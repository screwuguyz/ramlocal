"use client";
import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import type { Teacher, CaseFile } from "@/types";
import { exportToPDF } from "@/lib/pdfExport";

function getTodayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getWeekDates(year: number, weekNumber: number): string[] {
  // Yılın ilk gününü bul
  const jan1 = new Date(year, 0, 1);
  const daysOffset = (jan1.getDay() + 6) % 7; // Pazartesi = 0

  // Hafta numarasına göre tarihi hesapla
  const weekStart = new Date(year, 0, 1 + (weekNumber - 1) * 7 - daysOffset);

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }
  return dates;
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getWeeksInYear(year: number): number {
  const dec31 = new Date(year, 11, 31);
  return getWeekNumber(dec31);
}

const DAYS_TR = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

type Props = {
  teachers: Teacher[];
  cases: CaseFile[];
  history: Record<string, CaseFile[]>;
};

export default function WeeklyReport({ teachers, cases, history }: Props) {
  const today = new Date();
  const [year, setYear] = useState<number>(today.getFullYear());
  const [weekNumber, setWeekNumber] = useState<number>(getWeekNumber(today));
  const maxWeeks = getWeeksInYear(year);

  // Tüm dosyaları birleştir
  const allCases = useMemo(() => {
    const fromHistory = Object.values(history).flat();
    return [...cases, ...fromHistory].filter(c => !c.absencePenalty && !c.backupBonus);
  }, [cases, history]);

  // Seçili hafta verileri
  const weekDates = useMemo(() => getWeekDates(year, weekNumber), [year, weekNumber]);
  const weekCases = useMemo(() =>
    allCases.filter(c => weekDates.includes(c.createdAt.slice(0, 10))),
    [allCases, weekDates]
  );

  // Öğretmen bazlı haftalık özet
  const teacherWeeklySummary = useMemo(() => {
    return teachers
      .filter(t => t.active)
      .map(t => {
        const teacherCases = weekCases.filter(c => c.assignedTo === t.id);
        const totalPoints = teacherCases.reduce((sum, c) => sum + c.score, 0);
        const fileCount = teacherCases.length;
        const byDay = weekDates.map(date => {
          const dayCases = teacherCases.filter(c => c.createdAt.slice(0, 10) === date);
          return {
            date,
            count: dayCases.length,
            points: dayCases.reduce((sum, c) => sum + c.score, 0),
          };
        });
        return {
          id: t.id,
          name: t.name,
          totalPoints,
          fileCount,
          byDay,
        };
      })
      .sort((a, b) => b.totalPoints - a.totalPoints);
  }, [teachers, weekCases, weekDates]);

  // Günlük toplamlar
  const dailyTotals = useMemo(() => {
    return weekDates.map(date => {
      const dayCases = weekCases.filter(c => c.createdAt.slice(0, 10) === date);
      return {
        date,
        count: dayCases.length,
        points: dayCases.reduce((sum, c) => sum + c.score, 0),
      };
    });
  }, [weekCases, weekDates]);

  // Dosya türü dağılımı
  const typeDistribution = useMemo(() => {
    return {
      YONLENDIRME: weekCases.filter(c => c.type === "YONLENDIRME" && !c.isTest).length,
      DESTEK: weekCases.filter(c => c.type === "DESTEK" && !c.isTest).length,
      IKISI: weekCases.filter(c => c.type === "IKISI" && !c.isTest).length,
      TEST: weekCases.filter(c => c.isTest).length,
    };
  }, [weekCases]);

  const weekStartFormatted = new Date(weekDates[0]).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  const weekEndFormatted = new Date(weekDates[6]).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  const handleExportPDF = async () => {
    try {
      await exportToPDF(
        'weekly-report-content',
        `haftalik-rapor-${year}-hafta-${weekNumber}.pdf`,
        { format: 'a4', orientation: 'landscape' }
      );
    } catch (error) {
      console.error('PDF export failed:', error);
      alert('PDF dışa aktarma başarısız oldu. Lütfen tekrar deneyin.');
    }
  };

  return (
    <div id="weekly-report-content" className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>📅 Haftalık Rapor</CardTitle>
          <div className="flex items-center gap-2">
            <Button onClick={handleExportPDF} variant="outline" size="sm" type="button">
              <Download className="h-4 w-4 mr-2" />
              PDF İndir
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tarih Seçimi */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Label>Yıl</Label>
              <div className="flex items-center border rounded-md">
                <button
                  className="px-2 py-1 hover:bg-slate-100 rounded-l-md"
                  onClick={() => {
                    const newYear = Math.max(2020, year - 1);
                    setYear(newYear);
                    const maxW = getWeeksInYear(newYear);
                    if (weekNumber > maxW) setWeekNumber(maxW);
                  }}
                  type="button"
                >
                  ◀
                </button>
                <span className="px-3 py-1 font-medium min-w-[60px] text-center">{year}</span>
                <button
                  className="px-2 py-1 hover:bg-slate-100 rounded-r-md"
                  onClick={() => {
                    const newYear = Math.min(2100, year + 1);
                    setYear(newYear);
                    const maxW = getWeeksInYear(newYear);
                    if (weekNumber > maxW) setWeekNumber(maxW);
                  }}
                  type="button"
                >
                  ▶
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label>Hafta</Label>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setWeekNumber(prev => Math.max(1, prev - 1))}
                  disabled={weekNumber <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Select
                  value={String(weekNumber)}
                  onValueChange={(v) => setWeekNumber(Number(v))}
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: maxWeeks }, (_, i) => i + 1).map(w => (
                      <SelectItem key={w} value={String(w)}>Hafta {w}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setWeekNumber(prev => Math.min(maxWeeks, prev + 1))}
                  disabled={weekNumber >= maxWeeks}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="text-sm text-slate-600">
              {weekStartFormatted} - {weekEndFormatted}
            </div>
          </div>

          {/* Özet Kartları */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <CardContent className="pt-4">
                <div className="text-3xl font-bold">{weekCases.length}</div>
                <div className="text-sm opacity-90">Toplam Dosya</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
              <CardContent className="pt-4">
                <div className="text-3xl font-bold">
                  {weekCases.reduce((sum, c) => sum + c.score, 0)}
                </div>
                <div className="text-sm opacity-90">Toplam Puan</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
              <CardContent className="pt-4">
                <div className="text-3xl font-bold">
                  {teacherWeeklySummary.length}
                </div>
                <div className="text-sm opacity-90">Aktif Öğretmen</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
              <CardContent className="pt-4">
                <div className="text-3xl font-bold">
                  {weekCases.length > 0
                    ? (weekCases.reduce((sum, c) => sum + c.score, 0) / weekCases.length).toFixed(1)
                    : 0}
                </div>
                <div className="text-sm opacity-90">Ortalama Puan</div>
              </CardContent>
            </Card>
          </div>

          {/* Günlük Dağılım */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">📊 Günlük Dağılım</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto">
                <table className="w-full text-sm border border-border">
                  <thead>
                    <tr className="bg-muted">
                      <th className="p-2 text-left">Gün</th>
                      <th className="p-2 text-right">Dosya Sayısı</th>
                      <th className="p-2 text-right">Toplam Puan</th>
                      <th className="p-2 text-right">Ortalama Puan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyTotals.map((day, idx) => (
                      <tr key={day.date} className="border-t">
                        <td className="p-2">
                          {DAYS_TR[idx]} ({new Date(day.date).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })})
                        </td>
                        <td className="p-2 text-right">{day.count}</td>
                        <td className="p-2 text-right font-medium">{day.points}</td>
                        <td className="p-2 text-right">
                          {day.count > 0 ? (day.points / day.count).toFixed(1) : 0}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t font-semibold">
                      <td className="p-2">TOPLAM</td>
                      <td className="p-2 text-right">
                        {dailyTotals.reduce((sum, d) => sum + d.count, 0)}
                      </td>
                      <td className="p-2 text-right">
                        {dailyTotals.reduce((sum, d) => sum + d.points, 0)}
                      </td>
                      <td className="p-2 text-right">
                        {weekCases.length > 0
                          ? (weekCases.reduce((sum, c) => sum + c.score, 0) / weekCases.length).toFixed(1)
                          : 0}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Öğretmen Performansı */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">👨‍🏫 Öğretmen Performansı</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto">
                <table className="w-full text-sm border border-border">
                  <thead>
                    <tr className="bg-muted">
                      <th className="p-2 text-left">Öğretmen</th>
                      {weekDates.map((date, idx) => (
                        <th key={date} className="p-2 text-right text-xs">
                          {DAYS_TR[idx].slice(0, 3)}
                        </th>
                      ))}
                      <th className="p-2 text-right">Toplam Dosya</th>
                      <th className="p-2 text-right">Toplam Puan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teacherWeeklySummary.map((t) => (
                      <tr key={t.id} className="border-t hover:bg-slate-50">
                        <td className="p-2 font-medium">{t.name}</td>
                        {t.byDay.map((day, idx) => (
                          <td key={idx} className="p-2 text-right text-xs">
                            {day.count > 0 ? `${day.count} (${day.points})` : "-"}
                          </td>
                        ))}
                        <td className="p-2 text-right font-medium">{t.fileCount}</td>
                        <td className="p-2 text-right font-medium">{t.totalPoints}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Dosya Türü Dağılımı */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">📋 Dosya Türü Dağılımı</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{typeDistribution.YONLENDIRME}</div>
                  <div className="text-sm text-slate-600">Yönlendirme</div>
                </div>
                <div className="text-center p-4 bg-emerald-50 rounded-lg">
                  <div className="text-2xl font-bold text-emerald-600">{typeDistribution.DESTEK}</div>
                  <div className="text-sm text-slate-600">Destek</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{typeDistribution.IKISI}</div>
                  <div className="text-sm text-slate-600">İkisi</div>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">{typeDistribution.TEST}</div>
                  <div className="text-sm text-slate-600">Test</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}

