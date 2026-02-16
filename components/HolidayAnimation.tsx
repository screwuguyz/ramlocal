"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useAppStore } from "@/stores/useAppStore";
import confetti from "canvas-confetti";
import { X } from "lucide-react";

// Türkiye'deki önemli günler ve bayramlar
interface Holiday {
    name: string;
    emoji: string;
    colors: string[];
    particles: string[];
    message?: string;
}

import Holidays from "date-holidays";

// Dinamik Tatil Hesaplayıcı (Türkiye için)
const hd = new Holidays("TR");

// Türkiye'deki önemli günler ve bayramlar için emoji ve renk eşleştirmeleri
const HOLIDAY_STYLES: Record<string, any> = {
    "Ramazan Bayramı": { emoji: "🌙", colors: ["#FFD700", "#32CD32"], particles: ["🌙", "⭐", "✨"], message: "Ramazan Bayramınız Kutlu Olsun!" },
    "Kurban Bayramı": { emoji: "🕌", colors: ["#228B22", "#FFD700"], particles: ["🕌", "🌙", "⭐"], message: "Kurban Bayramınız Kutlu Olsun!" },
    "Yılbaşı": { emoji: "🎆", colors: ["#FFD700", "#FF6B6B", "#4ECDC4"], particles: ["❄️", "⭐", "🎉", "✨"], message: "Yeni Yılınız Kutlu Olsun! 🎊" },
    "Ulusal Egemenlik ve Çocuk Bayramı": { emoji: "🇹🇷", colors: ["#E30A17", "#FFFFFF"], particles: ["🇹🇷", "🎈", "🎉", "👧", "👦"], message: "23 Nisan Ulusal Egemenlik ve Çocuk Bayramı Kutlu Olsun!" },
    "Atatürk'ü Anma, Gençlik ve Spor Bayramı": { emoji: "🇹🇷", colors: ["#E30A17", "#FFFFFF"], particles: ["🇹🇷", "⚽", "🏃", "🎾"], message: "19 Mayıs Atatürk'ü Anma, Gençlik ve Spor Bayramı Kutlu Olsun!" },
    "Zafer Bayramı": { emoji: "🇹🇷", colors: ["#E30A17", "#FFFFFF"], particles: ["🇹🇷", "⭐", "🎖️"], message: "30 Ağustos Zafer Bayramı Kutlu Olsun!" },
    "Cumhuriyet Bayramı": { emoji: "🇹🇷", colors: ["#E30A17", "#FFFFFF"], particles: ["🇹🇷", "🎆", "🎉", "⭐"], message: "Cumhuriyet Bayramımız Kutlu Olsun! 🇹🇷" },
    "Demokrasi ve Milli Birlik Günü": { emoji: "🇹🇷", colors: ["#E30A17", "#FFFFFF"], particles: ["🇹🇷", "⭐", "🎗️"], message: "15 Temmuz Demokrasi ve Milli Birlik Günü Kutlu Olsun!" },
};

import { STATIC_BIRTHDAYS } from "@/lib/birthdays";

interface Particle {
    id: number;
    x: number;
    y: number;
    size: number;
    speed: number;
    opacity: number;
    char: string;
    drift: number;
}

