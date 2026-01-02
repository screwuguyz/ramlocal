"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, Trash2, Printer, Loader2, Inbox } from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";
import type { PdfAppointment } from "@/types";

interface DailyAppointmentsCardProps {
    pdfLoading: boolean;
    onShowDetails: (date?: Date) => void;
    onApplyEntry?: (entry: PdfAppointment) => void;
    onRemoveEntry?: (id: string) => void;
    onPrint?: () => void;
    onClearAll?: () => void;
}

export default function DailyAppointmentsCard({
    pdfLoading,
    onShowDetails,
    onApplyEntry,
    onRemoveEntry,
    onPrint,
    onClearAll,
}: DailyAppointmentsCardProps) {
    const { pdfEntries, selectedPdfEntryId, pdfDate, isAdmin, cases, history } = useAppStore();

    return (
        <Card className="border border-emerald-200 bg-emerald-50/70">
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <CardTitle>
                    📆 Günlük RAM Randevuları
                    {pdfDate && <span className="ml-2 text-sm text-emerald-700 font-normal">({pdfDate})</span>}
                </CardTitle>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className="w-[240px] justify-start text-left font-normal"
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {pdfDate ? pdfDate : <span>Tarih seç</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" onSelect={(date) => onShowDetails(date)} initialFocus />
                    </PopoverContent>
                </Popover>
                <div className="flex items-center gap-2">
                    {onClearAll && (
                        <Button size="sm" variant="destructive" onClick={onClearAll} disabled={pdfEntries.length === 0}>
                            <Trash2 className="h-4 w-4 mr-1.5" />
                            PDF'yi Temizle
                        </Button>
                    )}
                    {onPrint && (
                        <Button size="sm" variant="outline" onClick={onPrint} disabled={pdfEntries.length === 0}>
                            <Printer className="h-4 w-4 mr-1.5" />
                            Yazdır
                        </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => onShowDetails()}>
                        Detaylı Gör
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {pdfLoading ? (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-600">
                        <Loader2 className="h-8 w-8 animate-spin mb-3 text-emerald-600" />
                        <p className="text-sm">Randevular yükleniyor...</p>
                    </div>
                ) : pdfEntries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                        <Inbox className="h-12 w-12 mb-3 text-slate-400" />
                        <p className="text-sm font-medium">Henüz PDF içe aktarılmadı</p>
                        <p className="text-xs text-slate-400 mt-1">Randevu listesi boş</p>
                    </div>
                ) : (
                    <div className="overflow-auto border rounded-md max-h-64">
                        <table className="min-w-full text-xs md:text-sm">
                            <thead className="bg-emerald-100 text-emerald-900">
                                <tr>
                                    <th className="p-2 text-left">Saat</th>
                                    <th className="p-2 text-left">Ad Soyad</th>
                                    <th className="p-2 text-left">Dosya No</th>
                                    <th className="p-2 text-left">Açıklama</th>
                                    {isAdmin && <th className="p-2 text-right">İşlem</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {pdfEntries.map((entry) => {
                                    let isAssigned = false;
                                    if (cases || history) {
                                        const matchesEntry = (sourceEntry: PdfAppointment | undefined) => {
                                            if (!sourceEntry) return false;
                                            if (sourceEntry.id === entry.id) return true;
                                            return (
                                                sourceEntry.time === entry.time &&
                                                sourceEntry.name === entry.name &&
                                                (sourceEntry.fileNo || "") === (entry.fileNo || "")
                                            );
                                        };
                                        const inCases = cases?.some(c => matchesEntry(c.sourcePdfEntry)) || false;
                                        const inHistory = history ? Object.values(history).some(dayCases =>
                                            dayCases.some(c => matchesEntry(c.sourcePdfEntry))
                                        ) : false;
                                        isAssigned = inCases || inHistory;
                                    }

                                    return (
                                        <tr
                                            key={entry.id}
                                            className={`border-b last:border-b-0 ${selectedPdfEntryId === entry.id ? "bg-emerald-50" : "bg-white"} ${isAssigned ? "relative opacity-75" : ""}`}
                                        >
                                            {isAssigned && (
                                                <div className="absolute inset-0 pointer-events-none z-10">
                                                    <div className="absolute top-1/2 left-0 right-0 h-1 bg-red-500 transform -translate-y-1/2 shadow-sm"></div>
                                                </div>
                                            )}
                                            <td className={`p-2 font-semibold relative z-0 ${isAssigned ? "text-red-600" : ""}`}>{entry.time}</td>
                                            <td className={`p-2 relative z-0 ${isAssigned ? "text-red-600" : ""}`}>{entry.name}</td>
                                            <td className={`p-2 relative z-0 ${isAssigned ? "text-red-600" : ""}`}>{entry.fileNo || "-"}</td>
                                            <td className={`p-2 text-xs text-slate-600 relative z-0 ${isAssigned ? "text-red-600" : ""}`}>{entry.extra || "-"}</td>
                                            {isAdmin && onApplyEntry && onRemoveEntry && (
                                                <td className="p-2 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button size="sm" variant="outline" onClick={() => onApplyEntry(entry)}>
                                                            Forma Aktar
                                                        </Button>
                                                        <Button size="icon" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => onRemoveEntry(entry.id)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
