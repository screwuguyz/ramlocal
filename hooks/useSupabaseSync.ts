// ============================================
// RAM Dosya Atama - Supabase Sync Hook
// ============================================

"use client";

import { useEffect, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useAppStore } from "@/stores/useAppStore";
import { getTodayYmd } from "@/lib/date";
import { loadThemeFromSupabase, getThemeMode } from "@/lib/theme";
import { REALTIME_CHANNEL, API_ENDPOINTS } from "@/lib/constants";
import type { Teacher, CaseFile, Settings, EArchiveEntry, AbsenceRecord, QueueTicket } from "@/types";

// Generate unique client ID
function uid(): string {
    return Math.random().toString(36).slice(2, 9);
}

interface SupabaseSyncHook {
    fetchCentralState: () => Promise<void>;
    syncToServer: () => Promise<void>;
    isConnected: boolean;
}

export function useSupabaseSync(onRealtimeEvent?: (payload: any) => void): SupabaseSyncHook {
    const clientId = useRef(uid());
    const channelRef = useRef<RealtimeChannel | null>(null);
    const lastAppliedAtRef = useRef<string>("");

    // Store selectors
    const {
        teachers,
        cases,
        history,
        settings,
        eArchive,
        announcements,
        absenceRecords,
        lastRollover,
        lastAbsencePenalty,
        hydrated,
        liveStatus,
        setTeachers,
        setCases,
        setHistory,
        setSettings,
        setEArchive,
        setAnnouncements,
        setAbsenceRecords,
        setLastRollover,
        setLastAbsencePenalty,
        setLiveStatus,
        setHydrated,
        addToast,
        queue,
        setQueue,
        agendaNotes, // NEW
        setAgendaNotes, // NEW
    } = useAppStore();

    // Keep refs in sync with state
    const teachersRef = useRef<Teacher[]>([]);
    const casesRef = useRef<CaseFile[]>([]);
    const lastAbsencePenaltyRef = useRef<string>("");
    const supabaseTeacherCountRef = useRef<number>(0);

    // Track local edits/deletes to prevent immediate overwrite by server
    const lastLocalEditRef = useRef<Record<string, number>>({});
    const lastLocalDeleteRef = useRef<Record<string, number>>({});

    // Detect local teacher changes (Edit/New/Delete) to set "protection lock"
    useEffect(() => {
        // 1. Detect Edits & Adds
        if (teachers.length > 0) {
            teachers.forEach(t => {
                const oldT = teachersRef.current.find(old => old.id === t.id);
                // If teacher is NEW or changed locally, set protection lock for 15 seconds
                if (!oldT) {
                    lastLocalEditRef.current[t.id] = Date.now();
                    console.log(`[Sync] New teacher detected ${t.name}, locking sync for 15s`);
                } else if (oldT.yearlyLoad !== t.yearlyLoad || oldT.active !== t.active) {
                    lastLocalEditRef.current[t.id] = Date.now();
                    console.log(`[Sync] Local edit detected for ${t.name}, locking sync for 15s`);
                }
            });
        }

        // 2. Detect Deletions
        if (teachersRef.current.length > 0) {
            const currentIds = new Set(teachers.map(t => t.id));
            teachersRef.current.forEach(oldT => {
                if (!currentIds.has(oldT.id)) {
                    // This teacher was deleted locally
                    lastLocalDeleteRef.current[oldT.id] = Date.now();
                    console.log(`[Sync] Local teacher delete detected: ${oldT.name}, permanently blocking resurrection`);
                }
            });
        }

        teachersRef.current = teachers;
    }, [teachers]);

    // Detect local case deletions (Zombie Protection)
    useEffect(() => {
        if (casesRef.current.length > 0) {
            const currentIds = new Set(cases.map(c => c.id));
            casesRef.current.forEach(oldCase => {
                if (!currentIds.has(oldCase.id)) {
                    // This case was deleted locally
                    lastLocalDeleteRef.current[oldCase.id] = Date.now();
                    console.log(`[Sync] Local delete detected: ${oldCase.student}, permanently blocking resurrection`);
                }
            });
        }
        casesRef.current = cases;
    }, [cases]);

    useEffect(() => {
        lastAbsencePenaltyRef.current = lastAbsencePenalty;
    }, [lastAbsencePenalty]);

    // Fetch central state from API
    const fetchCentralState = useCallback(async () => {
        try {
            // 1. Check version first (Lightweight)
            const checkRes = await fetch(`${API_ENDPOINTS.STATE_CHECK || "/api/state-check"}?ts=${Date.now()}`, {
                cache: "no-store",
            });

            if (checkRes.ok) {
                const checkData = await checkRes.json();
                const remoteTs = Date.parse(String(checkData.updatedAt || 0));
                const localTs = Date.parse(String(lastAppliedAtRef.current || 0));

                // If remote is not newer, skip full fetch
                // (Allow 1s difference to avoid micro-sync issues)
                if (!isNaN(remoteTs) && !isNaN(localTs) && remoteTs <= localTs) {
                    // console.log("[Sync] Skipping fetch, data is up to date.");
                    return;
                }
            }

            // 2. Fetch Full State
            const res = await fetch(`${API_ENDPOINTS.STATE}?ts=${Date.now()}`, {
                cache: "no-store",
            });
            if (!res.ok) {
                console.error("[fetchCentralState] HTTP error:", res.status);
                return;
            }
            const s = await res.json();

            // Log Supabase errors
            if (s._error) {
                console.error("[fetchCentralState] Supabase error:", s._error);
                addToast(`Supabase bağlantı hatası: ${s._error}`);
            }

            // Store Supabase teacher count for protection
            const supabaseTeacherCount = s.teachers?.length || 0;
            supabaseTeacherCountRef.current = supabaseTeacherCount;

            // Update reference timestamp
            lastAppliedAtRef.current = s.updatedAt || new Date().toISOString();

            // Protection: Don't overwrite local teachers with empty Supabase data
            const supabaseTeachers = s.teachers ?? [];
            const currentTeachers = teachersRef.current || [];

            if (!hydrated && supabaseTeachers.length === 0) {
                console.log(
                    "[fetchCentralState] localStorage not loaded yet, skipping teachers update."
                );
            } else if (supabaseTeachers.length === 0 && currentTeachers.length > 0) {
                console.warn(
                    "[fetchCentralState] Supabase has no teachers but local state does. Keeping local state."
                );
            } else if (supabaseTeachers.length > 0) {
                // Intelligent Merge & Hard Lock Protection
                const now = Date.now();
                let mergedTeachers = supabaseTeachers.filter((remoteT: Teacher) => {
                    // ZOMBIE TEACHER PROTECTION
                    // If we deleted this teacher locally, NEVER let it come back
                    const deletedAt = lastLocalDeleteRef.current[remoteT.id];
                    if (deletedAt) {
                        console.log(`[Sync] 🧟 Zombie Teacher blocked: ${remoteT.name}`);
                        return false;
                    }
                    return true;
                }).map((remoteT: Teacher) => {
                    const localT = currentTeachers.find((t) => t.id === remoteT.id);
                    if (!localT) return remoteT;

                    // 1. HARD LOCK: If edited locally in last 15s, IGNORE remote completely
                    const lastEdit = lastLocalEditRef.current[remoteT.id] || 0;
                    if (now - lastEdit < 15000) {
                        console.log(`[Sync] 🛡️ Protected ${localT.name} from server overwrite (edited ${Math.round((now - lastEdit) / 1000)}s ago)`);
                        return localT;
                    }
                    // 2. AGGRESSIVE SCORE PROTECTION: 
                    // If remote score is 0 OR significantly different from local (more than 5 points diff) 
                    // AND local was recently edited (last 60 seconds), TRUST LOCAL.
                    const timeSinceEdit = now - (lastLocalEditRef.current[remoteT.id] || 0);

                    // Strict Zero Protection
                    if (remoteT.yearlyLoad === 0 && localT.yearlyLoad > 0) {
                        console.warn(`[Sync] 🛡️ Zero Protection: Keeping local ${localT.yearlyLoad} vs remote 0 for ${localT.name}`);
                        return { ...remoteT, yearlyLoad: localT.yearlyLoad };
                    }
                    // Recent Edit Protection (Extended to 60s for safety)
                    if (timeSinceEdit < 60000 && remoteT.yearlyLoad !== localT.yearlyLoad) {
                        console.warn(`[Sync] 🛡️ Recent Edit Protection: Keeping local ${localT.yearlyLoad} vs remote ${remoteT.yearlyLoad} for ${localT.name} (edited ${Math.round(timeSinceEdit / 1000)}s ago)`);
                        return { ...remoteT, yearlyLoad: localT.yearlyLoad, startingLoad: localT.startingLoad };
                    }

                    // Always preserve startingLoad from local if remote is missing it
                    if (localT.startingLoad !== undefined && remoteT.startingLoad === undefined) {
                        // Restore startingLoad
                        const fixedT = { ...remoteT, startingLoad: localT.startingLoad };
                        // RESTORE YEARLY LOAD from startingLoad if remote is 0
                        if (fixedT.yearlyLoad === 0 && fixedT.startingLoad > 0) {
                            fixedT.yearlyLoad = fixedT.startingLoad;
                            console.warn(`[Sync] 🛡️ Restored yearlyLoad ${fixedT.yearlyLoad} from startingLoad for ${fixedT.name}`);
                        }
                        return fixedT;
                    }

                    // Enforce yearlyLoad >= startingLoad
                    if (remoteT.startingLoad !== undefined && remoteT.yearlyLoad < remoteT.startingLoad) {
                        console.warn(`[Sync] 🛡️ Correcting yearlyLoad ${remoteT.yearlyLoad} to min ${remoteT.startingLoad} for ${remoteT.name}`);
                        return { ...remoteT, yearlyLoad: remoteT.startingLoad };
                    }

                    return remoteT;
                });

                // 3. NEW TEACHER PROTECTION
                const remoteIds = new Set(supabaseTeachers.map((t: Teacher) => t.id));
                const localOnlyTeachers = currentTeachers.filter(t => !remoteIds.has(t.id));

                localOnlyTeachers.forEach(localT => {
                    const lastEdit = lastLocalEditRef.current[localT.id] || 0;
                    const hasStartingLoad = localT.startingLoad !== undefined;

                    // If added/edited recently OR has manual starting load, keep it!
                    if ((now - lastEdit < 30000) || hasStartingLoad) {
                        console.log(`[Sync] 🛡️ Keeping new/unsynced teacher ${localT.name} (Has StartingLoad: ${hasStartingLoad})`);
                        mergedTeachers.push(localT);

                        // Force sync up if it's been a while? 
                        // Actually if we add it to mergedTeachers, it will trigger isDiff, causing setTeachers, which triggers syncToSupabase!
                    } else {
                        // Check if it was explicitly deleted
                        if (lastLocalDeleteRef.current[localT.id]) {
                            // It was deleted, so let it go
                        } else {
                            // It's an old orphan. 
                            // DANGEROUS: If state.json is corrupt/missing data, this deletes valid teachers.
                            // SAFEGUARD: If we are in LOCAL_MODE, maybe we should trust local more?
                            // For now, let's just log and keep it if we are unsure?
                            // No, if real deletion happens on another client, we need to drop it.
                            // But since we are single-user likely or small team...
                            // Let's rely on hasStartingLoad which covers manual attempts.
                            console.warn(`[Sync] Dropping orphan teacher ${localT.name} (not in server, no startingLoad, no recent edits)`);
                        }
                    }
                });

                // Only update if there are actual changes (prevent render loops)
                const isDiff = JSON.stringify(mergedTeachers) !== JSON.stringify(currentTeachers);
                if (isDiff) {
                    setTeachers(mergedTeachers);
                }
            }

            // ZOMBIE PROTECTION (Deleted Case Filtering) & ORPHAN PROTECTION
            const rawIncomingCases = s.cases || [];

            // 1. Filter out zombie cases (recently deleted locally)
            const incomingCases = rawIncomingCases.filter((c: CaseFile) => {
                const deletedAt = lastLocalDeleteRef.current[c.id];
                if (deletedAt) {
                    console.log(`[Sync] 🧟 Zombie blocked: ${c.student} (${c.id})`);
                    return false;
                }
                return true;
            });

            // 2. Protect orphan cases (created locally, not yet on server)
            const currentCases = casesRef.current || [];
            const incomingCaseIds = new Set(incomingCases.map((c: CaseFile) => c.id));
            const sixtySecondsAgo = new Date(Date.now() - 60000).toISOString();

            const orphanCases = currentCases.filter(c =>
                !incomingCaseIds.has(c.id) &&
                c.createdAt > sixtySecondsAgo
            );

            if (orphanCases.length > 0) {
                console.log(`[fetchCentralState] Protection: Keeping ${orphanCases.length} recent local cases not yet in server`);
                setCases([...incomingCases, ...orphanCases]);
            } else {
                setCases(incomingCases);
            }

            // HISTORY DEDUPE: Remove duplicate entries from history (same id in same day)
            const rawHistory = s.history ?? {};
            const cleanedHistory: Record<string, CaseFile[]> = {};
            Object.keys(rawHistory).forEach(date => {
                const dayCases = rawHistory[date] || [];
                const seen = new Set<string>();
                cleanedHistory[date] = dayCases.filter((c: CaseFile) => {
                    if (!c.id || seen.has(c.id)) return false;
                    seen.add(c.id);
                    return true;
                });
            });
            setHistory(cleanedHistory);
            setLastRollover(s.lastRollover ?? "");
            setLastAbsencePenalty(s.lastAbsencePenalty ?? "");

            if (Array.isArray(s.announcements)) {
                const today = getTodayYmd();
                setAnnouncements(
                    (s.announcements || []).filter(
                        (a: { createdAt?: string }) =>
                            (a.createdAt || "").slice(0, 10) === today
                    )
                );
            }

            if (s.settings) {
                setSettings({ ...settings, ...s.settings });
            }

            // Load theme settings from Supabase
            if (s.themeSettings) {
                loadThemeFromSupabase(s.themeSettings);
            }

            // Load E-Archive
            if (Array.isArray(s.eArchive) && s.eArchive.length > 0) {
                setEArchive(s.eArchive);
            }

            // Load absence records
            if (Array.isArray(s.absenceRecords)) {
                setAbsenceRecords(s.absenceRecords);
            }

            // Load Queue - KORUMA: Local queue dolu, remote boş ise üzerine yazma!
            const localQueue = useAppStore.getState().queue;
            const remoteQueue = Array.isArray(s.queue) ? s.queue : [];

            if (remoteQueue.length > 0) {
                // Remote'da queue varsa, güncelle
                console.log("[fetchCentralState] Loading queue from remote:", remoteQueue.length, "tickets");
                setQueue(remoteQueue);
            } else if (localQueue.length > 0) {
                // Remote boş ama local dolu - KORU! (Race condition önleme)
                console.log("[fetchCentralState] Keeping local queue (remote empty):", localQueue.length, "tickets");
                // setQueue çağırma - local'i koru
            } else {
                // Her ikisi de boş
                console.log("[fetchCentralState] Queue is empty");
            }

            // Agenda Notes Load
            if (s.agendaNotes) {
                setAgendaNotes(s.agendaNotes);
            }

            console.log(
                "[fetchCentralState] Loaded teachers:",
                s.teachers?.length || 0,
                "eArchive:",
                s.eArchive?.length || 0,
                "queue:",
                s.queue?.length || 0
            );

            setHydrated(true);
        } catch (err) {
            console.error("[fetchCentralState] Network error:", err);
        }
    }, [
        hydrated,
        settings,
        setTeachers,
        setCases,
        setHistory,
        setSettings,
        setEArchive,
        setAnnouncements,
        setAbsenceRecords,
        setLastRollover,
        setLastAbsencePenalty,
        setHydrated,
        setHydrated,
        addToast,
        setAgendaNotes, // NEW
    ]);

    // Sync current state to server (only for admin users)
    const syncToServer = useCallback(async () => {
        try {
            // REMOVED LOCALHOST BLOCK to allow fixing data from local dev
            // if (typeof window !== "undefined" &&
            //     (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
            //     console.log("[syncToServer] 🛑 BLOCKED - Running on localhost, not syncing to production");
            //     return;
            // }

            // Check if user is admin before syncing
            const sessionRes = await fetch("/api/session");
            const sessionData = sessionRes.ok ? await sessionRes.json() : { isAdmin: false };

            // DEBUG: Bypass admin check to rule out auth issues
            /* 
            if (!sessionData.isAdmin) {
                console.log("[syncToServer] Skipping sync - user is not admin");
                // DEBUG: Alert user if they think they are admin but system disagrees
                addToast("HATA: Admin yetkisi yok, kayıt yapılmadı!"); 
                return;
            } 
            */
            if (!sessionData.isAdmin) {
                console.warn("[syncToServer] User is not admin, aborting sync.");
                return;
            }

            // Get latest state from store to avoid closure issues
            const currentQueue = useAppStore.getState().queue;
            const currentTeachers = useAppStore.getState().teachers;

            const currentCases = useAppStore.getState().cases;
            const currentHistory = useAppStore.getState().history;
            const currentSettings = useAppStore.getState().settings;
            const currentEArchive = useAppStore.getState().eArchive;
            const currentAnnouncements = useAppStore.getState().announcements;
            const currentAbsenceRecords = useAppStore.getState().absenceRecords;
            const currentAgendaNotes = useAppStore.getState().agendaNotes; // NEW

            console.log("[syncToServer] Syncing...", {
                teachers: currentTeachers.length,
                queue: currentQueue.length,
                isAdmin: sessionData.isAdmin
            });

            const payload = {
                teachers: currentTeachers,
                cases: currentCases,
                history: currentHistory,
                settings: currentSettings,
                eArchive: currentEArchive,
                announcements: currentAnnouncements,
                absenceRecords: currentAbsenceRecords,
                lastRollover,
                lastAbsencePenalty,
                queue: currentQueue, // Use latest queue from store
                agendaNotes: currentAgendaNotes, // NEW
                updatedAt: new Date().toISOString(),
                clientId: clientId.current,
                themeSettings: { themeMode: getThemeMode(), colorScheme: "default" }, // Feature Parity with page.tsx
            };

            // 1. API ÜZERİNDEN KAYIT (Mevcut Yöntem)
            const res = await fetch(API_ENDPOINTS.STATE, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                console.error("[syncToServer] HTTP error:", res.status);
                addToast(`Kayıt hatası: Sunucu hatası (${res.status})`);

                // 2. FAILSAFE: API BAŞARISIZ OLURSA DOĞRUDAN SUPABASE YAZ (Eğer RLS izin verirse)
                console.log("[syncToServer] Attempting direct Supabase write fallback...");
                const { error: directError } = await supabase
                    .from('app_state')
                    .upsert({ id: 'global', state: payload, updated_at: payload.updatedAt });

                if (directError) {
                    console.error("[syncToServer] Direct write failed:", directError);
                    addToast(`Veritabanı yazma hatası: ${directError.message}`);
                } else {
                    console.log("[syncToServer] Direct write SUCCESS!");
                    addToast("API hatası nedeniyle doğrudan veritabanına yedeklendi.");
                }

            } else {
                console.log("[syncToServer] Successfully synced to server");
                lastAppliedAtRef.current = payload.updatedAt; // Prevent loop
            }

        } catch (err) {
            console.error("[syncToServer] Network error:", err);
        }
    }, [
        // Don't include queue in deps - we get it directly from store
        lastRollover,
        lastAbsencePenalty,
    ]);

    // Auto-sync on changes
    useEffect(() => {
        if (!hydrated) return;

        const timer = setTimeout(() => {
            syncToServer();
        }, 1000); // Debounce 1s (Faster Sync)

        return () => clearTimeout(timer);
    }, [
        teachers, cases, history, settings, eArchive, announcements, absenceRecords,
        lastRollover, lastAbsencePenalty, queue, agendaNotes, hydrated, syncToServer // Added agendaNotes
    ]);

    // Store fetchCentralState in ref to avoid reconnection issues
    const fetchRef = useRef(fetchCentralState);
    useEffect(() => {
        fetchRef.current = fetchCentralState;
    }, [fetchCentralState]);

    // Setup realtime subscription - use postgres_changes instead of broadcast
    useEffect(() => {
        if (!supabase) {
            setLiveStatus("offline");
            return;
        }

        // Use postgres_changes for app_state table updates
        const channel = supabase
            .channel("realtime:app_state")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "app_state" },
                (payload: any) => {
                    const targetId = payload?.new?.id ?? payload?.old?.id;
                    if (targetId && targetId !== "global") return;
                    console.log("[Realtime] app_state changed, fetching...");

                    if (onRealtimeEvent) {
                        onRealtimeEvent(payload);
                    }

                    fetchRef.current(); // Use ref instead of direct call
                }
            )
            .subscribe((status) => {
                if (status === "SUBSCRIBED") {
                    setLiveStatus("online");
                    console.log("[Realtime] Connected to channel");
                } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
                    setLiveStatus("offline");
                    console.log("[Realtime] Disconnected from channel");
                }
            });

        channelRef.current = channel;

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Empty deps - only setup once, use ref for fetchCentralState

    // Initial fetch - only once on mount
    useEffect(() => {
        fetchCentralState();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only run once on mount

    // Expose sync for debug button - STORE ASSIGN
    useEffect(() => {
        if (syncToServer) {
            console.log("[useSupabaseSync] Registering sync function to store");
            useAppStore.getState().setSyncFunction(syncToServer);
        }
    }, [syncToServer]);

    return {
        fetchCentralState,
        syncToServer,
        isConnected: liveStatus === "online",
    };
}