export default function HolidayAnimation() {
    const [particles, setParticles] = useState<Particle[]>([]);
    const [showMessage, setShowMessage] = useState(true);

    // Teachers store'dan doğum günlerini dinamik olarak oku
    const teachers = useAppStore((state) => state.teachers);

    // Bugünkü tatili veya doğum gününü hesapla
    const holiday = useMemo(() => {
        const now = new Date();
        const monthDay = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        // date-holidays ile kontrol et
        const hFound = hd.isHoliday(now);
        if (hFound && Array.isArray(hFound) && hFound.length > 0) {
            const h = hFound[0];
            const style = HOLIDAY_STYLES[h.name] || {
                name: h.name,
                emoji: "🎉",
                colors: ["#FFD700", "#FF6B6B"],
                particles: ["✨", "⭐", "🎉"],
                message: `${h.name} Kutlu Olsun!`
            };
            return { ...style, name: h.name };
        }

        // Doğum günlerini kontrol et (dinamik + sabit)
        const birthdayNames: string[] = [];

        // Sabit listeden
        if (STATIC_BIRTHDAYS[monthDay]) {
            birthdayNames.push(...STATIC_BIRTHDAYS[monthDay]);
        }

        // Teachers store'dan (yeni eklenenler)
        teachers.forEach(t => {
            if (t.birthDate === monthDay && t.active) {
                // Sabit listede yoksa ekle
                if (!birthdayNames.includes(t.name)) {
                    birthdayNames.push(t.name);
                }
            }
        });

        if (birthdayNames.length > 0) {
            const names = birthdayNames.join(" ve ");
            return {
                name: "Doğum Günü",
                emoji: "🎂",
                colors: ["#FF69B4", "#9B59B6"],
                particles: ["🎂", "🎁", "🎈", "🎉", "✨", "💐"],
                message: `🎂 İyi ki Doğdun ${names}! 🎉`
            };
        }

        return null;
    }, [teachers]);

    useEffect(() => {
        if (!holiday) return;

        // Bayram veya Doğum günü ise Konfeti patlat (canvas-confetti)
        // İlk yüklemede ve aralıklarla
        const triggerConfetti = () => {
            const end = Date.now() + 3 * 1000;
            const colors = holiday.colors || ["#ff69b4", "#ff1493", "#ffd700"];

            (function frame() {
                confetti({
                    particleCount: 2,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0 },
                    colors: colors
                });
                confetti({
                    particleCount: 2,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1 },
                    colors: colors
                });

                if (Date.now() < end) {
                    requestAnimationFrame(frame);
                }
            }());
        };

        triggerConfetti();
        const confettiInterval = setInterval(triggerConfetti, 15000); // 15 saniyede bir tekrarla

        // Başlangıç partikülleri oluştur (Yavaş yavaş düşen emojiler)
        const initialParticles: Particle[] = [];
        for (let i = 0; i < 40; i++) {
            initialParticles.push({
                id: i,
                x: Math.random() * 100,
                y: Math.random() * 100 - 100,
                size: Math.random() * 25 + 15,
                speed: Math.random() * 1.5 + 0.5,
                opacity: Math.random() * 0.6 + 0.4,
                char: holiday.particles[Math.floor(Math.random() * holiday.particles.length)],
                drift: (Math.random() - 0.5) * 2,
            });
        }
        setParticles(initialParticles);

        // Animasyon döngüsü (Emojiler için)
        const interval = setInterval(() => {
            setParticles(prev => prev.map(p => {
                let newY = p.y + p.speed;
                let newX = p.x + p.drift * 0.1;

                if (newY > 110) {
                    newY = -10;
                    newX = Math.random() * 100;
                }

                if (newX < -5) newX = 105;
                if (newX > 105) newX = -5;

                return { ...p, y: newY, x: newX };
            }));
        }, 80);

        return () => {
            clearInterval(interval);
            clearInterval(confettiInterval);
        };
    }, [holiday]);

    if (!holiday) return null;

    return (
        <>
            {/* Partiküller */}
            <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
                {particles.map(p => (
                    <div
                        key={p.id}
                        className="absolute transition-none"
                        style={{
                            left: `${p.x}%`,
                            top: `${p.y}%`,
                            fontSize: `${p.size}px`,
                            opacity: p.opacity,
                            transform: `rotate(${p.drift * 20}deg)`,
                        }}
                    >
                        {p.char}
                    </div>
                ))}
            </div>

            {/* Kutlama Bannerı (Kalıcı ve Görünür) */}
            {showMessage && holiday.message && (
                <div
                    className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[10000] px-8 py-4 rounded-2xl font-bold text-xl shadow-2xl flex items-center gap-4 transition-all hover:scale-105 group"
                    style={{
                        background: `linear-gradient(135deg, ${holiday.colors[0]}, ${holiday.colors[1] || holiday.colors[0]})`,
                        color: holiday.colors[0] === "#FFFFFF" || holiday.colors[0] === "#FFD700" ? "#000" : "#FFF",
                        border: "4px solid rgba(255,255,255,0.3)",
                    }}
                >
                    <div className="text-3xl animate-bounce">
                        {holiday.emoji}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs uppercase tracking-widest opacity-80 mb-0.5">BUGÜN ÖZEL BİR GÜN!</span>
                        <span>{holiday.message}</span>
                    </div>
                    <button
                        onClick={() => setShowMessage(false)}
                        className="ml-4 p-1 hover:bg-black/10 rounded-full transition-colors"
                        title="Kapat"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {/* Arka plan animasyonu */}
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                </div>
            )}
        </>
    );
}
