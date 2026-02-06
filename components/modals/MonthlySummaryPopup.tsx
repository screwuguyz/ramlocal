"use client";

import React, { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Trophy, FileText, ArrowRightLeft, HeartHandshake, Layers, Sparkles } from "lucide-react";

type CaseFile = {
    id: string;
    student: string;
    score: number;
    createdAt: string;
    assignedTo?: string;
    type: "YONLENDIRME" | "DESTEK" | "IKISI";
    isNew: boolean;
    absencePenalty?: boolean;
    backupBonus?: boolean;
};

interface MonthlySummaryPopupProps {
    isOpen: boolean;
    onClose: () => void;
    history: Record<string, CaseFile[]>;
    currentMonth?: string; // YYYY-MM format, defaults to current month
}

export default function MonthlySummaryPopup({
    isOpen,
    onClose,
    history,
    currentMonth
}: MonthlySummaryPopupProps) {
    const monthData = useMemo(() => {
        const now = new Date();
        const targetMonth = currentMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

        // Get all cases for the target month
        const monthCases: CaseFile[] = [];
        Object.entries(history).forEach(([date, cases]) => {
            if (date.startsWith(targetMonth)) {
                monthCases.push(...cases);
            }
        });

        // Calculate statistics
        const totalFiles = monthCases.filter(c => !c.absencePenalty && !c.backupBonus).length;
        const yonlendirme = monthCases.filter(c => c.type === "YONLENDIRME" && !c.absencePenalty && !c.backupBonus).length;
        const destek = monthCases.filter(c => c.type === "DESTEK" && !c.absencePenalty && !c.backupBonus).length;
        const ikisi = monthCases.filter(c => c.type === "IKISI" && !c.absencePenalty && !c.backupBonus).length;
        const newFiles = monthCases.filter(c => c.isNew && !c.absencePenalty && !c.backupBonus).length;

        // Get month name in Turkish
        const monthNames = [
            "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
            "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
        ];
        const [year, month] = targetMonth.split("-");
        const monthName = monthNames[parseInt(month) - 1] || month;

        return {
            targetMonth,
            monthName,
            year,
            totalFiles,
            yonlendirme,
            destek,
            ikisi,
            newFiles
        };
    }, [history, currentMonth]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
            <Card className="w-full max-w-lg mx-4 shadow-2xl border-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 text-white overflow-hidden">
                {/* Header */}
                <CardHeader className="relative pb-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-3 right-3 text-white/80 hover:text-white hover:bg-white/20"
                        onClick={onClose}
                    >
                        <X className="w-5 h-5" />
                    </Button>
                    <div className="flex items-center justify-center gap-3 pt-4">
                        <Trophy className="w-10 h-10 text-yellow-300 animate-bounce" />
                        <div className="text-center">
                            <CardTitle className="text-2xl font-bold">
                                🎉 Ay Bitti, Tebrikler!
                            </CardTitle>
                            <p className="text-white/80 text-sm mt-1">
                                {monthData.monthName} {monthData.year} Özeti
                            </p>
                        </div>
                        <Trophy className="w-10 h-10 text-yellow-300 animate-bounce" style={{ animationDelay: "0.2s" }} />
                    </div>
                </CardHeader>

                {/* Content */}
                <CardContent className="pt-6 pb-8">
                    <div className="bg-white/10 rounded-2xl p-6 backdrop-blur-sm">
                        <div className="grid grid-cols-2 gap-4">
                            {/* Total Files */}
                            <div className="col-span-2 bg-white/20 rounded-xl p-4 text-center">
                                <FileText className="w-8 h-8 mx-auto mb-2 text-yellow-200" />
                                <div className="text-4xl font-bold">{monthData.totalFiles}</div>
                                <div className="text-white/80 text-sm">Toplam Dosya</div>
                            </div>

                            {/* Yönlendirme */}
                            <div className="bg-blue-500/30 rounded-xl p-4 text-center">
                                <ArrowRightLeft className="w-6 h-6 mx-auto mb-1 text-blue-200" />
                                <div className="text-2xl font-bold">{monthData.yonlendirme}</div>
                                <div className="text-white/80 text-xs">Yönlendirme</div>
                            </div>

                            {/* Destek */}
                            <div className="bg-green-500/30 rounded-xl p-4 text-center">
                                <HeartHandshake className="w-6 h-6 mx-auto mb-1 text-green-200" />
                                <div className="text-2xl font-bold">{monthData.destek}</div>
                                <div className="text-white/80 text-xs">Destek</div>
                            </div>

                            {/* İkisi */}
                            <div className="bg-orange-500/30 rounded-xl p-4 text-center">
                                <Layers className="w-6 h-6 mx-auto mb-1 text-orange-200" />
                                <div className="text-2xl font-bold">{monthData.ikisi}</div>
                                <div className="text-white/80 text-xs">İkisi</div>
                            </div>

                            {/* Yeni Dosya */}
                            <div className="bg-pink-500/30 rounded-xl p-4 text-center">
                                <Sparkles className="w-6 h-6 mx-auto mb-1 text-pink-200" />
                                <div className="text-2xl font-bold">{monthData.newFiles}</div>
                                <div className="text-white/80 text-xs">Yeni Dosya</div>
                            </div>
                        </div>
                    </div>

                    {/* Close Button */}
                    <div className="mt-6 text-center">
                        <Button
                            onClick={onClose}
                            className="bg-white text-purple-700 hover:bg-white/90 font-semibold px-8 py-2 rounded-full shadow-lg"
                        >
                            Kapat
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
