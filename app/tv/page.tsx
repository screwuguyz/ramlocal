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

    const documents = [
        { no: 1, text: "VELİ VE ÖĞRENCİ KİMLİK ASILLARI" },
        { no: 2, text: "VELİ VE ÖĞRENCİ KİMLİK FOTOKOPİLERİ" },
        { no: 3, text: "OKUL ÇAĞINDA İSE: EĞİTSEL DEĞERLENDİRME VE İSTEK FORMU" },
        { no: 4, text: "OKUL ÇAĞI DIŞINDA İSE: GEÇERLİ İKAMETGAH BELGESİ" },
        { no: 5, text: "HASTANE RAPORU (ÇÖZGER, SAĞLIK KURULU VB.)" },
        { no: 6, text: "VELAYET DURUMUNDA: VELAYET BELGESİ" },
    ];

    return (
        <div
            className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white overflow-hidden cursor-pointer"
            onClick={handleInteract}
        >
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-5">
                <div className="absolute inset-0" style={{
                    backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
                    backgroundSize: '40px 40px'
                }}></div>
            </div>

            {/* Üst Bar */}
            <div className="absolute top-0 left-0 right-0 h-16 bg-black/30 backdrop-blur-md z-50 flex items-center justify-between px-6 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="font-bold tracking-wider">KARŞIYAKA RAM - DİJİTAL SIRAMATIK</span>
                </div>
                <div className="flex items-center gap-6">
                    <span className="text-2xl font-light">{format(new Date(), "HH:mm")}</span>
                    <button
                        onClick={toggleFullscreen}
                        className="bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg border border-white/20 transition-all flex items-center gap-2"
                    >
                        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        <span className="text-sm">{isFullscreen ? "Küçült" : "Tam Ekran"}</span>
                    </button>
                </div>
            </div>

            {/* Ses Uyarısı */}
            {!hasInteractedRef.current && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-yellow-500 text-black px-6 py-2 rounded-full font-bold animate-pulse">
                    🔊 Sesleri etkinleştirmek için ekrana tıklayın
                </div>
            )}

            {/* Ana 3 Sütunlu Grid */}
            <div className="h-screen pt-20 pb-4 px-4 grid grid-cols-1 xl:grid-cols-12 gap-4">

                {/* SOL SÜTUN - Bekleyen Sıralar */}
                <div className="hidden xl:flex xl:col-span-3 flex-col bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-4 overflow-hidden">
                    <h3 className="text-purple-300 font-bold uppercase tracking-wider text-lg border-b border-purple-500/30 pb-3 mb-4 flex items-center justify-between">
                        <span>BEKLEYEN SIRALAR</span>
                        <span className="bg-purple-500/30 px-3 py-1 rounded-lg text-xl font-black">{waitingTickets.length}</span>
                    </h3>
                    <div className="flex-1 space-y-2 overflow-y-auto">
                        {waitingTickets.length === 0 ? (
                            <div className="text-slate-500 text-lg text-center py-8">Sırada kimse yok</div>
                        ) : (
                            waitingTickets.map((t, idx) => (
                                <div
                                    key={t.id}
                                    className="bg-white/5 p-3 rounded-xl border border-white/10 flex items-center gap-3 transition-all animate-in slide-in-from-left duration-300"
                                    style={{ animationDelay: `${idx * 50}ms` }}
                                >
                                    <div className="bg-purple-500/30 text-purple-200 font-black w-12 h-12 flex items-center justify-center rounded-full text-xl border-2 border-purple-400/50">
                                        {String(t.no || '')}
                                    </div>
                                    <span className="text-lg font-medium truncate flex-1 text-white">{String(t.name || "Misafir")}</span>
                                    {idx === 0 && <span className="text-green-400 font-bold text-sm animate-pulse">SIRADA</span>}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* ORTA SÜTUN - Sıradaki Numara */}
                <div className="xl:col-span-5 flex flex-col items-center justify-center bg-gradient-to-b from-white/10 to-white/5 backdrop-blur-sm rounded-2xl border border-white/20 p-8">
                    <h1 className="text-3xl lg:text-4xl font-light tracking-[0.15em] text-purple-300 uppercase mb-4">
                        SIRADAKİ NUMARA
                    </h1>

                    {currentTicket ? (
                        <div className="text-center animate-in zoom-in duration-500">
                            <div className="text-[10rem] lg:text-[14rem] font-black leading-none tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-white to-purple-200 drop-shadow-[0_0_40px_rgba(168,85,247,0.6)]">
                                {String(currentTicket.no || '')}
                            </div>
                            {currentTicket.name && currentTicket.name !== "Misafir" && (
                                <div className="text-3xl lg:text-5xl font-medium mt-4 text-white/90">
                                    {String(currentTicket.name || '')}
                                </div>
                            )}
                            <div className="mt-6 inline-block px-8 py-3 bg-green-500/20 text-green-300 rounded-full text-xl font-bold border border-green-500/30 animate-pulse">
                                ✓ GÖRÜŞME ODASINA GEÇİNİZ
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <div className="text-8xl lg:text-9xl font-light text-slate-600 mb-4">—</div>
                            <div className="text-3xl font-light text-slate-500">Bekleniyor...</div>
                        </div>
                    )}
                </div>

                {/* SAĞ SÜTUN - Gerekli Evraklar */}
                <div className="hidden xl:flex xl:col-span-4 flex-col bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-4 overflow-hidden">
                    <h3 className="text-amber-300 font-bold uppercase tracking-wider text-base border-b border-amber-500/30 pb-3 mb-3 flex items-center gap-2">
                        <span>📋</span>
                        <span>RANDEVUSU BULUNAN BİREYLER İÇİN GEREKLİ EVRAKLAR</span>
                    </h3>
                    <div className="flex-1 space-y-2">
                        {documents.map((item, idx) => (
                            <div
                                key={item.no}
                                className="bg-white/5 p-3 rounded-xl border border-amber-500/20 flex items-start gap-3 animate-in slide-in-from-right duration-500"
                                style={{ animationDelay: `${idx * 100}ms` }}
                            >
                                <div className="bg-amber-500/20 text-amber-300 font-bold w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full text-sm border border-amber-400/30">
                                    {item.no}
                                </div>
                                <span className="text-sm font-medium text-white/90 leading-snug">{item.text}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
