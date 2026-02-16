import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, FileSpreadsheet } from "lucide-react";
import { format } from "date-fns";
import StudentDetailModal from "@/components/modals/StudentDetailModal";
import type { CaseFile, EArchiveEntry, Teacher } from "@/types";
import { nowISO } from "@/lib/date";

interface EArchiveViewProps {
    history: Record<string, CaseFile[]>;
    eArchive: EArchiveEntry[];
    cases: CaseFile[];
    teachers: Teacher[];
    showAdminButtons?: boolean;
    onClearEArchive: () => void;
    onExportCSV: () => void;
}

export default function EArchiveView({
    history,
    eArchive,
    cases,
    teachers,
    showAdminButtons = false,
    onClearEArchive,
    onExportCSV
}: EArchiveViewProps) {
    const [searchStudent, setSearchStudent] = useState("");
    const [searchFileNo, setSearchFileNo] = useState("");
    const [filterTeacher, setFilterTeacher] = useState<string>("");
    const [dateFrom, setDateFrom] = useState<string>("");
    const [dateTo, setDateTo] = useState<string>("");

    // Detail Modal State
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailStudent, setDetailStudent] = useState<{ name: string; fileNo?: string; history: CaseFile[] } | null>(null);

    const handleShowDetail = (studentName: string) => {
        const studentHistory: CaseFile[] = [];

        // 1. ÖNCE CANLI VERİ (Bugünün cases'leri) - En detaylı veri buradadır
        cases.forEach(c => {
            if (c.student === studentName) {
                studentHistory.push(c);
            }
        });

        // 2. SONRA GEÇMİŞ (History) - Detaylıdır
        Object.values(history).flat().forEach(c => {
            if (c.student === studentName && !studentHistory.some(h => h.id === c.id)) {
                studentHistory.push(c);
            }
        });

        // 3. EN SON E-ARŞİV (Manuel/Legacy) - Eksik veri olabilir, sadece ID çakışması yoksa ekle
        eArchive.forEach(e => {
            if ((e.studentName === studentName || (e as any).student === studentName) && !studentHistory.some(h => h.id === e.id)) {
                studentHistory.push({
                    id: e.id,
                    student: e.studentName,
                    fileNo: e.fileNo,
                    score: (e as any).score || 0, // Varsa kurtar
                    createdAt: e.date ? `${e.date}T12:00:00.000Z` : nowISO(),
                    type: (e.type as any) || "YONLENDIRME",
                    grade: (e as any).grade, // Varsa kurtar
                    isNew: false,
                    diagCount: 0,
                    isTest: false,
                    assignedTo: e.teacherName
                } as CaseFile);
            }
        });

        // Sırala
        studentHistory.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

        const fileNo = studentHistory.find(c => c.fileNo)?.fileNo;

        setDetailStudent({
            name: studentName,
            fileNo,
            history: studentHistory
        });
        setDetailOpen(true);
    };

    // Tüm arşiv kayıtlarını oluştur
    const allArchiveEntries = useMemo(() => {
        const entries: EArchiveEntry[] = [];

        // 1. Manuel E-Arşiv kayıtları
        eArchive.forEach(entry => {
            entries.push({
                ...entry,
                studentName: entry.studentName || (entry as any).student || "",
                teacherName: entry.teacherName || (entry as any).assignedToName || "",
                date: entry.date || (entry as any).createdAt || "",
                fileNo: entry.fileNo || ""
            });
        });

        // 2. History'den kayıtlar
        const historyCases = Object.values(history).flat();
        historyCases.forEach(c => {
            if (c.fileNo) {
                const t = teachers.find(x => x.id === c.assignedTo);
                entries.push({
                    id: c.id,
                    studentName: c.student,
                    fileNo: c.fileNo,
                    teacherName: t ? t.name : "Bilinmiyor",
                    date: c.createdAt.slice(0, 10)
                });
            }
        });

        // Aynı dosya numarası için EN YENİ atamanı tut
        entries.sort((a, b) => {
            const dateA = a.date ? new Date(a.date).getTime() : 0;
            const dateB = b.date ? new Date(b.date).getTime() : 0;
            return dateA - dateB;
        });

        const fileNoMap = new Map<string, EArchiveEntry>();
        entries.forEach(entry => {
            if (entry.fileNo) {
                fileNoMap.set(entry.fileNo, entry);
            }
        });

        return Array.from(fileNoMap.values());
    }, [eArchive, history, teachers]);

    // Filtrelenmiş liste
    const filteredArchive = useMemo(() => {
        let filtered = [...allArchiveEntries];

        if (searchStudent.trim()) {
            const searchLower = searchStudent.toLowerCase().trim();
            filtered = filtered.filter(e =>
                e.studentName.toLowerCase().includes(searchLower)
            );
        }

        if (searchFileNo.trim()) {
            const searchLower = searchFileNo.toLowerCase().trim();
            filtered = filtered.filter(e =>
                e.fileNo?.toLowerCase().includes(searchLower)
            );
        }

        if (filterTeacher) {
            filtered = filtered.filter(e => e.teacherName === filterTeacher);
        }

        if (dateFrom) {
            const fromDate = new Date(dateFrom);
            fromDate.setHours(0, 0, 0, 0);
            filtered = filtered.filter(e => {
                if (!e.date) return false;
                const entryDate = new Date(e.date);
                entryDate.setHours(0, 0, 0, 0);
                return entryDate >= fromDate;
            });
        }

        if (dateTo) {
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999);
            filtered = filtered.filter(e => {
                if (!e.date) return false;
                const entryDate = new Date(e.date);
                return entryDate <= toDate;
            });
        }

        return filtered.sort((a, b) => {
            const dateA = a.date ? new Date(a.date).getTime() : 0;
            const dateB = b.date ? new Date(b.date).getTime() : 0;
            return dateB - dateA;
        });
    }, [allArchiveEntries, searchStudent, searchFileNo, filterTeacher, dateFrom, dateTo]);

    // Tüm öğretmen isimlerini al
    const teacherNames = useMemo(() => {
        const names = new Set(allArchiveEntries.map(e => e.teacherName).filter(Boolean));
        return Array.from(names).sort();
    }, [allArchiveEntries]);

    return (
        <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>🗄️ E-Arşiv (Tüm Atanmış Dosyalar)</CardTitle>
                <div className="flex items-center gap-2">
                    {showAdminButtons && (
                        <Button variant="destructive" onClick={onClearEArchive}><Trash2 className="h-4 w-4 mr-2" /> Arşivi Temizle</Button>
                    )}
                    <Button onClick={onExportCSV}><FileSpreadsheet className="h-4 w-4 mr-2" /> CSV Olarak İndir</Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="mb-4 space-y-3 p-4 bg-slate-50 rounded-lg border">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <Label className="text-xs text-slate-600 mb-1 block">🔍 Öğrenci Adı</Label>
                            <Input
                                placeholder="Öğrenci adına göre ara..."
                                value={searchStudent}
                                onChange={(e) => setSearchStudent(e.target.value)}
                                className="h-9"
                            />
                        </div>
                        <div>
                            <Label className="text-xs text-slate-600 mb-1 block">📁 Dosya No</Label>
                            <Input
                                placeholder="Dosya numarasına göre ara..."
                                value={searchFileNo}
                                onChange={(e) => setSearchFileNo(e.target.value)}
                                className="h-9"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                            <Label className="text-xs text-slate-600 mb-1 block">👨‍🏫 Öğretmen</Label>
                            <Select value={filterTeacher} onValueChange={setFilterTeacher}>
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Tüm öğretmenler" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">Tüm öğretmenler</SelectItem>
                                    {teacherNames.map(name => (
                                        <SelectItem key={name} value={name}>{name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-xs text-slate-600 mb-1 block">📅 Başlangıç Tarihi</Label>
                            <Input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="h-9"
                            />
                        </div>
                        <div>
                            <Label className="text-xs text-slate-600 mb-1 block">📅 Bitiş Tarihi</Label>
                            <Input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="h-9"
                            />
                        </div>
                    </div>
                    {(searchStudent || searchFileNo || filterTeacher || dateFrom || dateTo) && (
                        <div className="flex items-center justify-between pt-2 border-t">
                            <span className="text-xs text-slate-600">
                                {filteredArchive.length} sonuç bulundu (toplam {eArchive.length})
                            </span>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                    setSearchStudent("");
                                    setSearchFileNo("");
                                    setFilterTeacher("");
                                    setDateFrom("");
                                    setDateTo("");
                                }}
                                className="h-7 text-xs"
                            >
                                ✕ Filtreleri Temizle
                            </Button>
                        </div>
                    )}
                </div>

                {eArchive.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        <div className="text-4xl mb-3">📭</div>
                        <div className="font-medium">E-Arşiv boş</div>
                        <div className="text-sm">Henüz atanmış dosya bulunmuyor.</div>
                    </div>
                ) : filteredArchive.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        <div className="text-4xl mb-3">🔍</div>
                        <div className="font-medium">Sonuç bulunamadı</div>
                        <div className="text-sm">Arama kriterlerinize uygun dosya yok.</div>
                    </div>
                ) : (
                    <div className="overflow-auto border rounded-md max-h-[70vh]">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-muted">
                                <tr>
                                    <th className="p-2 text-left w-12">No</th>
                                    <th className="p-2 text-left">Öğrenci Adı</th>
                                    <th className="p-2 text-left">Dosya No</th>
                                    <th className="p-2 text-left">Atanan Öğretmen</th>
                                    <th className="p-2 text-left">Atama Tarihi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredArchive.map((entry, index) => (
                                    <tr key={entry.id} className="border-t hover:bg-slate-50">
                                        <td className="p-2 font-semibold text-slate-500">{filteredArchive.length - index}</td>
                                        <td className="p-2 font-medium">
                                            <Button variant="ghost" className="p-0 h-auto font-medium text-indigo-600 hover:text-indigo-800 hover:underline" onClick={() => handleShowDetail(entry.studentName)}>
                                                {entry.studentName}
                                            </Button>
                                        </td>
                                        <td className="p-2">
                                            {entry.fileNo ? (
                                                <Button variant="ghost" className="p-0 h-auto text-slate-600 hover:text-indigo-800 hover:underline" onClick={() => handleShowDetail(entry.studentName)}>
                                                    {entry.fileNo}
                                                </Button>
                                            ) : '—'}
                                        </td>
                                        <td className="p-2">{entry.teacherName}</td>
                                        <td className="p-2">{new Date(entry.date).toLocaleDateString("tr-TR")}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <StudentDetailModal
                    open={detailOpen}
                    onOpenChange={setDetailOpen}
                    studentName={detailStudent?.name || ""}
                    fileNo={detailStudent?.fileNo}
                    history={detailStudent?.history || []}
                    teachers={teachers}
                    variant="absolute"
                />
            </CardContent>
        </Card>
    );
}
