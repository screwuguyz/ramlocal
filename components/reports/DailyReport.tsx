"use client";
import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Teacher, CaseFile } from "@/types";

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getMonths() {
  return ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
}

function getTodayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Türkiye'nin sabit resmi tatilleri
function getFixedHolidays(year: number): string[] {
  const holidays: string[] = [];

  // Sabit tarihler (her yıl aynı)
  holidays.push(`${year}-01-01`); // Yılbaşı
  holidays.push(`${year}-04-23`); // Ulusal Egemenlik ve Çocuk Bayramı
  holidays.push(`${year}-05-01`); // Emek ve Dayanışma Günü
  holidays.push(`${year}-05-19`); // Atatürk'ü Anma, Gençlik ve Spor Bayramı
  holidays.push(`${year}-07-15`); // Demokrasi ve Milli Birlik Günü
  holidays.push(`${year}-08-30`); // Zafer Bayramı
  holidays.push(`${year}-10-29`); // Cumhuriyet Bayramı

  return holidays;
}

// Dini bayramlar (Diyanet İşleri Başkanlığı resmi takvimine göre)
function getReligiousHolidays(year: number): string[] {
  const holidays: string[] = [];

  // 2024
  if (year === 2024) {
    // Ramazan Bayramı (10-12 Nisan)
    holidays.push("2024-04-10");
    holidays.push("2024-04-11");
    holidays.push("2024-04-12");
    // Kurban Bayramı (17-20 Haziran)
    holidays.push("2024-06-17");
    holidays.push("2024-06-18");
    holidays.push("2024-06-19");
    holidays.push("2024-06-20");
  }

  // 2025
  if (year === 2025) {
    // Ramazan Bayramı (30 Mart - 1 Nisan)
    holidays.push("2025-03-30");
    holidays.push("2025-03-31");
    holidays.push("2025-04-01");
    // Kurban Bayramı (6-9 Haziran)
    holidays.push("2025-06-06");
    holidays.push("2025-06-07");
    holidays.push("2025-06-08");
    holidays.push("2025-06-09");
  }

  // 2026
  if (year === 2026) {
    // Ramazan Bayramı (20-22 Mart)
    holidays.push("2026-03-20");
    holidays.push("2026-03-21");
    holidays.push("2026-03-22");
    // Kurban Bayramı (27-30 Mayıs)
    holidays.push("2026-05-27");
    holidays.push("2026-05-28");
    holidays.push("2026-05-29");
    holidays.push("2026-05-30");
  }

  // 2027 (tahmini - Hicri takvime göre hesaplanmış)
  if (year === 2027) {
    // Ramazan Bayramı (9-11 Mart)
    holidays.push("2027-03-09");
    holidays.push("2027-03-10");
    holidays.push("2027-03-11");
    // Kurban Bayramı (16-19 Mayıs)
    holidays.push("2027-05-16");
    holidays.push("2027-05-17");
    holidays.push("2027-05-18");
    holidays.push("2027-05-19");
  }

  // 2028 (tahmini)
  if (year === 2028) {
    // Ramazan Bayramı (26-28 Şubat)
    holidays.push("2028-02-26");
    holidays.push("2028-02-27");
    holidays.push("2028-02-28");
    // Kurban Bayramı (4-7 Mayıs)
    holidays.push("2028-05-04");
    holidays.push("2028-05-05");
    holidays.push("2028-05-06");
    holidays.push("2028-05-07");
  }

  return holidays;
}

// Tüm resmi tatilleri getir (sabit + dini + localStorage'dan eklenenler)
function getAllHolidays(year: number): Set<string> {
  const holidays = new Set<string>();

  // Sabit tatiller
  getFixedHolidays(year).forEach(h => holidays.add(h));

  // Dini bayramlar
  getReligiousHolidays(year).forEach(h => holidays.add(h));

  // localStorage'dan ek tatiller (admin tarafından eklenebilir)
  try {
    const customHolidays = localStorage.getItem(`custom_holidays_${year}`);
    if (customHolidays) {
      const parsed = JSON.parse(customHolidays) as string[];
      parsed.forEach(h => holidays.add(h));
    }
  } catch { }

  return holidays;
}

