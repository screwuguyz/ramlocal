"use client";

import React, { useEffect, useState, useMemo } from "react";

// Türkiye'deki önemli günler ve bayramlar
interface Holiday {
    name: string;
    emoji: string;
    colors: string[];
    particles: string[];
    message?: string;
}

// Ramazan ve Kurban Bayramı tarihleri (2024-2026)
const ISLAMIC_HOLIDAYS: Record<string, Holiday> = {
    // 2024
    "2024-04-10": { name: "Ramazan Bayramı", emoji: "🌙", colors: ["#FFD700", "#32CD32"], particles: ["🌙", "⭐", "✨"], message: "Ramazan Bayramınız Kutlu Olsun!" },
    "2024-04-11": { name: "Ramazan Bayramı", emoji: "🌙", colors: ["#FFD700", "#32CD32"], particles: ["🌙", "⭐", "✨"], message: "Ramazan Bayramınız Kutlu Olsun!" },
    "2024-04-12": { name: "Ramazan Bayramı", emoji: "🌙", colors: ["#FFD700", "#32CD32"], particles: ["🌙", "⭐", "✨"], message: "Ramazan Bayramınız Kutlu Olsun!" },
    "2024-06-16": { name: "Kurban Bayramı", emoji: "🕌", colors: ["#228B22", "#FFD700"], particles: ["🕌", "🌙", "⭐"], message: "Kurban Bayramınız Kutlu Olsun!" },
    "2024-06-17": { name: "Kurban Bayramı", emoji: "🕌", colors: ["#228B22", "#FFD700"], particles: ["🕌", "🌙", "⭐"], message: "Kurban Bayramınız Kutlu Olsun!" },
    "2024-06-18": { name: "Kurban Bayramı", emoji: "🕌", colors: ["#228B22", "#FFD700"], particles: ["🕌", "🌙", "⭐"], message: "Kurban Bayramınız Kutlu Olsun!" },
    "2024-06-19": { name: "Kurban Bayramı", emoji: "🕌", colors: ["#228B22", "#FFD700"], particles: ["🕌", "🌙", "⭐"], message: "Kurban Bayramınız Kutlu Olsun!" },
    // 2025
    "2025-03-30": { name: "Ramazan Bayramı", emoji: "🌙", colors: ["#FFD700", "#32CD32"], particles: ["🌙", "⭐", "✨"], message: "Ramazan Bayramınız Kutlu Olsun!" },
    "2025-03-31": { name: "Ramazan Bayramı", emoji: "🌙", colors: ["#FFD700", "#32CD32"], particles: ["🌙", "⭐", "✨"], message: "Ramazan Bayramınız Kutlu Olsun!" },
    "2025-04-01": { name: "Ramazan Bayramı", emoji: "🌙", colors: ["#FFD700", "#32CD32"], particles: ["🌙", "⭐", "✨"], message: "Ramazan Bayramınız Kutlu Olsun!" },
    "2025-06-06": { name: "Kurban Bayramı", emoji: "🕌", colors: ["#228B22", "#FFD700"], particles: ["🕌", "🌙", "⭐"], message: "Kurban Bayramınız Kutlu Olsun!" },
    "2025-06-07": { name: "Kurban Bayramı", emoji: "🕌", colors: ["#228B22", "#FFD700"], particles: ["🕌", "🌙", "⭐"], message: "Kurban Bayramınız Kutlu Olsun!" },
    "2025-06-08": { name: "Kurban Bayramı", emoji: "🕌", colors: ["#228B22", "#FFD700"], particles: ["🕌", "🌙", "⭐"], message: "Kurban Bayramınız Kutlu Olsun!" },
    "2025-06-09": { name: "Kurban Bayramı", emoji: "🕌", colors: ["#228B22", "#FFD700"], particles: ["🕌", "🌙", "⭐"], message: "Kurban Bayramınız Kutlu Olsun!" },
};

