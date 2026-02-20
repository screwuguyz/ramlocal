// ============================================
// RAM Dosya Atama - Scoring Utilities
// ============================================

import type { Teacher, CaseFile, Settings, CaseType } from "@/types";
import { CASE_TYPE_LABELS } from "@/lib/constants";

/**
 * Calculate score for a case based on settings
 */
export function calculateScore(
    caseData: {
        type: CaseType;
        isNew: boolean;
        diagCount: number;
        isTest: boolean;
    },
    settings: Settings
): number {
    let score = 0;

    // Base score by type
    switch (caseData.type) {
        case "YONLENDIRME":
            score = settings.scoreTypeY;
            break;
        case "DESTEK":
            score = settings.scoreTypeD;
            break;
        case "IKISI":
            score = settings.scoreTypeI;
            break;
    }

    // New case bonus
    if (caseData.isNew) {
        score += settings.scoreNewBonus;
    }

    // Diagnosis count adds to score
    score += caseData.diagCount;

    // Test case multiplier
    if (caseData.isTest) {
        score = settings.scoreTest;
    }

    return score;
}

/**
 * Get today's load for a teacher
 */
export function getTeacherDailyLoad(
    teacher: Teacher,
    cases: CaseFile[]
): number {
    return cases.filter((c) => c.assignedTo === teacher.id).length;
}

/**
 * Get monthly load for a teacher
 */
export function getTeacherMonthlyLoad(
    teacher: Teacher,
    yearMonth: string
): number {
    return teacher.monthly?.[yearMonth] || 0;
}

/**
 * Calculate total yearly load for a teacher
 */
export function getTeacherYearlyLoad(teacher: Teacher): number {
    return teacher.yearlyLoad;
}

/**
 * Find the best teacher for assignment
 * Returns teacher with lowest yearly load that hasn't hit daily limit
 */
export function findBestTeacher(
    teachers: Teacher[],
    cases: CaseFile[],
    settings: Settings,
    options?: {
        excludeIds?: string[];
        forTestCase?: boolean;
        history?: Record<string, CaseFile[]>;
    }
): Teacher | null {
    // Bugünün tarihi (yedek günü kontrolü için)
    const todayYmd = new Date().toISOString().slice(0, 10);

    // Son atanan öğretmeni bul (rotasyon için)
    const sortedCases = [...cases].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const lastAssignedId = sortedCases.find(c => c.assignedTo)?.assignedTo;

    let activeTeachers = teachers.filter((t) => {
        if (!t.active) return false;
        if (t.isAbsent) return false;
        if (t.backupDay === todayYmd) return false; // Yedek günü olanları hariç tut
        if (t.isPhysiotherapist) return false; // Fizyoterapistleri otomatik atamadan hariç tut
        if (["Furkan Ata ADIYAMAN", "Furkan Ata"].includes(t.name)) return false; // İsimle hariç tut (Legacy data fix)
        if (options?.excludeIds?.includes(t.id)) return false;
        if (options?.forTestCase && !t.isTester) return false;
        return true;
    });

    if (activeTeachers.length === 0) return null;

    // 🔄 ZORUNLU ROTASYON: Son atanan kişiyi listeden çıkar (birden fazla aday varsa)
    if (activeTeachers.length > 1 && lastAssignedId) {
        activeTeachers = activeTeachers.filter(t => t.id !== lastAssignedId);
    }

    // Bugünkü cases'lerden öğretmen başına dosya sayısını hesapla
    const todayCounts: Record<string, number> = {};
    cases.forEach(c => {
        if (c.assignedTo && !c.absencePenalty) {
            todayCounts[c.assignedTo] = (todayCounts[c.assignedTo] || 0) + 1;
        }
    });

    // Yıllık yük = teacher.yearlyLoad (atama anında güncelleniyor, güvenilir)
    // NOT: Bugünkü skorları EKLEMEMEYE dikkat - yearlyLoad zaten güncel
    const getEffectiveLoad = (t: Teacher): number => {
        return t.yearlyLoad;
    };

    // Bugün aldığı dosya sayısı
    const getTodayCount = (t: Teacher): number => {
        return todayCounts[t.id] || 0;
    };

    // Bu ay aldığı dosya sayısı (Aylık Adet) - history dahil
    const getMonthlyCount = (t: Teacher): number => {
        const now = new Date();
        const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        let count = 0;

        // 1. History'den bu ayki dosyaları say
        if (options?.history) {
            Object.entries(options.history).forEach(([date, dayCases]) => {
                if (date.startsWith(ym)) {
                    dayCases.forEach(c => {
                        if (c.assignedTo === t.id && !c.absencePenalty) count++;
                    });
                }
            });
        }

        // 2. Bugünkü cases'lerden de say
        cases.forEach(c => {
            if (c.assignedTo === t.id && c.createdAt.startsWith(ym) && !c.absencePenalty) count++;
        });

        return count;
    };

    // Sıralama: 1) Yıllık yük, 2) Günlük dosya, 3) Aylık adet, 4) ID (tutarlılık için)
    const sorted = [...activeTeachers].sort((a, b) => {
        // 1. Yıllık yük (en düşük önce)
        const byLoad = getEffectiveLoad(a) - getEffectiveLoad(b);
        if (byLoad !== 0) return byLoad;
        // 2. Günlük dosya sayısı (en düşük önce)
        const byDailyCount = getTodayCount(a) - getTodayCount(b);
        if (byDailyCount !== 0) return byDailyCount;
        // 3. Aylık adet (en düşük önce)
        const byMonthlyCount = getMonthlyCount(a) - getMonthlyCount(b);
        if (byMonthlyCount !== 0) return byMonthlyCount;
        // 4. ID ile tutarlı sıralama (rastgele değil)
        return a.id.localeCompare(b.id);
    });

    // Filter out teachers who hit daily limit
    const available = sorted.filter((t) => {
        return getTodayCount(t) < settings.dailyLimit;
    });

    return available[0] || null;
}

