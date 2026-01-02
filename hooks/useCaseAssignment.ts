// ============================================
// RAM Dosya Atama - Case Assignment Hook
// ============================================

import { useMemo, useCallback } from "react";
import type { Teacher, CaseFile, Settings } from "@/types";
import { getTodayYmd, ymOf } from "@/lib/date";
import { logger } from "@/lib/logger";
import { notifyTeacher } from "@/lib/notifications";

interface UseCaseAssignmentProps {
  teachers: Teacher[];
  cases: CaseFile[];
  history: Record<string, CaseFile[]>;
  settings: Settings;
  onTeachersUpdate: (updater: (prev: Teacher[]) => Teacher[]) => void;
  onCaseAssigned?: (teacher: Teacher, caseFile: CaseFile) => void;
}

const MAX_DAILY_CASES = 4;

export function useCaseAssignment({
  teachers,
  cases,
  history,
  settings,
  onTeachersUpdate,
  onCaseAssigned,
}: UseCaseAssignmentProps) {
  // Bugün test alıp almadı kontrolü
  const hasTestToday = useCallback(
    (teacherId: string) => {
      const today = getTodayYmd();
      return cases.some(
        (c) =>
          c.isTest &&
          !c.absencePenalty &&
          c.assignedTo === teacherId &&
          c.createdAt.slice(0, 10) === today
      );
    },
    [cases]
  );

  // Bugün bu öğretmene kaç dosya atanmış
  const countCasesToday = useCallback(
    (teacherId: string) => {
      const today = getTodayYmd();
      let count = 0;
      for (const c of cases) {
        if (c.absencePenalty) continue;
        if (c.assignedTo === teacherId && c.createdAt.slice(0, 10) === today) {
          count++;
        }
      }
      return count;
    },
    [cases]
  );

  // Gerçek yıllık yükü hesapla
  const getRealYearlyLoad = useCallback(
    (teacherId: string): number => {
      const currentYear = new Date().getFullYear();
      let total = 0;

      // History'den bu yılın puanlarını topla
      Object.entries(history).forEach(([date, dayCases]) => {
        if (date.startsWith(String(currentYear))) {
          dayCases.forEach((c) => {
            if (c.assignedTo === teacherId) {
              total += c.score;
            }
          });
        }
      });

      // Bugünün cases'lerinden de topla
      cases.forEach((c) => {
        if (
          c.assignedTo === teacherId &&
          c.createdAt.startsWith(String(currentYear))
        ) {
          total += c.score;
        }
      });

      return total;
    },
    [cases, history]
  );

  // Bugün en son kime atama yapıldı?
  const lastAssignedTeacherToday = useCallback((): string | undefined => {
    const today = getTodayYmd();
    const recent = cases.find(
      (c) =>
        !c.absencePenalty &&
        c.createdAt.slice(0, 10) === today &&
        !!c.assignedTo
    );
    return recent?.assignedTo;
  }, [cases]);

  // Otomatik atama
  const autoAssign = useCallback(
    (newCase: CaseFile): Teacher | null => {
      const todayYmd = getTodayYmd();
      const lastTid = lastAssignedTeacherToday();
      const currentYear = new Date().getFullYear();
      const previousYear = currentYear - 1;

      // Yeni yıl ilk atama kontrolü
      const isFirstOfYear = !cases.some(
        (c) => c.createdAt.startsWith(String(currentYear)) && c.assignedTo
      );

      // Geçen yılın toplam puanını hesapla
      const getPreviousYearLoad = (tid: string): number => {
        let total = 0;
        Object.entries(history).forEach(([date, dayCases]) => {
          if (date.startsWith(String(previousYear))) {
            dayCases.forEach((c) => {
              if (c.assignedTo === tid) {
                total += c.score;
              }
            });
          }
        });
        return total;
      };

      // Test dosyasıysa: sadece testörler ve bugün test almamış olanlar
      if (newCase.isTest) {
        let testers = teachers.filter(
          (t) =>
            t.isTester &&
            !t.isAbsent &&
            t.active &&
            t.backupDay !== todayYmd &&
            !hasTestToday(t.id) &&
            countCasesToday(t.id) < MAX_DAILY_CASES
        );

        if (!testers.length) return null;

        // Zorunlu rotasyon: Son atanan kişiyi listeden çıkar
        if (testers.length > 1 && lastTid) {
          testers = testers.filter((t) => t.id !== lastTid);
        }

        // Yeni yıl ilk atama: Geçen yılın en düşük puanlısını seç
        if (isFirstOfYear) {
          testers.sort(
            (a, b) => getPreviousYearLoad(a.id) - getPreviousYearLoad(b.id)
          );
        } else {
          // Sıralama: 1) Yıllık yük en az, 2) Bugün en az dosya alan, 3) Rastgele
          testers.sort((a, b) => {
            const byLoad = getRealYearlyLoad(a.id) - getRealYearlyLoad(b.id);
            if (byLoad !== 0) return byLoad;
            const byCount = countCasesToday(a.id) - countCasesToday(b.id);
            if (byCount !== 0) return byCount;
            return Math.random() - 0.5;
          });
        }

        const chosen = testers[0];

        const ym = ymOf(newCase.createdAt);
        onTeachersUpdate((prev) =>
          prev.map((t) =>
            t.id === chosen.id
              ? {
                  ...t,
                  yearlyLoad: t.yearlyLoad + newCase.score,
                  monthly: {
                    ...(t.monthly || {}),
                    [ym]: (t.monthly?.[ym] || 0) + newCase.score,
                  },
                }
              : t
          )
        );

        newCase.assignedTo = chosen.id;
        notifyTeacher(chosen.pushoverKey || "", "Yeni Test Dosyası", `Öğrenci: ${newCase.student}`);
        onCaseAssigned?.(chosen, newCase);
        return chosen;
      }

      // Normal dosya
      let available = teachers.filter(
        (t) =>
          !t.isAbsent &&
          t.active &&
          t.backupDay !== todayYmd &&
          countCasesToday(t.id) < settings.dailyLimit
      );

      if (!available.length) return null;

      // Zorunlu rotasyon: Son atanan kişiyi listeden çıkar
      if (available.length > 1 && lastTid) {
        available = available.filter((t) => t.id !== lastTid);
      }

      // Yeni yıl ilk atama: Geçen yılın en düşük puanlısını seç
      if (isFirstOfYear) {
        available.sort(
          (a, b) => getPreviousYearLoad(a.id) - getPreviousYearLoad(b.id)
        );
      } else {
        // Sıralama: 1) Yıllık yük en az, 2) Bugün en az dosya alan, 3) Rastgele
        available.sort((a, b) => {
          const byLoad = getRealYearlyLoad(a.id) - getRealYearlyLoad(b.id);
          if (byLoad !== 0) return byLoad;
          const byCount = countCasesToday(a.id) - countCasesToday(b.id);
          if (byCount !== 0) return byCount;
          return Math.random() - 0.5;
        });
      }

      const chosen = available[0];

      const ym = ymOf(newCase.createdAt);
      onTeachersUpdate((prev) =>
        prev.map((t) =>
          t.id === chosen.id
            ? {
                ...t,
                yearlyLoad: t.yearlyLoad + newCase.score,
                monthly: {
                  ...(t.monthly || {}),
                  [ym]: (t.monthly?.[ym] || 0) + newCase.score,
                  },
                }
              : t
        )
      );

      newCase.assignedTo = chosen.id;
      notifyTeacher(chosen.pushoverKey || "", "Yeni Dosya Atandı", `Öğrenci: ${newCase.student}`);
      onCaseAssigned?.(chosen, newCase);
      return chosen;
    },
    [
      teachers,
      cases,
      history,
      settings,
      hasTestToday,
      countCasesToday,
      getRealYearlyLoad,
      lastAssignedTeacherToday,
      onTeachersUpdate,
      onCaseAssigned,
    ]
  );

  return {
    hasTestToday,
    countCasesToday,
    getRealYearlyLoad,
    lastAssignedTeacherToday,
    autoAssign,
  };
}

