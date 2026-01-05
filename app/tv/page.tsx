"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useQueueSync } from "@/hooks/useQueueSync";
import { useAudioFeedback } from "@/hooks/useAudioFeedback";
import { QueueTicket } from "@/types";
import { format } from "date-fns";
import { Maximize2, Minimize2, Music, Volume2, VolumeX } from "lucide-react";
import { supabase } from "@/lib/supabase";

// YouTube video ID çıkarma
function extractYouTubeId(url: string): string | null {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/,
        /^([a-zA-Z0-9_-]{11})$/
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

export default function TvDisplayPage() {
    // YENİ: Dedicated queue sync hook kullan
    const { waitingTickets, calledTickets, currentTicket } = useQueueSync();
    const { playDingDong } = useAudioFeedback();

    const [lastAnnouncedId, setLastAnnouncedId] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const hasInteractedRef = useRef(false);

    // Ayarlar paneli state
    const [showSettings, setShowSettings] = useState(false);
    const [fontScale, setFontScale] = useState(1);
    const [musicVolume, setMusicVolume] = useState(0.5);
    const [announcementVolume, setAnnouncementVolume] = useState(1.0);
    const [settingsLoaded, setSettingsLoaded] = useState(false);

    // Client-side'da localStorage'dan ayarları yükle
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedFontScale = localStorage.getItem('tv_font_scale');
            const savedMusicVolume = localStorage.getItem('tv_music_volume');
            const savedAnnouncementVolume = localStorage.getItem('tv_announcement_volume');

            if (savedFontScale) setFontScale(parseFloat(savedFontScale));
            if (savedMusicVolume) setMusicVolume(parseFloat(savedMusicVolume));
            if (savedAnnouncementVolume) setAnnouncementVolume(parseFloat(savedAnnouncementVolume));

            setSettingsLoaded(true);
        }
    }, []);

    // Ayarlar değişince localStorage'a kaydet
    useEffect(() => {
        if (settingsLoaded && typeof window !== 'undefined') {
            localStorage.setItem('tv_font_scale', String(fontScale));
            localStorage.setItem('tv_music_volume', String(musicVolume));
            localStorage.setItem('tv_announcement_volume', String(announcementVolume));
        }
    }, [fontScale, musicVolume, announcementVolume, settingsLoaded]);




    // Müzik state'leri
    const [musicUrl, setMusicUrl] = useState<string>("");
    const [musicPlaying, setMusicPlaying] = useState(false);
    const [musicVideoId, setMusicVideoId] = useState<string | null>(null);
    const [musicMuted, setMusicMuted] = useState(false);
    const playerRef = useRef<any>(null);
    const isAnnouncingRef = useRef(false);

    // Video state'leri (görünür video)
    const [videoUrl, setVideoUrl] = useState<string>("");
    const [videoPlaying, setVideoPlaying] = useState(false);
    const [videoVideoId, setVideoVideoId] = useState<string | null>(null);


    // YouTube API yükleme
    useEffect(() => {
        if (typeof window !== 'undefined' && !(window as any).YT) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
        }
    }, []);

    // Supabase realtime - müzik durumunu dinle
    useEffect(() => {
        const channel = supabase.channel('music_state');

        channel
            .on('broadcast', { event: 'music_update' }, (payload: any) => {
                console.log("[TV] Music update received:", payload);
                const { url, playing } = payload.payload;
                if (url !== undefined) {
                    setMusicUrl(url);
                    const videoId = extractYouTubeId(url);
                    setMusicVideoId(videoId);
                }
                if (playing !== undefined) {
                    setMusicPlaying(playing);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Supabase realtime - video durumunu dinle
    useEffect(() => {
        const channel = supabase.channel('video_state');

        channel
            .on('broadcast', { event: 'video_update' }, (payload: any) => {
                console.log("[TV] Video update received:", payload);
                const { url, playing } = payload.payload;
                if (url !== undefined) {
                    setVideoUrl(url);
                    const videoId = extractYouTubeId(url);
                    setVideoVideoId(videoId);
                }
                if (playing !== undefined) {
                    setVideoPlaying(playing);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // YouTube player oluşturma
    useEffect(() => {
        if (!musicVideoId || !hasInteractedRef.current) return;

        const initPlayer = () => {
            if ((window as any).YT && (window as any).YT.Player) {
                playerRef.current = new (window as any).YT.Player('youtube-player', {
                    height: '0',
                    width: '0',
                    videoId: musicVideoId,
                    playerVars: {
                        autoplay: musicPlaying ? 1 : 0,
                        loop: 1,
                        playlist: musicVideoId,
                    },
                    events: {
                        onReady: (event: any) => {
                            // Başlangıçta ses seviyesini ayarla
                            event.target.setVolume(Math.round(musicVolume * 100));
                            if (musicPlaying && !isAnnouncingRef.current) {
                                event.target.playVideo();
                            }
                        }
                    }
                });
            }
        };

        if ((window as any).YT) {
            initPlayer();
        } else {
            (window as any).onYouTubeIframeAPIReady = initPlayer;
        }

        return () => {
            if (playerRef.current?.destroy) {
                playerRef.current.destroy();
                playerRef.current = null;
            }
        };
    }, [musicVideoId, hasInteractedRef.current]);

    // Müzik çal/durdur
    useEffect(() => {
        if (!playerRef.current) return;

        try {
            if (musicPlaying && !isAnnouncingRef.current) {
                playerRef.current.playVideo?.();
            } else {
                playerRef.current.pauseVideo?.();
            }
            // Ses seviyesi ayarla (0-100 arası)
            playerRef.current.setVolume?.(Math.round(musicVolume * 100));
        } catch (e) {
            console.log("[TV] Player control error:", e);
        }
    }, [musicPlaying, musicVolume]);

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
        // Müziği duraklat VE sesini kapat (çift güvenlik)
        isAnnouncingRef.current = true;
        if (playerRef.current) {
            try {
                playerRef.current.pauseVideo?.();
                playerRef.current.mute?.(); // Sesini de kapat
            } catch (e) {
                console.log("[TV] Player control error:", e);
            }
        }

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
                utterance.volume = announcementVolume; // Anons ses seviyesi ayarlardan

                utterance.onend = () => {
                    // Anons bitti, müziği devam ettir
                    setTimeout(() => {
                        isAnnouncingRef.current = false;
                        if (musicPlaying && playerRef.current) {
                            try {
                                playerRef.current.unMute?.(); // Sesi aç
                                playerRef.current.playVideo?.();
                            } catch (e) {
                                console.log("[TV] Player resume error:", e);
                            }
                        }
                    }, 1000);
                };

                window.speechSynthesis.speak(utterance);
            }, 1500);
        } else {
            // TTS yoksa 5 saniye sonra müziği devam ettir
            setTimeout(() => {
                isAnnouncingRef.current = false;
                if (musicPlaying && playerRef.current) {
                    try {
                        playerRef.current.unMute?.();
                        playerRef.current.playVideo?.();
                    } catch (e) {
                        console.log("[TV] Player resume error:", e);
                    }
                }
            }, 5000);
        }
    };

    // Interaction handler for audio context
    const handleInteract = () => {
        if (!hasInteractedRef.current) {
            hasInteractedRef.current = true;
            playDingDong(); // Test sesi
            // Eğer müzik aktifse başlat
            if (musicPlaying && musicVideoId) {
                // Player'ı yeniden oluştur
                setMusicVideoId(prev => prev);
            }
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
            className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white overflow-hidden cursor-pointer"
            onClick={handleInteract}
        >
            {/* Background Pattern - subtle */}
            <div className="absolute inset-0 opacity-5">
                <div className="absolute inset-0" style={{
                    backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
                    backgroundSize: '50px 50px'
                }}></div>
            </div>

            {/* Üst Bar */}
            <div className="absolute top-0 left-0 right-0 h-16 bg-black/30 backdrop-blur-md z-50 flex items-center justify-between px-6 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="font-bold tracking-wider">KARŞIYAKA RAM - DİJİTAL SIRAMATIK</span>

                    {/* Müzik Görselleştirici */}
                    {musicPlaying && (
                        <div className="hidden md:flex ml-4 items-end gap-1 h-5 pb-1">
                            <div className="w-1 bg-purple-400 rounded-t animate-[bounce_1s_infinite] h-[60%]"></div>
                            <div className="w-1 bg-purple-400 rounded-t animate-[bounce_1.2s_infinite] h-[100%]"></div>
                            <div className="w-1 bg-purple-400 rounded-t animate-[bounce_0.8s_infinite] h-[40%]"></div>
                            <div className="w-1 bg-purple-400 rounded-t animate-[bounce_1.1s_infinite] h-[80%]"></div>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-2xl font-light">{format(new Date(), "HH:mm")}</span>
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className="bg-white/10 hover:bg-white/20 p-2 rounded-lg border border-white/20 transition-all"
                        title="Ayarlar"
                    >
                        ⚙️
                    </button>
                    <button
                        onClick={toggleFullscreen}
                        className="bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg border border-white/20 transition-all flex items-center gap-2"
                    >
                        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        <span className="text-sm">{isFullscreen ? "Küçült" : "Tam Ekran"}</span>
                    </button>
                </div>
            </div>

            {/* Ayarlar Paneli */}
            {showSettings && (
                <div className="fixed top-20 right-4 z-50 bg-slate-900/95 backdrop-blur-md rounded-2xl border border-white/20 p-6 w-80 shadow-2xl">
                    <h3 className="text-lg font-bold text-white mb-4 flex justify-between items-center">
                        ⚙️ Görünüm Ayarları
                        <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white">✕</button>
                    </h3>

                    <div className="space-y-4">
                        <div>
                            <label className="text-sm text-slate-300 block mb-2">
                                Yazı Boyutu: {Math.round(fontScale * 100)}%
                            </label>
                            <input
                                type="range"
                                min="0.5"
                                max="2"
                                step="0.1"
                                value={fontScale}
                                onChange={(e) => setFontScale(parseFloat(e.target.value))}
                                className="w-full accent-purple-500"
                            />
                            <div className="flex justify-between text-xs text-slate-500 mt-1">
                                <span>50%</span>
                                <span>100%</span>
                                <span>200%</span>
                            </div>
                        </div>

                        {/* Müzik Ses Seviyesi */}
                        <div>
                            <label className="text-sm text-slate-300 block mb-2">
                                🎵 Müzik Sesi: {Math.round(musicVolume * 100)}%
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={musicVolume}
                                onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
                                className="w-full accent-blue-500"
                            />
                        </div>

                        {/* Anons Ses Seviyesi */}
                        <div>
                            <label className="text-sm text-slate-300 block mb-2">
                                📢 Anons Sesi: {Math.round(announcementVolume * 100)}%
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={announcementVolume}
                                onChange={(e) => setAnnouncementVolume(parseFloat(e.target.value))}
                                className="w-full accent-green-500"
                            />
                        </div>

                        <button
                            onClick={() => { setFontScale(1); setMusicVolume(0.5); setAnnouncementVolume(1.0); }}
                            className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-sm"
                        >
                            Varsayılana Sıfırla
                        </button>
                    </div>
                </div>
            )}

            {/* Ses Uyarısı */}
            {!hasInteractedRef.current && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-yellow-500 text-black px-6 py-2 rounded-full font-bold animate-pulse">
                    🔊 Sesleri etkinleştirmek için ekrana tıklayın
                </div>
            )}

            {/* Ana 3 Sütunlu Grid */}
            <div className="h-screen pt-20 pb-4 px-4 grid grid-cols-1 xl:grid-cols-12 gap-4">

                {/* SOL SÜTUN - Bekleyen Sıralar */}
                <div className="hidden lg:flex lg:col-span-3 flex-col bg-slate-800/80 backdrop-blur-sm rounded-2xl border border-blue-500/30 p-4 overflow-hidden">
                    <h3 className="text-blue-300 font-bold uppercase tracking-wider text-2xl border-b border-blue-500/40 pb-3 mb-4 flex items-center justify-between">
                        <span>BEKLEYEN SIRALAR</span>
                        <span className="bg-blue-600 px-4 py-2 rounded-lg text-2xl font-black text-white">{waitingTickets.length}</span>
                    </h3>
                    <div className="flex-1 space-y-2 overflow-y-auto">
                        {waitingTickets.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-50">
                                <div className="text-4xl mb-2">💤</div>
                                <div className="text-lg text-center">Sırada kimse yok</div>
                            </div>
                        ) : (
                            waitingTickets.map((t, idx) => (
                                <div
                                    key={t.id}
                                    className="bg-white/5 p-3 rounded-xl border border-white/10 flex items-center gap-3 transition-all animate-in slide-in-from-left duration-300"
                                    style={{ animationDelay: `${idx * 50}ms` }}
                                >
                                    <div className="bg-blue-600 text-white font-black w-14 h-14 flex items-center justify-center rounded-full text-2xl border-2 border-blue-400">
                                        {String(t.no || '')}
                                    </div>
                                    <span className="text-xl font-medium truncate flex-1 text-white">{String(t.name || "Misafir")}</span>
                                    {idx === 0 && <span className="text-lime-400 font-bold text-base animate-pulse">SIRADA</span>}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* ORTA SÜTUN - Sıradaki Numara */}
                <div className="lg:col-span-5 flex flex-col items-center justify-center bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-purple-500/40 p-8">
                    <h1 className="text-3xl lg:text-4xl font-bold tracking-[0.15em] text-purple-300 uppercase mb-4">
                        SIRADAKİ NUMARA
                    </h1>

                    {currentTicket ? (
                        <div className="text-center animate-in zoom-in duration-500" style={{ transform: `scale(${fontScale})`, transformOrigin: 'center center' }}>
                            <div className="text-[12rem] lg:text-[18rem] font-black leading-none tracking-tighter text-white drop-shadow-[0_0_30px_rgba(168,85,247,0.8)]">
                                {String(currentTicket.no || '')}
                            </div>
                            {currentTicket.name && currentTicket.name !== "Misafir" && (
                                <div className="text-3xl lg:text-5xl font-medium mt-4 text-white/90">
                                    {String(currentTicket.name || '')}
                                </div>
                            )}
                            <div className="mt-8 inline-block px-10 py-4 bg-green-600 text-white rounded-full text-2xl font-bold border-2 border-green-400 animate-pulse shadow-lg shadow-green-500/30">
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
                <div className="hidden xl:flex xl:col-span-4 flex-col bg-slate-800/80 backdrop-blur-sm rounded-2xl border border-orange-500/30 p-4 overflow-hidden">
                    <h3 className="text-orange-300 font-bold uppercase tracking-wider text-xl border-b border-orange-500/40 pb-3 mb-3 flex items-center gap-2">
                        <span>📋</span>
                        <span>RANDEVUSU BULUNAN BİREYLER İÇİN GEREKLİ EVRAKLAR</span>
                    </h3>
                    <div className="flex-1 space-y-2">
                        {documents.map((item, idx) => (
                            <div
                                key={item.no}
                                className="bg-slate-700/50 p-3 rounded-xl border border-orange-500/20 flex items-start gap-3 animate-in slide-in-from-right duration-500"
                                style={{ animationDelay: `${idx * 100}ms` }}
                            >
                                <div className="bg-orange-600 text-white font-bold w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full text-base">
                                    {item.no}
                                </div>
                                <span className="text-lg font-semibold text-white leading-snug">{item.text}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Hidden YouTube Player (Müzik için) */}
            <div id="youtube-player" className="hidden"></div>

            {/* Görünür Video Player - Sıra yokken büyük, sıra varken küçük */}
            {videoPlaying && videoVideoId && (() => {
                // Sıra aktivitesi var mı kontrol et
                const hasQueueActivity = waitingTickets.length > 0 || currentTicket !== null;
                const isLarge = !hasQueueActivity;

                return (
                    <div
                        className={`fixed z-40 rounded-2xl overflow-hidden shadow-2xl border-2 border-blue-500/50 transition-all duration-500 ${isLarge
                                ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
                                : 'bottom-20 left-4'
                            }`}
                    >
                        <iframe
                            width={isLarge ? 960 : 400}
                            height={isLarge ? 540 : 225}
                            src={`https://www.youtube.com/embed/${videoVideoId}?autoplay=1&loop=1&playlist=${videoVideoId}&mute=0&controls=0`}
                            title="Video Player"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="rounded-2xl transition-all duration-500"
                        ></iframe>
                    </div>
                );
            })()}

            {/* Müzik Göstergesi */}
            {musicPlaying && (
                <div className="fixed bottom-4 right-4 z-50 bg-green-600/90 backdrop-blur-sm px-4 py-2 rounded-full flex items-center gap-2 animate-pulse">
                    <Music className="w-4 h-4" />
                    <span className="text-sm font-medium">Müzik çalıyor</span>
                </div>
            )}

            {/* Video Göstergesi */}
            {videoPlaying && (
                <div className="fixed bottom-4 left-4 z-50 bg-blue-600/90 backdrop-blur-sm px-4 py-2 rounded-full flex items-center gap-2">
                    <span className="text-sm font-medium">🎬 Video oynatılıyor</span>
                </div>
            )}
        </div>
    );
}
