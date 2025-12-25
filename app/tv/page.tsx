"use client";

import { useEffect, useState, useRef } from "react";
import { useAppStore } from "@/stores/useAppStore";
import { useAudioFeedback } from "@/hooks/useAudioFeedback";
import { useSupabaseSync } from "@/hooks/useSupabaseSync";
import { QueueTicket } from "@/types";
import { format } from "date-fns";
import { Maximize2, Minimize2 } from "lucide-react";

export default function TvDisplayPage() {
    const queue = useAppStore(s => s.queue);
    const { playDingDong } = useAudioFeedback();

    // Sync hook'unu aktif et (data fetch + realtime sub)
    useSupabaseSync();

    const [lastAnnouncedId, setLastAnnouncedId] = useState<string | null>(null);
    const [currentTicket, setCurrentTicket] = useState<QueueTicket | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const hasInteractedRef = useRef(false);

    // Son çağrılan bileti bul
    useEffect(() => {
        // En son update edilen ve called olanı bul
        const calledTickets = queue
            .filter(t => t.status === 'called')
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

        const latest = calledTickets[0];

        setCurrentTicket(latest || null);

        if (latest && latest.id !== lastAnnouncedId) {
            setLastAnnouncedId(latest.id);
            announceTicket(latest);
        }
    }, [queue, lastAnnouncedId]);

    const announceTicket = (ticket: QueueTicket) => {
        // 1. Ding Dong
        playDingDong();

        // 2. TTS
        if ('speechSynthesis' in window) {
            // Ding dong bitene kadar biraz bekle
            setTimeout(() => {
                const text = `Sıra numarası ${ticket.no}. ${ticket.name && ticket.name !== "Misafir" ? ticket.name + "." : ""} Lütfen içeri giriniz.`;
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = "tr-TR";
                utterance.rate = 0.9;
                window.speechSynthesis.speak(utterance);
            }, 1500);
        }
    };

    // Interaction handler for audio context
    const handleInteract = () => {
        if (!hasInteractedRef.current) {
            hasInteractedRef.current = true;
            playDingDong(); // Test sesi
        }
    };

    // Fullscreen toggle
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => {
                setIsFullscreen(true);
            });
        } else {
            document.exitFullscreen().then(() => {
                setIsFullscreen(false);
            });
        }
    };

    // Fullscreen event listener
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    // Bekleyen sıralar
    const waitingTickets = queue
        .filter(t => t.status === 'waiting')
        .sort((a, b) => a.no - b.no)
        .slice(0, 10); // İlk 10 bekleyen

    return (
        <div
            className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center relative overflow-hidden cursor-pointer"
            onClick={handleInteract}
        >
            {/* Background Animation */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-900 to-slate-900 z-0">
                <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
            </div>

            {/* Üst Kontroller */}
            <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-50">
                {!hasInteractedRef.current && (
                    <div className="bg-yellow-500 text-black px-4 py-2 rounded-full font-bold animate-pulse">
                        Sesleri etkinleştirmek için ekrana tıklayın
                    </div>
                )}
                <button
                    onClick={toggleFullscreen}
                    className="bg-white/10 hover:bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/20 text-white transition-all flex items-center gap-2"
                >
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    <span className="text-sm">{isFullscreen ? "Küçült" : "Tam Ekran"}</span>
                </button>
            </div>

            <div className="z-10 text-center space-y-8 p-12 bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl w-[90%] max-w-5xl">
                <h1 className="text-4xl lg:text-5xl font-light tracking-[0.2em] text-purple-300 uppercase opacity-80">
                    Sıradaki Numara
                </h1>

                {currentTicket ? (
                    <div className="animate-in zoom-in duration-500">
                        <div className="text-[12rem] lg:text-[16rem] font-black leading-none tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-white to-purple-200 drop-shadow-[0_0_35px_rgba(168,85,247,0.5)]">
                            {currentTicket.no}
                        </div>
                        {currentTicket.name && (
                            <div className="text-4xl lg:text-6xl font-medium mt-8 text-white/90">
                                {currentTicket.name}
                            </div>
                        )}
                        <div className="mt-8 inline-block px-8 py-3 bg-green-500/20 text-green-300 rounded-full text-2xl font-bold border border-green-500/30 animate-pulse">
                            GÖRÜŞME ODASINA GEÇİNİZ
                        </div>
                    </div>
                ) : (
                    <div className="text-6xl font-light text-slate-500 py-20">
                        Bekleniyor...
                    </div>
                )}
            </div>

            {/* Alt Bilgi */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-slate-400 text-lg font-light tracking-widest z-10 flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span>RAM DİJİTAL ASİSTAN</span>
                </div>
                <span>|</span>
                <span>{format(new Date(), "HH:mm")}</span>
                {waitingTickets.length > 0 && (
                    <>
                        <span>|</span>
                        <span className="text-purple-300">{waitingTickets.length} Kişi Bekliyor</span>
                    </>
                )}
            </div>

            {/* Sol: Bekleyen Sıralar */}
            <div className="absolute left-8 top-1/2 -translate-y-1/2 hidden xl:block w-72 z-10">
                <h3 className="text-purple-300 font-bold mb-4 uppercase tracking-wider text-sm border-b border-purple-500/30 pb-2 flex items-center justify-between">
                    <span>Bekleyen Sıralar</span>
                    <span className="bg-purple-500/20 px-2 py-1 rounded text-xs">{waitingTickets.length}</span>
                </h3>
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    {waitingTickets.length === 0 ? (
                        <div className="text-slate-500 text-sm text-center py-8">Sırada kimse yok</div>
                    ) : (
                        waitingTickets.map((t, idx) => (
                            <div
                                key={t.id}
                                className="bg-white/5 hover:bg-white/10 p-3 rounded-lg border border-white/10 flex justify-between items-center transition-all animate-in slide-in-from-left duration-300"
                                style={{ animationDelay: `${idx * 50}ms` }}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-purple-500/20 text-purple-300 font-bold w-10 h-10 flex items-center justify-center rounded-full text-lg border border-purple-500/30">
                                        {t.no}
                                    </div>
                                    <span className="text-sm truncate max-w-[120px] text-white/80">{t.name || "Misafir"}</span>
                                </div>
                                <div className="text-xs text-slate-400">
                                    {idx === 0 && <span className="text-purple-300 font-bold">Sırada</span>}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Sağ: Geçmiş Çağrılar */}
            <div className="absolute right-8 top-1/2 -translate-y-1/2 hidden xl:block w-64 z-10">
                <h3 className="text-slate-400 font-bold mb-4 uppercase tracking-wider text-sm border-b border-slate-700 pb-2">Geçmiş Çağrılar</h3>
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    {queue
                        .filter(t => t.status === 'called' && (!currentTicket || t.id !== currentTicket.id))
                        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                        .slice(0, 8)
                        .map((t, idx) => (
                            <div
                                key={t.id}
                                className="bg-white/5 p-3 rounded-lg border border-white/5 flex justify-between items-center opacity-70 hover:opacity-100 transition-opacity animate-in slide-in-from-right duration-300"
                                style={{ animationDelay: `${idx * 50}ms` }}
                            >
                                <span className="font-bold text-2xl text-green-400">{t.no}</span>
                                <span className="text-sm truncate max-w-[100px]">{t.name || "Misafir"}</span>
                            </div>
                        ))}
                    {queue.filter(t => t.status === 'called' && (!currentTicket || t.id !== currentTicket.id)).length === 0 && (
                        <div className="text-slate-500 text-sm text-center py-8">Henüz çağrı yok</div>
                    )}
                </div>
            </div>
        </div>
    );
}
