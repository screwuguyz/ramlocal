"use client";

import React from 'react';
import { motion } from "framer-motion";

export function SchoolParade() {
    return (
        <div className="fixed bottom-0 left-0 w-full overflow-hidden pointer-events-none z-10 opacity-90 h-32">
            {/* Kayan Şerit Animasyonu - Zemin Çizgisi */}
            <div className="absolute bottom-4 w-full h-[2px] bg-slate-300 opacity-50"></div>

            <div className="absolute bottom-4 animate-marquee whitespace-nowrap flex items-end pb-2">
                {/* Grup 1 */}
                <div className="flex items-end gap-16 mx-8 text-7xl">
                    <span className="transform -scale-x-100 filter drop-shadow-xl hover:scale-110 transition-transform cursor-pointer">🚌</span>
                    <span className="animate-bounce-slight filter drop-shadow-md delay-100 text-6xl">🏃‍♂️</span>
                    <span className="animate-bounce-slight filter drop-shadow-md delay-200 text-6xl">🎒</span>
                    <span className="animate-bounce-slight filter drop-shadow-md delay-300 text-6xl">🚶‍♀️</span>
                    <span className="transform -scale-x-100 filter drop-shadow-lg text-7xl">🛹</span>
                    <span className="animate-bounce-slight filter drop-shadow-md delay-500 text-6xl">🏃‍♀️</span>
                </div>

                {/* Grup 2 (Tekrar) */}
                <div className="flex items-end gap-16 mx-8 text-7xl">
                    <span className="transform -scale-x-100 filter drop-shadow-xl">🚌</span>
                    <span className="animate-bounce-slight filter drop-shadow-md delay-100 text-6xl">🏃‍♂️</span>
                    <span className="animate-bounce-slight filter drop-shadow-md delay-200 text-6xl">🎒</span>
                    <span className="animate-bounce-slight filter drop-shadow-md delay-300 text-6xl">🚶‍♀️</span>
                    <span className="transform -scale-x-100 filter drop-shadow-lg text-7xl">🛹</span>
                    <span className="animate-bounce-slight filter drop-shadow-md delay-500 text-6xl">🏃‍♀️</span>
                </div>

                {/* Grup 3 (Süreklilik için) */}
                <div className="flex items-end gap-16 mx-8 text-7xl">
                    <span className="transform -scale-x-100 filter drop-shadow-xl">🚌</span>
                    <span className="animate-bounce-slight filter drop-shadow-md delay-100 text-6xl">🏃‍♂️</span>
                    <span className="animate-bounce-slight filter drop-shadow-md delay-200 text-6xl">🎒</span>
                    <span className="animate-bounce-slight filter drop-shadow-md delay-300 text-6xl">🚶‍♀️</span>
                    <span className="transform -scale-x-100 filter drop-shadow-lg text-7xl">🛹</span>
                    <span className="animate-bounce-slight filter drop-shadow-md delay-500 text-6xl">🏃‍♀️</span>
                </div>
            </div>
        </div>
    );
}

export function FloatingIcons() {
    return (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
            {/* Sol Üst - Kitap */}
            <div className="absolute top-20 left-20 text-7xl opacity-40 animate-float-slow filter blur-[0.5px]">
                📚
            </div>

            {/* Sağ Üst - Zil */}
            <div className="absolute top-40 right-20 text-6xl opacity-40 animate-float-reverse filter blur-[0.5px]">
                🔔
            </div>

            {/* Sol Alt - Kalem */}
            <div className="absolute bottom-60 left-40 text-6xl opacity-40 animate-pulse-slow filter blur-[0.5px]">
                ✏️
            </div>

            {/* Sağ Alt - Mezuniyet */}
            <div className="absolute bottom-40 right-40 text-7xl opacity-30 animate-spin-slow filter blur-[1px]">
                🎓
            </div>

            {/* Orta - Dünya */}
            <div className="absolute top-1/3 left-1/4 text-5xl opacity-30 animate-float-slow delay-700">
                🌍
            </div>

            {/* Ekstra - Okul */}
            <div className="absolute top-1/2 right-1/4 text-6xl opacity-30 animate-bounce-slight delay-500">
                🏫
            </div>
        </div>
    );
}

export function WelcomeLottie() {
    return (
        <div className="flex justify-center mb-6 relative z-10">
            <div className="relative group cursor-pointer">
                {/* Arkadaki Parlama */}
                <div className="absolute inset-0 bg-teal-400 blur-2xl opacity-40 rounded-full animate-pulse group-hover:opacity-70 transition-opacity"></div>
                {/* Ana İkon */}
                <div className="text-[100px] animate-bounce-in transform transition-transform group-hover:scale-110 duration-300 drop-shadow-2xl">
                    🏫
                </div>
                {/* Etrafındaki Küçük Yıldızlar */}
                <div className="absolute -top-4 -right-8 text-4xl animate-spin-slow">✨</div>
                <div className="absolute -bottom-2 -left-8 text-3xl animate-pulse text-yellow-500">✨</div>
                <div className="absolute top-1/2 -right-10 text-2xl animate-bounce delay-300 text-orange-400">✨</div>
            </div>
        </div>
    );
}
