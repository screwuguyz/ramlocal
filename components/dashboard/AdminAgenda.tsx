"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
    ChevronLeft,
    ChevronRight,
    CalendarDays,
    MoreHorizontal,
    Plus,
    X,
    Trash2,
    Check,
    AlertCircle,
    Notebook,
    Paintbrush
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, startOfMonth, endOfMonth, endOfWeek, eachDayOfInterval, addMonths, subMonths, isSameMonth, isWeekend } from "date-fns";
import { tr } from "date-fns/locale/tr";
import Holidays from "date-holidays";
import { useAppStore } from "@/stores/useAppStore";
import { NoteItem, NoteType } from "@/types";
import { STATIC_BIRTHDAYS } from "@/lib/birthdays";

const LS_KEY_OLD = "ram-agenda-notes-v2";

// Dinamik Tatil Hesaplayıcı (Türkiye için)
const hd = new Holidays("TR");

function getHolidayName(date: Date) {
    const holidays = hd.isHoliday(date);
    if (holidays && (holidays as any[]).length > 0) {
        // date-holidays bazen dizi döner, bazen tek nesne. normalize edelim.
        const hList = Array.isArray(holidays) ? holidays : [holidays];
        return hList[0].name;
    }
    return null;
}

// Renk paleti
const COLOR_PALETTE = [
    { id: "dark", color: "#1e293b", label: "Koyu" },
    { id: "red", color: "#dc2626", label: "Kırmızı" },
    { id: "blue", color: "#2563eb", label: "Mavi" },
    { id: "green", color: "#16a34a", label: "Yeşil" },
    { id: "purple", color: "#9333ea", label: "Mor" },
    { id: "orange", color: "#ea580c", label: "Turuncu" },
    { id: "pink", color: "#db2777", label: "Pembe" },
    { id: "teal", color: "#0d9488", label: "Turkuaz" },
];

