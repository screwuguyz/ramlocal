"use client";
import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
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

export default function YearlyReport({ teachers, cases, history }: Props) {
  const today = new Date();
  const [year, setYear] = useState<number>(today.getFullYear());
  const [compareYear, setCompareYear] = useState<number | null>(year - 1);

  // Tüm dosyaları birleştir
  const allCases = useMemo(() => {
    const fromHistory = Object.values(history).flat();
    // Backup bonuslar dahil ediliyor
    return [...cases, ...fromHistory].filter(c => !c.absencePenalty);
  }, [cases, history]);

  // Yıllık veriler
  const yearlyData = useMemo(() => {
    return MONTHS_TR.map((monthName, monthIdx) => {
      const month = monthIdx + 1;
      const monthDates = getMonthDates(year, month);
      const monthCases = allCases.filter(c => {
        const caseDate = c.createdAt.slice(0, 10);
        return monthDates.includes(caseDate);
      });

      return {
        month,
        monthName,
        count: monthCases.length,
        totalPoints: monthCases.reduce((sum, c) => sum + c.score, 0),
        avgPoints: monthCases.length > 0
          ? monthCases.reduce((sum, c) => sum + c.score, 0) / monthCases.length
          : 0,
        byType: {
          YONLENDIRME: monthCases.filter(c => c.type === "YONLENDIRME" && !c.isTest).length,
          DESTEK: monthCases.filter(c => c.type === "DESTEK" && !c.isTest).length,
          IKISI: monthCases.filter(c => c.type === "IKISI" && !c.isTest).length,
          TEST: monthCases.filter(c => c.isTest).length,
        },
      };
    });
  }, [allCases, year]);

  // Karşılaştırma yılı verileri
  const compareYearlyData = useMemo(() => {
    if (!compareYear) return null;

    return MONTHS_TR.map((monthName, monthIdx) => {
      const month = monthIdx + 1;
      const monthDates = getMonthDates(compareYear, month);
      const monthCases = allCases.filter(c => {
        const caseDate = c.createdAt.slice(0, 10);
        return monthDates.includes(caseDate);
      });

      return {
        month,
        monthName,
        count: monthCases.length,
        totalPoints: monthCases.reduce((sum, c) => sum + c.score, 0),
      };
    });
  }, [allCases, compareYear]);

  // Yıllık toplamlar
  const yearlyTotals = useMemo(() => {
    const total = yearlyData.reduce((acc, m) => ({
      count: acc.count + m.count,
      totalPoints: acc.totalPoints + m.totalPoints,
    }), { count: 0, totalPoints: 0 });

    return {
      ...total,
      avgPoints: total.count > 0 ? total.totalPoints / total.count : 0,
    };
  }, [yearlyData]);

  // Öğretmen bazlı yıllık özet
  const teacherYearlySummary = useMemo(() => {
    return teachers
      .filter(t => t.active)
      .map(t => {
        const teacherCases = allCases.filter(c => {
          const caseDate = c.createdAt.slice(0, 4);
          return caseDate === String(year) && c.assignedTo === t.id;
        });

        const totalPoints = teacherCases.reduce((sum, c) => sum + c.score, 0);
        const fileCount = teacherCases.length;
        const byMonth = MONTHS_TR.map((_, monthIdx) => {
          const month = monthIdx + 1;
          const monthDates = getMonthDates(year, month);
          const monthCases = teacherCases.filter(c =>
            monthDates.includes(c.createdAt.slice(0, 10))
          );
          return {
            month,
            count: monthCases.length,
            points: monthCases.reduce((sum, c) => sum + c.score, 0),
          };
        });

        return {
          id: t.id,
          name: t.name,
          totalPoints,
          fileCount,
          byMonth,
        };
      })
      .sort((a, b) => b.totalPoints - a.totalPoints);
  }, [teachers, allCases, year]);

  const handleExportPDF = async () => {
    try {
      await exportToPDF(
        'yearly-report-content',
        `yillik-rapor-${year}.pdf`,
        { format: 'a4', orientation: 'landscape' }
      );
    } catch (error) {
      console.error('PDF export failed:', error);
      alert('PDF dışa aktarma başarısız oldu. Lütfen tekrar deneyin.');
    }
  };

  return (
    <div id="yearly-report-content" className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>📆 Yıllık Rapor</CardTitle>
          <div className="flex items-center gap-2">
            <Button onClick={handleExportPDF} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              PDF İndir
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Yıl Seçimi */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Label>Yıl</Label>
              <div className="flex items-center border rounded-md bg-white">
                <button
                  className="px-3 py-2 hover:bg-slate-100 rounded-l-md border-r transition-colors"
                  onClick={() => setYear(prev => Math.max(2020, prev - 1))}
                >
                  <ChevronLeft className="h-4 w-4 text-slate-600" />
                </button>
                <span className="px-2 py-1 font-medium min-w-[70px] text-center text-slate-800">{year}</span>
                <button
                  className="px-3 py-2 hover:bg-slate-100 rounded-r-md border-l transition-colors"
                  onClick={() => setYear(prev => Math.min(2100, prev + 1))}
                >
                  <ChevronRight className="h-4 w-4 text-slate-600" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label>Karşılaştır</Label>
              <Input
                className="w-24"
                type="number"
                placeholder="Yıl"
                value={compareYear || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setCompareYear(val ? Number(val) : null);
                }}
              />
              {compareYear && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setCompareYear(null)}
                >
                  ✕
                </Button>
              )}
            </div>
          </div>

          {/* Özet Kartları */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <CardContent className="pt-4">
                <div className="text-3xl font-bold">{yearlyTotals.count}</div>
                <div className="text-sm opacity-90">Toplam Dosya</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
              <CardContent className="pt-4">
                <div className="text-3xl font-bold">{yearlyTotals.totalPoints}</div>
                <div className="text-sm opacity-90">Toplam Puan</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
              <CardContent className="pt-4">
                <div className="text-3xl font-bold">{yearlyTotals.avgPoints.toFixed(1)}</div>
                <div className="text-sm opacity-90">Ortalama Puan</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
              <CardContent className="pt-4">
                <div className="text-3xl font-bold">
                  {Math.round(yearlyTotals.count / 12)}
                </div>
                <div className="text-sm opacity-90">Aylık Ortalama</div>
              </CardContent>
            </Card>
          </div>

          {/* Aylık Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">📈 Aylık Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto">
                <table className="w-full text-sm border border-border">
                  <thead>
                    <tr className="bg-muted">
                      <th className="p-2 text-left">Ay</th>
                      <th className="p-2 text-right">Dosya Sayısı</th>
                      {compareYear && (
                        <th className="p-2 text-right">{compareYear} Dosya</th>
                      )}
                      {compareYear && (
                        <th className="p-2 text-right">Değişim</th>
                      )}
                      <th className="p-2 text-right">Toplam Puan</th>
                      <th className="p-2 text-right">Ortalama Puan</th>
                      <th className="p-2 text-left">Tür Dağılımı</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearlyData.map((month, idx) => {
                      const compareMonth = compareYearlyData?.[idx];
                      const change = compareMonth
                        ? month.count - compareMonth.count
                        : null;
                      const changePercent = compareMonth && compareMonth.count > 0
                        ? ((change! / compareMonth.count) * 100).toFixed(1)
                        : null;

                      return (
                        <tr key={month.month} className="border-t hover:bg-slate-50">
                          <td className="p-2 font-medium">{month.monthName}</td>
                          <td className="p-2 text-right">{month.count}</td>
                          {compareYear && (
                            <td className="p-2 text-right text-slate-600">
                              {compareMonth?.count || 0}
                            </td>
                          )}
                          {compareYear && (
                            <td className={`p-2 text-right font-medium ${change && change > 0 ? "text-green-600" :
                              change && change < 0 ? "text-red-600" :
                                "text-slate-600"
                              }`}>
                              {change !== null
                                ? `${change > 0 ? "+" : ""}${change} (${changePercent}%)`
                                : "-"
                              }
                            </td>
                          )}
                          <td className="p-2 text-right">{month.totalPoints}</td>
                          <td className="p-2 text-right">{month.avgPoints.toFixed(1)}</td>
                          <td className="p-2 text-xs text-slate-600">
                            Y:{month.byType.YONLENDIRME} D:{month.byType.DESTEK} İ:{month.byType.IKISI} T:{month.byType.TEST}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="border-t font-semibold">
                      <td className="p-2">TOPLAM</td>
                      <td className="p-2 text-right">{yearlyTotals.count}</td>
                      {compareYear && (
                        <td className="p-2 text-right">
                          {compareYearlyData?.reduce((sum, m) => sum + m.count, 0) || 0}
                        </td>
                      )}
                      {compareYear && (
                        <td className="p-2 text-right">
                          {(() => {
                            const totalCompare = compareYearlyData?.reduce((sum, m) => sum + m.count, 0) || 0;
                            const totalChange = yearlyTotals.count - totalCompare;
                            const totalChangePercent = totalCompare > 0
                              ? ((totalChange / totalCompare) * 100).toFixed(1)
                              : "0";
                            return `${totalChange > 0 ? "+" : ""}${totalChange} (${totalChangePercent}%)`;
                          })()}
                        </td>
                      )}
                      <td className="p-2 text-right">{yearlyTotals.totalPoints}</td>
                      <td className="p-2 text-right">{yearlyTotals.avgPoints.toFixed(1)}</td>
                      <td className="p-2">-</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Öğretmen Yıllık Performansı */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">👨‍🏫 Öğretmen Yıllık Performansı</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto max-h-[600px]">
                <table className="w-full text-sm border border-border">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="p-2 text-left">Öğretmen</th>
                      {MONTHS_TR.map((month, idx) => (
                        <th key={idx} className="p-2 text-right text-xs">
                          {month.slice(0, 3)}
                        </th>
                      ))}
                      <th className="p-2 text-right">Toplam Dosya</th>
                      <th className="p-2 text-right">Toplam Puan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teacherYearlySummary.map((t) => (
                      <tr key={t.id} className="border-t hover:bg-slate-50">
                        <td className="p-2 font-medium">{t.name}</td>
                        {t.byMonth.map((month, idx) => (
                          <td key={idx} className="p-2 text-right text-xs">
                            {month.count > 0 ? `${month.count} (${month.points})` : "-"}
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
        </CardContent>
      </Card>
    </div>
  );
}

