"use client";
import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";
import type { Teacher, CaseFile } from "@/lib/types";
import { exportToPDF } from "@/lib/pdfExport";

const MONTHS_TR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
];

type Props = {
  teachers: Teacher[];
  cases: CaseFile[];
  history: Record<string, CaseFile[]>;
};

function getMonthDates(year: number, month: number): string[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const dates: string[] = [];
  for (let i = 1; i <= daysInMonth; i++) {
    dates.push(`${year}-${String(month).padStart(2, "0")}-${String(i).padStart(2, "0")}`);
  }
  return dates;
}

export default function TeacherPerformanceReport({ teachers, cases, history }: Props) {
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null); // null = tüm yıl
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null); // null = tüm öğretmenler
  const [sortBy, setSortBy] = useState<"points" | "files" | "avgPoints">("points");

  // Tüm dosyaları birleştir
  const allCases = useMemo(() => {
    const fromHistory = Object.values(history).flat();
    // Backup bonuslar da artık dahil ediliyor (kurtarılan veriler için)
    return [...cases, ...fromHistory].filter(c => !c.absencePenalty);
  }, [cases, history]);

  // Filtrelenmiş dosyalar
  const filteredCases = useMemo(() => {
    let filtered = allCases.filter(c => {
      const caseYear = Number(c.createdAt.slice(0, 4));
      if (caseYear !== selectedYear) return false;

      if (selectedMonth !== null) {
        const caseMonth = Number(c.createdAt.slice(5, 7));
        if (caseMonth !== selectedMonth) return false;
      }

      if (selectedTeacherId) {
        if (c.assignedTo !== selectedTeacherId) return false;
      }

      return true;
    });

    return filtered;
  }, [allCases, selectedYear, selectedMonth, selectedTeacherId]);

  // Öğretmen performans verileri
  const teacherPerformance = useMemo(() => {
    const teacherMap = new Map<string, {
      id: string;
      name: string;
      totalFiles: number;
      totalPoints: number;
      avgPoints: number;
      byType: {
        YONLENDIRME: number;
        DESTEK: number;
        IKISI: number;
        TEST: number;
      };
      byMonth: Array<{ month: number; count: number; points: number }>;
      weeklyAvg: number;
      dailyAvg: number;
    }>();

    // Tüm öğretmenleri başlat
    teachers.filter(t => t.active).forEach(t => {
      teacherMap.set(t.id, {
        id: t.id,
        name: t.name,
        totalFiles: 0,
        totalPoints: 0,
        avgPoints: 0,
        byType: {
          YONLENDIRME: 0,
          DESTEK: 0,
          IKISI: 0,
          TEST: 0,
        },
        byMonth: MONTHS_TR.map((_, idx) => ({
          month: idx + 1,
          count: 0,
          points: 0,
        })),
        weeklyAvg: 0,
        dailyAvg: 0,
      });
    });

    // Dosyaları işle
    filteredCases.forEach(c => {
      if (!c.assignedTo) return;
      const teacher = teacherMap.get(c.assignedTo);
      if (!teacher) return;

      teacher.totalFiles++;
      teacher.totalPoints += c.score;

      // Tür bazlı
      if (c.isTest) {
        teacher.byType.TEST++;
      } else {
        if (c.type === "YONLENDIRME") teacher.byType.YONLENDIRME++;
        if (c.type === "DESTEK") teacher.byType.DESTEK++;
        if (c.type === "IKISI") teacher.byType.IKISI++;
      }

      // Ay bazlı
      const caseMonth = Number(c.createdAt.slice(5, 7));
      const monthData = teacher.byMonth[caseMonth - 1];
      if (monthData) {
        monthData.count++;
        monthData.points += c.score;
      }
    });

    // Ortalamaları hesapla
    teacherMap.forEach(teacher => {
      teacher.avgPoints = teacher.totalFiles > 0
        ? teacher.totalPoints / teacher.totalFiles
        : 0;

      // Haftalık ortalama (yıl için)
      if (selectedMonth === null) {
        teacher.weeklyAvg = teacher.totalFiles / 52;
      } else {
        const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
        const weeksInMonth = Math.ceil(daysInMonth / 7);
        teacher.weeklyAvg = teacher.totalFiles / weeksInMonth;
      }

      // Günlük ortalama
      if (selectedMonth === null) {
        teacher.dailyAvg = teacher.totalFiles / 365;
      } else {
        const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
        teacher.dailyAvg = teacher.totalFiles / daysInMonth;
      }
    });

    return Array.from(teacherMap.values()).sort((a, b) => {
      if (sortBy === "points") return b.totalPoints - a.totalPoints;
      if (sortBy === "files") return b.totalFiles - a.totalFiles;
      return b.avgPoints - a.avgPoints;
    });
  }, [teachers, filteredCases, selectedYear, selectedMonth, sortBy]);

  // Seçili öğretmen detayları
  const selectedTeacherDetail = useMemo(() => {
    if (!selectedTeacherId) return null;
    return teacherPerformance.find(t => t.id === selectedTeacherId);
  }, [teacherPerformance, selectedTeacherId]);

  const handleExportPDF = async () => {
    try {
      await exportToPDF(
        'teacher-performance-content',
        `ogretmen-performans-raporu-${selectedYear}${selectedMonth ? `-${selectedMonth}` : ''}.pdf`,
        { format: 'a4', orientation: 'portrait' }
      );
    } catch (error) {
      console.error('PDF export failed:', error);
      alert('PDF dışa aktarma başarısız oldu. Lütfen tekrar deneyin.');
    }
  };

  const periodLabel = selectedMonth
    ? `${MONTHS_TR[selectedMonth - 1]} ${selectedYear}`
    : `${selectedYear} Yılı`;

  return (
    <div id="teacher-performance-content" className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>👨‍🏫 Öğretmen Performans Raporu</CardTitle>
          <div className="flex items-center gap-2">
            <Button onClick={handleExportPDF} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              PDF İndir
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtreler */}
          <div className="flex items-center gap-4 flex-wrap p-4 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Label>Yıl</Label>
              <div className="flex items-center border rounded-md">
                <button
                  className="px-2 py-1 hover:bg-slate-100 rounded-l-md"
                  onClick={() => setSelectedYear(prev => Math.max(2020, prev - 1))}
                >
                  ◀
                </button>
                <span className="px-3 py-1 font-medium min-w-[60px] text-center">{selectedYear}</span>
                <button
                  className="px-2 py-1 hover:bg-slate-100 rounded-r-md"
                  onClick={() => setSelectedYear(prev => Math.min(2100, prev + 1))}
                >
                  ▶
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label>Ay</Label>
              <Select
                value={selectedMonth ? String(selectedMonth) : "all"}
                onValueChange={(v) => setSelectedMonth(v === "all" ? null : Number(v))}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Yıl</SelectItem>
                  {MONTHS_TR.map((month, idx) => (
                    <SelectItem key={idx + 1} value={String(idx + 1)}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label>Öğretmen</Label>
              <Select
                value={selectedTeacherId || "all"}
                onValueChange={(v) => setSelectedTeacherId(v === "all" ? null : v)}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Öğretmenler</SelectItem>
                  {teachers.filter(t => t.active).map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label>Sıralama</Label>
              <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="points">Toplam Puan</SelectItem>
                  <SelectItem value="files">Dosya Sayısı</SelectItem>
                  <SelectItem value="avgPoints">Ortalama Puan</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Özet */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <CardContent className="pt-4">
                <div className="text-3xl font-bold">{teacherPerformance.length}</div>
                <div className="text-sm opacity-90">Aktif Öğretmen</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
              <CardContent className="pt-4">
                <div className="text-3xl font-bold">
                  {teacherPerformance.reduce((sum, t) => sum + t.totalFiles, 0)}
                </div>
                <div className="text-sm opacity-90">Toplam Dosya</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
              <CardContent className="pt-4">
                <div className="text-3xl font-bold">
                  {teacherPerformance.reduce((sum, t) => sum + t.totalPoints, 0)}
                </div>
                <div className="text-sm opacity-90">Toplam Puan</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
              <CardContent className="pt-4">
                <div className="text-3xl font-bold">
                  {teacherPerformance.length > 0
                    ? (teacherPerformance.reduce((sum, t) => sum + t.avgPoints, 0) / teacherPerformance.length).toFixed(1)
                    : 0}
                </div>
                <div className="text-sm opacity-90">Ortalama Puan</div>
              </CardContent>
            </Card>
          </div>

          {/* Öğretmen Listesi */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                📊 Öğretmen Performans Tablosu ({periodLabel})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto">
                <table className="w-full text-sm border border-border">
                  <thead>
                    <tr className="bg-muted">
                      <th className="p-2 text-left">Sıra</th>
                      <th className="p-2 text-left">Öğretmen</th>
                      <th className="p-2 text-right">Toplam Dosya</th>
                      <th className="p-2 text-right">Toplam Puan</th>
                      <th className="p-2 text-right">Ortalama Puan</th>
                      <th className="p-2 text-right">Haftalık Ort.</th>
                      <th className="p-2 text-right">Günlük Ort.</th>
                      <th className="p-2 text-left">Tür Dağılımı</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teacherPerformance.map((t, idx) => (
                      <tr
                        key={t.id}
                        className={`border-t hover:bg-slate-50 cursor-pointer ${selectedTeacherId === t.id ? "bg-blue-50" : ""
                          }`}
                        onClick={() => setSelectedTeacherId(t.id === selectedTeacherId ? null : t.id)}
                      >
                        <td className="p-2 text-center font-bold">
                          {idx + 1}
                          {idx < 3 && <span className="ml-1">🏆</span>}
                        </td>
                        <td className="p-2 font-medium">{t.name}</td>
                        <td className="p-2 text-right">{t.totalFiles}</td>
                        <td className="p-2 text-right font-medium">{t.totalPoints}</td>
                        <td className="p-2 text-right">{t.avgPoints.toFixed(1)}</td>
                        <td className="p-2 text-right text-xs">{t.weeklyAvg.toFixed(1)}</td>
                        <td className="p-2 text-right text-xs">{t.dailyAvg.toFixed(2)}</td>
                        <td className="p-2 text-xs text-slate-600">
                          Y:{t.byType.YONLENDIRME} D:{t.byType.DESTEK} İ:{t.byType.IKISI} T:{t.byType.TEST}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Seçili Öğretmen Detayları */}
          {selectedTeacherDetail && (
            <Card className="border-2 border-blue-500">
              <CardHeader>
                <CardTitle className="text-lg">
                  📋 {selectedTeacherDetail.name} - Detaylı Analiz
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Genel Bilgiler */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {selectedTeacherDetail.totalFiles}
                    </div>
                    <div className="text-sm text-slate-600">Toplam Dosya</div>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {selectedTeacherDetail.totalPoints}
                    </div>
                    <div className="text-sm text-slate-600">Toplam Puan</div>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-lg">
                    <div className="text-2xl font-bold text-emerald-600">
                      {selectedTeacherDetail.avgPoints.toFixed(1)}
                    </div>
                    <div className="text-sm text-slate-600">Ortalama Puan</div>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg">
                    <div className="text-2xl font-bold text-amber-600">
                      {selectedTeacherDetail.weeklyAvg.toFixed(1)}
                    </div>
                    <div className="text-sm text-slate-600">Haftalık Ortalama</div>
                  </div>
                </div>

                {/* Aylık Dağılım */}
                <div>
                  <h3 className="font-semibold mb-2">Aylık Dağılım</h3>
                  <div className="overflow-auto">
                    <table className="w-full text-sm border border-border">
                      <thead>
                        <tr className="bg-muted">
                          <th className="p-2 text-left">Ay</th>
                          <th className="p-2 text-right">Dosya Sayısı</th>
                          <th className="p-2 text-right">Toplam Puan</th>
                          <th className="p-2 text-right">Ortalama Puan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedTeacherDetail.byMonth.map((month, idx) => (
                          <tr key={month.month} className="border-t">
                            <td className="p-2">{MONTHS_TR[idx]}</td>
                            <td className="p-2 text-right">{month.count}</td>
                            <td className="p-2 text-right">{month.points}</td>
                            <td className="p-2 text-right">
                              {month.count > 0 ? (month.points / month.count).toFixed(1) : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Tür Dağılımı */}
                <div>
                  <h3 className="font-semibold mb-2">Dosya Türü Dağılımı</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 bg-blue-50 rounded-lg text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {selectedTeacherDetail.byType.YONLENDIRME}
                      </div>
                      <div className="text-sm text-slate-600">Yönlendirme</div>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-lg text-center">
                      <div className="text-2xl font-bold text-emerald-600">
                        {selectedTeacherDetail.byType.DESTEK}
                      </div>
                      <div className="text-sm text-slate-600">Destek</div>
                    </div>
                    <div className="p-3 bg-purple-50 rounded-lg text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {selectedTeacherDetail.byType.IKISI}
                      </div>
                      <div className="text-sm text-slate-600">İkisi</div>
                    </div>
                    <div className="p-3 bg-orange-50 rounded-lg text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {selectedTeacherDetail.byType.TEST}
                      </div>
                      <div className="text-sm text-slate-600">Test</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