// Sabit tarihli bayramlar (ay-gün formatında)
const FIXED_HOLIDAYS: Record<string, Holiday> = {
    // Yılbaşı
    "12-31": { name: "Yılbaşı Gecesi", emoji: "🎆", colors: ["#FFD700", "#FF6B6B", "#4ECDC4"], particles: ["❄️", "⭐", "🎉", "✨"], message: "Yeni Yılınız Kutlu Olsun! 🎊" },
    "01-01": { name: "Yeni Yıl", emoji: "🎊", colors: ["#FFD700", "#FF6B6B", "#4ECDC4"], particles: ["🎉", "🎊", "✨", "🥳"], message: "Yeni Yılınız Kutlu Olsun! 🎉" },
    // Milli Bayramlar
    "04-23": { name: "23 Nisan", emoji: "🇹🇷", colors: ["#E30A17", "#FFFFFF"], particles: ["🇹🇷", "🎈", "🎉", "👧", "👦"], message: "23 Nisan Ulusal Egemenlik ve Çocuk Bayramı Kutlu Olsun!" },
    "05-19": { name: "19 Mayıs", emoji: "🇹🇷", colors: ["#E30A17", "#FFFFFF"], particles: ["🇹🇷", "⚽", "🏃", "🎾"], message: "19 Mayıs Atatürk'ü Anma, Gençlik ve Spor Bayramı Kutlu Olsun!" },
    "08-30": { name: "30 Ağustos", emoji: "🇹🇷", colors: ["#E30A17", "#FFFFFF"], particles: ["🇹🇷", "⭐", "🎖️"], message: "30 Ağustos Zafer Bayramı Kutlu Olsun!" },
    "10-29": { name: "29 Ekim", emoji: "🇹🇷", colors: ["#E30A17", "#FFFFFF"], particles: ["🇹🇷", "🎆", "🎉", "⭐"], message: "Cumhuriyet Bayramımız Kutlu Olsun! 🇹🇷" },
};

function getHolidayForDate(date: Date): Holiday | null {
    const fullDate = date.toISOString().slice(0, 10);
    const monthDay = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    // Önce İslami bayramları kontrol et
    if (ISLAMIC_HOLIDAYS[fullDate]) {
        return ISLAMIC_HOLIDAYS[fullDate];
    }

    // Sonra sabit tarihli bayramları kontrol et
    if (FIXED_HOLIDAYS[monthDay]) {
        return FIXED_HOLIDAYS[monthDay];
    }

    return null;
}

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

    const holiday = useMemo(() => getHolidayForDate(new Date()), []);

    useEffect(() => {
        if (!holiday) return;

        // Başlangıç partikülleri oluştur
        const initialParticles: Particle[] = [];
        for (let i = 0; i < 50; i++) {
            initialParticles.push({
                id: i,
                x: Math.random() * 100,
                y: Math.random() * 100 - 100, // Ekranın üstünden başla
                size: Math.random() * 20 + 10,
                speed: Math.random() * 2 + 1,
                opacity: Math.random() * 0.5 + 0.5,
                char: holiday.particles[Math.floor(Math.random() * holiday.particles.length)],
                drift: (Math.random() - 0.5) * 2,
            });
        }
        setParticles(initialParticles);

        // Animasyon döngüsü
        const interval = setInterval(() => {
            setParticles(prev => prev.map(p => {
                let newY = p.y + p.speed;
                let newX = p.x + p.drift * 0.1;

                // Ekrandan çıktıysa yukarıdan tekrar başlat
                if (newY > 110) {
                    newY = -10;
                    newX = Math.random() * 100;
                }

                // X sınırlarını kontrol et
                if (newX < -5) newX = 105;
                if (newX > 105) newX = -5;

                return { ...p, y: newY, x: newX };
            }));
        }, 50);

        // Mesajı 10 saniye sonra gizle
        const messageTimer = setTimeout(() => setShowMessage(false), 10000);

        return () => {
            clearInterval(interval);
            clearTimeout(messageTimer);
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

            {/* Kutlama Mesajı */}
            {showMessage && holiday.message && (
                <div
                    className="fixed top-4 left-1/2 -translate-x-1/2 z-[10000] px-6 py-3 rounded-full font-bold text-lg shadow-2xl animate-bounce"
                    style={{
                        background: `linear-gradient(135deg, ${holiday.colors[0]}, ${holiday.colors[1] || holiday.colors[0]})`,
                        color: holiday.colors[0] === "#FFFFFF" || holiday.colors[0] === "#FFD700" ? "#000" : "#FFF",
                    }}
                >
                    {holiday.emoji} {holiday.message}
                </div>
            )}
        </>
    );
}
