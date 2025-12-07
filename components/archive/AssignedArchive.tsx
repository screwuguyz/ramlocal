"use client";
import React, { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { CaseFile } from "@/lib/types";

function ymdLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type Settings = {
  dailyLimit: number;
  scoreTest: number;
  scoreNewBonus: number;
  scoreTypeY: number;
  scoreTypeD: number;
  scoreTypeI: number;
  backupBonusMode: 'plus_max' | 'minus_min';
  backupBonusAmount: number;
  absencePenaltyAmount: number;
};

export default function AssignedArchive({
  history,
  cases,
  teacherName,
  caseDesc,
  settings,
}: {
  history: Record<string, CaseFile[]>;
  cases: CaseFile[];
  teacherName: (id?: string) => string;
  caseDesc: (c: CaseFile) => string;
  settings: Settings;
}) {
  const days = useMemo(() => {
    const set = new Set<string>(Object.keys(history));
    const todayYmd = ymdLocal(new Date());
    if (cases.some((c) => c.createdAt.slice(0, 10) === todayYmd)) set.add(todayYmd);
    return Array.from(set).sort();
  }, [history, cases]);

  const [day, setDay] = useState<string>(() => {
    const today = ymdLocal(new Date());
    if (days.length === 0) return today;
    return days.includes(today) ? today : days[days.length - 1];
  });

  useEffect(() => {
    if (days.length === 0) return;
    if (!days.includes(day)) setDay(days[days.length - 1]);
  }, [days, day]);

  const list = useMemo(() => {
    return [
      ...(history[day] || []),
      ...cases.filter((c) => c.createdAt.slice(0, 10) === day),
    ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [day, history, cases]);

  const idx = days.indexOf(day);
  const prevDisabled = idx <= 0;
  const nextDisabled = idx === -1 || idx >= days.length - 1;

  if (days.length === 0) {
    return (
      <Card className="mt-4"><CardHeader><CardTitle>Atanan Dosyalar</CardTitle></CardHeader>
        <CardContent>Henüz arşiv kaydı yok.</CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-4">
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Atanan Dosyalar (Günlük Arşiv)</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => !prevDisabled && setDay(days[idx - 1])}
            disabled={prevDisabled}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Select value={day} onValueChange={setDay}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Gün seç" />
            </SelectTrigger>
            <SelectContent>
              {days.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => !nextDisabled && setDay(days[idx + 1])}
            disabled={nextDisabled}
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="p-2 text-left">Öğrenci</th>
                <th className="p-2 text-right">Puan</th>
                <th className="p-2 text-left">Saat</th>
                <th className="p-2 text-left">Atanan</th>
                <th className="p-2 text-left">Test</th>
                <th className="p-2 text-left">Açıklama</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="p-2">{c.fileNo ? `${c.fileNo} - ${c.student}` : c.student}</td>
                  <td className="p-2 text-right">{c.score}</td>
                  <td className="p-2">
                    {new Date(c.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="p-2">{teacherName(c.assignedTo)}</td>
                  <td className="p-2">
                    {c.absencePenalty ? "Hayır (Denge)" : c.isTest ? `Evet (+${settings.scoreTest})` : "Hayır"}
                  </td>
                  <td className="p-2 text-sm text-muted-foreground">{caseDesc(c)}</td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td className="p-4 text-center text-muted-foreground" colSpan={6}>Bu günde kayıt yok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
