"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useQueueSync } from "@/hooks/useQueueSync";
import { useAudioFeedback } from "@/hooks/useAudioFeedback";
import { QueueTicket } from "@/types";
import { format } from "date-fns";
import { Maximize2, Minimize2, Music, Volume2, VolumeX, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import QRCode from "react-qr-code";

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
    const { playDingDong, playTicketAdded } = useAudioFeedback();

    const [lastAnnouncedId, setLastAnnouncedId] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const hasInteractedRef = useRef(false);
    const prevWaitingCountRef = useRef<number>(0);

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

    // Sağ Panel Carousel State
    const [currentSlide, setCurrentSlide] = useState(0);
    const [weatherData, setWeatherData] = useState<{ temp: string, condition: string, icon: string } | null>(null);
    const [currentAwarenessMessage, setCurrentAwarenessMessage] = useState({
        text: "Her çocuk eşsizdir ve kendi yolculuğunda özeldir.",
        emoji: "🌟"
    });

    // Özel Eğitim Farkındalık Mesajları
    const awarenessMessages = [
        { text: "Her çocuk eşsizdir ve kendi yolculuğunda özeldir.", emoji: "🌟" },
        { text: "Farklılıklar bizi zenginleştirir, kapsayıcı olalım.", emoji: "🤝" },
        { text: "Özel gereksinimli bireyler toplumun ayrılmaz bir parçasıdır.", emoji: "💜" },
        { text: "Engel, bireyde değil toplumun bakış açısındadır.", emoji: "👁️" },
        { text: "Her birey kendi hızında öğrenir, sabırla destekleyelim.", emoji: "🐢" },
        { text: "Eğitim herkes için bir haktır, erişilebilir olmalıdır.", emoji: "📚" },
        { text: "Küçük adımlar büyük başarılara dönüşür.", emoji: "👣" },
        { text: "Anlayış ve empati, en güçlü destek araçlarıdır.", emoji: "💝" },
        { text: "Potansiyeli keşfetmek için fırsat vermek yeterlidir.", emoji: "🔑" },
        { text: "Birlikte daha güçlüyüz, işbirliği yapalım.", emoji: "🤲" },
        { text: "Her çocuğun güçlü yanları vardır, onları keşfedelim.", emoji: "💪" },
        { text: "Sabır ve sevgi, her engeli aşmanın anahtarıdır.", emoji: "❤️" },
    ];

    // Hava durumu çek (İzmir/Karşıyaka)
    useEffect(() => {
        const fetchWeather = async () => {
            try {
                // wttr.in API - JSON formatı daha güvenilir
                const response = await fetch('https://wttr.in/Izmir?format=j1');
                if (!response.ok) throw new Error('Weather API error');

                const data = await response.json();
                const current = data.current_condition?.[0];

                if (current) {
                    const tempC = current.temp_C + '°C';
                    const condition = current.lang_tr?.[0]?.value || current.weatherDesc?.[0]?.value || 'Açık';

                    // Hava durumuna göre emoji seç
                    let icon = '☀️';
                    const condLower = condition.toLowerCase();
                    if (condLower.includes('yağmur') || condLower.includes('rain')) icon = '🌧️';
                    else if (condLower.includes('bulut') || condLower.includes('cloud') || condLower.includes('parça')) icon = '⛅';
                    else if (condLower.includes('kar') || condLower.includes('snow')) icon = '❄️';
                    else if (condLower.includes('sis') || condLower.includes('fog') || condLower.includes('puslu')) icon = '🌫️';
                    else if (condLower.includes('fırtına') || condLower.includes('storm') || condLower.includes('gök gürültülü')) icon = '⛈️';
                    else if (condLower.includes('açık') || condLower.includes('güneş') || condLower.includes('sunny') || condLower.includes('clear')) icon = '☀️';

                    setWeatherData({ temp: tempC, condition: condition, icon });
                } else {
                    throw new Error('No weather data');
                }
            } catch (error) {
                console.log('[TV] Weather fetch error:', error);
                // Fallback: Basit metin formatı dene
                try {
                    const fallbackResponse = await fetch('https://wttr.in/Izmir?format=%t');
                    const tempText = await fallbackResponse.text();
                    setWeatherData({ temp: tempText.trim(), condition: 'İzmir', icon: '🌡️' });
                } catch {
                    setWeatherData({ temp: '15°C', condition: 'İzmir', icon: '☀️' });
                }
            }
        };

        fetchWeather();
        const weatherInterval = setInterval(fetchWeather, 60 * 60 * 1000); // 1 saatte bir güncelle (CPU optimizasyonu)
        return () => clearInterval(weatherInterval);
    }, []);

    // Carousel otomatik döngü (12 saniye - 9 slayt) - CPU optimized
    const TOTAL_SLIDES = 9;
    useEffect(() => {
        const slideInterval = setInterval(() => {
            setCurrentSlide(prev => {
                const nextSlide = (prev + 1) % TOTAL_SLIDES;
                // Farkındalık mesajını döndür (son slayta geçerken)
                if (nextSlide === TOTAL_SLIDES - 1) {
                    setCurrentAwarenessMessage(awarenessMessages[Math.floor(Math.random() * awarenessMessages.length)]);
                }
                return nextSlide;
            });
        }, 12000); // 12 saniye (CPU optimizasyonu için 8'den yükseltildi)
        return () => clearInterval(slideInterval);
    }, []); // Empty dependency - interval sadece mount'ta oluşturulur


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

    // Yeni sıra alındığında ses çal
    useEffect(() => {
        const currentCount = waitingTickets.length;
        const prevCount = prevWaitingCountRef.current;

        // Eğer sayı arttıysa yeni bilet alınmış demektir
        // hasInteractedRef.current olmadan da çalışsın çünkü kullanıcı etkileşimi olmadan da ses çalabilir
        if (currentCount > prevCount) {
            console.log("[TV] 🎫 NEW TICKET ADDED TO QUEUE! Playing sound...", { currentCount, prevCount });
            playTicketAdded();
        }

        prevWaitingCountRef.current = currentCount;
    }, [waitingTickets.length, playTicketAdded]);

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
            className="min-h-screen text-white overflow-hidden cursor-pointer relative"
            onClick={handleInteract}
            style={{
                background: 'linear-gradient(-45deg, #0f172a, #1e1b4b, #312e81, #1e3a8a, #0f172a)',
                backgroundSize: '400% 400%',
                animation: 'aurora-movement 15s ease infinite',
                // Font scale CSS değişkeni - tüm child elementlere uygulanacak
                ['--font-scale' as any]: fontScale
            }}
        >
            {/* Overlay gradient for depth */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-950/20 to-transparent pointer-events-none"></div>

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
            <div className="h-screen pt-20 pb-20 px-4 grid grid-cols-1 xl:grid-cols-12 gap-4">

                {/* SOL SÜTUN - Bekleyen Sıralar */}
                <div className="hidden lg:flex lg:col-span-3 flex-col bg-slate-800/80 backdrop-blur-sm rounded-2xl border border-blue-500/30 p-4 overflow-hidden">
                    <h3
                        className="text-blue-300 font-bold uppercase tracking-wider border-b border-blue-500/40 pb-3 mb-4 flex items-center justify-between"
                        style={{ fontSize: `calc(1.5rem * ${fontScale})` }}
                    >
                        <span>BEKLEYEN SIRALAR</span>
                        <span
                            className="bg-blue-600 px-4 py-2 rounded-lg font-black text-white"
                            style={{ fontSize: `calc(1.5rem * ${fontScale})` }}
                        >
                            {waitingTickets.length}
                        </span>
                    </h3>
                    <div className="flex-1 space-y-2 overflow-y-auto">
                        {waitingTickets.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-50">
                                <div style={{ fontSize: `calc(2.5rem * ${fontScale})` }} className="mb-2">💤</div>
                                <div style={{ fontSize: `calc(1.125rem * ${fontScale})` }} className="text-center">Sırada kimse yok</div>
                            </div>
                        ) : (
                            waitingTickets.map((t, idx) => (
                                <div
                                    key={t.id}
                                    className="bg-white/5 p-3 rounded-xl border border-white/10 flex items-center gap-3 transition-all animate-in slide-in-from-left duration-300"
                                    style={{ animationDelay: `${idx * 50}ms` }}
                                >
                                    <div
                                        className="bg-blue-600 text-white font-black flex items-center justify-center rounded-full border-2 border-blue-400"
                                        style={{
                                            width: `calc(3.5rem * ${fontScale})`,
                                            height: `calc(3.5rem * ${fontScale})`,
                                            fontSize: `calc(1.5rem * ${fontScale})`
                                        }}
                                    >
                                        {String(t.no || '')}
                                    </div>
                                    <span
                                        className="font-medium truncate flex-1 text-white"
                                        style={{ fontSize: `calc(1.25rem * ${fontScale})` }}
                                    >
                                        {String(t.name || "Misafir")}
                                    </span>
                                    {idx === 0 && (
                                        <span
                                            className="text-lime-400 font-bold animate-pulse"
                                            style={{ fontSize: `calc(1rem * ${fontScale})` }}
                                        >
                                            SIRADA
                                        </span>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Tahmini Bekleme Süresi */}
                    {waitingTickets.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-blue-500/30">
                            <div className="flex items-center justify-center gap-2 text-yellow-400">
                                <Clock style={{ width: `calc(1.25rem * ${fontScale})`, height: `calc(1.25rem * ${fontScale})` }} />
                                <span style={{ fontSize: `calc(1.125rem * ${fontScale})` }} className="font-bold">Tahmini Bekleme:</span>
                                <span style={{ fontSize: `calc(1.5rem * ${fontScale})` }} className="font-black">~{waitingTickets.length * 15} dk</span>
                            </div>
                        </div>
                    )}

                    {/* QR Kod - Mobil Takip */}
                    <div className="mt-4 pt-4 border-t border-blue-500/30 flex flex-col items-center">
                        <p className="text-sm text-slate-400 mb-2 text-center">📱 Sıranızı telefonunuzdan takip edin</p>
                        <div className="bg-white p-2 rounded-xl">
                            <QRCode
                                value={typeof window !== 'undefined' ? `${window.location.origin}/sira-al` : 'https://localhost:3000/sira-al'}
                                size={80}
                                level="M"
                            />
                        </div>
                    </div>
                </div>

                {/* ORTA SÜTUN - Sıradaki Numara */}
                <div className="lg:col-span-5 flex flex-col items-center justify-center bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-purple-500/40 p-8 relative overflow-hidden">
                    {/* Glow effect background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 via-transparent to-blue-600/10 pointer-events-none"></div>

                    <h1 className="text-3xl lg:text-4xl font-bold tracking-[0.15em] text-purple-300 uppercase mb-4 relative z-10">
                        SIRADAKİ NUMARA
                    </h1>

                    {currentTicket ? (
                        <div
                            key={currentTicket.id}
                            className="text-center relative z-10"
                            style={{
                                transform: `scale(${fontScale})`,
                                transformOrigin: 'center center',
                                animation: 'flip-board-enter 1s cubic-bezier(0.34, 1.56, 0.64, 1)'
                            }}
                        >
                            <div
                                className="font-black leading-none tracking-tighter text-white relative"
                                style={{
                                    fontSize: 'clamp(8rem, 18vw, 18rem)',
                                    fontFamily: 'var(--font-outfit), sans-serif',
                                    animation: 'text-glow 2s ease-in-out infinite'
                                }}
                            >
                                {String(currentTicket.no || '')}
                            </div>
                            {currentTicket.name && currentTicket.name !== "Misafir" && (
                                <div className="text-3xl lg:text-5xl font-medium mt-4 text-white/90" style={{ fontFamily: 'var(--font-outfit), sans-serif' }}>
                                    {String(currentTicket.name || '')}
                                </div>
                            )}
                            <div className="mt-8 inline-block px-10 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-full text-2xl font-bold border-2 border-green-400 animate-pulse shadow-lg shadow-green-500/50">
                                ✓ GÖRÜŞME ODASINA GEÇİNİZ
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8 relative z-10">
                            <div className="text-8xl lg:text-9xl font-light text-slate-600 mb-4" style={{ fontFamily: 'var(--font-outfit), sans-serif' }}>—</div>
                            <div className="text-3xl font-light text-slate-500">Bekleniyor...</div>
                        </div>
                    )}
                </div>

                {/* SAĞ SÜTUN - Dinamik Carousel */}
                <div className="hidden xl:flex xl:col-span-4 flex-col bg-slate-800/80 backdrop-blur-sm rounded-2xl border border-orange-500/30 p-6 overflow-hidden relative">

                    {/* Slide Indicators */}
                    <div className="absolute top-6 right-6 flex gap-1.5 z-10">
                        {Array.from({ length: 9 }, (_, i) => (
                            <div
                                key={i}
                                className={`h-2 rounded-full transition-all duration-500 ${currentSlide === i ? 'bg-orange-400 w-6' : 'bg-white/30 w-2'}`}
                            />
                        ))}
                    </div>

                    {/* Slide 0: Gerekli Evraklar */}
                    <div
                        className={`flex-1 flex flex-col transition-all duration-700 ease-in-out ${currentSlide === 0 ? 'opacity-100 scale-100' : 'opacity-0 scale-95 absolute inset-0 pointer-events-none'}`}
                    >
                        <h3 className="text-orange-300 font-black uppercase tracking-wider text-2xl border-b border-orange-500/40 pb-4 mb-4 flex items-center gap-3">
                            <span className="text-3xl">📋</span>
                            <span>GEREKLİ EVRAKLAR</span>
                        </h3>
                        <div className="flex-1 space-y-3">
                            {documents.map((item) => (
                                <div
                                    key={item.no}
                                    className="bg-slate-700/50 p-4 rounded-xl border border-orange-500/20 flex items-start gap-4"
                                >
                                    <div className="bg-orange-600 text-white font-black w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-full text-xl">
                                        {item.no}
                                    </div>
                                    <span className="text-xl font-bold text-white leading-snug">{item.text}</span>
                                </div>
                            ))}
                        </div>

                        {/* Öğle Arası Uyarısı */}
                        <div className="mt-4 px-4 py-3 bg-yellow-500/20 border border-yellow-500/50 rounded-xl flex items-center gap-3">
                            <span className="text-2xl">⏰</span>
                            <span className="text-lg font-bold text-yellow-300">ÖĞLE ARASI: 12:30 - 13:30</span>
                        </div>
                    </div>

                    {/* Slide 1: Kurum Duyurusu */}
                    <div
                        className={`flex-1 flex flex-col items-center justify-center transition-all duration-700 ease-in-out ${currentSlide === 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-95 absolute inset-0 pointer-events-none'}`}
                    >
                        <h3
                            className="text-blue-300 font-black uppercase tracking-wider border-b border-blue-500/40 pb-3 mb-6 flex items-center gap-3 w-full"
                            style={{ fontSize: `calc(1.25rem * ${fontScale})` }}
                        >
                            <span style={{ fontSize: `calc(1.5rem * ${fontScale})` }}>📢</span>
                            <span>KURUM DUYURUSU</span>
                        </h3>
                        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
                            <div style={{ fontSize: `calc(4rem * ${fontScale})` }} className="mb-6">🏫</div>
                            <h4
                                className="font-black text-white mb-4"
                                style={{ fontSize: `calc(1.5rem * ${fontScale})`, fontFamily: 'var(--font-outfit), sans-serif' }}
                            >
                                KARŞIYAKA RAM
                            </h4>
                            <p style={{ fontSize: `calc(1rem * ${fontScale})` }} className="text-slate-300 leading-relaxed mb-4">
                                Değerli velilerimiz, randevu saatinizden <span className="text-yellow-400 font-bold">15 dakika önce</span> kurumumuzda bulunmanızı rica ederiz.
                            </p>
                            <p style={{ fontSize: `calc(1rem * ${fontScale})` }} className="text-slate-300 leading-relaxed">
                                Gerekli evraklarınızı <span className="text-orange-400 font-bold">eksiksiz</span> getirmeniz işlemlerinizin hızlanmasını sağlayacaktır.
                            </p>
                            <div className="mt-6 px-6 py-3 bg-blue-600/30 rounded-2xl border border-blue-500/50">
                                <p style={{ fontSize: `calc(0.875rem * ${fontScale})` }} className="text-blue-200">
                                    📞 İletişim: <span style={{ fontSize: `calc(1rem * ${fontScale})` }} className="font-black">(0232) 368 89 85</span>
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Slide 2: Hava Durumu */}
                    <div
                        className={`flex-1 flex flex-col items-center justify-center transition-all duration-700 ease-in-out ${currentSlide === 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-95 absolute inset-0 pointer-events-none'}`}
                    >
                        <h3 className="text-cyan-300 font-black uppercase tracking-wider text-2xl border-b border-cyan-500/40 pb-4 mb-8 flex items-center gap-3 w-full">
                            <span className="text-3xl">🌤️</span>
                            <span>HAVA DURUMU - KARŞIYAKA</span>
                        </h3>
                        <div className="flex-1 flex flex-col items-center justify-center">
                            <div style={{ fontSize: '10rem' }} className="mb-6">{weatherData?.icon || '🌡️'}</div>
                            <div className="text-8xl font-black text-white mb-4" style={{ fontFamily: 'var(--font-outfit), sans-serif' }}>
                                {weatherData?.temp || '—'}
                            </div>
                            <div className="text-3xl text-slate-300 capitalize font-semibold">
                                {weatherData?.condition || 'Yükleniyor...'}
                            </div>
                            <div className="mt-8 text-slate-400 text-lg">
                                📍 İzmir, Karşıyaka
                            </div>
                        </div>
                    </div>

                    {/* Slide 3: Özel Eğitim Hakları */}
                    <div
                        className={`flex-1 flex flex-col transition-all duration-700 ease-in-out p-2 ${currentSlide === 3 ? 'opacity-100 scale-100' : 'opacity-0 scale-95 absolute inset-0 pointer-events-none'}`}
                    >
                        <h3
                            className="text-emerald-300 font-black uppercase tracking-wider border-b border-emerald-500/40 pb-3 mb-4 flex items-center gap-3"
                            style={{ fontSize: `calc(1.25rem * ${fontScale})` }}
                        >
                            <span style={{ fontSize: `calc(1.5rem * ${fontScale})` }}>⚖️</span>
                            <span>ÖZEL EĞİTİM HAKLARI</span>
                        </h3>
                        <div className="flex-1 space-y-3 overflow-y-auto">
                            <div className="bg-emerald-900/30 p-3 rounded-xl border border-emerald-500/30">
                                <div className="flex items-start gap-3">
                                    <span style={{ fontSize: `calc(1.5rem * ${fontScale})` }}>📚</span>
                                    <div>
                                        <h4 className="font-bold text-emerald-200" style={{ fontSize: `calc(1.125rem * ${fontScale})` }}>Kaynaştırma/Bütünleştirme Eğitimi</h4>
                                        <p className="text-slate-300" style={{ fontSize: `calc(0.875rem * ${fontScale})` }}>Özel gereksinimli öğrenciler, akranlarıyla birlikte normal sınıflarda eğitim alma hakkına sahiptir.</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-emerald-900/30 p-3 rounded-xl border border-emerald-500/30">
                                <div className="flex items-start gap-3">
                                    <span style={{ fontSize: `calc(1.5rem * ${fontScale})` }}>📝</span>
                                    <div>
                                        <h4 className="font-bold text-emerald-200" style={{ fontSize: `calc(1.125rem * ${fontScale})` }}>BEP (Bireyselleştirilmiş Eğitim Programı)</h4>
                                        <p className="text-slate-300" style={{ fontSize: `calc(0.875rem * ${fontScale})` }}>Her öğrencinin ihtiyaçlarına göre özel hazırlanan eğitim programı.</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-emerald-900/30 p-3 rounded-xl border border-emerald-500/30">
                                <div className="flex items-start gap-3">
                                    <span style={{ fontSize: `calc(1.5rem * ${fontScale})` }}>🏫</span>
                                    <div>
                                        <h4 className="font-bold text-emerald-200" style={{ fontSize: `calc(1.125rem * ${fontScale})` }}>Destek Eğitim Odası</h4>
                                        <p className="text-slate-300" style={{ fontSize: `calc(0.875rem * ${fontScale})` }}>Okullarda bireysel veya küçük gruplarla özel destek eğitimi hakkı.</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-emerald-900/30 p-3 rounded-xl border border-emerald-500/30">
                                <div className="flex items-start gap-3">
                                    <span style={{ fontSize: `calc(1.5rem * ${fontScale})` }}>🆓</span>
                                    <div>
                                        <h4 className="font-bold text-emerald-200" style={{ fontSize: `calc(1.125rem * ${fontScale})` }}>Ücretsiz RAM Hizmetleri</h4>
                                        <p className="text-slate-300" style={{ fontSize: `calc(0.875rem * ${fontScale})` }}>Tüm değerlendirme ve rehberlik hizmetleri ücretsizdir.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Slide 4: Tanılama Süreci */}
                    <div
                        className={`flex-1 flex flex-col transition-all duration-700 ease-in-out p-2 ${currentSlide === 4 ? 'opacity-100 scale-100' : 'opacity-0 scale-95 absolute inset-0 pointer-events-none'}`}
                    >
                        <h3
                            className="text-sky-300 font-black uppercase tracking-wider border-b border-sky-500/40 pb-3 mb-4 flex items-center gap-3"
                            style={{ fontSize: `calc(1.25rem * ${fontScale})` }}
                        >
                            <span style={{ fontSize: `calc(1.5rem * ${fontScale})` }}>🔍</span>
                            <span>TANILAMA SÜRECİ</span>
                        </h3>
                        <div className="flex-1 flex flex-col justify-center space-y-4">
                            <div className="flex items-center gap-4">
                                <div
                                    className="bg-sky-600 text-white font-black flex items-center justify-center rounded-full flex-shrink-0"
                                    style={{ width: `calc(3rem * ${fontScale})`, height: `calc(3rem * ${fontScale})`, fontSize: `calc(1.25rem * ${fontScale})` }}
                                >1</div>
                                <div className="bg-sky-900/40 p-3 rounded-xl flex-1 border border-sky-500/30">
                                    <h4 className="font-bold text-sky-200" style={{ fontSize: `calc(1rem * ${fontScale})` }}>Başvuru</h4>
                                    <p className="text-slate-300" style={{ fontSize: `calc(0.875rem * ${fontScale})` }}>Okul veya aile, RAM'a başvurur</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div
                                    className="bg-sky-600 text-white font-black flex items-center justify-center rounded-full flex-shrink-0"
                                    style={{ width: `calc(3rem * ${fontScale})`, height: `calc(3rem * ${fontScale})`, fontSize: `calc(1.25rem * ${fontScale})` }}
                                >2</div>
                                <div className="bg-sky-900/40 p-3 rounded-xl flex-1 border border-sky-500/30">
                                    <h4 className="font-bold text-sky-200" style={{ fontSize: `calc(1rem * ${fontScale})` }}>Randevu</h4>
                                    <p className="text-slate-300" style={{ fontSize: `calc(0.875rem * ${fontScale})` }}>Değerlendirme için randevu alınır</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div
                                    className="bg-sky-600 text-white font-black flex items-center justify-center rounded-full flex-shrink-0"
                                    style={{ width: `calc(3rem * ${fontScale})`, height: `calc(3rem * ${fontScale})`, fontSize: `calc(1.25rem * ${fontScale})` }}
                                >3</div>
                                <div className="bg-sky-900/40 p-3 rounded-xl flex-1 border border-sky-500/30">
                                    <h4 className="font-bold text-sky-200" style={{ fontSize: `calc(1rem * ${fontScale})` }}>Değerlendirme</h4>
                                    <p className="text-slate-300" style={{ fontSize: `calc(0.875rem * ${fontScale})` }}>Uzmanlar tarafından eğitsel değerlendirme yapılır</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div
                                    className="bg-sky-600 text-white font-black flex items-center justify-center rounded-full flex-shrink-0"
                                    style={{ width: `calc(3rem * ${fontScale})`, height: `calc(3rem * ${fontScale})`, fontSize: `calc(1.25rem * ${fontScale})` }}
                                >4</div>
                                <div className="bg-sky-900/40 p-3 rounded-xl flex-1 border border-sky-500/30">
                                    <h4 className="font-bold text-sky-200" style={{ fontSize: `calc(1rem * ${fontScale})` }}>Rapor</h4>
                                    <p className="text-slate-300" style={{ fontSize: `calc(0.875rem * ${fontScale})` }}>Bireysel Gelişim Raporu hazırlanır ve yönlendirme yapılır</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Slide 5: Özel Eğitim Türleri */}
                    <div
                        className={`flex-1 flex flex-col transition-all duration-700 ease-in-out p-2 ${currentSlide === 5 ? 'opacity-100 scale-100' : 'opacity-0 scale-95 absolute inset-0 pointer-events-none'}`}
                    >
                        <h3
                            className="text-pink-300 font-black uppercase tracking-wider border-b border-pink-500/40 pb-3 mb-4 flex items-center gap-3"
                            style={{ fontSize: `calc(1.25rem * ${fontScale})` }}
                        >
                            <span style={{ fontSize: `calc(1.5rem * ${fontScale})` }}>🎓</span>
                            <span>ÖZEL EĞİTİM TÜRLERİ</span>
                        </h3>
                        <div className="flex-1 grid grid-cols-2 gap-3">
                            <div className="bg-pink-900/30 p-4 rounded-xl border border-pink-500/30 flex flex-col items-center text-center">
                                <span style={{ fontSize: `calc(2.5rem * ${fontScale})` }} className="mb-2">🏫</span>
                                <h4 className="font-bold text-pink-200" style={{ fontSize: `calc(1.125rem * ${fontScale})` }}>Kaynaştırma Eğitimi</h4>
                                <p className="text-slate-300 mt-1" style={{ fontSize: `calc(0.75rem * ${fontScale})` }}>Normal sınıflarda akranlarla birlikte eğitim</p>
                            </div>
                            <div className="bg-pink-900/30 p-4 rounded-xl border border-pink-500/30 flex flex-col items-center text-center">
                                <span style={{ fontSize: `calc(2.5rem * ${fontScale})` }} className="mb-2">👥</span>
                                <h4 className="font-bold text-pink-200" style={{ fontSize: `calc(1.125rem * ${fontScale})` }}>Özel Eğitim Sınıfı</h4>
                                <p className="text-slate-300 mt-1" style={{ fontSize: `calc(0.75rem * ${fontScale})` }}>Okul içinde ayrı sınıflarda eğitim</p>
                            </div>
                            <div className="bg-pink-900/30 p-4 rounded-xl border border-pink-500/30 flex flex-col items-center text-center">
                                <span style={{ fontSize: `calc(2.5rem * ${fontScale})` }} className="mb-2">🏛️</span>
                                <h4 className="font-bold text-pink-200" style={{ fontSize: `calc(1.125rem * ${fontScale})` }}>Uygulama Okulu</h4>
                                <p className="text-slate-300 mt-1" style={{ fontSize: `calc(0.75rem * ${fontScale})` }}>Özel eğitim uygulama okullarında tam zamanlı eğitim</p>
                            </div>
                            <div className="bg-pink-900/30 p-4 rounded-xl border border-pink-500/30 flex flex-col items-center text-center">
                                <span style={{ fontSize: `calc(2.5rem * ${fontScale})` }} className="mb-2">🏠</span>
                                <h4 className="font-bold text-pink-200" style={{ fontSize: `calc(1.125rem * ${fontScale})` }}>Evde Eğitim</h4>
                                <p className="text-slate-300 mt-1" style={{ fontSize: `calc(0.75rem * ${fontScale})` }}>Sağlık durumu nedeniyle evde eğitim hizmeti</p>
                            </div>
                        </div>
                    </div>

                    {/* Slide 6: Evde Destek İpuçları */}
                    <div
                        className={`flex-1 flex flex-col transition-all duration-700 ease-in-out p-2 ${currentSlide === 6 ? 'opacity-100 scale-100' : 'opacity-0 scale-95 absolute inset-0 pointer-events-none'}`}
                    >
                        <h3
                            className="text-amber-300 font-black uppercase tracking-wider border-b border-amber-500/40 pb-3 mb-4 flex items-center gap-3"
                            style={{ fontSize: `calc(1.25rem * ${fontScale})` }}
                        >
                            <span style={{ fontSize: `calc(1.5rem * ${fontScale})` }}>🏠</span>
                            <span>EVDE DESTEK İPUÇLARI</span>
                        </h3>
                        <div className="flex-1 space-y-3 overflow-y-auto">
                            <div className="bg-amber-900/30 p-3 rounded-xl border border-amber-500/30 flex items-start gap-3">
                                <span style={{ fontSize: `calc(1.5rem * ${fontScale})` }}>⏰</span>
                                <div>
                                    <h4 className="font-bold text-amber-200" style={{ fontSize: `calc(1rem * ${fontScale})` }}>Düzenli Rutinler Oluşturun</h4>
                                    <p className="text-slate-300" style={{ fontSize: `calc(0.875rem * ${fontScale})` }}>Günlük programlar çocuğunuzun güvende hissetmesini sağlar.</p>
                                </div>
                            </div>
                            <div className="bg-amber-900/30 p-3 rounded-xl border border-amber-500/30 flex items-start gap-3">
                                <span style={{ fontSize: `calc(1.5rem * ${fontScale})` }}>🎯</span>
                                <div>
                                    <h4 className="font-bold text-amber-200" style={{ fontSize: `calc(1rem * ${fontScale})` }}>Küçük Hedefler Belirleyin</h4>
                                    <p className="text-slate-300" style={{ fontSize: `calc(0.875rem * ${fontScale})` }}>Ulaşılabilir hedefler motivasyonu artırır.</p>
                                </div>
                            </div>
                            <div className="bg-amber-900/30 p-3 rounded-xl border border-amber-500/30 flex items-start gap-3">
                                <span style={{ fontSize: `calc(1.5rem * ${fontScale})` }}>🎮</span>
                                <div>
                                    <h4 className="font-bold text-amber-200" style={{ fontSize: `calc(1rem * ${fontScale})` }}>Oyun ile Öğrenme</h4>
                                    <p className="text-slate-300" style={{ fontSize: `calc(0.875rem * ${fontScale})` }}>Eğitici oyunlar öğrenmeyi keyifli hale getirir.</p>
                                </div>
                            </div>
                            <div className="bg-amber-900/30 p-3 rounded-xl border border-amber-500/30 flex items-start gap-3">
                                <span style={{ fontSize: `calc(1.5rem * ${fontScale})` }}>💪</span>
                                <div>
                                    <h4 className="font-bold text-amber-200" style={{ fontSize: `calc(1rem * ${fontScale})` }}>Sabırlı ve Destekleyici Olun</h4>
                                    <p className="text-slate-300" style={{ fontSize: `calc(0.875rem * ${fontScale})` }}>Her başarıyı kutlayın, süreci destekleyin.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Slide 7: Önemli Hatırlatmalar */}
                    <div
                        className={`flex-1 flex flex-col transition-all duration-700 ease-in-out p-2 ${currentSlide === 7 ? 'opacity-100 scale-100' : 'opacity-0 scale-95 absolute inset-0 pointer-events-none'}`}
                    >
                        <h3
                            className="text-red-300 font-black uppercase tracking-wider border-b border-red-500/40 pb-3 mb-4 flex items-center gap-3"
                            style={{ fontSize: `calc(1.25rem * ${fontScale})` }}
                        >
                            <span style={{ fontSize: `calc(1.5rem * ${fontScale})` }}>📅</span>
                            <span>ÖNEMLİ HATIRLATMALAR</span>
                        </h3>
                        <div className="flex-1 space-y-3 overflow-y-auto">
                            <div className="bg-red-900/30 p-4 rounded-xl border border-red-500/30">
                                <div className="flex items-center gap-3 mb-2">
                                    <span style={{ fontSize: `calc(1.5rem * ${fontScale})` }}>📋</span>
                                    <h4 className="font-bold text-red-200" style={{ fontSize: `calc(1.125rem * ${fontScale})` }}>Rapor Yenileme</h4>
                                </div>
                                <p className="text-slate-300" style={{ fontSize: `calc(0.875rem * ${fontScale})` }}>Bireysel Gelişim Raporları süre sonunda yenilenmelidir. Sürenizi takip edin!</p>
                            </div>
                            <div className="bg-red-900/30 p-4 rounded-xl border border-red-500/30">
                                <div className="flex items-center gap-3 mb-2">
                                    <span style={{ fontSize: `calc(1.5rem * ${fontScale})` }}>📚</span>
                                    <h4 className="font-bold text-red-200" style={{ fontSize: `calc(1.125rem * ${fontScale})` }}>Kayıt Dönemleri</h4>
                                </div>
                                <p className="text-slate-300" style={{ fontSize: `calc(0.875rem * ${fontScale})` }}>Okul kayıt dönemlerinde gerekli evraklarınızı hazır bulundurun.</p>
                            </div>
                            <div className="bg-red-900/30 p-4 rounded-xl border border-red-500/30">
                                <div className="flex items-center gap-3 mb-2">
                                    <span style={{ fontSize: `calc(1.5rem * ${fontScale})` }}>🔄</span>
                                    <h4 className="font-bold text-red-200" style={{ fontSize: `calc(1.125rem * ${fontScale})` }}>BEP Toplantıları</h4>
                                </div>
                                <p className="text-slate-300" style={{ fontSize: `calc(0.875rem * ${fontScale})` }}>BEP toplantılarına katılım zorunludur. Okulunuzla iletişimde kalın.</p>
                            </div>
                        </div>
                    </div>

                    {/* Slide 8: Farkındalık Mesajları (Dinamik) */}
                    <div
                        className={`flex-1 flex flex-col items-center justify-center transition-all duration-700 ease-in-out ${currentSlide === 8 ? 'opacity-100 scale-100' : 'opacity-0 scale-95 absolute inset-0 pointer-events-none'}`}
                    >
                        <h3
                            className="text-violet-300 font-black uppercase tracking-wider border-b border-violet-500/40 pb-3 mb-6 flex items-center gap-3 w-full"
                            style={{ fontSize: `calc(1.25rem * ${fontScale})` }}
                        >
                            <span style={{ fontSize: `calc(1.5rem * ${fontScale})` }}>💜</span>
                            <span>ÖZEL EĞİTİM FARKINDALIĞI</span>
                        </h3>
                        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
                            <div style={{ fontSize: `calc(6rem * ${fontScale})` }} className="mb-8">{currentAwarenessMessage.emoji}</div>
                            <blockquote className="text-white leading-relaxed mb-8 font-medium" style={{ fontSize: `calc(2rem * ${fontScale})` }}>
                                "{currentAwarenessMessage.text}"
                            </blockquote>
                            <div className="grid grid-cols-3 gap-4 mt-4">
                                <div className="bg-violet-900/40 p-3 rounded-xl text-center">
                                    <div style={{ fontSize: `calc(2rem * ${fontScale})` }} className="mb-1">🤝</div>
                                    <p className="text-violet-200 font-semibold" style={{ fontSize: `calc(0.75rem * ${fontScale})` }}>Kapsayıcı Ol</p>
                                </div>
                                <div className="bg-violet-900/40 p-3 rounded-xl text-center">
                                    <div style={{ fontSize: `calc(2rem * ${fontScale})` }} className="mb-1">👂</div>
                                    <p className="text-violet-200 font-semibold" style={{ fontSize: `calc(0.75rem * ${fontScale})` }}>Dinle ve Anla</p>
                                </div>
                                <div className="bg-violet-900/40 p-3 rounded-xl text-center">
                                    <div style={{ fontSize: `calc(2rem * ${fontScale})` }} className="mb-1">💪</div>
                                    <p className="text-violet-200 font-semibold" style={{ fontSize: `calc(0.75rem * ${fontScale})` }}>Destekle</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Hidden YouTube Player (Müzik için) */}
            {/* Hidden YouTube Player (Müzik için) */}
            <div id="youtube-player" className="absolute top-[-9999px] left-[-9999px] opacity-0 pointer-events-none"></div>

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

            {/* Marquee Ticker - Announcements */}
            <div
                className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-orange-600 via-red-600 to-orange-600 z-50 overflow-hidden border-t-2 border-orange-400"
                style={{ height: `calc(4rem * ${fontScale})` }}
            >
                <div
                    className="flex items-center h-full whitespace-nowrap text-white font-black"
                    style={{
                        animation: 'marquee 45s linear infinite',
                        fontSize: `calc(1.25rem * ${fontScale})`
                    }}
                >
                    <span className="px-8">📋 RANDEVUSU OLAN BİREYLER GEREKLİ EVRAKLARI HAZIR BULUNDURMALARI GEREKMEKTEDİR</span>
                    <span className="px-8">⏰ ÖĞLE ARASI: 12:30 - 13:30</span>
                    <span className="px-8">📞 BİLGİ İÇİN: (0232) 368 89 85</span>
                    <span className="px-8">🏥 KARŞIYAKA REHBERLİK VE ARAŞTIRMA MERKEZİ</span>
                    <span className="px-8">📋 RANDEVUSU OLAN BİREYLER GEREKLİ EVRAKLARI HAZIR BULUNDURMALARI GEREKMEKTEDİR</span>
                    <span className="px-8">⏰ ÖĞLE ARASI: 12:30 - 13:30</span>
                </div>
            </div>
        </div>
    );
}
