"use client";
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Inbox } from "lucide-react";
import type { CaseFile, Teacher } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || ""; // e.g. https://ram-dosya-atama.vercel.app
const USE_PROXY = !!API_BASE; // localde doluysa proxy, Vercel'de boş bırak

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
  backupBonusAmount: number;
  absencePenaltyAmount: number;
};

export default function AssignedArchiveSingleDay({
  history,
  cases,
  teacherName,
  caseDesc,
  teachers,
  settings,
}: {
  history: Record<string, CaseFile[]>;
  cases: CaseFile[];
  teacherName: (id?: string) => string;
  caseDesc: (c: CaseFile) => string;
  teachers: Teacher[];
  settings: Settings;
}) {
  const days = React.useMemo(() => {
    const set = new Set<string>(Object.keys(history));
    const todayYmd = ymdLocal(new Date());
    // Bugün hiç kayıt olmasa bile 'bugün' seçilebilir olsun
    set.add(todayYmd);
    return Array.from(set).sort();
  }, [history, cases]);

  const [day, setDay] = React.useState<string>(() => {
    const today = ymdLocal(new Date());
    if (days.length === 0) return today;
    return days.includes(today) ? today : days[days.length - 1];
  });

  React.useEffect(() => {
    if (days.length === 0) return;
    if (!days.includes(day)) setDay(days[days.length - 1]);
  }, [days, day]);

  const list = React.useMemo(() => {
    return [
      ...(history[day] || []),
      ...cases.filter((c) => c.createdAt.slice(0, 10) === day),
    ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [day, history, cases]);

  const idx = days.indexOf(day);
  const prevDisabled = idx <= 0;
  const nextDisabled = idx === -1 || idx >= days.length - 1;
  const [aiOpenId, setAiOpenId] = React.useState<string | null>(null);
  const [aiLoading, setAiLoading] = React.useState(false);
  const [aiMessages, setAiMessages] = React.useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [aiInput, setAiInput] = React.useState("");

  // Seçili gün için öğretmen özetlerini hazırla (günlük sayaç ve test almış mı)
  const teacherSummaries = React.useMemo(() => {
    const dayCases = list.filter((c) => c.assignedTo && !c.absencePenalty);
    const countMap = new Map<string, number>();
    const hasTestMap = new Map<string, boolean>();
    for (const c of dayCases) {
      const tid = c.assignedTo as string;
      countMap.set(tid, (countMap.get(tid) || 0) + 1);
      if (c.isTest) hasTestMap.set(tid, true);
    }
    return teachers.map((t) => ({
      id: t.id,
      name: t.name,
      isTester: !!t.isTester,
      isAbsent: !!t.isAbsent,
      active: !!t.active,
      yearlyLoad: Number(t.yearlyLoad || 0),
      todayCount: countMap.get(t.id) || 0,
      hasTestToday: !!hasTestMap.get(t.id),
    }));
  }, [teachers, list]);

  return (
    <Card className="mt-4">
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Atanan Dosyalar (Tek Gün)</CardTitle>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={prevDisabled} onClick={() => !prevDisabled && setDay(days[idx - 1])}>
            Önceki
          </Button>
          <Select value={day} onValueChange={setDay}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Gün seç" /></SelectTrigger>
            <SelectContent>
              {days.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" disabled={nextDisabled} onClick={() => !nextDisabled && setDay(days[idx + 1])}>
            Sonraki
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto">
          <table className="w-full text-sm border border-border">
            <thead className="sticky top-0 z-10 bg-muted">
              <tr>
                <th className="p-2 text-left">Öğrenci</th>
                <th className="p-2 text-right">Puan</th>
                <th className="p-2 text-left">Saat</th>
                <th className="p-2 text-left">Atanan</th>
                <th className="p-2 text-left">Test</th>
                <th className="p-2 text-left">Açıklama</th>
                <th className="p-2 text-left">Yapay Zeka</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <React.Fragment key={c.id}>
                  <tr className="border-t odd:bg-muted/30 hover:bg-slate-50 transition-colors duration-150">
                    <td className="p-2">{c.student}</td>
                    <td className="p-2 text-right">{c.score}</td>
                    <td className="p-2">
                      {new Date(c.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="p-2">{teacherName(c.assignedTo)}</td>
                    <td className="p-2">{c.absencePenalty ? "Hayır (Denge)" : c.isTest ? `Evet (+${settings.scoreTest})` : "Hayır"}</td>
                    <td className="p-2 text-sm text-muted-foreground">{caseDesc(c)}</td>
                    <td className="p-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setAiOpenId(prev => {
                            const next = prev === c.id ? null : c.id;
                            if (next === c.id) {
                              setAiMessages([]);
                              setAiInput("Neden bu dosyayı buraya atadın?");
                            }
                            return next;
                          });
                        }}
                      >
                        YAPAY ZEKA İLE AÇIKLA
                      </Button>
                    </td>
                  </tr>
                  {aiOpenId === c.id && (
                    <tr className="border-t bg-white">
                      <td className="p-3" colSpan={7}>
                        <div className="border rounded-md p-3 space-y-3">
                          <div className="font-medium">Yapay Zeka Açıklaması — Atanan: {teacherName(c.assignedTo) || "—"}</div>
                          <div className="space-y-2 max-h-64 overflow-auto">
                            {aiMessages.map((m, idx) => {
                              // Markdown bold formatını render et (**metin**)
                              const renderWithBold = (text: string) => {
                                const parts: (string | JSX.Element)[] = [];
                                let lastIndex = 0;
                                const regex = /\*\*(.+?)\*\*/g;
                                let match;
                                
                                while ((match = regex.exec(text)) !== null) {
                                  // Önceki kısmı ekle
                                  if (match.index > lastIndex) {
                                    parts.push(text.substring(lastIndex, match.index));
                                  }
                                  // Kalın kısmı ekle
                                  parts.push(
                                    <strong key={match.index} className="font-bold text-emerald-900">
                                      {match[1]}
                                    </strong>
                                  );
                                  lastIndex = regex.lastIndex;
                                }
                                // Kalan kısmı ekle
                                if (lastIndex < text.length) {
                                  parts.push(text.substring(lastIndex));
                                }
                                return parts.length > 0 ? parts : text;
                              };
                              
                              return (
                                <div key={idx} className={m.role === "user" ? "text-slate-800" : "text-emerald-800"}>
                                  <span className="text-xs uppercase font-semibold mr-2">{m.role === "user" ? "Siz" : "Asistan"}</span>
                                  <span className="whitespace-pre-wrap">{renderWithBold(m.content)}</span>
                                </div>
                              );
                            })}
                          </div>
                          <form
                            className="flex gap-2"
                            onSubmit={async (e: React.FormEvent<HTMLFormElement>) => {
                              e.preventDefault();
                              const q = aiInput.trim() || "Neden bu dosyayı buraya atadın?";
                              setAiInput("");
                              setAiLoading(true);
                              try {
                                const rules = [
                                  "TEST DOSYALARI: Sadece testör öğretmenlere gider; aynı gün ikinci test verilmez.",
                                  `NORMAL DOSYA UYGUNLUK: Aktif olmalı, devamsız ya da yedek olmamalı ve günlük sınır (${settings.dailyLimit}) aşılmamalı. Testörler test almış olsa da normal dosya alabilir.`,
                                  "SIRALAMA: Yıllık yük az → Bugün aldığı dosya az → Rastgele; mümkünse son atanan öğretmene arka arkaya verilmez.",
                                  `GÜNLÜK SINIR: Öğretmen başına en fazla ${settings.dailyLimit} dosya.`,
                                  "MANUEL ATAMA: Admin manuel öğretmen seçerse otomatik seçim devre dışı kalır.",
                                  `DEVAMSIZ: Devamsız olan öğretmene dosya verilmez; gün sonunda devamsızlar için o gün en düşük puanın ${settings.absencePenaltyAmount} eksiği denge puanı eklenir.`,
                                  `BAŞKAN YEDEK: Yedek işaretli öğretmen o gün dosya almaz; gün sonunda diğerlerinin en yüksek günlük puanına +${settings.backupBonusAmount} eklenir.`,
                                  `PUANLAMA: TEST = ${settings.scoreTest}; YÖNLENDİRME = ${settings.scoreTypeY}; DESTEK = ${settings.scoreTypeD}; İKİSİ = ${settings.scoreTypeI}; YENİ = +${settings.scoreNewBonus}; TANI = 0–6 (üst sınır 6).`,
                                  "BİLDİRİM: Atama sonrası öğretmene bildirim gönderilir.",
                                ];
                                const endpoint = USE_PROXY ? "/api/explain-proxy" : "/api/explain";
                                const res = await fetch(endpoint, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    question: q,
                                    caseFile: {
                                      id: c.id,
                                      student: c.student,
                                      fileNo: c.fileNo,
                                      score: c.score,
                                      type: c.type,
                                      isNew: c.isNew,
                                      diagCount: c.diagCount,
                                      isTest: c.isTest,
                                      assignedTo: c.assignedTo,
                                      assignReason: c.assignReason,
                                      createdAt: c.createdAt,
                                    },
                                    selectedTeacher: { id: c.assignedTo, name: teacherName(c.assignedTo) },
                                    rules,
                                    context: { today: day, dailyLimit: settings.dailyLimit },
                                    otherTeachers: teacherSummaries,
                                    messages: aiMessages,
                                  }),
                                });
                                let text = "";
                                try { text = await res.text(); } catch {}
                                let answer = "";
                                let details = "";
                                if (text) {
                                  try {
                                    const json = JSON.parse(text);
                                    answer = json?.answer || json?.error || text;
                                    details = json?.details ? `\nDetay: ${String(json.details)}` : "";
                                  } catch {
                                    answer = text;
                                  }
                                }
                                if (!res.ok) {
                                  setAiMessages((msgs) => [
                                    ...msgs,
                                    { role: "assistant", content: `Hata: ${answer || "Bilinmeyen hata"}${details}` },
                                  ]);
                                } else {
                                  setAiMessages((msgs) => [
                                    ...msgs,
                                    { role: "assistant", content: String(answer || "(Yanıt alınamadı)") },
                                  ]);
                                }
                              } catch (err: any) {
                                const msg = err?.message || String(err) || "Bir hata oluştu.";
                                setAiMessages((msgs) => [
                                  ...msgs,
                                  { role: "assistant", content: `Hata: ${msg}` },
                                ]);
                              } finally {
                                setAiLoading(false);
                              }
                            }}
                          >
                            <Input
                              value={aiInput}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAiInput(e.target.value)}
                              onFocus={() => { if (!aiInput) setAiInput("Neden bu dosyayı buraya atadın?"); }}
                              placeholder="Sorunuzu yazın..."
                              className="flex-1"
                            />
                            <Button type="submit" disabled={aiLoading}>{aiLoading ? "Gönderiliyor..." : "Yapay Zekaya Sor"}</Button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {list.length === 0 && (
                <tr>
                  <td className="p-8 text-center" colSpan={7}>
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Inbox className="h-10 w-10 mb-2 text-slate-400" />
                      <p className="text-sm font-medium">Bu günde kayıt yok</p>
                      <p className="text-xs text-slate-400 mt-1">Seçili tarihte dosya atanmamış</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
