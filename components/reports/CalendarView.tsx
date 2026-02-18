// ============================================
// Takvim Görünümü Bileşeni
// ============================================

"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

// Types
interface CaseFile {
    id: string;
    student: string;
    score: number;
    createdAt: string;
    type?: "YONLENDIRME" | "DESTEK" | "IKISI";
    isNew?: boolean;
    diagCount?: number;
    isTest?: boolean;
    assignedTo?: string;
    absencePenalty?: boolean;
}

interface Teacher {
    id: string;
    name: string;
    isAbsent: boolean;
    yearlyLoad: number;
    active: boolean;
}

interface HistoryEntry {
    date: string;
    cases: CaseFile[];
}

interface CalendarViewProps {
    history: Record<string, CaseFile[]>;
    cases?: CaseFile[]; // Make optional to not break immediately
    teachers: Teacher[];
    onDayClick?: (date: string, cases: CaseFile[]) => void;
}

// Türkçe ay ve gün isimleri
const MONTHS_TR = [
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
];

const DAYS_TR = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

export default function CalendarView({ history, cases = [], teachers, onDayClick }: CalendarViewProps) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState<string | null>(null);

    // Ay ve yıl
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Ay başlangıç ve bitiş
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Pazartesi'den başlat (0 = Pzt, 6 = Paz)
    const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;
    const daysInMonth = lastDayOfMonth.getDate();

    // Takvim grid'i oluştur
    const calendarDays = useMemo(() => {
        const days: (number | null)[] = [];

        // Boş günler (ay başlamadan önce)
        for (let i = 0; i < startDayOfWeek; i++) {
            days.push(null);
        }

        // Ayın günleri
        for (let day = 1; day <= daysInMonth; day++) {
            days.push(day);
        }

        return days;
    }, [startDayOfWeek, daysInMonth]);
    const getDayData = (day: number) => {
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

        // History'den ve cases'den (bugün/aktif) verileri birleştir
        const fromHistory = history[dateStr] || [];
        const fromCases = cases.filter(c => c.createdAt.startsWith(dateStr));

        const combined = [...fromHistory, ...fromCases];
        // Dedupe
        const uniqueCases = new Map<string, CaseFile>();
        combined.forEach(c => {
            if (c.id) uniqueCases.set(c.id, c);
        });

        const realCases = Array.from(uniqueCases.values()).filter(c => !c.absencePenalty);

        return {
            dateStr,
            cases: realCases,
            total: realCases.length,
            hasData: realCases.length > 0,
        };
    };

    // Yoğunluk rengini belirle
    const getIntensityColor = (count: number) => {
        if (count === 0) return "bg-slate-50";
        if (count <= 2) return "bg-emerald-100 text-emerald-800";
        if (count <= 4) return "bg-emerald-200 text-emerald-900";
        if (count <= 6) return "bg-yellow-200 text-yellow-900";
        if (count <= 8) return "bg-orange-200 text-orange-900";
        return "bg-red-200 text-red-900";
    };

    // Önceki/sonraki ay
    const prevMonth = () => {
        setCurrentDate(new Date(year, month - 1, 1));
        setSelectedDay(null);
    };

    const nextMonth = () => {
        setCurrentDate(new Date(year, month + 1, 1));
        setSelectedDay(null);
    };

    // Bugüne git
    const goToToday = () => {
        setCurrentDate(new Date());
        setSelectedDay(null);
    };

    // Gün detayı
    const selectedDayData = selectedDay ? getDayData(parseInt(selectedDay)) : null;
    const selectedDateStr = selectedDayData?.dateStr || "";
    const selectedCases = selectedDayData?.cases || [];

    // Bugün mü?
    const today = new Date();
    const isToday = (day: number) =>
        day === today.getDate() &&
        month === today.getMonth() &&
        year === today.getFullYear();

    // Özet istatistikler
    const monthStats = useMemo(() => {
        let totalCases = 0;
        let totalDays = 0;

        for (let day = 1; day <= daysInMonth; day++) {
            const data = getDayData(day);
            if (data.hasData) {
                totalCases += data.total;
                totalDays++;
            }
        }

        return { totalCases, totalDays, avgPerDay: totalDays > 0 ? (totalCases / totalDays).toFixed(1) : 0 };
    }, [history, year, month, daysInMonth]);

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button size="icon" variant="outline" onClick={prevMonth}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <h3 className="text-lg font-semibold min-w-[160px] text-center">
                        {MONTHS_TR[month]} {year}
                    </h3>
                    <Button size="icon" variant="outline" onClick={nextMonth}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
                <Button size="sm" variant="outline" onClick={goToToday}>
                    Bugün
                </Button>
            </div>

            {/* Özet Kartları */}
            <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-100 rounded-lg p-2">
                    <div className="text-2xl font-bold text-slate-800">{monthStats.totalCases}</div>
                    <div className="text-xs text-slate-500">Toplam Dosya</div>
                </div>
                <div className="bg-slate-100 rounded-lg p-2">
                    <div className="text-2xl font-bold text-slate-800">{monthStats.totalDays}</div>
                    <div className="text-xs text-slate-500">Aktif Gün</div>
                </div>
                <div className="bg-slate-100 rounded-lg p-2">
                    <div className="text-2xl font-bold text-slate-800">{monthStats.avgPerDay}</div>
                    <div className="text-xs text-slate-500">Ort. / Gün</div>
                </div>
            </div>

            {/* Takvim Grid */}
            <div className="border rounded-xl overflow-hidden">
                {/* Gün başlıkları */}
                <div className="grid grid-cols-7 bg-slate-100">
                    {DAYS_TR.map((day, i) => (
                        <div
                            key={day}
                            className={`p-2 text-center text-xs font-medium ${i >= 5 ? "text-slate-400" : "text-slate-600"
                                }`}
                        >
                            {day}
                        </div>
                    ))}
                </div>

                {/* Gün hücreleri */}
                <div className="grid grid-cols-7">
                    {calendarDays.map((day, index) => {
                        if (day === null) {
                            return <div key={`empty-${index}`} className="p-2 min-h-[60px] bg-slate-50" />;
                        }

                        const data = getDayData(day);
                        const isSelected = selectedDay === String(day);
                        const isTodayDay = isToday(day);
                        const isWeekend = index % 7 >= 5;

                        return (
                            <div
                                key={day}
                                onClick={() => {
                                    setSelectedDay(isSelected ? null : String(day));
                                    if (!isSelected && onDayClick && data.hasData) {
                                        onDayClick(data.dateStr, data.cases);
                                    }
                                }}
                                className={`
                  p-1 min-h-[60px] border-t border-l cursor-pointer transition-all
                  ${isWeekend ? "bg-slate-50" : "bg-white"}
                  ${isSelected ? "ring-2 ring-teal-500 ring-inset z-10" : ""}
                  ${isTodayDay ? "ring-2 ring-blue-400 ring-inset" : ""}
                  hover:bg-slate-100
                `}
                            >
                                <div className={`text-xs font-medium mb-1 ${isTodayDay ? "text-blue-600" : "text-slate-500"}`}>
                                    {day}
                                </div>
                                {data.hasData && (
                                    <div className={`text-center rounded py-0.5 text-xs font-semibold ${getIntensityColor(data.total)}`}>
                                        {data.total} 📁
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Seçili Gün Detayı */}
            {selectedDay && selectedDayData && (
                <div className="border rounded-xl p-4 bg-white shadow-sm animate-slide-in-up">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-slate-800">
                            📅 {parseInt(selectedDay)} {MONTHS_TR[month]} {year}
                        </h4>
                        <Button size="icon" variant="ghost" onClick={() => setSelectedDay(null)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>

                    {selectedCases.length === 0 ? (
                        <p className="text-slate-500 text-sm">Bu gün dosya atanmamış.</p>
                    ) : (
                        <>
                            {/* Özet */}
                            <div className="grid grid-cols-3 gap-2 mb-3 text-center text-sm">
                                <div className="bg-teal-50 rounded p-2">
                                    <div className="font-bold text-teal-700">{selectedCases.length}</div>
                                    <div className="text-xs text-teal-600">Dosya</div>
                                </div>
                                <div className="bg-blue-50 rounded p-2">
                                    <div className="font-bold text-blue-700">
                                        {new Set(selectedCases.map(c => c.assignedTo)).size}
                                    </div>
                                    <div className="text-xs text-blue-600">Öğretmen</div>
                                </div>
                                <div className="bg-purple-50 rounded p-2">
                                    <div className="font-bold text-purple-700">
                                        {selectedCases.reduce((sum, c) => sum + c.score, 0)}
                                    </div>
                                    <div className="text-xs text-purple-600">Puan</div>
                                </div>
                            </div>

                            {/* Dosya Listesi */}
                            <div className="space-y-1 max-h-[200px] overflow-y-auto">
                                {selectedCases.map((c, i) => {
                                    const teacher = teachers.find(t => t.id === c.assignedTo);
                                    return (
                                        <div key={c.id} className="flex items-center justify-between text-sm p-2 bg-slate-50 rounded">
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-400">{i + 1}.</span>
                                                <span className="font-medium">{c.student}</span>
                                                <span className="text-xs text-slate-500">
                                                    {c.type === "YONLENDIRME" ? "Y" : c.type === "DESTEK" ? "D" : c.type === "IKISI" ? "İ" : "-"}
                                                    {c.isNew && " 🆕"}
                                                    {c.isTest && " 🧪"}
                                                </span>
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                {teacher?.name || "?"} • {c.score}p
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Renk Açıklaması */}
            <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100"></span> 1-2</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-200"></span> 3-4</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-200"></span> 5-6</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-200"></span> 7-8</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-200"></span> 9+</span>
            </div>
        </div>
    );
}
