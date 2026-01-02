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

const FILE_TYPES = [
  { key: "YONLENDIRME", label: "Yönlendirme", color: "blue" },
  { key: "DESTEK", label: "Destek", color: "emerald" },
  { key: "IKISI", label: "İkisi", color: "purple" },
  { key: "TEST", label: "Test", color: "orange" },
] as const;

export default function FileTypeAnalysis({ teachers, cases, history }: Props) {
  const today = new Date();
  const [year, setYear] = useState<number>(today.getFullYear());
  const [selectedType, setSelectedType] = useState<string | null>(null);

  // Tüm dosyaları birleştir
  const allCases = useMemo(() => {
    const fromHistory = Object.values(history).flat();
    return [...cases, ...fromHistory].filter(c => !c.absencePenalty && !c.backupBonus);
  }, [cases, history]);

  // Yıllık tür bazlı veriler
  const yearlyTypeData = useMemo(() => {
    return FILE_TYPES.map(type => {
      const typeCases = allCases.filter(c => {
        const caseYear = Number(c.createdAt.slice(0, 4));
        if (caseYear !== year) return false;

        if (type.key === "TEST") {
          return c.isTest;
        } else {
          return c.type === type.key && !c.isTest;
        }
      });

      const byMonth = MONTHS_TR.map((_, monthIdx) => {
        const month = monthIdx + 1;
        const monthDates = getMonthDates(year, month);
        const monthCases = typeCases.filter(c =>
          monthDates.includes(c.createdAt.slice(0, 10))
        );

        return {
          month,
          count: monthCases.length,
          totalPoints: monthCases.reduce((sum, c) => sum + c.score, 0),
          avgPoints: monthCases.length > 0
            ? monthCases.reduce((sum, c) => sum + c.score, 0) / monthCases.length
            : 0,
        };
      });

      return {
        type: type.key,
        label: type.label,
        color: type.color,
        totalCount: typeCases.length,
        totalPoints: typeCases.reduce((sum, c) => sum + c.score, 0),
        avgPoints: typeCases.length > 0
          ? typeCases.reduce((sum, c) => sum + c.score, 0) / typeCases.length
          : 0,
        byMonth,
      };
    });
  }, [allCases, year]);

  // Toplam veriler
  const totalData = useMemo(() => {
    const allYearCases = allCases.filter(c => {
      const caseYear = Number(c.createdAt.slice(0, 4));
      return caseYear === year;
    });

    return {
      totalCount: allYearCases.length,
      totalPoints: allYearCases.reduce((sum, c) => sum + c.score, 0),
      avgPoints: allYearCases.length > 0
        ? allYearCases.reduce((sum, c) => sum + c.score, 0) / allYearCases.length
        : 0,
    };
  }, [allCases, year]);

  // Öğretmen bazlı tür dağılımı
  const teacherTypeDistribution = useMemo(() => {
    return teachers
      .filter(t => t.active)
      .map(t => {
        const teacherCases = allCases.filter(c => {
          const caseYear = Number(c.createdAt.slice(0, 4));
          return caseYear === year && c.assignedTo === t.id;
        });

        const byType = FILE_TYPES.map(type => {
          const typeCases = teacherCases.filter(c => {
            if (type.key === "TEST") {
              return c.isTest;
            } else {
              return c.type === type.key && !c.isTest;
            }
          });

          return {
            type: type.key,
            label: type.label,
            count: typeCases.length,
            points: typeCases.reduce((sum, c) => sum + c.score, 0),
          };
        });

        return {
          id: t.id,
          name: t.name,
          totalFiles: teacherCases.length,
          totalPoints: teacherCases.reduce((sum, c) => sum + c.score, 0),
          byType,
        };
      })
      .filter(t => t.totalFiles > 0)
      .sort((a, b) => b.totalFiles - a.totalFiles);
  }, [teachers, allCases, year]);

  // Seçili tür detayları
  const selectedTypeDetail = useMemo(() => {
    if (!selectedType) return null;
    return yearlyTypeData.find(t => t.type === selectedType);
  }, [yearlyTypeData, selectedType]);

  const handleExportPDF = async () => {
    try {
      await exportToPDF(
        'file-type-analysis-content',
        `dosya-turu-analizi-${year}.pdf`,
        { format: 'a4', orientation: 'landscape' }
      );
    } catch (error) {
      console.error('PDF export failed:', error);
      alert('PDF dışa aktarma başarısız oldu. Lütfen tekrar deneyin.');
    }
  };

  return (
    <div id="file-type-analysis-content" className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>📊 Dosya Türü Analizi</CardTitle>
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
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setYear(prev => prev - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Input
                  className="w-24"
                  type="number"
                  value={year}
                  onChange={(e) => {
                    const newYear = Number(e.target.value);
                    if (newYear >= 2020 && newYear <= 2100) {
                      setYear(newYear);
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setYear(prev => prev + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label>Tür Seç</Label>
              <Select
                value={selectedType || "all"}
                onValueChange={(v) => setSelectedType(v === "all" ? null : v)}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Türler</SelectItem>
                  {FILE_TYPES.map(type => (
                    <SelectItem key={type.key} value={type.key}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Özet Kartları */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <CardContent className="pt-4">
                <div className="text-3xl font-bold">{totalData.totalCount}</div>
                <div className="text-sm opacity-90">Toplam Dosya</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
              <CardContent className="pt-4">
                <div className="text-3xl font-bold">{totalData.totalPoints}</div>
                <div className="text-sm opacity-90">Toplam Puan</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
              <CardContent className="pt-4">
                <div className="text-3xl font-bold">{totalData.avgPoints.toFixed(1)}</div>
                <div className="text-sm opacity-90">Ortalama Puan</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
              <CardContent className="pt-4">
                <div className="text-3xl font-bold">{yearlyTypeData.length}</div>
                <div className="text-sm opacity-90">Dosya Türü</div>
              </CardContent>
            </Card>
          </div>

          {/* Tür Bazlı Özet */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">📋 Tür Bazlı Özet</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {yearlyTypeData.map(type => {
                  const percentage = totalData.totalCount > 0
                    ? (type.totalCount / totalData.totalCount * 100).toFixed(1)
                    : 0;

                  return (
                    <Card
                      key={type.type}
                      className={`border-2 cursor-pointer transition-all hover:shadow-lg ${selectedType === type.type ? `border-${type.color}-500` : ""
                        }`}
                      onClick={() => setSelectedType(selectedType === type.type ? null : type.type)}
                    >
                      <CardContent className="pt-4">
                        <div className={`text-3xl font-bold text-${type.color}-600 mb-2`}>
                          {type.totalCount}
                        </div>
                        <div className="text-sm font-medium text-slate-700 mb-1">
                          {type.label}
                        </div>
                        <div className="text-xs text-slate-500 mb-2">
                          %{percentage} • {type.totalPoints} puan
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full bg-${type.color}-500 rounded-full`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <div className="text-xs text-slate-600 mt-2">
                          Ort: {type.avgPoints.toFixed(1)} puan
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Seçili Tür Detayları */}
          {selectedTypeDetail && (
            <Card className="border-2 border-blue-500">
              <CardHeader>
                <CardTitle className="text-lg">
                  📈 {selectedTypeDetail.label} - Aylık Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-auto">
                  <table className="w-full text-sm border border-border">
                    <thead>
                      <tr className="bg-muted">
                        <th className="p-2 text-left">Ay</th>
                        <th className="p-2 text-right">Dosya Sayısı</th>
                        <th className="p-2 text-right">Toplam Puan</th>
                        <th className="p-2 text-right">Ortalama Puan</th>
                        <th className="p-2 text-right">Aylık %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTypeDetail.byMonth.map((month, idx) => {
                        const monthlyTotal = yearlyTypeData.reduce((sum, t) =>
                          sum + t.byMonth[idx].count, 0
                        );
                        const monthlyPercentage = monthlyTotal > 0
                          ? ((month.count / monthlyTotal) * 100).toFixed(1)
                          : 0;

                        return (
                          <tr key={month.month} className="border-t hover:bg-slate-50">
                            <td className="p-2 font-medium">{MONTHS_TR[idx]}</td>
                            <td className="p-2 text-right">{month.count}</td>
                            <td className="p-2 text-right">{month.totalPoints}</td>
                            <td className="p-2 text-right">
                              {month.avgPoints.toFixed(1)}
                            </td>
                            <td className="p-2 text-right text-slate-600">
                              %{monthlyPercentage}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="border-t font-semibold">
                        <td className="p-2">TOPLAM</td>
                        <td className="p-2 text-right">{selectedTypeDetail.totalCount}</td>
                        <td className="p-2 text-right">{selectedTypeDetail.totalPoints}</td>
                        <td className="p-2 text-right">
                          {selectedTypeDetail.avgPoints.toFixed(1)}
                        </td>
                        <td className="p-2 text-right">-</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Öğretmen Bazlı Tür Dağılımı */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">👨‍🏫 Öğretmen Bazlı Tür Dağılımı</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto max-h-[600px]">
                <table className="w-full text-sm border border-border">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="p-2 text-left">Öğretmen</th>
                      {FILE_TYPES.map(type => (
                        <th key={type.key} className="p-2 text-right text-xs">
                          {type.label.slice(0, 3)}
                        </th>
                      ))}
                      <th className="p-2 text-right">Toplam Dosya</th>
                      <th className="p-2 text-right">Toplam Puan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teacherTypeDistribution.map(t => (
                      <tr key={t.id} className="border-t hover:bg-slate-50">
                        <td className="p-2 font-medium">{t.name}</td>
                        {t.byType.map(type => (
                          <td key={type.type} className="p-2 text-right text-xs">
                            {type.count > 0 ? `${type.count} (${type.points})` : "-"}
                          </td>
                        ))}
                        <td className="p-2 text-right font-medium">{t.totalFiles}</td>
                        <td className="p-2 text-right font-medium">{t.totalPoints}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Aylık Tür Karşılaştırması */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">📊 Aylık Tür Karşılaştırması</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto">
                <table className="w-full text-sm border border-border">
                  <thead>
                    <tr className="bg-muted">
                      <th className="p-2 text-left">Ay</th>
                      {FILE_TYPES.map(type => (
                        <th key={type.key} className="p-2 text-right text-xs">
                          {type.label}
                        </th>
                      ))}
                      <th className="p-2 text-right">Toplam</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MONTHS_TR.map((month, monthIdx) => {
                      const monthTotals = yearlyTypeData.map(t => t.byMonth[monthIdx]);
                      const monthTotal = monthTotals.reduce((sum, m) => sum + m.count, 0);

                      return (
                        <tr key={monthIdx} className="border-t hover:bg-slate-50">
                          <td className="p-2 font-medium">{month}</td>
                          {monthTotals.map((monthData, idx) => {
                            const percentage = monthTotal > 0
                              ? ((monthData.count / monthTotal) * 100).toFixed(1)
                              : 0;

                            return (
                              <td key={idx} className="p-2 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <span>{monthData.count}</span>
                                  <span className="text-xs text-slate-500">(%{percentage})</span>
                                </div>
                              </td>
                            );
                          })}
                          <td className="p-2 text-right font-medium">{monthTotal}</td>
                        </tr>
                      );
                    })}
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

