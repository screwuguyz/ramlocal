"use client";
import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Teacher } from "@/lib/types";

function getMonths() {
  return ["01","02","03","04","05","06","07","08","09","10","11","12"];
}

export default function MonthlyReport({ teachers }: { teachers: Teacher[] }) {
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
  const months = getMonths();
  const rows = useMemo(() => teachers.map((t) => {
    const byMonth = months.map((m) => t.monthly?.[`${year}-${m}`] || 0);
    const total = byMonth.reduce((a, b) => a + b, 0);
    return { id: t.id, name: t.name, byMonth, total };
  }), [teachers, months, year]);

  const colTotals = months.map((_, i) => rows.reduce((a, r) => a + r.byMonth[i], 0));
  const grand = rows.reduce((a, r) => a + r.total, 0);

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>📊 Aylık Yük Raporu</CardTitle>
        <div className="flex items-center gap-2">
          <Label className="whitespace-nowrap">Yıl</Label>
          <Input
            className="w-28"
            value={year}
            onChange={(e) => setYear(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
          />
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
                <tr key={r.id} className="border-t">
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
