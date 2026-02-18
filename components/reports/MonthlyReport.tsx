"use client";
import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Teacher, CaseFile } from "@/types";

function getMonths() {
  return ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
}

type Props = {
  teachers: Teacher[];
  cases?: CaseFile[];
  history?: Record<string, CaseFile[]>;
};

export default function MonthlyReport({ teachers, cases = [], history = {} }: Props) {
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
  const months = getMonths();

  // Tüm dosyaları al (cases + history) - sistem puanları dahil (devamsızlık cezası, yedek başkan bonusu)
  const allCases = useMemo(() => {
    const fromHistory = Object.values(history).flat();
    const fromToday = cases || [];
    const combined = [...fromHistory, ...fromToday];

    // DEDUPE: Same case ID should only count once
    const seen = new Set<string>();
    return combined.filter(c => {
      if (!c.id || seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  }, [cases, history]);

  // Her öğretmen için aylık puanları hesapla (Daily Report ile aynı mantık)
  const rows = useMemo(() => teachers.map((t) => {
    const byMonth = months.map((m) => {
      const ym = `${year}-${m}`;
      // Bu ay bu öğretmene atanmış dosyaların puanlarını topla
      const monthCases = allCases.filter(c =>
        c.assignedTo === t.id &&
        c.createdAt.slice(0, 7) === ym
      );
      const total = monthCases.reduce((sum, c) => sum + c.score, 0);
      return total;
    });
    const total = byMonth.reduce((a, b) => a + b, 0) + (t.startingLoad || 0);
    return { id: t.id, name: t.name, byMonth, total };
  }), [teachers, months, year, allCases]);

  const colTotals = months.map((_, i) => rows.reduce((a, r) => a + r.byMonth[i], 0));
  const grand = rows.reduce((a, r) => a + r.total, 0);

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>📊 Aylık Yük Raporu</CardTitle>
        <div className="flex items-center gap-2">
          <Label className="whitespace-nowrap">Yıl</Label>
          <div className="flex items-center border rounded-md">
            <button
              className="px-2 py-1 hover:bg-slate-100 rounded-l-md"
              onClick={() => setYear(prev => String(Math.max(2020, Number(prev) - 1)))}
            >
              ◀
            </button>
            <span className="px-3 py-1 font-medium min-w-[60px] text-center">{year}</span>
            <button
              className="px-2 py-1 hover:bg-slate-100 rounded-r-md"
              onClick={() => setYear(prev => String(Math.min(2100, Number(prev) + 1)))}
            >
              ▶
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto">
          <table className="w-full text-sm border border-border">
            <thead>
              <tr className="bg-muted">
                <th className="p-2 text-left">Öğretmen</th>
                {months.map((m) => (
                  <th key={m} className={"p-2 text-right " + (m === currentMonth ? "text-red-600 font-semibold" : "")}>
                    {year}-{m}
                  </th>
                ))}
                <th className="p-2 text-right">Toplam</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t hover:bg-slate-50 transition-colors duration-150">
                  <td className="p-2">{r.name}</td>
                  {r.byMonth.map((v, i) => (
                    <td key={i} className={"p-2 text-right " + (months[i] === currentMonth ? "text-red-600 font-semibold" : "")}>{v}</td>
                  ))}
                  <td className="p-2 text-right font-medium">{r.total}</td>
                </tr>
              ))}
              <tr className="border-t font-semibold">
                <td className="p-2">TOPLAM</td>
                {colTotals.map((v, i) => (
                  <td key={i} className={"p-2 text-right " + (months[i] === currentMonth ? "text-red-600 font-semibold" : "")}>{v}</td>
                ))}
                <td className="p-2 text-right">{grand}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
