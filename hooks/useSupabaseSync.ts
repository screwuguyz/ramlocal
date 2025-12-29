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

    useEffect(() => {
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
            if (!isNaN(incomingTs) && incomingTs <= currentTs) return;
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
                setTeachers(supabaseTeachers);
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
            // Check if user is admin before syncing
            const sessionRes = await fetch("/api/session");
            const sessionData = sessionRes.ok ? await sessionRes.json() : { isAdmin: false };

            if (!sessionData.isAdmin) {
                console.log("[syncToServer] Skipping sync - user is not admin");
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

            console.log("[syncToServer] Syncing queue:", currentQueue.length, "tickets");
            console.log("[syncToServer] Called tickets:", currentQueue.filter(t => t.status === 'called').length);

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
            } else {
                console.log("[syncToServer] Successfully synced to server");
            }
        } catch (err) {
            console.error("[syncToServer] Network error:", err);
        }
    }, [
        // Don't include queue in deps - we get it directly from store
        lastRollover,
        lastAbsencePenalty,
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

    return {
        fetchCentralState,
        syncToServer,
        isConnected: liveStatus === "online",
    };
}
