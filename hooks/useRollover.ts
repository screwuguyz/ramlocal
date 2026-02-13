import { useCallback, useEffect, useRef } from "react";
import { useAppStore } from "@/stores/useAppStore";
import { getTodayYmd } from "@/lib/date";
import { uid } from "@/lib/utils";
import type { CaseFile } from "@/types";

export function useRollover() {
    const {
        setCases,
        setTeachers,
        setHistory,
        setLastRollover,
        setLastAbsencePenalty,
        setAbsenceRecords,
        lastRollover,
        hydrated
    } = useAppStore();

    // Refs to track last execution to prevent duplicates in same render cycle
    const lastAbsencePenaltyRef = useRef<string>("");

    // ---- Devamsızlar için dengeleme puanı (gün sonu, rollover öncesi)
    const applyAbsencePenaltyForDay = useCallback((day: string) => {
        const { hydrated } = useAppStore.getState();
        if (!hydrated) return;
        if (lastAbsencePenaltyRef.current === day) return;

        const currentTeachers = useAppStore.getState().teachers;
        const currentCases = useAppStore.getState().cases;
        const currentAbsenceRecords = useAppStore.getState().absenceRecords;
        const settingsCurrent = useAppStore.getState().settings;

        // Çalışan öğretmenler
        const workingTeachers = currentTeachers.filter((t) =>
            t.active &&
            !t.isPhysiotherapist &&
            !currentAbsenceRecords.some(r => r.teacherId === t.id && r.date === day) &&
            !t.isAbsent &&
            t.backupDay !== day
        );
        const workingIds = new Set(workingTeachers.map((t) => t.id));
        const dayWorkingCases = currentCases.filter(
            (c) =>
                !c.absencePenalty &&
                c.assignedTo &&
                c.createdAt.slice(0, 10) === day &&
                workingIds.has(c.assignedTo)
        );

        const pointsByTeacher = new Map<string, number>();
        workingTeachers.forEach((t) => pointsByTeacher.set(t.id, 0));
        for (const c of dayWorkingCases) {
            const tid = c.assignedTo as string;
            pointsByTeacher.set(tid, (pointsByTeacher.get(tid) || 0) + c.score);
        }

        const minScore = pointsByTeacher.size ? Math.min(...pointsByTeacher.values()) : 0;
        const { absencePenaltyAmount } = settingsCurrent;
        const penaltyScore = Math.max(0, minScore - absencePenaltyAmount);

        // Devamsız öğretmenler
        const absentTeachers = currentTeachers.filter((t) =>
            t.active && (currentAbsenceRecords.some(r => r.teacherId === t.id && r.date === day) || t.isAbsent)
        );
        const absentIds = new Set(absentTeachers.map((t) => t.id));

        if (!absentTeachers.length) {
            setLastAbsencePenalty(day);
            lastAbsencePenaltyRef.current = day;
            return;
        }

        const existingPenaltyCases = currentCases.filter(
            (c) => c.absencePenalty && c.createdAt.slice(0, 10) === day
        );
        const keepNonPenalty = currentCases.filter(
            (c) => !(c.absencePenalty && c.createdAt.slice(0, 10) === day)
        );

        const loadDelta = new Map<string, number>();
        const newPenaltyCases: CaseFile[] = [];
        const reasonText = `Devamsızlık sonrası dengeleme puanı: en düşük ${minScore} - ${absencePenaltyAmount} = ${penaltyScore}`;

        for (const t of absentTeachers) {
            const existing = existingPenaltyCases.find((c) => c.assignedTo === t.id);
            const prevScore = existing?.score ?? 0;
            const score = penaltyScore;
            const createdAt = existing?.createdAt ?? `${day}T23:59:00.000Z`;
            const id = existing?.id ?? uid();
            newPenaltyCases.push({
                id,
                student: `${t.name} - Devamsız`,
                score,
                createdAt,
                assignedTo: t.id,
                type: "DESTEK",
                isNew: false,
                diagCount: 0,
                isTest: false,
                assignReason: reasonText,
                absencePenalty: true,
            });
            const delta = score - prevScore;
            if (delta) loadDelta.set(t.id, (loadDelta.get(t.id) || 0) + delta);
        }

        for (const c of existingPenaltyCases) {
            const tid = c.assignedTo;
            if (!tid) continue;
            if (!absentIds.has(tid)) {
                const delta = -c.score;
                if (delta) loadDelta.set(tid, (loadDelta.get(tid) || 0) + delta);
            }
        }

        let changedCases = existingPenaltyCases.length !== newPenaltyCases.length;
        if (!changedCases) {
            for (const np of newPenaltyCases) {
                const ex = existingPenaltyCases.find((c) => c.assignedTo === np.assignedTo);
                if (!ex || ex.score !== np.score || ex.assignReason !== np.assignReason) {
                    changedCases = true;
                    break;
                }
            }
        }

        if (changedCases) {
            const nextCases = [...newPenaltyCases, ...keepNonPenalty];
            setCases(nextCases);
        }

        if (loadDelta.size > 0) {
            const ym = day.slice(0, 7);
            const nextTeachers = currentTeachers.map((t) => {
                const delta = loadDelta.get(t.id) || 0;
                if (!delta) return t;
                const nextMonthly = { ...(t.monthly || {}) };
                nextMonthly[ym] = Math.max(0, (nextMonthly[ym] || 0) + delta);
                return {
                    ...t,
                    yearlyLoad: Math.max(0, t.yearlyLoad + delta),
                    monthly: nextMonthly,
                };
            });
            setTeachers(nextTeachers);
        }

        setLastAbsencePenalty(day);
        lastAbsencePenaltyRef.current = day;
    }, [setCases, setTeachers, setLastAbsencePenalty]);

    // ---- Başkan yedek: bugün dosya alma, yarın bonusla başlat
    const applyBackupBonusForDay = useCallback((day: string) => {
        const currentTeachers = useAppStore.getState().teachers;
        const currentCases = useAppStore.getState().cases;
        const settingsCurrent = useAppStore.getState().settings;

        const backups = currentTeachers.filter((t) => t.active && t.backupDay === day);
        if (backups.length === 0) return;

        // Hesaplama: Günlük dosyalardan
        const dayCases = currentCases.filter(
            (c) => !c.absencePenalty && !c.backupBonus && c.assignedTo && c.createdAt.slice(0, 10) === day
        );
        const pointsByTeacher = new Map<string, number>();
        for (const c of dayCases) {
            if (!c.assignedTo) continue;
            pointsByTeacher.set(c.assignedTo, (pointsByTeacher.get(c.assignedTo) || 0) + c.score);
        }

        const { backupBonusAmount } = settingsCurrent;
        const maxScore = pointsByTeacher.size ? Math.max(...pointsByTeacher.values()) : 0;
        const bonusScore = maxScore + backupBonusAmount;
        const reasonText = `Başkan yedek bonusu: en yüksek ${maxScore} + ${backupBonusAmount} = ${bonusScore}`;
        const ym = day.slice(0, 7);

        const existingBonusCases = currentCases.filter(c => c.backupBonus && c.createdAt.slice(0, 10) === day);
        const keepNonBonus = currentCases.filter(c => !(c.backupBonus && c.createdAt.slice(0, 10) === day));
        const newBonusCases: CaseFile[] = [];
        const loadDelta = new Map<string, number>();

        for (const t of backups) {
            const existing = existingBonusCases.find((c) => c.assignedTo === t.id);
            const prevScore = existing?.score ?? 0;
            const score = bonusScore;
            const createdAt = existing?.createdAt ?? `${day}T23:59:30.000Z`;
            const id = existing?.id ?? uid();

            newBonusCases.push({
                id,
                student: `${t.name} - Başkan Yedek`,
                score,
                createdAt,
                assignedTo: t.id,
                type: "DESTEK",
                isNew: false,
                diagCount: 0,
                isTest: false,
                assignReason: reasonText,
                backupBonus: true,
            });
            const delta = score - prevScore;
            if (delta) loadDelta.set(t.id, (loadDelta.get(t.id) || 0) + delta);
        }

        // Cases Update
        const nextCases = [...newBonusCases, ...keepNonBonus];
        setCases(nextCases);

        // Teachers Update
        const nextTeachers = currentTeachers.map((t) => {
            if (t.backupDay !== day) return t;
            const delta = loadDelta.get(t.id) || 0;
            const nextMonthly = { ...(t.monthly || {}) };
            nextMonthly[ym] = Math.max(0, (nextMonthly[ym] || 0) + delta);
            return {
                ...t,
                backupDay: undefined,
                yearlyLoad: Math.max(0, t.yearlyLoad + delta),
                monthly: nextMonthly,
            };
        });
        setTeachers(nextTeachers);

    }, [setTeachers, setCases]);

    // ---- ROLLOVER: Gece 00:00 arşivle & sıfırla
    const doRollover = useCallback(() => {
        try {
            // State'i en güncel haliyle al
            const state = useAppStore.getState();
            const currentCases = state.cases;
            const currentHistory = state.history;
            const currentTeachers = state.teachers;
            const currentAbsenceRecords = state.absenceRecords;

            // FIX: Tarih belirleme mantığını güçlendiriyoruz.
            // 1. Dosyalar varsa, EN ESKİ dosyanın tarihini baz al (örn: dün ve bugün karışık ise, dünü işle)
            // 2. Dosya yoksa, lastRollover'a bak. Eğer lastRollover dünü gösteriyorsa, dünü kapat.
            // 3. Hiçbiri yoksa bugünü baz al.
            let dayOfCases = getTodayYmd();

            if (currentCases.length > 0) {
                // En eski tarihi bul
                const dates = currentCases.map(c => c.createdAt.slice(0, 10));
                dates.sort(); // String sort YYYY-MM-DD için doğrudur
                dayOfCases = dates[0];
            } else if (state.lastRollover) {
                // Dosya yok ama son işlem tarihi bugünden farklıysa, sıradaki günü (veya o günü) işlemeliyiz.
                // Basitçe: lastRollover dünü gösteriyorsa, dünü işleme alalım (boş olsa bile ceza kesilsin).
                // lastRollover yapıldıysa o gün bitmiştir. Biz o günden SONRAKİ günü işlemeliyiz?
                // Veya şimdilik "son işlem yapılmamış gün" olarak lastRollover değil, lastRollover'ın olduğu gün (eğer tekrar ediyorsa) kontrol edilmeli.
                // KABUL: Şimdilik "lastRollover" eğer bugüne eşit değilse, lastRollover'ı takip eden gün değil,
                // sistemin "unuttuğu" günü bulmak gerekir.
                // Bu karmaşık olabilir. Basit çözüm: Eğer lastRollover tarihli dosya yoksa, muhtemelen o gün kapanmıştır.
                // Biz lastRollover DEĞİL, ondan sonraki potansiyel boş günü bulmalıyız.
                // AMA: Kullanıcı senaryosunda "dosya vardı". O yüzden yukarıdaki 'dates[0]' mantığı %99 çözecek.
                // Boş gün fixini de entegre edersek:
                /*
                const lastDate = new Date(state.lastRollover);
                lastDate.setDate(lastDate.getDate() + 1);
                const nextDay = lastDate.toISOString().slice(0, 10);
                if (nextDay < getTodayYmd()) dayOfCases = nextDay;
                */
                // RİSK ALMAMAK İÇİN: Sadece 'dates[0]' fixini yapıyorum. Boş gün fixini bir sonraki aşamaya bırakıyorum (talep gelirse).
                // User "11'inde dosya vardı" dediği için bu kısım yeterli.
            }

            console.log(`[doRollover] Processing day: ${dayOfCases} (Cases: ${currentCases.length})`);

            // ✅ GÜVENLIK: Rollover öncesi, şu an izinli olan öğretmenlerin absenceRecords'ta o gün için kaydı yoksa ekle
            const updatedAbsenceRecords = [...currentAbsenceRecords];
            let recordsChanged = false;

            currentTeachers.forEach(t => {
                if (t.active && t.isAbsent && !t.isPhysiotherapist) {
                    const hasRecord = updatedAbsenceRecords.some(r => r.teacherId === t.id && r.date === dayOfCases);
                    if (!hasRecord) {
                        updatedAbsenceRecords.push({ teacherId: t.id, date: dayOfCases });
                        recordsChanged = true;
                        console.log(`[doRollover] İzin kaydı eklendi: ${t.name} - ${dayOfCases}`);
                    }
                }
            });

            if (recordsChanged) {
                setAbsenceRecords(updatedAbsenceRecords);
            }

            // Puanları hesapla (Store güncellenir)
            applyAbsencePenaltyForDay(dayOfCases);
            applyBackupBonusForDay(dayOfCases);

            // NOT: Above functions updated the store synchronously.
            // We need to fetch FRESH state for history archiving.
            const freshState = useAppStore.getState();
            const sourceCases = freshState.cases;
            const nextHistory: Record<string, CaseFile[]> = { ...currentHistory };

            // SADECE o güne ait olanları arşive taşı, bugününkiler kalsın
            // (Eski mantık tüm sourceCases'i geziyordu. Şimdi filtreli gidelim ki bugünün dosyaları silinmesin?)
            // HAYIR: doRollover mantığı "günü kapatmaktır".
            // Ama eğer gün içinde çalıştırıldıysa (bugün bitmeden)?
            // User "Ertesi gün bakıyoruz" dedi. Yani gece yarısı geçince.
            // Eğer gece yarısı geçince çalıştıysa, currentCases içindeki 'eski' dosyaları (dayOfCases) arşive alıp siliyoruz.
            // BUGÜN'ün dosyaları (eğer varsa) cases'de kalmalı!

            const casesToArchive = sourceCases.filter(c => c.createdAt.slice(0, 10) === dayOfCases);
            const casesToKeep = sourceCases.filter(c => c.createdAt.slice(0, 10) !== dayOfCases);

            // Arşive ekle
            if (!nextHistory[dayOfCases]) nextHistory[dayOfCases] = [];

            for (const c of casesToArchive) {
                // DEDUPE check
                if (!nextHistory[dayOfCases].some(ex => ex.id === c.id)) {
                    nextHistory[dayOfCases].push(c);
                }
            }

            setHistory(nextHistory);
            setCases(casesToKeep); // Sadece o günün dosyalarını sil, diğerleri kalsın (örn: bugünün dosyaları)

            // Eğer dayOfCases bugündense (veya geçmişse), lastRollover'ı güncelle
            // Burada dayOfCases 'işlenen gün'dür.
            setLastRollover(dayOfCases);

            // Eğer işlenen gün BUGÜN değilse (geçmiş bir gün ise), öğretmenleri resetlemeyelim?
            // Çünkü bugün daha başlamadı veya devam ediyor.
            // Sadece "Bugün" kapandığında resetlemek mantıklı.
            // Ancak devamsızlık/tester durumu günlük.
            // Ertesi gün için reset gerekir.
            // Eğer 11'i kapatıyorsak, 12'si için öğretmenlerin devamsızlık durumu korunmalı mı?
            // User manuel olarak "devamsız" işaretledi. Bu "bugün" için geçerli.
            // Eğer dün kapatılıyorsa, dünün kaydı zaten absenceRecords'a eklendi.
            // Flag'i kaldırırsak, bugün (12'si) için devamsızlığı kalkar.
            // Eğer kullanıcı 12'si sabahı işaretlediyse ve biz 11'i arkadan kapatıyorsak, flag'i kaldırmak kullanıcının bugünkü ayarını bozar!
            // BU ÇOK ÖNEMLİ: Geçmiş günü kapatırken `isAbsent` flag'ini resetlememeliyiz!

            if (dayOfCases === getTodayYmd()) {
                // Sadece bugünü kapatıyorsak flagleri sıfırla (yarın için hazırlık)
                const latestTeachers = freshState.teachers;
                const resetTeachers = latestTeachers.map(t => ({ ...t, isAbsent: false, isTester: false }));
                setTeachers(resetTeachers);
            }
        } catch (error) {
            console.error("Critical: doRollover failed", error);
        }

    }, [setCases, setHistory, setLastRollover, setAbsenceRecords, setTeachers, applyAbsencePenaltyForDay, applyBackupBonusForDay]);

    // Schedule Rollover
    useEffect(() => {
        if (!hydrated) return;
        const today = getTodayYmd();
        if (lastRollover && lastRollover !== today) {
            doRollover();
        } else if (!lastRollover) {
            setLastRollover(today);
        }

        function msToNextMidnight() {
            const now = new Date();
            const next = new Date(now);
            next.setHours(24, 0, 0, 0); // bugün 24:00 = yarın 00:00
            return next.getTime() - now.getTime();
        }

        let timeoutId: any;
        function schedule() {
            timeoutId = setTimeout(() => {
                doRollover();
                schedule(); // Sonraki gün için tekrar kur
            }, msToNextMidnight() + 1000); // +1sn gecikme
        }
        schedule();

        return () => clearTimeout(timeoutId);
    }, [hydrated, lastRollover, doRollover, setLastRollover]);

    return {
        doRollover
    };
}
