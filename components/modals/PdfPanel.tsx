
import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, X } from "lucide-react";
import { PdfAppointment } from "@/types";
import { useAppStore } from "@/stores/useAppStore";
import { API_ENDPOINTS } from "@/lib/constants";

interface PdfPanelProps {
    open: boolean;
    onClose: () => void;
    pdfEntries: PdfAppointment[];
    pdfDate: string | null;
    isAdmin: boolean;
    activePdfEntryId: string | null;
    onApplyEntry: (entry: PdfAppointment) => void;
    onRemoveEntry: (id: string, entryDate: string | null) => void;
    onClearAll: () => void;
    onClearSelection: () => void;
}

export default function PdfPanel({
    open,
    onClose,
    pdfEntries,
    pdfDate,
    isAdmin,
    activePdfEntryId,
    onApplyEntry,
    onRemoveEntry,
    onClearAll,
    onClearSelection
}: PdfPanelProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [pdfUploading, setPdfUploading] = useState(false);
    const [pdfUploadError, setPdfUploadError] = useState<string | null>(null);
    const [pdfLoading, setPdfLoading] = useState(false);

    const addToast = useAppStore(s => s.addToast);

    const pdfInputRef = useRef<HTMLInputElement>(null);

    const [manualDate, setManualDate] = useState<string>("");

    if (!open) return null;

    async function handlePdfFileChange(file: File | null) {
        if (!file) return;
        setPdfFile(file);
        setPdfUploadError(null);
    }

    async function uploadPdfFromFile() {
        if (!pdfFile) return;
        setPdfUploading(true);
        setPdfUploadError(null);

        try {
            const formData = new FormData();
            formData.append("pdf", pdfFile);

            // If manual date is selected, pass it as query param
            let url = API_ENDPOINTS.PDF_IMPORT;
            if (manualDate) {
                url += `?overrideDate=${manualDate}`;
            }

            const res = await fetch(url, {
                method: "POST",
                body: formData,
            });

            let data;
            try {
                data = await res.json();
            } catch {
                data = null;
            }

            if (!res.ok) {
                const errorMsg = data?.error || "PDF yüklenemedi (Sunucu hatası)";
                setPdfUploadError(errorMsg);
                addToast(`Hata: ${errorMsg}`);
                return;
            }

            if (data?.error) {
                setPdfUploadError(data.error);
                addToast(`Hata: ${data.error}`);
                return;
            }

            addToast(`Başarı: PDF yüklendi! ${data.entries?.length || 0} randevu bulundu.`);
            setPdfFile(null);
            // Optionally clear manual date or keep it for next upload
            // setManualDate(""); 
        } catch (err: any) {
            setPdfUploadError(err.message || "Bilinmeyen hata");
            addToast(`Hata: ${err.message}`);
        } finally {
            setPdfUploading(false);
        }
    }

    return (
        <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl border border-emerald-100 p-6 space-y-5">
            <button
                className="absolute top-4 right-4 text-slate-600 hover:text-slate-900 z-10"
                onClick={onClose}
                title="Kapat"
            >
                <X className="h-6 w-6" />
            </button>

            <>
                <Card className="border border-dashed border-emerald-300 bg-white/90">
                    <CardHeader>
                        <CardTitle>RAM Randevu PDF Yükle</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="bg-emerald-50/50 p-3 rounded-md border border-emerald-100">
                            <label className="block text-sm font-medium text-emerald-900 mb-1">
                                Manuel Tarih Seçimi (Otomatik okuma çalışmazsa):
                            </label>
                            <input
                                type="date"
                                className="block w-full text-sm p-2 border border-emerald-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
                                value={manualDate}
                                onChange={(e) => setManualDate(e.target.value)}
                            />
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <label
                                className={`sm:flex-1 flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isDragging
                                    ? "border-emerald-500 bg-emerald-50"
                                    : "border-emerald-300 hover:bg-emerald-50/50"
                                    }`}
                                onDragEnter={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
                                        setIsDragging(true);
                                    }
                                }}
                                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
                                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setIsDragging(false);
                                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                        const file = e.dataTransfer.files[0];
                                        if (file.type === "application/pdf") {
                                            handlePdfFileChange(file);
                                        } else {
                                            addToast("Hata: Lütfen sadece PDF dosyası sürükleyin.");
                                        }
                                    }
                                }}
                            >
                                <input
                                    type="file"
                                    accept="application/pdf"
                                    ref={pdfInputRef}
                                    onChange={(e) => handlePdfFileChange(e.target.files?.[0] || null)}
                                    className="hidden"
                                />
                                <div className="text-center text-slate-600">
                                    {pdfFile ? <span className="font-semibold text-emerald-800">{pdfFile.name}</span> : "PDF dosyasını buraya sürükleyin veya tıklayıp seçin"}
                                </div>
                            </label>
                            <Button onClick={uploadPdfFromFile} disabled={pdfUploading || !pdfFile}>
                                {pdfUploading ? "Yükleniyor..." : "PDF Ekle"}
                            </Button>
                        </div>
                        <p className="text-xs text-slate-600">
                            Sistem, PDF başlığındaki tarihi (örn: "21.11.2025 Tarihli Randevu Listesi") otomatik olarak okur. Yükleme, o tarihe ait mevcut listeyi siler ve yenisiyle değiştirir.
                        </p>
                        {pdfUploadError && <p className="text-sm text-red-600">{pdfUploadError}</p>}
                        {!pdfUploadError && pdfEntries.length > 0 && (
                            <p className="text-sm text-emerald-700">
                                Son yüklemede {pdfEntries.length} randevu bulundu
                                {pdfDate ? ` (${pdfDate})` : ""}. Bu liste tüm kullanıcılarla paylaşılır.
                            </p>
                        )}
                    </CardContent>
                </Card>
                <Card className="border border-emerald-200 bg-emerald-50/60">
                    <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <CardTitle>
                            Yüklenen PDF Randevuları
                            {pdfDate && <span className="ml-2 text-sm text-emerald-700 font-normal">({pdfDate})</span>}
                        </CardTitle>
                        {isAdmin ? (
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    data-silent="true"
                                    onClick={onClearAll}
                                    disabled={!pdfEntries.length || pdfLoading}
                                >
                                    PDF'yi Temizle
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    data-silent="true"
                                    onClick={onClearSelection}
                                    disabled={!activePdfEntryId}
                                >
                                    Seçimi Temizle
                                </Button>
                            </div>
                        ) : null}
                    </CardHeader>
                    <CardContent>
                        {pdfLoading ? (
                            <p className="text-sm text-slate-600">Randevular yükleniyor...</p>
                        ) : pdfEntries.length === 0 ? (
                            <p className="text-sm text-slate-600">Henüz PDF içe aktarılmadı. İlk sayfadaki panelden PDF yükleyebilirsiniz.</p>
                        ) : (
                            <div className="overflow-auto border rounded-md">
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
                                        {pdfEntries.map((entry) => (
                                            <tr
                                                key={entry.id}
                                                className={`border-b last:border-b-0 ${activePdfEntryId === entry.id ? "bg-emerald-50" : "bg-white"}`}
                                            >
                                                <td className="p-2 font-semibold">{entry.time}</td>
                                                <td className="p-2">{entry.name}</td>
                                                <td className="p-2">{entry.fileNo || "-"}</td>
                                                <td className="p-2 text-xs text-slate-600">{entry.extra || "-"}</td>
                                                {isAdmin && (
                                                    <td className="p-2 flex flex-col gap-1 items-end">
                                                        <Button size="sm" onClick={() => onApplyEntry(entry)}>Forma Aktar</Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="text-red-600 hover:text-red-700"
                                                            onClick={() => onRemoveEntry(entry.id, pdfDate)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </>
        </div>
    );
}
