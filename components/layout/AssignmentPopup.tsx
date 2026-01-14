// ============================================
// Atama Popup Bileşeni - Premium Tasarım
// ============================================

"use client";

import React from "react";
import { useAppStore } from "@/stores/useAppStore";
import { CheckCircle, Sparkles, Star } from "lucide-react";

export default function AssignmentPopup() {
    const assignmentPopup = useAppStore((state) => state.assignmentPopup);

    // Confetti effect is handled globally in page.tsx now
    // to prevent double animation and positioning issues.

    if (!assignmentPopup) return null;

    return (
        <div className="fixed inset-0 top-0 left-0 h-screen w-screen z-[100000] flex items-center justify-center pointer-events-none">
            {/* Arka plan blur efekti */}
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm animate-fade-in" />

            {/* Ana popup kartı */}
            <div className="relative pointer-events-auto animate-scale-bounce">
                {/* Dış glow efekti */}
                <div className="absolute -inset-4 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 rounded-[40px] blur-2xl opacity-60 animate-pulse" />

                {/* Parıldayan yıldızlar */}
                <div className="absolute -top-6 -left-6 text-4xl animate-spin-slow">✨</div>
                <div className="absolute -top-4 -right-8 text-3xl animate-bounce delay-100">⭐</div>
                <div className="absolute -bottom-6 -left-4 text-3xl animate-pulse delay-200">🌟</div>
                <div className="absolute -bottom-4 -right-6 text-4xl animate-spin-slow delay-300">✨</div>

                {/* Kart içeriği */}
                <div className="relative bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 text-white p-10 rounded-[32px] shadow-2xl border border-white/20 overflow-hidden">
                    {/* Animasyonlu arka plan deseni */}
                    <div className="absolute inset-0 opacity-20">
                        <div className="absolute top-0 left-0 w-40 h-40 bg-white rounded-full blur-3xl animate-float-slow" />
                        <div className="absolute bottom-0 right-0 w-32 h-32 bg-cyan-300 rounded-full blur-3xl animate-float-reverse" />
                    </div>

                    <div className="relative flex flex-col items-center text-center">
                        {/* Başarı ikonu - Animasyonlu */}
                        <div className="relative mb-6">
                            {/* Dış halka animasyonu */}
                            <div className="absolute inset-0 w-24 h-24 bg-white/30 rounded-full animate-ping" />
                            <div className="absolute inset-0 w-24 h-24 bg-white/20 rounded-full animate-pulse" />

                            {/* İkon container */}
                            <div className="relative w-24 h-24 bg-gradient-to-br from-white/40 to-white/10 rounded-full flex items-center justify-center backdrop-blur-sm border-2 border-white/30 shadow-lg">
                                <CheckCircle className="w-14 h-14 text-white drop-shadow-lg animate-bounce-in" />
                            </div>

                            {/* Sparkle efektleri */}
                            <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-yellow-300 animate-pulse" />
                            <Star className="absolute -bottom-1 -left-2 w-5 h-5 text-yellow-300 fill-yellow-300 animate-spin-slow" />
                        </div>

                        {/* Başlık */}
                        <h2 className="text-3xl font-extrabold mb-3 tracking-tight drop-shadow-lg">
                            <span className="bg-gradient-to-r from-white via-cyan-100 to-white bg-clip-text">
                                🎉 Dosya Atandı!
                            </span>
                        </h2>

                        {/* Öğrenci adı */}
                        <div className="bg-white/15 backdrop-blur-sm px-6 py-2 rounded-full mb-4 border border-white/20">
                            <p className="text-xl font-semibold">{assignmentPopup.studentName}</p>
                        </div>

                        {/* Ok ve öğretmen */}
                        <div className="flex items-center gap-3 mb-5">
                            <div className="flex items-center gap-2 text-white/80">
                                <span className="text-sm">atandı</span>
                            </div>
                            <div className="text-3xl animate-bounce-horizontal">→</div>
                            <div className="bg-gradient-to-r from-orange-400 to-amber-400 px-5 py-2 rounded-full shadow-lg border border-orange-300/50">
                                <span className="text-xl font-bold text-white drop-shadow">{assignmentPopup.teacherName}</span>
                            </div>
                        </div>

                        {/* Puan rozeti */}
                        <div className="relative">
                            <div className="absolute inset-0 bg-white rounded-full blur-md opacity-30 animate-pulse" />
                            <div className="relative bg-gradient-to-r from-white/30 to-white/10 px-8 py-3 rounded-full border-2 border-white/40 backdrop-blur-sm shadow-inner">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg opacity-90">Puan:</span>
                                    <span className="text-3xl font-black">{assignmentPopup.score}</span>
                                    <span className="text-2xl">🏆</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
