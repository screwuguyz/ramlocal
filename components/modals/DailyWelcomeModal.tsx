"use client";

import React, { useState, useEffect, useMemo } from "react";
import { X, Calendar, Notebook } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale/tr";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/stores/useAppStore";
import { STATIC_BIRTHDAYS } from "@/lib/birthdays";
import { notifyAllTeachers } from "@/lib/notifications";
import Holidays from "date-holidays";

const hd = new Holidays("TR");

const LS_SHOWN_KEY = "ram-daily-welcome-shown";
const LS_AGENDA_KEY = "ram-agenda-notes-v2";

interface NoteItem {
    id: string;
    text: string;
    color: string;
    type?: "WISCR" | "OGT" | "SERBEST";
}

const NOTE_TYPES = [
    { id: "WISCR", label: "WISCR", icon: "🧠", bg: "bg-blue-100", text: "text-blue-700" },
    { id: "OGT", label: "ÖGT", icon: "📋", bg: "bg-emerald-100", text: "text-emerald-700" },
    { id: "SERBEST", label: "Serbest", icon: "📝", bg: "bg-slate-100", text: "text-slate-600" },
] as const;

export default function DailyWelcomeModal() {
    const [open, setOpen] = useState(false);
    const [todayNotes, setTodayNotes] = useState<NoteItem[]>([]);
    const { teachers } = useAppStore();

    // Helper function to calculate special events (reused in useEffect)
    function getSpecialEvent(teacherList: typeof teachers) {
        const now = new Date();
        const monthDay = format(now, "MM-dd");
        const birthdayNames: string[] = [];
        if (STATIC_BIRTHDAYS[monthDay]) birthdayNames.push(...STATIC_BIRTHDAYS[monthDay]);
        teacherList.forEach(t => {
            if (t.birthDate === monthDay && t.active && !birthdayNames.includes(t.name)) {
                birthdayNames.push(t.name);
            }
        });

        const holidays = hd.isHoliday(now);
        let holidayName = null;
        if (holidays && Array.isArray(holidays) && holidays.length > 0) {
            holidayName = holidays[0].name;
        }
        return { birthdayNames, holidayName };
    }

    // Günün Önemi (Doğum Günü + Bayram)
    const specialEvent = useMemo(() => getSpecialEvent(teachers), [teachers]);

    useEffect(() => {
        // Sadece tarayıcıda çalış
        if (typeof window === "undefined") return;

        function checkTimeAndShow() {
            const now = new Date();
            const currentHour = now.getHours(); // 0-23
            const currentMinute = now.getMinutes(); // 0-59

            // Hedef aralık: 09:00 - 09:10
            const isTimeWindow = currentHour === 9 && currentMinute >= 0 && currentMinute <= 10;

            const todayStr = format(now, "yyyy-MM-dd");
            const lastShownDate = localStorage.getItem(LS_SHOWN_KEY);

            if (isTimeWindow && lastShownDate !== todayStr) {
                // Göster!
                setOpen(true);
                loadTodayNotes(todayStr);
                // Gösterildi olarak işaretle
                localStorage.setItem(LS_SHOWN_KEY, todayStr);

                // DOĞUM GÜNÜ BİLDİRİMİ (Sadece ilk açılışta ve bir kere)
                const special = getSpecialEvent(teachers);
                if (special.birthdayNames.length > 0) {
                    const notifiedKey = `ram-birthday-notified-${todayStr}`;
                    if (!localStorage.getItem(notifiedKey)) {
                        notifyAllTeachers(
                            teachers,
                            "Doğum Günü 🎉",
                            `Bugün ${special.birthdayNames.join(" ve ")} hocamızın doğum günü! İyi ki doğdunuz! 🎂`,
                            0
                        ).catch(e => console.error("Birthday notify error", e));
                        localStorage.setItem(notifiedKey, "true");
                    }
                }
            }
        }

        // İlk kontrol
        checkTimeAndShow();

        // Her 10 saniyede bir kontrol et (dakika değişimi yakalamak için)
        const interval = setInterval(checkTimeAndShow, 10000);
        return () => clearInterval(interval);
    }, [open]);

    function loadTodayNotes(dateKey: string) {
        try {
            const raw = localStorage.getItem(LS_AGENDA_KEY);
            if (raw) {
                const data = JSON.parse(raw);
                const notes = data[dateKey] || [];
                setTodayNotes(notes);
            }
        } catch {
            setTodayNotes([]);
        }
    }

    if (!open) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border-2 border-indigo-100"
                >
                    {/* Header Resimli */}
                    <div className="relative h-32 bg-gradient-to-r from-violet-500 to-fuchsia-500 flex items-center justify-center overflow-hidden">
                        <div className="absolute inset-0 opacity-20">
                            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                                <path d="M0 100 C 20 0 50 0 100 100 Z" fill="white" />
                            </svg>
                        </div>
                        <div className="text-center z-10 text-white">
                            <div className="text-4xl mb-1 drop-shadow-md">
                                {specialEvent.birthdayNames.length > 0 ? "🎂" : specialEvent.holidayName ? "🇹🇷" : "🌸☀️😊"}
                            </div>
                            <h2 className="text-2xl font-bold drop-shadow-sm">
                                {specialEvent.birthdayNames.length > 0 ? "İyi ki Doğdunuz!" : specialEvent.holidayName ? "Bayramınız Kutlu Olsun!" : "Günaydın!"}
                            </h2>
                            <p className="text-indigo-100 text-sm font-medium">
                                {specialEvent.birthdayNames.length > 0
                                    ? specialEvent.birthdayNames.join(" ve ") + " için özel bir gün!"
                                    : specialEvent.holidayName || "Harika bir gün olsun!"}
                            </p>
                        </div>

                        <button
                            onClick={() => setOpen(false)}
                            className="absolute top-3 right-3 text-white/80 hover:text-white bg-black/20 hover:bg-black/30 rounded-full p-1 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-6">
                        <div className="flex items-center gap-2 mb-4 justify-center text-slate-500">
                            <Calendar className="w-4 h-4" />
                            <span className="text-sm font-medium">
                                {format(new Date(), "d MMMM yyyy, EEEE", { locale: tr })}
                            </span>
                        </div>

                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                            <div className="flex items-center gap-2 mb-3 text-indigo-700 font-bold border-b border-indigo-100 pb-2">
                                <Notebook className="w-5 h-5" />
                                <h3>Bugünün Ajandası</h3>
                            </div>

                            {todayNotes.length > 0 ? (
                                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                                    {todayNotes.map((note) => {
                                        const typeConfig = NOTE_TYPES.find(t => t.id === (note.type || "SERBEST"));
                                        return (
                                            <div key={note.id} className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm flex flex-col gap-1">
                                                {typeConfig && note.type !== "SERBEST" && (
                                                    <span className={`inline-flex items-center gap-1 self-start px-1.5 py-0.5 rounded text-[9px] font-bold ${typeConfig.bg} ${typeConfig.text}`}>
                                                        {typeConfig.icon} {typeConfig.label}
                                                    </span>
                                                )}
                                                <div className="flex items-start gap-2">
                                                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: note.color }} />
                                                    <span className="text-sm text-slate-700 font-medium leading-relaxed" style={{ color: note.color }}>{note.text}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-6 text-slate-400 text-sm italic">
                                    Bugün için henüz not eklenmemiş.
                                </div>
                            )}
                        </div>

                        <div className="mt-6 text-center">
                            <button
                                onClick={() => setOpen(false)}
                                className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full font-medium shadow-md hover:shadow-lg transform active:scale-95 transition-all text-sm"
                            >
                                Teşekkürler, Başlayalım! 🚀
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