/**
 * Get human-readable case type
 */
export function humanType(v?: CaseType): string {
    if (!v) return "—";
    return CASE_TYPE_LABELS[v] || "—";
}

/**
 * Generate case description string
 */
export function caseDescription(caseData: CaseFile): string {
    if (caseData.absencePenalty) {
        return caseData.assignReason || "Devamsızlık sonrası denge puanı (otomatik)";
    }
    let diagLabel = `Tanı: ${caseData.diagCount ?? 0}`;
    if (caseData.diagnoses && caseData.diagnoses.length > 0) {
        diagLabel = `Tanı: ${caseData.diagnoses.join(", ")}`;
    }
    let s = `Tür: ${humanType(caseData.type)} • Yeni: ${caseData.isNew ? "Evet" : "Hayır"} • ${diagLabel}`;
    if (caseData.isTest) s += " • Test";
    if (caseData.assignReason) s += ` • Neden: ${caseData.assignReason}`;
    // Okul Öncesi + Yönlendirme/İkisi ise yönlendirme bilgisini göster
    if (caseData.grade && caseData.grade.startsWith("Okul Öncesi") && (caseData.type === "YONLENDIRME" || caseData.type === "IKISI")) {
        const subLabel = caseData.grade.includes("(") ? caseData.grade : "";
        s += ` • Yönlendirme: Evet${subLabel ? ` (${subLabel.replace("Okul Öncesi ", "")})` : ""}`;
    }
    return s;
}

/**
 * Calculate backup bonus for a teacher
 */
export function calculateBackupBonus(
    teachers: Teacher[],
    settings: Settings
): number {
    // Find the highest yearly load
    const maxLoad = Math.max(...teachers.map((t) => t.yearlyLoad), 0);
    // Backup bonus puts them at max + backupBonusAmount
    return maxLoad + settings.backupBonusAmount;
}

/**
 * Calculate absence penalty for a teacher
 */
export function calculateAbsencePenalty(
    teachers: Teacher[],
    settings: Settings
): number {
    // Find the lowest yearly load
    const minLoad = Math.min(
        ...teachers.filter((t) => t.active).map((t) => t.yearlyLoad),
        0
    );
    // Absence penalty puts them at min - absencePenaltyAmount
    return Math.max(0, minLoad - settings.absencePenaltyAmount);
}

/**
 * Sort teachers by daily load then yearly load
 */
export function sortTeachersByLoad(
    teachers: Teacher[],
    cases: CaseFile[]
): Teacher[] {
    return [...teachers].sort((a, b) => {
        const dailyA = getTeacherDailyLoad(a, cases);
        const dailyB = getTeacherDailyLoad(b, cases);
        if (dailyA !== dailyB) return dailyA - dailyB;
        return a.yearlyLoad - b.yearlyLoad;
    });
}

/**
 * Get statistics summary
 */
export function getStatsSummary(
    teachers: Teacher[],
    cases: CaseFile[],
    history: Record<string, CaseFile[]>
) {
    const activeTeachers = teachers.filter((t) => t.active);
    const totalCasesToday = cases.length;
    const assignedToday = cases.filter((c) => c.assignedTo).length;

    // All-time totals from history
    const allCases = Object.values(history).flat();
    const totalAllTime = allCases.length + totalCasesToday;

    return {
        totalTeachers: activeTeachers.length,
        totalCasesToday,
        assignedToday,
        unassignedToday: totalCasesToday - assignedToday,
        totalAllTime,
    };
}
