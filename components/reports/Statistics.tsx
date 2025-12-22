"use client";
import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Teacher, CaseFile } from "@/lib/types";

type Props = {
  teachers: Teacher[];
  cases: CaseFile[];
  history: Record<string, CaseFile[]>;
};

function getTodayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getWeekDates(weeksAgo = 0): string[] {
  const dates: string[] = [];
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1 - (weeksAgo * 7)); // Monday
  
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }
  return dates;
}

function getMonthDates(monthsAgo = 0): string[] {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() - monthsAgo;
  const targetDate = new Date(year, month, 1);
  const daysInMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
  
  const dates: string[] = [];
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(targetDate.getFullYear(), targetDate.getMonth(), i);
    dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }
  return dates;
}

const DAYS_TR = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

export default function Statistics({ teachers, cases, history }: Props) {
  // Navigasyon state'leri
  const [weekOffset, setWeekOffset] = useState(0); // 0 = bu hafta, 1 = geçen hafta, vb.
  const [monthOffset, setMonthOffset] = useState(0); // 0 = bu ay, 1 = geçen ay, vb.

  // Tüm dosyaları birleştir (bugün + history)
  const allCases = useMemo(() => {
    const fromHistory = Object.values(history).flat();
    return [...cases, ...fromHistory].filter(c => !c.absencePenalty && !c.backupBonus);
  }, [cases, history]);

  // Seçili hafta verileri
  const selectedWeekDates = getWeekDates(weekOffset);
  const selectedWeekCases = allCases.filter(c => selectedWeekDates.includes(c.createdAt.slice(0, 10)));

  // Bu hafta ve geçen hafta verileri (karşılaştırma için)
  const thisWeekDates = getWeekDates(0);
  const lastWeekDates = getWeekDates(1);
  const thisWeekCases = allCases.filter(c => thisWeekDates.includes(c.createdAt.slice(0, 10)));
  const lastWeekCases = allCases.filter(c => lastWeekDates.includes(c.createdAt.slice(0, 10)));

  // Haftalık özet
  const thisWeekTotal = thisWeekCases.length;
  const lastWeekTotal = lastWeekCases.length;
  const weekChange = lastWeekTotal > 0 ? ((thisWeekTotal - lastWeekTotal) / lastWeekTotal * 100).toFixed(0) : 0;

  // Günlük dağılım (seçili hafta)
  const dailyDistribution = selectedWeekDates.map((date, idx) => {
    const count = selectedWeekCases.filter(c => c.createdAt.slice(0, 10) === date).length;
    return { day: DAYS_TR[idx], count, date };
  });
  const maxDaily = Math.max(...dailyDistribution.map(d => d.count), 1);

  // Hafta başlangıç ve bitiş tarihleri (gösterim için)
  const weekStartDate = selectedWeekDates[0];
  const weekEndDate = selectedWeekDates[6];
  const weekStartFormatted = new Date(weekStartDate).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
  const weekEndFormatted = new Date(weekEndDate).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });

  // Seçili ay verileri
  const selectedMonthDates = getMonthDates(monthOffset);
  const selectedMonthCases = allCases.filter(c => selectedMonthDates.includes(c.createdAt.slice(0, 10)));

  // Öğretmen performansı (seçili ay)
  const teacherPerformance = teachers
    .filter(t => t.active)
    .map(t => {
      const teacherCases = selectedMonthCases.filter(c => c.assignedTo === t.id);
      const totalPoints = teacherCases.reduce((sum, c) => sum + c.score, 0);
      const fileCount = teacherCases.length;
      return { id: t.id, name: t.name, points: totalPoints, files: fileCount };
    })
    .sort((a, b) => b.points - a.points);

  const maxPoints = Math.max(...teacherPerformance.map(t => t.points), 1);

  // Dosya türü dağılımı (seçili ay)
  const typeDistribution = {
    YONLENDIRME: selectedMonthCases.filter(c => c.type === "YONLENDIRME" && !c.isTest).length,
    DESTEK: selectedMonthCases.filter(c => c.type === "DESTEK" && !c.isTest).length,
    IKISI: selectedMonthCases.filter(c => c.type === "IKISI" && !c.isTest).length,
    TEST: selectedMonthCases.filter(c => c.isTest).length,
  };
  const totalTypes = typeDistribution.YONLENDIRME + typeDistribution.DESTEK + typeDistribution.IKISI + typeDistribution.TEST || 1;

  // Ay adı (gösterim için)
  const monthDate = new Date();
  monthDate.setMonth(monthDate.getMonth() - monthOffset);
  const monthName = monthDate.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });

  // Bu ay verileri (karşılaştırma için - özet kartlarında kullanılıyor)
  const thisMonthDates = getMonthDates(0);
  const thisMonthCases = allCases.filter(c => thisMonthDates.includes(c.createdAt.slice(0, 10)));

  // Saat dağılımı (en çok atama yapılan saatler)
  const hourDistribution: Record<number, number> = {};
  for (let h = 8; h <= 17; h++) hourDistribution[h] = 0;
  
  allCases.forEach(c => {
    const hour = new Date(c.createdAt).getHours();
    if (hour >= 8 && hour <= 17) {
      hourDistribution[hour] = (hourDistribution[hour] || 0) + 1;
    }
  });
  const maxHour = Math.max(...Object.values(hourDistribution), 1);

  // Aylık trend (son 6 ay)
  const monthlyTrend = [];
  for (let i = 5; i >= 0; i--) {
    const dates = getMonthDates(i);
    const monthCases = allCases.filter(c => dates.includes(c.createdAt.slice(0, 10)));
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const monthName = d.toLocaleDateString("tr-TR", { month: "short" });
    monthlyTrend.push({ month: monthName, count: monthCases.length });
  }
  const maxMonthly = Math.max(...monthlyTrend.map(m => m.count), 1);

  return (
    <div className="space-y-6">
      {/* Özet Kartları */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="pt-4">
            <div className="text-3xl font-bold">{thisWeekTotal}</div>
            <div className="text-sm opacity-90">Bu Hafta Dosya</div>
            <div className="text-xs mt-1 opacity-75">
              {Number(weekChange) > 0 ? "↑" : Number(weekChange) < 0 ? "↓" : "→"} {Math.abs(Number(weekChange))}% geçen haftaya göre
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <CardContent className="pt-4">
            <div className="text-3xl font-bold">{thisMonthCases.length}</div>
            <div className="text-sm opacity-90">Bu Ay Dosya</div>
            <div className="text-xs mt-1 opacity-75">
              {teachers.filter(t => t.active).length} aktif öğretmen
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="pt-4">
            <div className="text-3xl font-bold">{thisMonthCases.reduce((s, c) => s + c.score, 0)}</div>
            <div className="text-sm opacity-90">Bu Ay Toplam Puan</div>
            <div className="text-xs mt-1 opacity-75">
              Ort: {(thisMonthCases.reduce((s, c) => s + c.score, 0) / (thisMonthCases.length || 1)).toFixed(1)} puan/dosya
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
          <CardContent className="pt-4">
            <div className="text-3xl font-bold">{allCases.length}</div>
            <div className="text-sm opacity-90">Toplam Dosya</div>
            <div className="text-xs mt-1 opacity-75">
              Tüm zamanlar
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grafikler */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Haftalık Dağılım */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">📅 Günlük Dağılım</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setWeekOffset(prev => prev + 1)}
                  className="h-7 px-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-slate-600 min-w-[120px] text-center">
                  {weekOffset === 0 ? "Bu Hafta" : `${weekStartFormatted} - ${weekEndFormatted}`}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setWeekOffset(prev => Math.max(0, prev - 1))}
                  disabled={weekOffset === 0}
                  className="h-7 px-2"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between gap-2 h-40">
              {dailyDistribution.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center">
                  <div className="text-xs text-slate-600 mb-1">{d.count}</div>
                  <div 
                    className="w-full bg-blue-500 rounded-t transition-all duration-300"
                    style={{ height: `${(d.count / maxDaily) * 100}%`, minHeight: d.count > 0 ? "8px" : "2px" }}
                  />
                  <div className="text-xs mt-2 text-slate-500">{d.day}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Aylık Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">📈 Son 6 Ay Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between gap-2 h-40">
              {monthlyTrend.map((m, i) => (
                <div key={i} className="flex-1 flex flex-col items-center">
                  <div className="text-xs text-slate-600 mb-1">{m.count}</div>
                  <div 
                    className="w-full bg-emerald-500 rounded-t transition-all duration-300"
                    style={{ height: `${(m.count / maxMonthly) * 100}%`, minHeight: m.count > 0 ? "8px" : "2px" }}
                  />
                  <div className="text-xs mt-2 text-slate-500">{m.month}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Dosya Türü Dağılımı */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">📊 Dosya Türü Dağılımı</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setMonthOffset(prev => prev + 1)}
                  className="h-7 px-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-slate-600 min-w-[140px] text-center capitalize">
                  {monthOffset === 0 ? "Bu Ay" : monthName}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setMonthOffset(prev => Math.max(0, prev - 1))}
                  disabled={monthOffset === 0}
                  className="h-7 px-2"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Yönlendirme</span>
                  <span className="text-slate-600">{typeDistribution.YONLENDIRME} ({((typeDistribution.YONLENDIRME / totalTypes) * 100).toFixed(0)}%)</span>
                </div>
                <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${(typeDistribution.YONLENDIRME / totalTypes) * 100}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Destek</span>
                  <span className="text-slate-600">{typeDistribution.DESTEK} ({((typeDistribution.DESTEK / totalTypes) * 100).toFixed(0)}%)</span>
                </div>
                <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${(typeDistribution.DESTEK / totalTypes) * 100}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>İkisi</span>
                  <span className="text-slate-600">{typeDistribution.IKISI} ({((typeDistribution.IKISI / totalTypes) * 100).toFixed(0)}%)</span>
                </div>
                <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full transition-all duration-500" style={{ width: `${(typeDistribution.IKISI / totalTypes) * 100}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>🧪 Test</span>
                  <span className="text-slate-600">{typeDistribution.TEST} ({((typeDistribution.TEST / totalTypes) * 100).toFixed(0)}%)</span>
                </div>
                <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500 rounded-full transition-all duration-500" style={{ width: `${(typeDistribution.TEST / totalTypes) * 100}%` }} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Saat Dağılımı - Yatay Bar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">🕐 Saatlik Dağılım</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(hourDistribution).map(([hour, count]) => {
                const percentage = (count / maxHour) * 100;
                const isTopHour = count === maxHour && count > 0;
                return (
                  <div key={hour} className="flex items-center gap-3">
                    <div className={`w-14 text-sm font-medium ${isTopHour ? "text-amber-600" : "text-slate-600"}`}>
                      {hour}:00
                    </div>
                    <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden relative">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          isTopHour 
                            ? "bg-gradient-to-r from-amber-400 to-amber-500" 
                            : "bg-gradient-to-r from-blue-400 to-blue-500"
                        }`}
                        style={{ width: `${percentage}%`, minWidth: count > 0 ? "8px" : "0" }}
                      />
                      {count > 0 && (
                        <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold ${
                          percentage > 60 ? "text-white" : "text-slate-600"
                        }`}>
                          {count} dosya
                        </span>
                      )}
                    </div>
                    {isTopHour && <span className="text-amber-500">🔥</span>}
                  </div>
                );
              })}
            </div>
            <div className="mt-3 text-xs text-slate-500 text-center">
              En yoğun saat: <span className="font-bold text-amber-600">
                {Object.entries(hourDistribution).sort((a, b) => b[1] - a[1])[0]?.[0]}:00
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Öğretmen Performansı */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">👨‍🏫 Öğretmen Performansı</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setMonthOffset(prev => prev + 1)}
                className="h-7 px-2"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-slate-600 min-w-[140px] text-center capitalize">
                {monthOffset === 0 ? "Bu Ay" : monthName}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setMonthOffset(prev => Math.max(0, prev - 1))}
                disabled={monthOffset === 0}
                className="h-7 px-2"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {teacherPerformance.slice(0, 10).map((t, i) => (
              <div key={t.id} className="flex items-center gap-3">
                <div className="w-6 text-center font-bold text-slate-400">{i + 1}</div>
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{t.name}</span>
                    <span className="text-slate-600">{t.points} puan • {t.files} dosya</span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${i === 0 ? "bg-amber-500" : i === 1 ? "bg-slate-400" : i === 2 ? "bg-amber-700" : "bg-blue-500"}`}
                      style={{ width: `${(t.points / maxPoints) * 100}%` }} 
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Uyarı notu */}
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
            <div className="font-medium text-amber-800 mb-1">ℹ️ Bu hesaplamada:</div>
            <ul className="text-amber-700 text-xs space-y-0.5 ml-4 list-disc">
              <li>❌ Devamsızlık puanları dahil edilmiyor</li>
              <li>❌ Yedek başkan bonusları dahil edilmiyor</li>
              <li>✅ Sadece gerçek dosya atamaları sayılıyor</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

