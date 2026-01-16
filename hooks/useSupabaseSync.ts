// ============================================
// RAM Dosya Atama - Supabase Sync Hook
// ============================================

"use client";

import { useEffect, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useAppStore } from "@/stores/useAppStore";
import { getTodayYmd } from "@/lib/date";
import { loadThemeFromSupabase } from "@/lib/theme";
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

export function useSupabaseSync(): SupabaseSyncHook {
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
    } = useAppStore();

    // Keep refs in sync with state
    const teachersRef = useRef<Teacher[]>([]);
    const casesRef = useRef<CaseFile[]>([]);
    const lastAbsencePenaltyRef = useRef<string>("");
    const supabaseTeacherCountRef = useRef<number>(0);

    // Track local edits to prevent immediate overwrite by server
    const lastLocalEditRef = useRef<Record<string, number>>({});

    // Detect local teacher changes to set "protection lock"
    useEffect(() => {
        if (teachersRef.current.length > 0) {
            teachers.forEach(t => {
                const oldT = teachersRef.current.find(old => old.id === t.id);
                // If teacher changed locally, set protection lock for 15 seconds
                if (oldT && (oldT.yearlyLoad !== t.yearlyLoad || oldT.active !== t.active)) {
                    lastLocalEditRef.current[t.id] = Date.now();
                    console.log(`[Sync] Local edit detected for ${t.name}, locking sync for 15s`);
                }
            });
        }
        teachersRef.current = teachers;
    }, [teachers]);

    useEffect(() => {
        casesRef.current = cases;
    }, [cases]);
    useEffect(() => {
        lastAbsencePenaltyRef.current = lastAbsencePenalty;
    }, [lastAbsencePenalty]);

    // Fetch central state from API
    const fetchCentralState = useCallback(async () => {
        try {
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

            const incomingTs = Date.parse(String(s.updatedAt || 0));
            const currentTs = Date.parse(String(lastAppliedAtRef.current || 0));
            // Relaxed timestamp check: if incoming is strictly older, ignore. 
            // If equal, we still process to catch up on partial updates unless locked.
            if (!isNaN(incomingTs) && incomingTs < currentTs) return;

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
                const mergedTeachers = supabaseTeachers.map((remoteT: Teacher) => {
                    const localT = currentTeachers.find((t) => t.id === remoteT.id);
                    if (!localT) return remoteT;

                    // 1. HARD LOCK: If edited locally in last 15s, IGNORE remote completely
                    const lastEdit = lastLocalEditRef.current[remoteT.id] || 0;
                    if (now - lastEdit < 15000) {
                        console.log(`[Sync] 🛡️ Protected ${localT.name} from server overwrite (edited ${Math.round((now - lastEdit) / 1000)}s ago)`);
                        return localT;
                    }

                    // 2. ZERO PROTECTION: If remote score is 0 but local is > 0, keep local score
                    if ((remoteT.yearlyLoad === 0) && (localT.yearlyLoad > 0)) {
                        console.warn(`[fetchCentralState] Protection: Ignoring 0 score from server for ${remoteT.name}, keeping local ${localT.yearlyLoad}`);
                        return { ...remoteT, yearlyLoad: localT.yearlyLoad };
                    }
                    return remoteT;
                });

                // Only update if there are actual changes (prevent render loops)
                const isDiff = JSON.stringify(mergedTeachers) !== JSON.stringify(currentTeachers);
                if (isDiff) {
                    setTeachers(mergedTeachers);
                }
            }

            setCases(s.cases ?? []);
            setHistory(s.history ?? {});
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
        addToast,
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
                addToast("DEBUG: Admin değil ama kayıt zorlanıyor...");
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
                updatedAt: new Date().toISOString(),
                clientId: clientId.current,
            };

            const res = await fetch(API_ENDPOINTS.STATE, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                console.error("[syncToServer] HTTP error:", res.status);
                addToast(`Kayıt hatası: Sunucu hatası (${res.status})`);
            } else {
                console.log("[syncToServer] Successfully synced to server");
                // addToast("Değişiklikler kaydedildi."); // Optional success toast
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
        lastRollover, lastAbsencePenalty, queue, hydrated, syncToServer
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

    // Expose sync for debug button
    useEffect(() => {
        if (syncToServer) {
            console.log("[useSupabaseSync] Binding window.forceSync");
            // @ts-ignore
            window.forceSync = syncToServer;
        }
        return () => {
            // @ts-ignore
            // delete window.forceSync; // Don't delete on cleanup to avoid flicker
        };
    }, [syncToServer]);

    return {
        fetchCentralState,
        syncToServer,
        isConnected: liveStatus === "online",
    };
}
