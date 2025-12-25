// ============================================
// Mini Dashboard Widget'ları
// ============================================

"use client";

import React, { useMemo } from "react";
import { Users, FileText, Calendar, TrendingUp, AlertCircle, Clock } from "lucide-react";
import { CaseFile, Teacher, PdfAppointment } from "@/types";
import { findBestTeacher } from "@/lib/scoring";
import { useAppStore } from "@/stores/useAppStore";
import QueueWidget from "./QueueWidget";

interface MiniWidgetsProps {
    teachers: Teacher[];
    cases: CaseFile[];
    pdfEntries: PdfAppointment[];
    history: Record<string, CaseFile[]>;
    isAdmin?: boolean;
}

export default function MiniWidgets({ teachers, cases, pdfEntries, history, isAdmin = false }: MiniWidgetsProps) {
    const settings = useAppStore((state) => state.settings);

    // 1. Öğretmen Özeti
    const teacherStats = useMemo(() => {
        const active = teachers.filter(t => t.active && !t.isAbsent);
        const absent = teachers.filter(t => t.isAbsent);

        return {
            activeCount: active.length,
            absentCount: absent.length,
            total: teachers.length
        };
    }, [teachers]);

    // 3. Sıradaki Randevu
    const nextAppointment = useMemo(() => {
        if (!pdfEntries || pdfEntries.length === 0) return null;

        const now = new Date();
        const tolerance = 30 * 60 * 1000;

        const todayAssignedNames = new Set(
            cases
                .filter(c => !c.absencePenalty)
                .map(c => c.student.toLowerCase().trim())
        );

        const pending = pdfEntries.filter(e => {
            const studentName = e.name.toLowerCase().trim();
            if (todayAssignedNames.has(studentName)) return false;

            const [hours, minutes] = e.time.split(":").map(Number);
            const appointmentDate = new Date();
            appointmentDate.setHours(hours, minutes, 0, 0);

            const isExpired = (appointmentDate.getTime() + tolerance) < now.getTime();
            return !isExpired;
        });

        if (pending.length === 0) return null;
        return pending[0];
    }, [pdfEntries, cases]);

    // İzinli öğretmenlerin isimleri
    const absentNames = useMemo(() => {
        return teachers
            .filter(t => t.active && t.isAbsent)
            .map(t => t.name)
            .join(", ");
    }, [teachers]);

    // Tahmini Atama
    const prediction = useMemo(() => {
        if (!nextAppointment || !settings) return null;

        const bestForSupport = findBestTeacher(teachers, cases, settings, { forTestCase: false });
        const bestForTest = findBestTeacher(teachers, cases, settings, { forTestCase: true });

        return { bestForSupport, bestForTest };
    }, [nextAppointment, teachers, cases, settings]);

    // 4. Aylık Performans
    const performanceStats = useMemo(() => {
        const today = new Date();
        const currentMonth = today.toISOString().slice(0, 7);
        const lastMonthDate = new Date(today);
        lastMonthDate.setMonth(today.getMonth() - 1);
        const lastMonth = lastMonthDate.toISOString().slice(0, 7);

        let currentMonthCount = 0;
        let lastMonthCount = 0;

        Object.entries(history).forEach(([date, dayCases]) => {
            if (date.startsWith(currentMonth)) {
                currentMonthCount += dayCases.filter(c => !c.absencePenalty).length;
            } else if (date.startsWith(lastMonth)) {
                lastMonthCount += dayCases.filter(c => !c.absencePenalty).length;
            }
        });

        currentMonthCount += cases.filter(c => !c.absencePenalty).length;

        const diff = currentMonthCount - lastMonthCount;
        const isUp = diff >= 0;
        const percentChange = lastMonthCount > 0
            ? Math.round(((currentMonthCount - lastMonthCount) / lastMonthCount) * 100)
            : 0;

        return { currentMonthCount, lastMonthCount, isUp, percentChange };
    }, [history, cases]);

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

            {/* 1. Öğretmen Durumu */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 relative overflow-hidden group hover:border-blue-500 transition-colors">
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Users className="w-12 h-12 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex flex-col h-full justify-between">
                    <div>
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Kadro Durumu</div>
                        <div className="text-2xl font-bold text-slate-800 dark:text-white mb-2 flex items-baseline gap-2">
                            <span>{teacherStats.activeCount}</span>
                            <span className="text-sm font-normal text-slate-400">Aktif</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 text-sm mt-2">
                        <div className="flex -space-x-2 overflow-hidden">
                            {teachers.filter(t => t.active && !t.isAbsent).slice(0, 5).map(t => (
                                <div key={t.id} className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 border-2 border-white dark:border-slate-800 flex items-center justify-center text-[10px] text-blue-600 dark:text-blue-300 font-bold" title={String(t.name || '')}>
                                    {String(t.name || '').substring(0, 1) || '?'}
                                </div>
                            ))}
                            {teacherStats.activeCount > 5 && (
                                <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 border-2 border-white dark:border-slate-800 flex items-center justify-center text-[10px] text-slate-500 dark:text-slate-400">
                                    +{teacherStats.activeCount - 5}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="text-xs text-rose-500 mt-2 font-medium truncate" title={absentNames}>
                        {teacherStats.absentCount > 0 ? (
                            <>
                                <span className="font-bold">{teacherStats.absentCount}</span> kişi izinli: {absentNames}
                            </>
                        ) : "Tam kadro"}
                    </div>
                </div>
            </div>

            {/* 2. Sıradaki Randevu (ve Tahmini Atama) */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 relative overflow-hidden group hover:border-purple-500 transition-colors">
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Clock className="w-12 h-12 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex flex-col h-full justify-between">
                    <div>
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Sıradaki Randevu</div>
                        {nextAppointment ? (
                            <>
                                <div className="text-lg font-bold text-slate-800 dark:text-white truncate" title={String(nextAppointment.name || '')}>
                                    {String(nextAppointment.name || '')}
                                </div>
                                <div className="text-sm text-purple-600 dark:text-purple-400 font-medium">
                                    {String(nextAppointment.time || '').split(" ")[0]}
                                </div>
                            </>
                        ) : (
                            <div className="text-slate-400 dark:text-slate-500 italic mt-2">
                                Bekleyen yok
                            </div>
                        )}
                    </div>

                    {nextAppointment && (
                        <div className="space-y-2 mt-2">
                            <div className="text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-2 py-1 rounded inline-block w-fit">
                                {nextAppointment.fileNo ? `#${String(nextAppointment.fileNo)}` : "Dosya No Yok"}{nextAppointment.extra ? ` - ${String(nextAppointment.extra)}` : ''}
                            </div>

                            {/* Tahmini Atama */}
                            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-2 text-xs text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-700">
                                <div className="font-semibold mb-1 text-slate-500 dark:text-slate-400">Tahmini Atama:</div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <span className="block text-[10px] text-slate-400">Destek / İkisi</span>
                                        <span className="font-medium text-purple-600 dark:text-purple-400 truncate block" title={String(prediction?.bestForSupport?.name || "-")}>
                                            {String(prediction?.bestForSupport?.name || "-")}
                                        </span>
                                    </div>
                                    <div className="border-l pl-2 border-slate-200 dark:border-slate-600">
                                        <span className="block text-[10px] text-slate-400">Test Varsa</span>
                                        <span className="font-medium text-rose-500 dark:text-rose-400 truncate block" title={String(prediction?.bestForTest?.name || "-")}>
                                            {String(prediction?.bestForTest?.name || "-")}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 3. Aylık Performans */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 relative overflow-hidden group hover:border-orange-500 transition-colors">
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                    <TrendingUp className="w-12 h-12 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="flex flex-col h-full justify-between">
                    <div>
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Bu Ay Performans</div>
                        <div className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
                            {performanceStats.currentMonthCount} <span className="text-sm font-normal text-slate-400">dosya</span>
                        </div>
                    </div>

                    <div className={`flex items-center gap-1 text-sm font-medium ${performanceStats.isUp ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {performanceStats.isUp ? '↗' : '↘'} {Math.abs(performanceStats.percentChange)}%
                        <span className="text-slate-400 font-normal text-xs ml-1">geçen aya göre</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                        Geçen ay: {performanceStats.lastMonthCount}
                    </div>
                </div>
            </div>

            {/* 5. Sıramatik Widget - Sadece admin için */}
            {isAdmin && (
                <div className="lg:col-span-1">
                    <QueueWidget />
                </div>
            )}

        </div>
    );
}