// Bir tarihin hafta sonu olup olmadığını kontrol et
function isWeekend(dateStr: string): boolean {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dayOfWeek = date.getDay(); // 0 = Pazar, 6 = Cumartesi
  return dayOfWeek === 0 || dayOfWeek === 6;
}

type LiveScores = {
  maxScore: number;
  minScore: number;
  backupBonus: number;
  absencePenalty: number;
};

type Settings = {
  backupBonusAmount: number;
  absencePenaltyAmount: number;
};

export default function DailyReportView({
  teachers,
  cases,
  history,
  liveScores,
  settings,
}: {
  teachers: Teacher[];
  cases: CaseFile[];
  history: Record<string, CaseFile[]>;
  liveScores?: LiveScores;
  settings?: Settings;
}) {
  const today = new Date();
  const [year, setYear] = useState<number>(today.getFullYear());
  const [month, setMonth] = useState<number>(today.getMonth() + 1); // 1-12
  const dCount = daysInMonth(year, month);

  type DayAgg = { points: number; count: number };

  const monthKey = `${String(year)}-${String(month).padStart(2, "0")}`;
  const dayKeys = Array.from({ length: dCount }, (_, i) => `${monthKey}-${String(i + 1).padStart(2, "0")}`);
  const todayInfo = new Date();
  const isCurrentMonth = year === todayInfo.getFullYear() && month === (todayInfo.getMonth() + 1);
  const currentDayIndex = isCurrentMonth ? (todayInfo.getDate() - 1) : -1; // 0-based index

  // Resmi tatilleri yükle
  const holidays = useMemo(() => getAllHolidays(year), [year]);

  function getCasesForMonth(ym: string) {
    const inHistory = Object.entries(history)
      .filter(([day]) => day.startsWith(ym))
      .flatMap(([, arr]) => arr);
    const inToday = cases.filter((c) => c.createdAt.slice(0, 7) === ym);

    // DEDUPE: Same case ID should only count once (history takes priority for past days)
    const combined = [...inHistory, ...inToday];
    const seen = new Set<string>();
    const deduped = combined.filter(c => {
      if (!c.id || seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });

    return deduped.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  const data = useMemo(() => getCasesForMonth(monthKey), [monthKey, cases, history]);

  const agg = useMemo(() => {
    const m = new Map<string, DayAgg>();
    data.forEach((c) => {
      if (!c.assignedTo) return;
      const ymd = c.createdAt.slice(0, 10);
      if (!ymd.startsWith(monthKey)) return;
      const key = `${c.assignedTo}|${ymd}`;
      const cur = m.get(key) || { points: 0, count: 0 };
      // Tüm puanları dahil et (sistem puanları dahil: devamsızlık cezası, yedek başkan bonusu)
      cur.points += c.score;
      // Sadece gerçek dosya atamaları için count artır
      if (!c.absencePenalty && !c.backupBonus) {
        cur.count += 1;
      }
      m.set(key, cur);
    });
    return m;
  }, [data, monthKey]);

  const todayYmd = getTodayYmd();

  const rows = teachers.filter(t =>
    t.active &&
    !t.isPhysiotherapist &&
    !["Furkan Ata ADIYAMAN", "Furkan Ata"].includes(t.name)
  ).map((t) => {
    const perDay: DayAgg[] = dayKeys.map((d) => agg.get(`${t.id}|${d}`) || { points: 0, count: 0 });
    const totalPoints = perDay.reduce((a, d) => a + d.points, 0);
    const totalCount = perDay.reduce((a, d) => a + d.count, 0);

    // Seçili yılın toplam puanını hesapla (Dinamik Yıllık Yük)
    let calculatedYearlyLoad = 0;
    const seenYearlyIds = new Set<string>(); // DEDUPE: Aynı case'i iki kez sayma

    // 1. History'den topla (tüm puanları dahil et: dosya atamaları + sistem puanları)
    Object.entries(history).forEach(([date, dayCases]) => {
      if (date.startsWith(String(year))) {
        dayCases.forEach(c => {
          if (c.assignedTo === t.id && c.id && !seenYearlyIds.has(c.id)) {
            seenYearlyIds.add(c.id);
            calculatedYearlyLoad += c.score;
          }
        });
      }
    });

    // 2. Bugünün cases'lerinden topla (Eğer seçili yıl, bugünün yılıysa)
    if (String(year) === todayYmd.slice(0, 4)) {
      cases.forEach(c => {
        if (c.assignedTo === t.id && c.createdAt.startsWith(String(year)) && c.id && !seenYearlyIds.has(c.id)) {
          seenYearlyIds.add(c.id);
          calculatedYearlyLoad += c.score;
        }
      });
    }

    // Canlı puan hesaplama (bugün için)
    const isBackupToday = t.backupDay === todayYmd;
    const isAbsentToday = t.isAbsent && t.active;
    let liveScore: number | null = null;
    let liveType: 'backup' | 'absent' | null = null;

    if (liveScores && isCurrentMonth && currentDayIndex >= 0) {
      if (isBackupToday) {
        liveScore = liveScores.backupBonus;
        liveType = 'backup';
      } else if (isAbsentToday) {
        liveScore = liveScores.absencePenalty;
        liveType = 'absent';
      }
    }

    return { id: t.id, name: t.name, perDay, totalPoints, totalCount, liveScore, liveType, isBackupToday, isAbsentToday, yearlyLoad: calculatedYearlyLoad };
  });

  const colTotals = dayKeys.map((d) =>
    rows.reduce(
      (acc, r) => ({ points: acc.points + (agg.get(`${r.id}|${d}`)?.points || 0), count: acc.count + (agg.get(`${r.id}|${d}`)?.count || 0) }),
      { points: 0, count: 0 }
    )
  );

  const grandPoints = rows.reduce((a, r) => a + r.totalPoints, 0);
  const grandCount = rows.reduce((a, r) => a + r.totalCount, 0);

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>📅 Günlük Rapor (Puan · Adet)</CardTitle>
        <div className="flex items-center gap-2">
          <Label>Yıl</Label>
          <div className="flex items-center border rounded-md">
            <button
              className="px-2 py-1 hover:bg-slate-100 rounded-l-md"
              onClick={() => setYear(prev => Math.max(2020, prev - 1))}
            >
              ◀
            </button>
            <span className="px-3 py-1 font-medium min-w-[60px] text-center">{year}</span>
            <button
              className="px-2 py-1 hover:bg-slate-100 rounded-r-md"
              onClick={() => setYear(prev => Math.min(2100, prev + 1))}
            >
              ▶
            </button>
          </div>
          <Label>Ay</Label>
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-[120px]"><SelectValue placeholder="Ay" /></SelectTrigger>
            <SelectContent>
              {getMonths().map((m, idx) => (
                <SelectItem key={m} value={String(idx + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto">
          <table className="w-full text-sm border border-border">
            <thead>
              <tr className="bg-muted">
                <th className="p-2 text-left">Öğretmen</th>
                {dayKeys.map((d, i) => {
                  const isWeekendDay = isWeekend(d);
                  const isHoliday = holidays.has(d);
                  const isToday = i === currentDayIndex;

                  let className = "p-2 text-right ";
                  if (isToday) className += "text-red-600 font-semibold ";
                  else if (isHoliday) className += "text-purple-600 font-semibold bg-purple-50 ";
                  else if (isWeekendDay) className += "text-blue-600 font-semibold bg-blue-50 ";

                  return (
                    <th key={d} className={className} title={isHoliday ? "Resmi Tatil" : isWeekendDay ? "Hafta Sonu" : ""}>
                      {String(i + 1).padStart(2, "0")}
                    </th>
                  );
                })}
                <th className="p-2 text-right">Aylık Puan</th>
                <th className="p-2 text-right">Aylık Adet</th>
                <th className="p-2 text-right font-bold text-blue-600">Yıllık Puan</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t hover:bg-slate-50 transition-colors duration-150">
                  <td className="p-2">
                    {r.name}
                    {r.isBackupToday && <span className="ml-1 text-amber-600" title="Yedek Başkan">👑</span>}
                    {r.isAbsentToday && <span className="ml-1 text-red-600" title="Devamsız">🚫</span>}
                  </td>
                  {r.perDay.map((cell, i) => {
                    const dayKey = dayKeys[i];
                    const isToday = i === currentDayIndex;
                    const isWeekendDay = isWeekend(dayKey);
                    const isHoliday = holidays.has(dayKey);
                    const showLiveScore = isToday && r.liveScore !== null;

                    let className = "p-2 text-right ";
                    if (showLiveScore && r.liveType === 'backup') {
                      className += "text-amber-600 bg-amber-50 dark:bg-amber-950 font-semibold ";
                    } else if (showLiveScore && r.liveType === 'absent') {
                      className += "text-red-600 bg-red-50 dark:bg-red-950 font-semibold ";
                    } else if (isToday && !showLiveScore) {
                      className += "text-red-600 font-semibold ";
                    } else if (isHoliday) {
                      className += "text-purple-600 bg-purple-50 font-semibold ";
                    } else if (isWeekendDay) {
                      className += "text-blue-600 bg-blue-50 font-semibold ";
                    }

                    const title = showLiveScore
                      ? (r.liveType === 'backup'
                        ? `👑 Yedek Başkan - Tahmini: ${r.liveScore} puan (max+${settings?.backupBonusAmount})`
                        : `🚫 Devamsız - Tahmini: ${r.liveScore} puan (min-${settings?.absencePenaltyAmount})`)
                      : isHoliday
                        ? "🎉 Resmi Tatil"
                        : isWeekendDay
                          ? "📅 Hafta Sonu"
                          : undefined;

                    return (
                      <td
                        key={i}
                        className={className}
                        title={title}
                      >
                        {showLiveScore ? (
                          <span className="flex items-center justify-end gap-1">
                            <span className="animate-pulse">●</span>
                            {r.liveScore}
                          </span>
                        ) : (
                          <>{cell.points}{cell.count ? ` (${cell.count})` : ""}</>
                        )}
                      </td>
                    );
                  })}
                  <td className="p-2 text-right font-medium">{r.totalPoints}</td>
                  <td className="p-2 text-right font-medium">{r.totalCount}</td>
                  <td className="p-2 text-right font-bold text-blue-600">{r.yearlyLoad}</td>
                </tr>
              ))}
              <tr className="border-t font-semibold">
                <td className="p-2">TOPLAM</td>
                {colTotals.map((c, i) => {
                  const dayKey = dayKeys[i];
                  const isToday = i === currentDayIndex;
                  const isWeekendDay = isWeekend(dayKey);
                  const isHoliday = holidays.has(dayKey);

                  let className = "p-2 text-right ";
                  if (isToday) className += "text-red-600 ";
                  else if (isHoliday) className += "text-purple-600 bg-purple-50 ";
                  else if (isWeekendDay) className += "text-blue-600 bg-blue-50 ";

                  return (
                    <td key={i} className={className}>
                      {c.points}{c.count ? ` (${c.count})` : ""}
                    </td>
                  );
                })}
                <td className="p-2 text-right">{grandPoints}</td>
                <td className="p-2 text-right">{grandCount}</td>
                <td className="p-2 text-right text-blue-600">{rows.reduce((a, r) => a + r.yearlyLoad, 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
