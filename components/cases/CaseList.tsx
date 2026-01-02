"use client";

import React, { useState } from "react";
import { useAppStore } from "@/stores/useAppStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, FileText, Search } from "lucide-react";
import { notifyTeacher } from "@/lib/notifications";
import { caseDescription } from "@/lib/scoring";
import { humanType } from "@/lib/utils";
import { getTodayYmd, ymOf } from "@/lib/date";
import type { CaseFile, Teacher, PdfAppointment } from "@/types";

export default function CaseList() {
    const {
        cases,
        removeCase,
        teachers,
        updateTeacher,
        pdfEntries,
        setPdfEntries,
        addToast,
        settings
    } = useAppStore();
    const [search, setSearch] = useState("");

    const today = getTodayYmd();
    const todayCases = cases.filter(c => c.createdAt.slice(0, 10) === today);

    // Filter by search
    const filteredCases = todayCases.filter(c =>
        c.student.toLowerCase().includes(search.toLowerCase()) ||
        teachers.find(t => t.id === c.assignedTo)?.name.toLowerCase().includes(search.toLowerCase())
    );

    function teacherName(id?: string) {
        if (!id) return "Atanmadı";
        const t = teachers.find(x => x.id === id);
        return t ? t.name : "Bilinmiyor";
    }

    async function notifyEmergencyNow(c: CaseFile) {
        if (!c.assignedTo) return;
        const t = teachers.find(x => x.id === c.assignedTo);
        if (!t) return;

        try {
            if (!t.pushoverKey) throw new Error("Öğretmenin Pushover anahtarı yok");
            await notifyTeacher(t.pushoverKey, "ACİL DURUM", `Acil Dosya: ${c.student} (Puan: ${c.score})`, 2); // Priority 2 = High/Emergency
            addToast(`Acil bildirim gönderildi: ${t.name}`);
        } catch (err: any) {
            addToast(`Bildirim hatası: ${err.message || "Bilinmiyor"}`);
        }
    }

    function handleRemoveCase(id: string) {
        const targetNow = cases.find(c => c.id === id);
        if (!targetNow) return;

        const who = `${targetNow.student}${targetNow.fileNo ? ` (${targetNow.fileNo})` : ""}`;
        const hasSourcePdf = !!targetNow.sourcePdfEntry;

        if (!confirm(hasSourcePdf
            ? `Bu dosyayı geri almak istiyor musunuz?\n${who}\n\nRandevu listesine geri dönecek.`
            : `Bu dosyayı silmek istiyor musunuz?\n${who}`)) return;

        // Restore to PDF list
        if (hasSourcePdf && targetNow.sourcePdfEntry) {
            setPdfEntries([targetNow.sourcePdfEntry, ...pdfEntries]);
            addToast("Dosya geri alındı, randevu listesine eklendi");
        } else {
            addToast("Dosya silindi");
        }

        // Update Teacher Load
        if (targetNow.assignedTo) {
            const t = teachers.find(x => x.id === targetNow.assignedTo);
            if (t) {
                const ym = ymOf(targetNow.createdAt);
                const nextMonthly = { ...(t.monthly || {}) };
                nextMonthly[ym] = Math.max(0, (nextMonthly[ym] || 0) - targetNow.score);
                updateTeacher(t.id, {
                    yearlyLoad: Math.max(0, t.yearlyLoad - targetNow.score),
                    monthly: nextMonthly
                });
            }
        }

        removeCase(id);
    }

    return (
        <div className="space-y-4">
            {/* Search Filter */}
            <div className="flex items-center gap-2 max-w-sm mb-4">
                <Search className="w-4 h-4 text-slate-400" />
                <Input
                    placeholder="Ara: Öğrenci veya Öğretmen..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-9"
                />
            </div>

            <Card className="border-none shadow-xl bg-white/80">
                <CardHeader className="bg-gradient-to-r from-teal-50 to-orange-50 pb-3 border-b border-teal-100">
                    <CardTitle className="text-teal-800 flex items-center gap-2">
                        <span>📋</span>
                        <span>Atanan Dosyalar (Bugün)</span>
                        <span className="ml-auto text-sm font-normal text-slate-500">
                            Toplam: {filteredCases.length}
                        </span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-teal-100/50 text-teal-900 font-semibold border-b border-teal-200">
                                <tr>
                                    <th className="p-3 text-left">Öğrenci</th>
                                    <th className="p-3 text-right">Puan</th>
                                    <th className="p-3 text-left">Saat</th>
                                    <th className="p-3 text-left">Atanan</th>
                                    <th className="p-3 text-left">Test</th>
                                    <th className="p-3 text-left">Açıklama</th>
                                    <th className="p-3 text-right">İşlem</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredCases.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-slate-400">
                                            <div className="flex flex-col items-center justify-center">
                                                <FileText className="h-8 w-8 mb-2 opacity-50" />
                                                <p>Kayıt bulunamadı</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredCases.map((c) => (
                                        <tr key={c.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="p-3 font-medium text-slate-700">{c.student}</td>
                                            <td className="p-3 text-right font-bold bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">+{c.score}</td>
                                            <td className="p-3 text-slate-500">
                                                {new Date(c.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                                            </td>
                                            <td className="p-3">
                                                <div className="font-medium text-slate-700">{teacherName(c.assignedTo)}</div>
                                            </td>
                                            <td className="p-3">
                                                {c.isTest ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                                        Test (+{settings.scoreTest})
                                                    </span>
                                                ) : <span className="text-slate-400">-</span>}
                                            </td>
                                            <td className="p-3 text-slate-500 text-xs max-w-[200px] truncate" title={caseDescription(c)}>
                                                {caseDescription(c)}
                                            </td>
                                            <td className="p-3 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {c.assignedTo && (
                                                        <Button
                                                            size="sm"
                                                            variant="destructive"
                                                            className="h-7 text-xs"
                                                            onClick={() => notifyEmergencyNow(c)}
                                                            title="Acil Bildirim Gönder"
                                                        >
                                                            Acil
                                                        </Button>
                                                    )}
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-7 w-7 text-slate-400 hover:text-red-600"
                                                        onClick={() => handleRemoveCase(c.id)}
                                                        title="Sil"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="md:hidden space-y-2 p-3">
                        {filteredCases.length === 0 && (
                            <div className="text-center py-8 text-slate-400">
                                Kayıt yok
                            </div>
                        )}
                        {filteredCases.map((c) => (
                            <div key={c.id} className="border rounded-lg p-3 bg-white shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="font-medium">{c.student}</div>
                                    <div className="text-sm font-semibold text-emerald-600">+{c.score}</div>
                                </div>
                                <div className="text-xs text-slate-500 mb-2">
                                    {new Date(c.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} • {teacherName(c.assignedTo)}
                                </div>
                                <div className="text-xs text-slate-400 mb-3 line-clamp-2">
                                    {caseDescription(c)}
                                </div>
                                <div className="flex justify-end gap-2">
                                    {c.assignedTo && (
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            className="h-8 text-xs"
                                            onClick={() => notifyEmergencyNow(c)}
                                        >
                                            Acil
                                        </Button>
                                    )}
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 text-xs border-red-200 text-red-600 hover:bg-red-50"
                                        onClick={() => handleRemoveCase(c.id)}
                                    >
                                        Sil
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
