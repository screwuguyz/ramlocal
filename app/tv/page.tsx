"use client";

import { useEffect, useState, useRef } from "react";
import { useQueueSync } from "@/hooks/useQueueSync";
import { useAudioFeedback } from "@/hooks/useAudioFeedback";
import { QueueTicket } from "@/types";
import { format } from "date-fns";
import { Maximize2, Minimize2 } from "lucide-react";

export default function TvDisplayPage() {
    // YENİ: Dedicated queue sync hook kullan
    const { waitingTickets, calledTickets, currentTicket } = useQueueSync();
    const { playDingDong } = useAudioFeedback();

    const [lastAnnouncedId, setLastAnnouncedId] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const hasInteractedRef = useRef(false);

    // Yeni bilet çağrılınca anons et
    useEffect(() => {
        console.log("[TV] Current ticket changed:", currentTicket?.no);

        if (currentTicket && currentTicket.id !== lastAnnouncedId) {
            console.log("[TV] 🎉 NEW TICKET CALLED:", currentTicket.no, currentTicket.name);
            setLastAnnouncedId(currentTicket.id);
            announceTicket(currentTicket);
        }
    }, [currentTicket, lastAnnouncedId]);

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

    // waitingTickets zaten useQueueSync hook'tan geliyor (satır 12)

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
                            {String(currentTicket.no || '')}
                        </div>
                        {currentTicket.name && currentTicket.name !== "Misafir" && (
                            <div className="text-4xl lg:text-6xl font-medium mt-8 text-white/90">
                                {String(currentTicket.name || '')}
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

            {/* Sol: Bekleyen Sıralar - TV için büyütülmüş */}
            <div className="absolute left-8 top-24 bottom-24 hidden xl:flex flex-col w-80 z-10">
                <h3 className="text-purple-300 font-bold mb-6 uppercase tracking-wider text-xl border-b-2 border-purple-500/30 pb-3 flex items-center justify-between">
                    <span>BEKLEYEN SIRALAR</span>
                    <span className="bg-purple-500/30 px-4 py-2 rounded-lg text-2xl font-black">{waitingTickets.length}</span>
                </h3>
                <div className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                    {waitingTickets.length === 0 ? (
                        <div className="text-slate-500 text-xl text-center py-12">Sırada kimse yok</div>
                    ) : (
                        waitingTickets.map((t, idx) => (
                            <div
                                key={t.id}
                                className="bg-white/10 hover:bg-white/15 p-4 rounded-xl border border-white/20 flex justify-between items-center transition-all animate-in slide-in-from-left duration-300"
                                style={{ animationDelay: `${idx * 50}ms` }}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="bg-purple-500/30 text-purple-200 font-black w-16 h-16 flex items-center justify-center rounded-full text-3xl border-2 border-purple-400/50">
                                        {String(t.no || '')}
                                    </div>
                                    <span className="text-xl font-medium truncate max-w-[150px] text-white">{String(t.name || "Misafir")}</span>
                                </div>
                                <div className="text-lg text-slate-400">
                                    {idx === 0 && <span className="text-green-400 font-bold animate-pulse">SIRADA</span>}
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
                    {calledTickets
                        .filter(t => !currentTicket || t.id !== currentTicket.id)
                        .slice(0, 8)
                        .map((t, idx) => (
                            <div
                                key={t.id || idx}
                                className="bg-white/5 p-3 rounded-lg border border-white/5 flex justify-between items-center opacity-70 hover:opacity-100 transition-opacity animate-in slide-in-from-right duration-300"
                                style={{ animationDelay: `${idx * 50}ms` }}
                            >
                                <span className="font-bold text-2xl text-green-400">{String(t.no || '')}</span>
                                <span className="text-sm truncate max-w-[100px]">{String(t.name || "Misafir")}</span>
                            </div>
                        ))}
                    {calledTickets.filter(t => !currentTicket || t.id !== currentTicket.id).length === 0 && (
                        <div className="text-slate-500 text-sm text-center py-8">Henüz çağrı yok</div>
                    )}
                </div>
            </div>
        </div>
    );
}
