"use client";
import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Teacher, CaseFile } from "@/lib/types";

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getMonths() {
  return ["01","02","03","04","05","06","07","08","09","10","11","12"];
}

export default function DailyReportView({
  teachers,
  cases,
  history,
}: {
  teachers: Teacher[];
  cases: CaseFile[];
  history: Record<string, CaseFile[]>;
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

  function getCasesForMonth(ym: string) {
    const inHistory = Object.entries(history)
      .filter(([day]) => day.startsWith(ym))
      .flatMap(([, arr]) => arr);
    const inToday = cases.filter((c) => c.createdAt.slice(0, 7) === ym);
    return [...inHistory, ...inToday].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
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
      cur.points += c.score;
      if (!c.absencePenalty) cur.count += 1;
      m.set(key, cur);
    });
    return m;
  }, [data, monthKey]);

  const rows = teachers.map((t) => {
    const perDay: DayAgg[] = dayKeys.map((d) => agg.get(`${t.id}|${d}`) || { points: 0, count: 0 });
    const totalPoints = perDay.reduce((a, d) => a + d.points, 0);
    const totalCount = perDay.reduce((a, d) => a + d.count, 0);
    return { id: t.id, name: t.name, perDay, totalPoints, totalCount };
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
        <CardTitle>Günlük Rapor (Puan · Adet)</CardTitle>
        <div className="flex items-center gap-2">
          <Label>Yıl</Label>
          <Input
            className="w-24"
            value={year}
            onChange={(e) => setYear(Number(String(e.target.value).replace(/[^0-9]/g, "").slice(0, 4)) || year)}
          />
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
                {dayKeys.map((d, i) => (
                  <th
                    key={d}
                    className={"p-2 text-right " + (i === currentDayIndex ? "text-red-600 font-semibold" : "")}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </th>
                ))}
                <th className="p-2 text-right">Aylık Puan</th>
                <th className="p-2 text-right">Aylık Adet</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.name}</td>
                  {r.perDay.map((cell, i) => (
                    <td key={i} className={"p-2 text-right " + (i === currentDayIndex ? "text-red-600 font-semibold" : "")}>
                      {cell.points}{cell.count ? ` (${cell.count})` : ""}
                    </td>
                  ))}
                  <td className="p-2 text-right font-medium">{r.totalPoints}</td>
                  <td className="p-2 text-right font-medium">{r.totalCount}</td>
                </tr>
              ))}
              <tr className="border-t font-semibold">
                <td className="p-2">TOPLAM</td>
                {colTotals.map((c, i) => (
                  <td key={i} className={"p-2 text-right " + (i === currentDayIndex ? "text-red-600 font-semibold" : "")}>
                    {c.points}{c.count ? ` (${c.count})` : ""}
                  </td>
                ))}
                <td className="p-2 text-right">{grandPoints}</td>
                <td className="p-2 text-right">{grandCount}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
