"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/stores/useAppStore";
import { useSupabaseSync } from "@/hooks/useSupabaseSync";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Ticket } from "lucide-react";
import { QueueTicket } from "@/types";

export default function SiraAlPage() {
    const { queue, setQueue } = useAppStore();
    const { fetchCentralState } = useSupabaseSync();

    // Client-side only state
    const [myTicketId, setMyTicketId] = useState<string | null>(null);
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(false);

    // Initial fetch to get queue status
    useEffect(() => {
        fetchCentralState();
        // Periodik fetch (backup for realtime) - optional
        const interval = setInterval(fetchCentralState, 10000);
        return () => clearInterval(interval);
    }, [fetchCentralState]);

    const handleSiraAl = async () => {
        setLoading(true);
        const nameInput = name.trim() || "Misafir";

        try {
            // Public endpoint'e istek at
            const res = await fetch("/api/queue", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "add", name: nameInput })
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || "Sıra alınamadı");
            }

            const data = await res.json();
            if (data.ok && data.ticket) {
                const newTicket = data.ticket as QueueTicket;
                // Anında UI güncellemesi (optimistic update)
                setQueue([...queue, newTicket]);
                setMyTicketId(newTicket.id);
                
                // Supabase'den güncel queue'yu çek (realtime sync için)
                setTimeout(() => {
                    fetchCentralState();
                }, 500);
            } else {
                throw new Error(data.error || "Sıra alınamadı");
            }
        } catch (err: any) {
            console.error("Queue error:", err);
            const errorMessage = err?.message || "Sıra alınırken bir hata oluştu.";
            alert(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const myTicket = myTicketId ? queue.find(t => t.id === myTicketId) : null;

    // Sıra hesaplama
    const peopleAhead = myTicket
        ? queue.filter(t => t.status === 'waiting' && t.no < myTicket.no).length
        : queue.filter(t => t.status === 'waiting').length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center p-4">
            <Card className="w-full max-w-md shadow-2xl border-0 bg-white/95 backdrop-blur">
                <CardHeader className="text-center space-y-4 pb-2">
                    <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
                        <Ticket className="w-8 h-8 text-purple-600" />
                    </div>
                    <div>
                        <CardTitle className="text-2xl font-bold text-slate-800">Dijital Sıramatik</CardTitle>
                        <CardDescription className="text-slate-500">Karşıyaka RAM Özel Eğitim Bölümü</CardDescription>
                    </div>
                </CardHeader>

                <CardContent className="space-y-6 pt-4">
                    {/* BİLET VARSA */}
                    {myTicket ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="border-4 border-dashed border-purple-100 rounded-3xl p-8 text-center bg-purple-50/50 relative overflow-hidden">
                                <div className="absolute top-0 md:top-auto md:bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-300 to-transparent"></div>

                                <h3 className="text-purple-600 font-bold tracking-widest uppercase text-sm mb-2">SIRA NUMARANIZ</h3>
                                <div className="text-8xl font-black text-slate-900 tracking-tighter leading-none mb-2">
                                    {myTicket.no}
                                </div>
                                <div className="text-slate-500 font-medium text-lg truncate px-4">
                                    {myTicket.name}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div className="bg-slate-50 rounded-2xl p-4 text-center border border-slate-100">
                                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Önünüzde</div>
                                    <div className="text-2xl font-bold text-slate-800">{peopleAhead} Kişi</div>
                                </div>
                                <div className="bg-slate-50 rounded-2xl p-4 text-center border border-slate-100">
                                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Durum</div>
                                    <div className={`text-2xl font-bold ${myTicket.status === 'called' ? 'text-green-500 animate-pulse' : 'text-orange-500'}`}>
                                        {myTicket.status === 'waiting' ? 'Bekliyor' :
                                            myTicket.status === 'called' ? 'ÇAĞRILDI' : 'Tamamlandı'}
                                    </div>
                                    {myTicket.status === 'called' && (
                                        <div className="text-sm text-green-600 font-medium mt-1">Lütfen İçeri Giriniz</div>
                                    )}
                                </div>
                            </div>

                            <Button
                                variant="outline"
                                className="w-full h-12 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 border-slate-200"
                                onClick={() => setMyTicketId(null)}
                            >
                                Yeni Sıra Al
                            </Button>
                        </div>
                    ) : (
                        /* BİLET YOKSA */
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700 ml-1">İsim Soyisim (İsteğe Bağlı)</label>
                                <Input
                                    placeholder="Adınız..."
                                    className="h-14 text-lg rounded-xl border-slate-200 focus:border-purple-500 bg-slate-50"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </div>

                            <Button
                                className="w-full h-14 text-lg font-bold rounded-xl bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-200 transition-all hover:scale-[1.02]"
                                onClick={handleSiraAl}
                                disabled={loading}
                            >
                                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "SIRA AL"}
                            </Button>

                            <div className="flex items-center justify-center gap-2 text-xs text-slate-400 mt-4">
                                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                                Sistem Aktif
                            </div>
                        </div>
                    )}
                </CardContent>

                <CardFooter className="justify-center border-t border-slate-100 py-6">
                    <div className="text-slate-300 text-xs font-medium">RAM Dijital Sistemleri © 2025</div>
                </CardFooter>
            </Card>
        </div>
    );
}

function Loader2({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
    )
}
