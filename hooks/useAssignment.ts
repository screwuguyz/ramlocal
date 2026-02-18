import { useCallback, useEffect } from "react";
import { useAppStore } from "@/stores/useAppStore";
import { getTodayYmd, nowISO, ymOf } from "@/lib/date";
import { notifyTeacher } from "@/lib/notifications";
import type { CaseFile, Teacher } from "@/types";

export function useAssignment() {
    const {
        teachers,
        cases,
        history,
        settings,
        updateTeacher,
        addCase: addCaseAction, // Alias to avoid conflict if we export addCase
    } = useAppStore();

    const MAX_DAILY_CASES = 4; // Constant from page.tsx (or should be in settings?)

    // ---- Helper Functions

    const getRealYearlyLoad = useCallback((tid: string): number => {
        const currentYear = new Date().getFullYear();
        const seenIds = new Set<string>();

        // Başlangıç Puanı (Manuel eklenen)
        const teacher = teachers.find(t => t.id === tid);
        let total = teacher?.startingLoad || 0;

        // History'den bu yılın puanlarını topla
        Object.entries(history).forEach(([date, dayCases]) => {
            if (date.startsWith(String(currentYear))) {
                dayCases.forEach(c => {
                    if (c.assignedTo === tid && c.id && !seenIds.has(c.id)) {
                        seenIds.add(c.id);
                        total += c.score;
                    }
                });
            }
        });

        // Bugünün cases'lerinden de topla
        cases.forEach(c => {
            if (c.assignedTo === tid && c.createdAt.startsWith(String(currentYear)) && c.id && !seenIds.has(c.id)) {
                seenIds.add(c.id);
                total += c.score;
            }
        });

        return total;
    }, [history, cases]);

    // SYNC: Öğretmenlerin kayıtlı yıllık yükünü, gerçek hesaplamayla eşitle
    useEffect(() => {
        const timer = setTimeout(() => {
            teachers.forEach(t => {
                // 1. Calculate Score based on History + Today Cases (ignoring current startingLoad for a moment)
                // We need a version of getRealYearlyLoad that doesn't use t.startingLoad, but we can just subtract it if needed
                // OR we can copy the logic here for clarity since we are doing a migration

                const currentYear = new Date().getFullYear();
                const seenIds = new Set<string>();
                let casesScore = 0;

                // History
                Object.entries(history).forEach(([date, dayCases]) => {
                    if (date.startsWith(String(currentYear))) {
                        dayCases.forEach(c => {
                            if (c.assignedTo === t.id && c.id && !seenIds.has(c.id)) {
                                seenIds.add(c.id);
                                casesScore += c.score;
                            }
                        });
                    }
                });

                // Today
                cases.forEach(c => {
                    if (c.assignedTo === t.id && c.createdAt.startsWith(String(currentYear)) && c.id && !seenIds.has(c.id)) {
                        seenIds.add(c.id);
                        casesScore += c.score;
                    }
                });

                // 2. SELF-HEALING: If startingLoad is missing but we have a valid yearlyLoad, infer startingLoad
                if (t.startingLoad === undefined && t.yearlyLoad > 0) {
                    // Assume the difference is the starting load
                    const inferredStartingLoad = Math.max(0, t.yearlyLoad - casesScore);
                    console.log(`[AutoAssign] 🩹 Backfilling startingLoad for ${t.name}: ${inferredStartingLoad} (Yearly: ${t.yearlyLoad}, Cases: ${casesScore})`);

                    // Update with inferred startingLoad
                    updateTeacher(t.id, { startingLoad: inferredStartingLoad, yearlyLoad: t.yearlyLoad });
                    return; // Skip the standard update this cycle to let this save
                }

                // 3. Standard Sync
                const real = (t.startingLoad || 0) + casesScore;
                if (t.yearlyLoad !== real) {
                    // Only update if difference is meaningful or we trust our calculation
                    // Prevent zero-reset if we are unsure? No, logic above handles the 'undefined' case.
                    // If startingLoad IS defined (e.g. 0), then we trust the calc.
                    console.log(`[AutoAssign] Updating score for ${t.name}: ${t.yearlyLoad} -> ${real}`);
                    updateTeacher(t.id, { yearlyLoad: real });
                }
            });
        }, 1000);
        return () => clearTimeout(timer);
    }, [cases, history, teachers, updateTeacher]);

    const countCasesToday = useCallback((tid: string) => {
        const today = getTodayYmd();
        let n = 0;
        for (const c of cases) {
            if (c.absencePenalty) continue;
            if (c.assignedTo === tid && c.createdAt.slice(0, 10) === today) n++;
        }
        return n;
    }, [cases]);

    const hasTestToday = useCallback((tid: string) => {
        const today = getTodayYmd();
        return cases.some(c => c.isTest && !c.absencePenalty && c.assignedTo === tid && c.createdAt.slice(0, 10) === today);
    }, [cases]);

    const countCasesThisMonth = useCallback((tid: string): number => {
        const now = new Date();
        const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const seenIds = new Set<string>();
        let count = 0;

        // History'den bu ayın dosyalarını say
        Object.entries(history).forEach(([date, dayCases]) => {
            if (date.startsWith(ym)) {
                dayCases.forEach(c => {
                    if (c.assignedTo === tid && !c.absencePenalty && !c.backupBonus && c.id && !seenIds.has(c.id)) {
                        seenIds.add(c.id);
                        count++;
                    }
                });
            }
        });

        // Bugünün cases'lerinden de say
        cases.forEach(c => {
            if (c.assignedTo === tid && c.createdAt.startsWith(ym) && !c.absencePenalty && !c.backupBonus && c.id && !seenIds.has(c.id)) {
                seenIds.add(c.id);
                count++;
            }
        });

        return count;
    }, [cases, history]);

    const lastAssignedTeacherToday = useCallback((): string | undefined => {
        const today = getTodayYmd();
        // Sıralama yap (yeni > eski) ve ilkini al
        const todayCases = cases.filter(c => !c.absencePenalty && c.createdAt.slice(0, 10) === today && !!c.assignedTo);
        if (!todayCases.length) return undefined;

        // Create a copy to sort to avoid mutating state directly (though filter creates new array, objects are ref)
        // Actually filter returns array of references. Sort mutates the array.
        // Since todayCases is a new array from filter, sorting it is safe for the array itself.
        todayCases.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return todayCases[0].assignedTo;
    }, [cases]);

    // ---- Assignment Logic

    const autoAssign = useCallback((newCase: CaseFile): Teacher | null => {
        try {
            const todayYmd = getTodayYmd();
            const lastTid = lastAssignedTeacherToday();
            const currentYear = new Date().getFullYear();
            const previousYear = currentYear - 1;

            // FIX (v2.2): isFirstOfYear disabled
            const isFirstOfYear = false;

            // Passed to avoid huge closure, or just defined here?
            // Defined inside since it needs history and is specific.
            function getPreviousYearLoad(tid: string): number {
                // Since we are inside hook, we can access 'history' from scope? 
                // Need to be careful about stale closures if 'history' changes but 'autoAssign' not recreated?
                // 'autoAssign' has dependency [history].
                // But better to use useAppStore.getState() inside critical implementations?
                // For read-only calculations during a transient action, props are usually fine if dependencies are correct.
                let total = 0;
                Object.entries(history).forEach(([date, dayCases]) => {
                    if (date.startsWith(String(previousYear))) {
                        dayCases.forEach(c => {
                            if (c.assignedTo === tid) {
                                total += c.score;
                            }
                        });
                    }
                });
                return total;
            }

            // Test dosyasıysa
            if (newCase.isTest) {
                let testers = teachers.filter(
                    (t) => !t.isPhysiotherapist && !["Furkan Ata ADIYAMAN", "Furkan Ata"].includes(t.name) && t.isTester && !t.isAbsent && t.active && t.backupDay !== todayYmd && !hasTestToday(t.id) && countCasesToday(t.id) < MAX_DAILY_CASES
                );
                if (!testers.length) return null;

                if (testers.length > 1 && lastTid) {
                    testers = testers.filter(t => t.id !== lastTid);
                }

                if (isFirstOfYear) {
                    testers.sort((a, b) => getPreviousYearLoad(a.id) - getPreviousYearLoad(b.id));
                } else {
                    testers.sort((a, b) => {
                        const byLoad = a.yearlyLoad - b.yearlyLoad;
                        if (byLoad !== 0) return byLoad;
                        const byCount = countCasesToday(a.id) - countCasesToday(b.id);
                        if (byCount !== 0) return byCount;
                        const byMonthly = countCasesThisMonth(a.id) - countCasesThisMonth(b.id);
                        if (byMonthly !== 0) return byMonthly;
                        return Math.random() - 0.5;
                    });
                }

                const chosen = testers[0];
                const ym = ymOf(newCase.createdAt);

                updateTeacher(chosen.id, {
                    yearlyLoad: chosen.yearlyLoad + newCase.score,
                    monthly: { ...(chosen.monthly || {}), [ym]: (chosen.monthly?.[ym] || 0) + newCase.score },
                });

                newCase.assignedTo = chosen.id;
                notifyTeacher(chosen.pushoverKey || "", "Dosya Atandı (Test)", `Öğrenci: ${newCase.student}`, 0, chosen.id);
                return chosen;
            }

            // Normal Dosya
            let available = teachers.filter(
                (t) => !t.isPhysiotherapist && !["Furkan Ata ADIYAMAN", "Furkan Ata"].includes(t.name) && !t.isAbsent && t.active && t.backupDay !== todayYmd && countCasesToday(t.id) < settings.dailyLimit
            );
            if (!available.length) return null;

            if (available.length > 1 && lastTid) {
                available = available.filter(t => t.id !== lastTid);
            }

            if (isFirstOfYear) {
                available.sort((a, b) => getPreviousYearLoad(a.id) - getPreviousYearLoad(b.id));
            } else {
                available.sort((a, b) => {
                    const byLoad = getRealYearlyLoad(a.id) - getRealYearlyLoad(b.id);
                    if (byLoad !== 0) return byLoad;
                    const byCount = countCasesToday(a.id) - countCasesToday(b.id);
                    if (byCount !== 0) return byCount;
                    const byMonthly = countCasesThisMonth(a.id) - countCasesThisMonth(b.id);
                    if (byMonthly !== 0) return byMonthly;
                    return Math.random() - 0.5;
                });
            }

            const chosen = available[0];

            // DEBUG ALERT LOGIC REMOVED/OMITTED FOR CLEANUP - User can add back if needed

            const ym = ymOf(newCase.createdAt);

            updateTeacher(chosen.id, {
                yearlyLoad: chosen.yearlyLoad + newCase.score,
                monthly: { ...(chosen.monthly || {}), [ym]: (chosen.monthly?.[ym] || 0) + newCase.score },
            });

            newCase.assignedTo = chosen.id;
            notifyTeacher(chosen.pushoverKey || "", "Dosya Atandı", `Öğrenci: ${newCase.student}`, 0, chosen.id);
            return chosen;
        } catch (error) {
            console.error("Critical AutoAssign Error:", error);
            return null;
        }

    }, [teachers, history, settings, updateTeacher, getRealYearlyLoad, countCasesToday, countCasesThisMonth, hasTestToday, lastAssignedTeacherToday]);


    const autoAssignWithTestCheck = useCallback((newCase: CaseFile, skipTeacherIds: string[] = []): { chosen: Teacher | null; needsConfirm: boolean; pendingCase?: CaseFile; confirmType?: 'testNotFinished' | 'testerProtection' } => {
        try {
            const todayYmd = getTodayYmd();

            // Test dosyası normal akışla gider
            if (newCase.isTest) {
                const chosen = autoAssign(newCase);
                return { chosen, needsConfirm: false };
            }

            // Normal dosya için available listesi
            let available = teachers.filter(
                (t) => !t.isPhysiotherapist && !["Furkan Ata ADIYAMAN", "Furkan Ata"].includes(t.name) && !t.isAbsent && t.active && t.backupDay !== todayYmd && countCasesToday(t.id) < settings.dailyLimit && !skipTeacherIds.includes(t.id)
            );
            if (!available.length) return { chosen: null, needsConfirm: false };

            const lastTid = lastAssignedTeacherToday();
            if (available.length > 1 && lastTid) {
                available = available.filter(t => t.id !== lastTid);
            }

            available.sort((a, b) => {
                const byLoad = getRealYearlyLoad(a.id) - getRealYearlyLoad(b.id);
                if (byLoad !== 0) return byLoad;
                const byCount = countCasesToday(a.id) - countCasesToday(b.id);
                if (byCount !== 0) return byCount;
                const byMonthly = countCasesThisMonth(a.id) - countCasesThisMonth(b.id);
                if (byMonthly !== 0) return byMonthly;
                return Math.random() - 0.5;
            });

            const chosen = available[0];

            // Test Kontrolü
            if (chosen.isTester && hasTestToday(chosen.id)) {
                // Bugün test almış bir testöre normal dosya geldi -> SOR
                return { chosen, needsConfirm: true, pendingCase: newCase, confirmType: "testNotFinished" };
            }

            if (chosen.isTester) {
                // Testör ama henüz test almamış -> KORUMA SORUSU
                return { chosen, needsConfirm: true, pendingCase: newCase, confirmType: "testerProtection" };
            }

            // Proceed to assign
            const ym = ymOf(newCase.createdAt);
            updateTeacher(chosen.id, {
                yearlyLoad: chosen.yearlyLoad + newCase.score,
                monthly: { ...(chosen.monthly || {}), [ym]: (chosen.monthly?.[ym] || 0) + newCase.score },
            });
            newCase.assignedTo = chosen.id;
            notifyTeacher(chosen.pushoverKey || "", "Dosya Atandı", `Öğrenci: ${newCase.student}`, 0, chosen.id);

            return { chosen, needsConfirm: false };
        } catch (error) {
            console.error("AutoAssign Error:", error);
            // Log to server/file if logger is available in this scope?
            // Assuming logger is not imported here, standard console.error is fallback.
            // If we want to use the global logger, we need to import it.
            // But for now, returning safe null prevents crash.
            return { chosen: null, needsConfirm: false };
        }

    }, [teachers, settings, countCasesToday, lastAssignedTeacherToday, getRealYearlyLoad, countCasesThisMonth, hasTestToday, updateTeacher, autoAssign]);

    return {
        autoAssign,
        autoAssignWithTestCheck,
        getRealYearlyLoad,
        countCasesToday,
        countCasesThisMonth,
        hasTestToday,
        lastAssignedTeacherToday
    };
}
