"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { QueueTicket } from "@/types";

// Dedicated hook for queue synchronization
// Uses separate queue_tickets table with realtime subscription
export function useQueueSync() {
    const [tickets, setTickets] = useState<QueueTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const channelRef = useRef<any>(null);

    // Fetch all tickets from API
    const fetchTickets = useCallback(async () => {
        try {
            const res = await fetch("/api/queue-v2");
            const data = await res.json();

            if (data.ok && Array.isArray(data.tickets)) {
                setTickets(data.tickets);
                setError(null);
            } else {
                setError(data.error || "Failed to fetch tickets");
            }
        } catch (err: any) {
            console.error("[useQueueSync] Fetch error:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    // Add new ticket
    const addTicket = useCallback(async (name?: string): Promise<QueueTicket | null> => {
        try {
            const res = await fetch("/api/queue-v2", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
            });
            const data = await res.json();

            if (data.ok && data.ticket) {
                // Optimistic update - add to local state immediately
                setTickets(prev => [...prev, data.ticket]);
                return data.ticket;
            }
            return null;
        } catch (err: any) {
            console.error("[useQueueSync] Add error:", err);
            return null;
        }
    }, []);

    // Call ticket (change status to 'called')
    const callTicket = useCallback(async (id: string, calledBy?: string) => {
        try {
            // Optimistic update
            setTickets(prev => prev.map(t =>
                t.id === id
                    ? { ...t, status: 'called' as const, calledBy, updatedAt: new Date().toISOString() }
                    : t
            ));

            const res = await fetch("/api/queue-v2", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, status: "called", calledBy }),
            });
            const data = await res.json();

            if (!data.ok) {
                // Revert on failure
                await fetchTickets();
            }
        } catch (err: any) {
            console.error("[useQueueSync] Call error:", err);
            await fetchTickets();
        }
    }, [fetchTickets]);

    // Complete ticket (change status to 'done')
    const completeTicket = useCallback(async (id: string) => {
        try {
            // Optimistic update
            setTickets(prev => prev.map(t =>
                t.id === id
                    ? { ...t, status: 'done' as const, updatedAt: new Date().toISOString() }
                    : t
            ));

            const res = await fetch("/api/queue-v2", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, status: "done" }),
            });
            const data = await res.json();

            if (!data.ok) {
                await fetchTickets();
            }
        } catch (err: any) {
            console.error("[useQueueSync] Complete error:", err);
            await fetchTickets();
        }
    }, [fetchTickets]);

    // Clear all tickets (reset queue)
    const clearAll = useCallback(async () => {
        try {
            setTickets([]);

            const res = await fetch("/api/queue-v2", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clearAll: true }),
            });
            const data = await res.json();

            if (!data.ok) {
                await fetchTickets();
            }
        } catch (err: any) {
            console.error("[useQueueSync] Clear error:", err);
            await fetchTickets();
        }
    }, [fetchTickets]);

    // Setup realtime subscription
    useEffect(() => {
        // Initial fetch
        fetchTickets();

        // Subscribe to realtime changes
        if (supabase) {
            const channel = supabase
                .channel("queue_tickets_realtime")
                .on(
                    "postgres_changes",
                    { event: "*", schema: "public", table: "queue_tickets" },
                    (payload) => {
                        console.log("[useQueueSync] Realtime event:", payload.eventType);

                        if (payload.eventType === "INSERT") {
                            const newTicket: QueueTicket = {
                                id: payload.new.id,
                                no: payload.new.no,
                                name: payload.new.name,
                                status: payload.new.status,
                                calledBy: payload.new.called_by,
                                createdAt: payload.new.created_at,
                                updatedAt: payload.new.updated_at,
                            };
                            setTickets(prev => {
                                // Avoid duplicates
                                if (prev.some(t => t.id === newTicket.id)) return prev;
                                return [...prev, newTicket];
                            });
                        }
                        else if (payload.eventType === "UPDATE") {
                            setTickets(prev => prev.map(t =>
                                t.id === payload.new.id
                                    ? {
                                        ...t,
                                        status: payload.new.status,
                                        calledBy: payload.new.called_by,
                                        updatedAt: payload.new.updated_at,
                                    }
                                    : t
                            ));
                        }
                        else if (payload.eventType === "DELETE") {
                            setTickets(prev => prev.filter(t => t.id !== payload.old.id));
                        }
                    }
                )
                .subscribe((status) => {
                    console.log("[useQueueSync] Subscription status:", status);
                });

            channelRef.current = channel;
        }

        // Backup polling every 5 seconds (in case realtime fails)
        const interval = setInterval(fetchTickets, 5000);

        return () => {
            clearInterval(interval);
            if (channelRef.current && supabase) {
                supabase.removeChannel(channelRef.current);
            }
        };
    }, [fetchTickets]);

    // Computed values
    const waitingTickets = tickets
        .filter(t => t.status === "waiting")
        .sort((a, b) => (a.no || 0) - (b.no || 0));

    const calledTickets = tickets
        .filter(t => t.status === "called")
        .sort((a, b) => {
            const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
            const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
            return bTime - aTime; // Most recent first
        });

    const currentTicket = calledTickets[0] || null;

    return {
        tickets,
        waitingTickets,
        calledTickets,
        currentTicket,
        loading,
        error,
        addTicket,
        callTicket,
        completeTicket,
        clearAll,
        refresh: fetchTickets,
    };
}