// Test türleri
const NOTE_TYPES = [
    { id: "WISCR", label: "WISCR", icon: "🧠", bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-300", defaultColor: "#2563eb" },
    { id: "OGT", label: "ÖGT", icon: "📋", bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-300", defaultColor: "#16a34a" },
    { id: "SERBEST", label: "Serbest Not", icon: "📝", bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-300", defaultColor: "#1e293b" },
] as const;


function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function AdminAgenda() {
    const [weekStart, setWeekStart] = useState(() =>
        startOfWeek(new Date(), { weekStartsOn: 1 })
    );

    // Global Store
    const {
        agendaNotes: data,
        setAgendaNotes,
        addAgendaNote,
        updateAgendaNote,
        removeAgendaNote,
        teachers,
        hydrated
    } = useAppStore();

    const [collapsed, setCollapsed] = useState(false);
    const [activeColorPicker, setActiveColorPicker] = useState<string | null>(null); // "dateKey:itemId"
    const [showTypeSelector, setShowTypeSelector] = useState<string | null>(null); // dateKey
    const [viewMode, setViewMode] = useState<"week" | "month">("week");
    const [monthStart, setMonthStart] = useState(() => startOfMonth(new Date()));
    const [selectedDay, setSelectedDay] = useState<Date | null>(null); // For modal in month view

    // Form için state
    const [promptData, setPromptData] = useState<{ dateKey: string, type: NoteType } | null>(null);
    const [formData, setFormData] = useState({ name: "", tc: "", phone: "" });

    // Migration Effect (Old LocalStorage -> Global Store)
    useEffect(() => {
        if (!hydrated) return; // Store hazır olana kadar bekle

        const oldDataRaw = localStorage.getItem(LS_KEY_OLD);
        if (oldDataRaw) {
            try {
                const oldData = JSON.parse(oldDataRaw);
                const currentNotes = useAppStore.getState().agendaNotes;

                const merged = { ...currentNotes };
                Object.keys(oldData).forEach(key => {
                    if (!merged[key]) {
                        merged[key] = oldData[key];
                    } else {
                        // If both have data, merge arrays? Or prefer one?
                        // Let's concat unique items by ID
                        const existingIds = new Set(merged[key].map((i: NoteItem) => i.id));
                        oldData[key].forEach((item: NoteItem) => {
                            if (!existingIds.has(item.id)) {
                                merged[key].push(item);
                            }
                        });
                    }
                });

                setAgendaNotes(merged);

                // GÜVENLİK İÇİN ŞİMDİLİK SİLMİYORUZ!
                // Verilerin başarıyla taşındığından emin olduktan sonra silebilirsiniz.
                // console.log("Migration successful, old keys preserved for safety.");

                // Clear old data to prevent re-migration
                // localStorage.removeItem(LS_KEY_OLD);
                // Also clear v1 if exists
                // localStorage.removeItem("ram-agenda-notes");
            } catch (e) {
                console.error("Migration failed", e);
            }
        }
    }, [hydrated, setAgendaNotes]);


    // Yeni madde ekle (test türü ile)
    const addItem = useCallback((dateKey: string, noteType: NoteType) => {
        const typeConfig = NOTE_TYPES.find(t => t.id === noteType);

        // WISCR veya ÖGT ise formu aç
        if (noteType === "WISCR" || noteType === "OGT") {
            setPromptData({ dateKey, type: noteType });
            setFormData({ name: "", tc: "", phone: "" });
            setShowTypeSelector(null);
            return;
        }

        addAgendaNote(dateKey, {
            id: uid(),
            text: "",
            color: typeConfig?.defaultColor || "#1e293b",
            type: noteType,
        });

        setShowTypeSelector(null);
    }, [addAgendaNote]);

    // Formu onayla ve ekle
    const confirmAddStructured = useCallback(() => {
        if (!promptData) return;
        const { dateKey, type } = promptData;
        const typeConfig = NOTE_TYPES.find(t => t.id === type);

        const formattedText = `AD SOYAD: ${formData.name.toUpperCase()}\nTC: ${formData.tc}\nTEL: ${formData.phone}`;

        addAgendaNote(dateKey, {
            id: uid(),
            text: formattedText,
            color: typeConfig?.defaultColor || "#1e293b",
            type: type,
        });

        setPromptData(null);
    }, [promptData, formData, addAgendaNote]);

    // Madde metnini güncelle
    const updateItemText = useCallback((dateKey: string, itemId: string, text: string) => {
        updateAgendaNote(dateKey, itemId, { text });
    }, [updateAgendaNote]);

    // Madde rengini değiştir
    const updateItemColor = useCallback((dateKey: string, itemId: string, color: string) => {
        updateAgendaNote(dateKey, itemId, { color });
        setActiveColorPicker(null);
    }, [updateAgendaNote]);

    // Madde sil
    const removeItem = useCallback((dateKey: string, itemId: string) => {
        removeAgendaNote(dateKey, itemId);
    }, [removeAgendaNote]);

    const today = new Date();
    const weekDays = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));

    const monthStartDay = startOfWeek(startOfMonth(monthStart), { weekStartsOn: 1 });
    const monthEndDay = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 });
    const monthDays = eachDayOfInterval({ start: monthStartDay, end: monthEndDay });

    const goToPrev = () => {
        if (viewMode === "week") setWeekStart(prev => subWeeks(prev, 1));
        else setMonthStart(prev => subMonths(prev, 1));
    };
    const goToNext = () => {
        if (viewMode === "week") setWeekStart(prev => addWeeks(prev, 1));
        else setMonthStart(prev => addMonths(prev, 1));
    };
    const goToToday = () => {
        const now = new Date();
        if (viewMode === "week") setWeekStart(startOfWeek(now, { weekStartsOn: 1 }));
        else setMonthStart(startOfMonth(now));
    };

    const weekLabel = `${format(weekDays[0], "d MMM", { locale: tr })} – ${format(weekDays[4], "d MMM yyyy", { locale: tr })}`;
    const monthLabel = format(monthStart, "MMMM yyyy", { locale: tr });

    return (
        <div className="mb-6 relative">
            {/* Başlık */}
            <div className="flex items-center justify-between mb-3">
                <button
                    onClick={() => setCollapsed(c => !c)}
                    className="flex items-center gap-2 text-lg font-bold text-slate-700 hover:text-indigo-600 transition-colors"
                >
                    <Notebook className="w-5 h-5" />
                    <span>📅 Haftalık Ajanda</span>
                    <span className="text-xs font-normal text-slate-400 ml-2">{collapsed ? "▶ Aç" : "▼"}</span>
                </button>

                {!collapsed && (
                    <div className="flex items-center gap-2">
                        {/* Görünüm Modu Seçici */}
                        <div className="flex bg-slate-100 rounded-lg p-1 mr-2">
                            <button
                                onClick={() => setViewMode("week")}
                                className={`px-2 py-1 text-xs font-semibold rounded-md transition-all ${viewMode === "week" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                            >
                                Hafta
                            </button>
                            <button
                                onClick={() => setViewMode("month")}
                                className={`px-2 py-1 text-xs font-semibold rounded-md transition-all ${viewMode === "month" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                            >
                                Ay
                            </button>
                        </div>

                        <Button size="sm" variant="ghost" onClick={goToPrev} className="h-8 w-8 p-0">
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <button
                            onClick={goToToday}
                            className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors px-2 py-1 rounded-lg hover:bg-indigo-50 flex items-center gap-1.5"
                        >
                            <CalendarDays className="w-3.5 h-3.5" />
                            <span className="capitalize">{viewMode === "week" ? weekLabel : monthLabel}</span>
                        </button>
                        <Button size="sm" variant="ghost" onClick={goToNext} className="h-8 w-8 p-0">
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                )}
            </div>

            {/* Görünüm İçerik */}
            {!collapsed && (
                <>
                    {/* HAFTALIK GÖRÜNÜM */}
                    {viewMode === "week" && (
                        <div className="grid grid-cols-5 gap-3">
                            {weekDays.map(day => {
                                const dateKey = format(day, "yyyy-MM-dd");
                                const isToday = isSameDay(day, today);
                                const items = data[dateKey] || [];
                                const holidayName = getHolidayName(day);

                                // Doğum günü tespiti
                                const monthDay = format(day, "MM-dd");
                                const birthdayNames: string[] = [];
                                if (STATIC_BIRTHDAYS[monthDay]) birthdayNames.push(...STATIC_BIRTHDAYS[monthDay]);
                                teachers.forEach(t => {
                                    if (t.birthDate === monthDay && t.active && !birthdayNames.includes(t.name)) {
                                        birthdayNames.push(t.name);
                                    }
                                });
                                const hasBirthday = birthdayNames.length > 0;

                                return (
                                    <div
                                        key={dateKey}
                                        className={`
                  rounded-lg border-2 overflow-hidden transition-all duration-200 flex flex-col
                  ${isToday
                                                ? "border-indigo-500 shadow-lg shadow-indigo-100 ring-2 ring-indigo-200"
                                                : items.length > 0
                                                    ? "border-slate-300 shadow-sm"
                                                    : "border-slate-200 shadow-sm"
                                            }
                  ${(items.length > 0 && !isToday) ? "bg-indigo-50/50" : "bg-white"} hover:shadow-md
                `}
                                    >
                                        {/* Gün Başlığı */}
                                        < div
                                            className={`
                    px-3 py-3 text-center
                    ${isToday
                                                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-inner"
                                                    : "bg-slate-100 text-slate-800 border-b border-slate-200"
                                                }
                  `}
                                        >
                                            <div className={`text-base font-bold uppercase tracking-widest mb-0.5 ${isToday ? "text-indigo-100" : "text-slate-500"}`}>
                                                {format(day, "EEEE", { locale: tr })}
                                            </div>
                                            <div className={`text-3xl font-black ${isToday ? "text-white" : "text-slate-900"} leading-none mb-1`}>
                                                {format(day, "d")}
                                            </div>
                                            <div className={`text-sm font-semibold uppercase ${isToday ? "text-indigo-200" : "text-slate-500"}`}>
                                                {format(day, "MMMM", { locale: tr })}
                                            </div>

                                            {/* Bayram ve Doğum Günü (Haftalık) */}
                                            {holidayName && (
                                                <div className={`mt-1 text-sm font-black drop-shadow-sm ${isToday ? "text-white" : "text-red-600"}`}>
                                                    🎈 {holidayName}
                                                </div>
                                            )}
                                            {hasBirthday && (
                                                <div className={`mt-0.5 text-sm font-black drop-shadow-sm ${isToday ? "text-white" : "text-pink-600"}`}>
                                                    🎂 {birthdayNames.join(", ")}
                                                </div>
                                            )}
                                        </div>

                                        {/* Madde Listesi */}
                                        <div className="flex-1 min-h-[160px] max-h-[1000px] overflow-y-auto">
                                            {items.map((item, idx) => (
                                                <div key={item.id}>
                                                    {/* Ayırıcı çizgi (ilk madde hariç) */}
                                                    {idx > 0 && (
                                                        <div className="mx-2 border-t border-dashed border-slate-200" />
                                                    )}

                                                    <div className="group relative px-2 py-1.5">
                                                        {/* Tür Etiketi */}
                                                        {(() => {
                                                            const typeConfig = NOTE_TYPES.find(t => t.id === (item.type || "SERBEST"));
                                                            return typeConfig && item.type !== "SERBEST" ? (
                                                                <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${typeConfig.bg} ${typeConfig.text} mb-1`}>
                                                                    <span>{typeConfig.icon}</span>
                                                                    <span>{typeConfig.label}</span>
                                                                </div>
                                                            ) : null;
                                                        })()}

                                                        {/* Madde satırı */}
                                                        <div className="flex gap-1.5 items-start">
                                                            {/* Madde işareti */}
                                                            <span
                                                                className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0 border"
                                                                style={{ backgroundColor: item.color, borderColor: item.color }}
                                                            />

                                                            {/* Metin */}
                                                            <textarea
                                                                value={item.text}
                                                                onChange={(e) => updateItemText(dateKey, item.id, e.target.value)}
                                                                placeholder="Not yaz..."
                                                                style={{ color: item.color }}
                                                                rows={2}
                                                                className="flex-1 text-xs font-bold resize-none border-0 bg-transparent focus:outline-none focus:ring-0 placeholder:text-slate-300 placeholder:font-normal leading-relaxed p-0"
                                                            />
                                                        </div>

                                                        {/* Madde araç çubuğu (hover'da görünür) */}
                                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mt-0.5 ml-3.5">
                                                            {/* Renk */}
                                                            <button
                                                                onClick={() => setActiveColorPicker(
                                                                    activeColorPicker === `${dateKey}:${item.id}` ? null : `${dateKey}:${item.id}`
                                                                )}
                                                                className="p-0.5 rounded hover:bg-slate-100 text-slate-300 hover:text-indigo-500 transition-colors"
                                                                title="Renk Seç"
                                                            >
                                                                <Paintbrush className="w-3 h-3" />
                                                            </button>
                                                            {/* Sil */}
                                                            <button
                                                                onClick={() => removeItem(dateKey, item.id)}
                                                                className="p-0.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors"
                                                                title="Maddeyi Sil"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </div>

                                                        {/* Renk paleti */}
                                                        {activeColorPicker === `${dateKey}:${item.id}` && (
                                                            <div className="flex items-center gap-1 mt-1 ml-3.5 p-1 bg-white border border-slate-200 rounded-lg shadow-sm">
                                                                {COLOR_PALETTE.map(c => (
                                                                    <button
                                                                        key={c.id}
                                                                        onClick={() => updateItemColor(dateKey, item.id, c.color)}
                                                                        className={`w-4 h-4 rounded-full border-2 transition-all hover:scale-125
                                  ${item.color === c.color ? "border-slate-700 scale-110" : "border-slate-200"}
                                `}
                                                                        style={{ backgroundColor: c.color }}
                                                                        title={c.label}
                                                                    />
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}

                                            {/* Boş durum */}
                                            {items.length === 0 && (
                                                <div className="flex items-center justify-center h-full min-h-[80px] text-slate-300 text-xs">
                                                    Not yok
                                                </div>
                                            )}
                                        </div>

                                        {/* Yeni Madde Ekle Butonu + Tür Seçici */}
                                        <div className="border-t border-slate-100 px-2 py-1.5 relative">
                                            {showTypeSelector === dateKey ? (
                                                <div className="flex flex-col gap-1 py-1">
                                                    <div className="text-[10px] text-slate-400 text-center font-medium mb-0.5">Test Türü Seçin:</div>
                                                    {NOTE_TYPES.map(t => (
                                                        <button
                                                            key={t.id}
                                                            onClick={() => addItem(dateKey, t.id)}
                                                            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-bold ${t.bg} ${t.text} ${t.border} border hover:opacity-80 transition-all`}
                                                        >
                                                            <span>{t.icon}</span>
                                                            <span>{t.label}</span>
                                                        </button>
                                                    ))}
                                                    <button
                                                        onClick={() => setShowTypeSelector(null)}
                                                        className="text-[10px] text-slate-400 hover:text-slate-600 mt-0.5"
                                                    >
                                                        İptal
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setShowTypeSelector(dateKey)}
                                                    className="w-full flex items-center justify-center gap-1 text-[11px] text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-md py-1 transition-colors font-medium"
                                                >
                                                    <Plus className="w-3 h-3" />
                                                    Madde Ekle
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )
                    }

                    {/* AYLIK GÖRÜNÜM */}
                    {
                        viewMode === "month" && (
                            <div className="bg-white rounded-lg border-t border-l border-slate-300 shadow-sm overflow-hidden">
                                {/* Gün İsimleri */}
                                <div className="grid grid-cols-7 border-b border-slate-300 bg-slate-50">
                                    {["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"].map(d => (
                                        <div key={d} className="py-2 text-center text-xs font-bold text-slate-500 uppercase tracking-wider border-r border-slate-300 last:border-r-0">
                                            {d}
                                        </div>
                                    ))}
                                </div>
                                {/* Günler Grid */}
                                <div className="grid grid-cols-7 text-xs sm:text-sm">
                                    {monthDays.map(day => {
                                        const dateKey = format(day, "yyyy-MM-dd");
                                        const isToday = isSameDay(day, today);
                                        const isCurrentMonth = isSameMonth(day, monthStart);
                                        const items = data[dateKey] || [];
                                        const hasNotes = items.length > 0;
                                        const isWkend = isWeekend(day);
                                        const holidayName = getHolidayName(day);
                                        const isHoliday = !!holidayName;

                                        // Doğum günü tespiti (Sabit + Store)
                                        const monthDay = format(day, "MM-dd");
                                        const birthdayNames: string[] = [];
                                        if (STATIC_BIRTHDAYS[monthDay]) birthdayNames.push(...STATIC_BIRTHDAYS[monthDay]);
                                        teachers.forEach(t => {
                                            if (t.birthDate === monthDay && t.active && !birthdayNames.includes(t.name)) {
                                                birthdayNames.push(t.name);
                                            }
                                        });
                                        const hasBirthday = birthdayNames.length > 0;

                                        return (
                                            <div
                                                key={dateKey}
                                                onClick={() => setSelectedDay(day)}
                                                className={`
                                            min-h-[80px] sm:min-h-[100px] border-b border-r border-slate-200 p-1 sm:p-2 cursor-pointer transition-colors relative group
                                            ${!isCurrentMonth ? "bg-slate-50/50 text-slate-400" : (hasNotes && !isToday) ? "bg-indigo-50/80" : "bg-white"}
                                            ${isToday ? "bg-indigo-50/50" : ""}
                                            ${isHoliday ? "bg-red-50/30" : ""}
                                            ${hasNotes ? "hover:bg-indigo-100/60" : "hover:bg-slate-50"}
                                        `}
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className={`
                                                w-6 h-6 flex items-center justify-center rounded-full font-semibold
                                                ${isToday ? "bg-indigo-600 text-white shadow-md" : (isWkend || isHoliday) ? "text-red-600" : "text-slate-700"}
                                            `}>
                                                        {format(day, "d")}
                                                    </span>
                                                    {/* Not Sayısı Rozeti (Mobil için) */}
                                                    {hasNotes && (
                                                        <span className="sm:hidden w-1.5 h-1.5 rounded-full bg-amber-500" />
                                                    )}
                                                </div>

                                                {/* Bayram İsmi */}
                                                {holidayName && (
                                                    <div className="text-[11px] text-red-600 font-black leading-tight mb-1 truncate drop-shadow-sm">
                                                        🎈 {holidayName}
                                                    </div>
                                                )}

                                                {/* Doğum Günü İsimleri */}
                                                {hasBirthday && (
                                                    <div className="text-[11px] text-pink-600 font-black leading-tight mb-1 truncate drop-shadow-sm" title={birthdayNames.join(", ")}>
                                                        🎂 {birthdayNames.join(", ")}
                                                    </div>
                                                )}

                                                {/* Not Önizlemeleri (Desktop) */}
                                                <div className="hidden sm:block space-y-1">
                                                    {items.slice(0, 3).map(item => (
                                                        <div key={item.id} className="flex items-center gap-1">
                                                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                                                            <div className="text-[10px] truncate text-slate-600 font-medium leading-tight max-w-full">
                                                                {item.text || "Yeni Not"}
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {items.length > 3 && (
                                                        <div className="text-[9px] text-slate-400 pl-2.5">
                                                            +{items.length - 3} diğer
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )
                    }
                </>
            )}

            {/* DETAY MODAL (ABSOLUTE POZİSYONLU) */}
            {
                selectedDay && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 rounded-xl backdrop-blur-[1px] bg-white/10">
                        <div className="absolute inset-0 bg-black/10 rounded-xl" onClick={() => setSelectedDay(null)}></div>
                        {(() => {
                            const day = selectedDay;
                            const dateKey = format(day, "yyyy-MM-dd");
                            const isToday = isSameDay(day, today);
                            const items = data[dateKey] || [];
                            const isWkend = isWeekend(day);
                            const holidayName = getHolidayName(day);

                            // Doğum günü tespiti (Modal için)
                            const monthDay = format(day, "MM-dd");
                            const birthdayNames: string[] = [];
                            if (STATIC_BIRTHDAYS[monthDay]) birthdayNames.push(...STATIC_BIRTHDAYS[monthDay]);
                            teachers.forEach(t => {
                                if (t.birthDate === monthDay && t.active && !birthdayNames.includes(t.name)) {
                                    birthdayNames.push(t.name);
                                }
                            });

                            return (
                                <div className={`
                                relative w-full max-w-md bg-white rounded-xl border-2 overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200
                                ${isToday ? "border-indigo-400 ring-4 ring-indigo-500/20" : "border-slate-300"}
                            `}>
                                    {/* Gün Başlığı */}
                                    <div className={`
                                    px-4 py-4 text-center relative
                                    ${isToday ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white" : "bg-slate-100 text-slate-800 border-b border-slate-200"}
                                `}>
                                        <button
                                            onClick={() => setSelectedDay(null)}
                                            className="absolute right-3 top-3 p-1 rounded-full hover:bg-black/10 transition-colors"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                        <div className={`text-lg font-bold uppercase tracking-widest mb-0.5 ${isToday ? "text-indigo-100" : (isWkend || holidayName) ? "text-red-500" : "text-slate-500"}`}>
                                            {format(day, "EEEE", { locale: tr })}
                                        </div>
                                        <div className={`text-4xl font-black ${isToday ? "text-white" : (isWkend || holidayName) ? "text-red-600" : "text-slate-900"} leading-none mb-1`}>
                                            {format(day, "d")}
                                        </div>
                                        <div className={`text-sm font-semibold uppercase ${isToday ? "text-indigo-200" : "text-slate-500"}`}>
                                            {format(day, "MMMM yyyy", { locale: tr })}
                                        </div>
                                        {holidayName && (
                                            <div className={`text-sm font-black mt-1 ${isToday ? "text-white/90" : "text-red-500"}`}>
                                                🎈 {holidayName}
                                            </div>
                                        )}
                                        {birthdayNames.length > 0 && (
                                            <div className={`text-sm font-black mt-0.5 ${isToday ? "text-white/90" : "text-pink-500"}`}>
                                                🎂 {birthdayNames.join(", ")}
                                            </div>
                                        )}
                                    </div>

                                    {/* Madde Listesi */}
                                    <div className="flex-1 min-h-[200px] max-h-[50vh] overflow-y-auto bg-white p-2">
                                        {items.map((item, idx) => (
                                            <div key={item.id}>
                                                {idx > 0 && <div className="mx-2 border-t border-dashed border-slate-200" />}
                                                <div className="group relative px-2 py-2">
                                                    {(() => {
                                                        const typeConfig = NOTE_TYPES.find(t => t.id === (item.type || "SERBEST"));
                                                        return typeConfig && item.type !== "SERBEST" ? (
                                                            <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${typeConfig.bg} ${typeConfig.text} mb-1`}>
                                                                <span>{typeConfig.icon}</span>
                                                                <span>{typeConfig.label}</span>
                                                            </div>
                                                        ) : null;
                                                    })()}

                                                    <div className="flex gap-2 items-start">
                                                        <span className="mt-2 w-2 h-2 rounded-full flex-shrink-0 border" style={{ backgroundColor: item.color, borderColor: item.color }} />
                                                        <textarea
                                                            value={item.text}
                                                            onChange={(e) => updateItemText(dateKey, item.id, e.target.value)}
                                                            placeholder="Not yaz..."
                                                            style={{ color: item.color }}
                                                            rows={2}
                                                            className="flex-1 text-xs font-bold resize-none border-0 bg-transparent focus:outline-none focus:ring-0 placeholder:text-slate-300 placeholder:font-normal leading-relaxed p-0"
                                                        />
                                                    </div>

                                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mt-1 ml-4">
                                                        <button onClick={() => setActiveColorPicker(activeColorPicker === `${dateKey}:${item.id}` ? null : `${dateKey}:${item.id}`)} className="p-1 rounded hover:bg-slate-100 text-slate-300 hover:text-indigo-500" title="Renk"><Paintbrush className="w-3.5 h-3.5" /></button>
                                                        <button onClick={() => removeItem(dateKey, item.id)} className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-400" title="Sil"><X className="w-3.5 h-3.5" /></button>
                                                    </div>

                                                    {activeColorPicker === `${dateKey}:${item.id}` && (
                                                        <div className="flex items-center gap-1 mt-1 ml-4 p-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 relative">
                                                            {COLOR_PALETTE.map(c => (
                                                                <button key={c.id} onClick={() => updateItemColor(dateKey, item.id, c.color)} className={`w-5 h-5 rounded-full border-2 hover:scale-110 ${item.color === c.color ? "border-slate-800" : "border-slate-200"}`} style={{ backgroundColor: c.color }} />
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        {items.length === 0 && <div className="flex items-center justify-center p-8 text-slate-300 text-sm">Not yok</div>}
                                    </div>

                                    <div className="border-t border-slate-100 bg-slate-50 p-2">
                                        {showTypeSelector === dateKey ? (
                                            <div className="flex flex-col gap-1">
                                                <div className="text-[10px] text-slate-400 text-center font-medium">Tür Seç:</div>
                                                <div className="flex gap-1 justify-center">
                                                    {NOTE_TYPES.map(t => (
                                                        <button key={t.id} onClick={() => addItem(dateKey, t.id)} className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold ${t.bg} ${t.text} border hover:brightness-95`}>
                                                            <span>{t.icon}</span><span>{t.label}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                                <button onClick={() => setShowTypeSelector(null)} className="text-[10px] text-slate-400 hover:text-slate-600 text-center mt-1">İptal</button>
                                            </div>
                                        ) : (
                                            <button onClick={() => setShowTypeSelector(dateKey)} className="w-full flex items-center justify-center gap-1 text-sm text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 py-2 rounded-lg transition-colors font-medium">
                                                <Plus className="w-4 h-4" /> Madde Ekle
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                )
            }

            {/* STRÜKTÜREL VERİ FORMU (WISCR/ÖGT) */}
            {
                promptData && (
                    <div className="absolute inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-sm bg-slate-900/20 rounded-xl animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl shadow-2xl border-2 border-indigo-500 w-full max-w-sm overflow-hidden flex flex-col scale-in-center">
                            <div className="bg-indigo-600 px-4 py-3 text-white flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-xl">{NOTE_TYPES.find(t => t.id === promptData.type)?.icon}</span>
                                    <span className="font-bold">{NOTE_TYPES.find(t => t.id === promptData.type)?.label} Bilgileri</span>
                                </div>
                                <button onClick={() => setPromptData(null)} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-4 space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Öğrenci Ad Soyad</label>
                                    <input
                                        autoFocus
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="Ad Soyad giriniz..."
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:font-normal"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">T.C. Kimlik No</label>
                                        <input
                                            type="text"
                                            maxLength={11}
                                            value={formData.tc}
                                            onChange={e => setFormData(prev => ({ ...prev, tc: e.target.value.replace(/\D/g, '') }))}
                                            placeholder="11 hane..."
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:font-normal"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Telefon</label>
                                        <input
                                            type="text"
                                            value={formData.phone}
                                            onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                            placeholder="05xx..."
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:font-normal"
                                        />
                                    </div>
                                </div>

                                <Button
                                    onClick={confirmAddStructured}
                                    disabled={!formData.name.trim()}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 group"
                                >
                                    <Check className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                    <span>Maddeyi Kaydet</span>
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
