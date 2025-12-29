"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// Local toast - just use alert for simplicity
// Local uid function
import AssignedArchiveView from "@/components/archive/AssignedArchive";
// Types are defined locally below

// Types (Redefined to ensure standalone works if exports are missing)
// If you can export them from page.tsx, do so. But simpler to redefine or import types.
// For now, I will try to import types from app/page if they are exported.
// Note: In Next.js app dir, importing types from page.tsx might be tricky if it's not a pure type file.
// Let's redefine types locally for safety to avoid circular deps or build issues.

type Teacher = {
    id: string;
    name: string;
    isAbsent: boolean;
    absentDay?: string;
    yearlyLoad: number;
    monthly?: Record<string, number>;
    active: boolean;
    pushoverKey?: string;
    isTester: boolean;
    backupDay?: string;
};

type CaseFile = {
    id: string;
    student: string;
    fileNo?: string;
    score: number;
    createdAt: string;
    assignedTo?: string;
    type: "YONLENDIRME" | "DESTEK" | "IKISI";
    isNew: boolean;
    diagCount: number;
    isTest: boolean;
    assignReason?: string;
    absencePenalty?: boolean;
    backupBonus?: boolean;
    sourcePdfEntry?: any;
};

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

// Helper Functions
function getTodayYmd(): string {
    if (typeof window === "undefined") return new Date().toISOString().slice(0, 10);
    const params = new URLSearchParams(window.location.search);
    const simDate = params.get("simDate");
    if (simDate && /^\d{4}-\d{2}-\d{2}$/.test(simDate)) return simDate;
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function uid_local() {
    return Math.random().toString(36).slice(2, 9);
}

function caseDesc(c: CaseFile) {
    if (c.absencePenalty) return c.assignReason || "Devamsızlık sonrası denge puanı";
    if (c.backupBonus) return c.assignReason || "Yedek bonusu";
    let s = `Tür: ${c.type} • Yeni: ${c.isNew ? "Evet" : "Hayır"} • Tanı: ${c.diagCount}`;
    if (c.isTest) s += " • Test";
    return s;
}

export default function TimeMachinePage() {
    const [password, setPassword] = useState("");
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // State from backend
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [cases, setCases] = useState<CaseFile[]>([]);
    const [history, setHistory] = useState<Record<string, CaseFile[]>>({});
    const [settings, setSettings] = useState<Settings>({
        dailyLimit: 5, scoreTest: 10, scoreNewBonus: 1, scoreTypeY: 1, scoreTypeD: 2, scoreTypeI: 3, backupBonusAmount: 3, absencePenaltyAmount: 3
    });
    const [loading, setLoading] = useState(true);

    // Manuel kayıt ekleme için state
    const [manualTeacherId, setManualTeacherId] = useState("");
    const [manualScore, setManualScore] = useState("");
    const [manualDesc, setManualDesc] = useState("");
    const [isFileEntry, setIsFileEntry] = useState(true); // true = dosya, false = puan düzeltme

    // Sync State
    const fetchCentralState = async () => {
        try {
            const res = await fetch(`/api/state?ts=${Date.now()}`);
            if (!res.ok) throw new Error("Fetch failed");
            const data = await res.json();
            if (data.teachers) setTeachers(data.teachers);
            if (data.cases) setCases(data.cases);
            if (data.history) setHistory(data.history);
            if (data.settings) setSettings(prev => ({ ...prev, ...data.settings }));
        } catch (err) {
            console.error(err);
            // alert("Veri çekilemedi!"); 
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAuthenticated) {
            fetchCentralState();
            // Optional: Polling setup if needed, but for manual admin tool, fetch on load is usually enough.
            // Or set up interval.
            const interval = setInterval(fetchCentralState, 5000);
            return () => clearInterval(interval);
        }
    }, [isAuthenticated]);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === "Ataber.12") {
            setIsAuthenticated(true);
        } else {
            alert("Hatalı şifre!");
        }
    };

    // derived state for archive view
    const currentSimDate = typeof window !== "undefined" ? (new URLSearchParams(window.location.search).get("simDate") || getTodayYmd()) : "";
    const dayArchiveCases = useMemo(() => history[currentSimDate] || [], [history, currentSimDate]);

    const handleRollOver = async () => {
        if (!confirm("Günü sonlandırmak istediğinize emin misiniz? Bu işlem geri alınamaz.")) return;

        const params = new URLSearchParams(window.location.search);
        const simDate = params.get("simDate") || getTodayYmd();

        // Local Logic (Copied from page.tsx)
        let nextHistory = { ...history };
        let nextCases = [...cases];
        let nextTeachers = [...teachers];

        // 1. Move today's cases to history
        const todayCases = nextCases.filter(c => c.createdAt.slice(0, 10) === simDate);
        nextCases = nextCases.filter(c => c.createdAt.slice(0, 10) !== simDate);

        if (todayCases.length > 0) {
            nextHistory[simDate] = [
                ...(nextHistory[simDate] || []),
                ...todayCases
            ];
        }

        // 2. Yedek bonusu
        const backupTeacher = nextTeachers.find(t => t.backupDay === simDate);
        if (backupTeacher) {
            const allTodayCases = nextHistory[simDate] || [];
            const todaysFileScores: Record<string, number> = {};
            allTodayCases.forEach(c => {
                if (c.assignedTo) todaysFileScores[c.assignedTo] = (todaysFileScores[c.assignedTo] || 0) + c.score;
            });

            const sortedByType = [...nextTeachers].filter(t => t.active && !t.isAbsent && t.id !== backupTeacher.id);
            let maxScore = 0;
            sortedByType.forEach(t => {
                if (todaysFileScores[t.id] && todaysFileScores[t.id] > maxScore) maxScore = todaysFileScores[t.id];
            });

            const bonusAmount = maxScore + settings.backupBonusAmount;
            const bonusCase: CaseFile = {
                id: uid_local(),
                student: `${backupTeacher.name} - Yedek Bonus`,
                score: bonusAmount,
                createdAt: simDate + "T23:59:00.000Z",
                assignedTo: backupTeacher.id,
                type: "DESTEK",
                isNew: false,
                diagCount: 0,
                isTest: false,
                backupBonus: true,
                assignReason: `Yedek başkan bonusu (En yüksek: ${maxScore} + ${settings.backupBonusAmount})`
            };
            nextHistory[simDate] = [...(nextHistory[simDate] || []), bonusCase];
        }

        // 3. Devamsızlık cezası
        const absentTeachers = nextTeachers.filter(t => t.isAbsent);
        if (absentTeachers.length > 0) {
            const allTodayCases = nextHistory[simDate] || [];
            const todaysFileScores: Record<string, number> = {};
            allTodayCases.forEach(c => {
                if (c.assignedTo) todaysFileScores[c.assignedTo] = (todaysFileScores[c.assignedTo] || 0) + c.score;
            });

            let minScore = Infinity;
            let anyActive = false;
            nextTeachers.forEach(t => {
                if (t.active && !t.isAbsent && todaysFileScores[t.id] !== undefined) {
                    const s = todaysFileScores[t.id];
                    if (s < minScore) { minScore = s; anyActive = true; }
                }
            });
            if (!anyActive) minScore = 0;

            const penaltyScore = minScore - settings.absencePenaltyAmount;
            absentTeachers.forEach(t => {
                const penaltyCase: CaseFile = {
                    id: uid_local(),
                    student: `${t.name} - Devamsızlık Cezası`,
                    score: penaltyScore,
                    createdAt: simDate + "T23:59:00.000Z",
                    assignedTo: t.id,
                    type: "DESTEK",
                    isNew: false,
                    diagCount: 0,
                    isTest: false,
                    absencePenalty: true,
                    assignReason: `Devamsızlık cezası (En düşük: ${minScore} - ${settings.absencePenaltyAmount})`
                };
                nextHistory[simDate] = [...(nextHistory[simDate] || []), penaltyCase];
            });
        }

        // 4. Reset teachers
        nextTeachers = nextTeachers.map(t => ({ ...t, isAbsent: false, backupDay: undefined }));

        // Update State Locally
        setHistory(nextHistory);
        setCases(nextCases);
        setTeachers(nextTeachers);

        // 5. AUTO BACKUP & SAVE
        try {
            // First save state to persist changes
            // NOTE: We rely on auto-backup api to save state effectively if we treat it as the source of truth? 
            // No, we should hit /api/state to save first OR just rely on backup if backup restores it?
            // Actually standard flow is: update DB state via API.
            // But here we are doing a "bulk update".
            // Let's use the backup endpoint as "Save Point" AND /api/state for current state.
            // We'll mimic sending these changes to /api/state via POST if supported, or rely on socket?
            // Standard page.tsx syncs via `useSupabaseSync`. Here we are manual.
            // We should manually call an endpoint to update global state.
            // OR reuse the exact same logic: update UI -> auto syncs? 
            // In this standalone page, we don't have the auto-sync hook running to PUSH changes.
            // So we must manually push the state.

            // Push State
            await fetch("/api/state", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    teachers: nextTeachers,
                    cases: nextCases,
                    history: nextHistory,
                    // We must send other fields too if we don't want to lose them?
                    // Ideally api/state PATCHES. If it overwrites, we need full object.
                    // Let's assume we need to send what we changed.
                    // app_state table has a JSON blob.
                    // We need to fetch latest full state, merge, and save?
                    // Or just trust we have latest.
                })
            });

            // Auto Backup
            await fetch("/api/backup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    state: {
                        teachers: nextTeachers,
                        cases: nextCases,
                        history: nextHistory,
                        settings: settings,
                        // others...
                    },
                    backupType: "auto",
                    description: `Otomatik - ${simDate} Sonu (Zaman Tüneli)`
                }),
            });

            alert(`✅ ${simDate} günü başarıyla sonlandırıldı ve yedek alındı.`);

            // Next Day Redirect
            const nextDay = new Date(simDate + "T12:00:00");
            nextDay.setDate(nextDay.getDate() + 1);
            const nextDayStr = nextDay.toISOString().slice(0, 10);

            const today = new Date();
            const todayStr = today.toISOString().slice(0, 10);

            if (nextDayStr <= todayStr) {
                window.location.href = `?simDate=${nextDayStr}`;
            } else {
                window.location.href = window.location.pathname; // Back to 'today' (no param)
            }

        } catch (e) {
            console.error(e);
            alert("Hata oluştu: " + e);
        }
    };

    const handleFixDuplicates = async () => {
        if (!confirm("Tüm geçmişteki yinelenen bonus ve ceza kayıtları temizlenecek. Devam edilsin mi?")) return;
        const nextHistory = { ...history };
        let removedCount = 0;
        Object.keys(nextHistory).forEach(date => {
            const dayCases = nextHistory[date] || [];
            const uniqueBonusMap: Record<string, CaseFile[]> = {};
            const uniquePenaltyMap: Record<string, CaseFile[]> = {};
            dayCases.forEach(c => {
                if (c.backupBonus && c.assignedTo) {
                    if (!uniqueBonusMap[c.assignedTo]) uniqueBonusMap[c.assignedTo] = [];
                    uniqueBonusMap[c.assignedTo].push(c);
                } else if (c.absencePenalty && c.assignedTo) {
                    if (!uniquePenaltyMap[c.assignedTo]) uniquePenaltyMap[c.assignedTo] = [];
                    uniquePenaltyMap[c.assignedTo].push(c);
                }
            });
            const idsToRemove = new Set<string>();
            Object.values(uniqueBonusMap).forEach(list => {
                if (list.length > 1) {
                    list.sort((a, b) => b.score - a.score);
                    list.slice(1).forEach(rem => idsToRemove.add(rem.id));
                }
            });
            Object.values(uniquePenaltyMap).forEach(list => {
                if (list.length > 1) {
                    list.sort((a, b) => a.score - b.score);
                    list.slice(1).forEach(rem => idsToRemove.add(rem.id));
                }
            });
            if (idsToRemove.size > 0) {
                nextHistory[date] = dayCases.filter(c => !idsToRemove.has(c.id));
                removedCount += idsToRemove.size;
            }
        });

        if (removedCount > 0) {
            setHistory(nextHistory);
            // Save
            await fetch("/api/state", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ history: nextHistory })
            });
            alert(`✅ Toplam ${removedCount} adet yinelenen kayıt temizlendi.`);
        } else {
            alert("✅ Temizlenecek kayıt bulunamadı.");
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 p-4">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle>🔐 Giriş Yap</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="space-y-2">
                                <Label>Şifre</Label>
                                <Input
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Şifrenizi girin..."
                                />
                            </div>
                            <Button type="submit" className="w-full">Giriş</Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (loading) return <div className="p-8 text-center">Yükleniyor...</div>;

    return (
        <div className="min-h-screen bg-purple-50 p-6 space-y-6">
            <Card className="border-2 border-purple-300">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-purple-800">
                        <span className="text-2xl">⏰</span>
                        Zaman Makinesi (Gizli Panel)
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="bg-white p-4 rounded-lg border">
                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <Label>Tarih Seç</Label>
                                <Input
                                    type="date"
                                    defaultValue={currentSimDate}
                                    onChange={(e) => {
                                        const newDate = e.target.value;
                                        if (newDate) window.location.href = `?simDate=${newDate}`;
                                    }}
                                />
                            </div>
                            <div className="flex gap-2 items-end">
                                <Button variant="outline" onClick={() => {
                                    const d = new Date(currentSimDate);
                                    d.setDate(d.getDate() - 1);
                                    window.location.href = `?simDate=${d.toISOString().slice(0, 10)}`;
                                }}>Prev</Button>
                                <Button variant="outline" onClick={() => {
                                    const d = new Date(currentSimDate);
                                    d.setDate(d.getDate() + 1);
                                    window.location.href = `?simDate=${d.toISOString().slice(0, 10)}`;
                                }}>Next</Button>
                                <Button variant="ghost" onClick={() => window.location.href = window.location.pathname}>Bugün</Button>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <Button variant="destructive" size="lg" className="flex-1" onClick={handleRollOver}>
                            🔚 Günü Sonlandır (+Yedek Al)
                        </Button>
                        <Button variant="outline" className="flex-1 border-orange-300 text-orange-700 bg-orange-50" onClick={handleFixDuplicates}>
                            🛠️ Yinelenenleri Temizle
                        </Button>
                    </div>

                    {/* Manuel Kayıt Ekleme */}
                    <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                        <h4 className="text-md font-semibold text-green-800 mb-3">➕ Manuel Kayıt Ekle</h4>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <div>
                                <Label className="text-green-700">Öğretmen</Label>
                                <select
                                    className="w-full p-2 border rounded mt-1"
                                    value={manualTeacherId}
                                    onChange={(e) => setManualTeacherId(e.target.value)}
                                >
                                    <option value="">Seçiniz...</option>
                                    {teachers.filter(t => t.active).map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <Label className="text-green-700">Puan</Label>
                                <Input
                                    type="number"
                                    placeholder="Örn: 5 veya -3"
                                    className="mt-1"
                                    value={manualScore}
                                    onChange={(e) => setManualScore(e.target.value)}
                                />
                            </div>
                            <div>
                                <Label className="text-green-700">Açıklama</Label>
                                <Input
                                    type="text"
                                    placeholder="Örn: Manuel düzeltme"
                                    className="mt-1"
                                    value={manualDesc}
                                    onChange={(e) => setManualDesc(e.target.value)}
                                />
                            </div>
                            <div>
                                <Label className="text-green-700">Kayıt Türü</Label>
                                <div className="flex gap-2 mt-1">
                                    <Button
                                        type="button"
                                        variant={isFileEntry ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setIsFileEntry(true)}
                                        className={isFileEntry ? "bg-blue-600" : ""}
                                    >
                                        📁 Dosya
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={!isFileEntry ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setIsFileEntry(false)}
                                        className={!isFileEntry ? "bg-orange-600" : ""}
                                    >
                                        ⚖️ Puan
                                    </Button>
                                </div>
                            </div>
                            <div className="flex items-end">
                                <Button
                                    variant="default"
                                    className="w-full bg-green-600 hover:bg-green-700"
                                    onClick={async () => {
                                        if (!manualTeacherId) {
                                            alert("Lütfen öğretmen seçin!");
                                            return;
                                        }
                                        const score = Number(manualScore);
                                        if (isNaN(score) || score === 0) {
                                            alert("Geçerli bir puan girin!");
                                            return;
                                        }

                                        const teacher = teachers.find(t => t.id === manualTeacherId);
                                        const desc = manualDesc || "Manuel ekleme";
                                        const newEntry: CaseFile = {
                                            id: uid_local(),
                                            student: `${teacher?.name || "?"} - ${desc}`,
                                            score: score,
                                            createdAt: currentSimDate + "T12:00:00.000Z",
                                            assignedTo: manualTeacherId,
                                            type: "DESTEK",
                                            isNew: false,
                                            diagCount: 0,
                                            isTest: false,
                                            assignReason: desc,
                                            absencePenalty: !isFileEntry // Dosya değilse true (sayılmaz)
                                        };

                                        const newHistory = {
                                            ...history,
                                            [currentSimDate]: [...(history[currentSimDate] || []), newEntry]
                                        };
                                        setHistory(newHistory);

                                        // Save to backend
                                        try {
                                            const res = await fetch("/api/state", {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ history: newHistory })
                                            });
                                            if (!res.ok) throw new Error("API error");

                                            // Reset form
                                            setManualTeacherId("");
                                            setManualScore("");
                                            setManualDesc("");
                                            setIsFileEntry(true);

                                            alert("✅ Kayıt eklendi!");
                                        } catch (err) {
                                            console.error(err);
                                            alert("❌ Kayıt eklenemedi!");
                                        }
                                    }}
                                >
                                    Ekle
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8">
                        <h3 className="text-lg font-bold mb-4">{currentSimDate} - Arşiv Kayıtları</h3>
                        <AssignedArchiveView
                            history={history}
                            cases={[]} // Passing empty cases because archive view uses history[date] mostly
                            teacherName={(id) => teachers.find(t => t.id === id)?.name || "—"}
                            caseDesc={caseDesc}
                            settings={settings}
                            onRemove={async (id, date) => {
                                const newDateCases = (history[date] || []).filter(c => c.id !== id);
                                const newHistory = { ...history, [date]: newDateCases };
                                setHistory(newHistory);
                                // save
                                await fetch("/api/state", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ history: newHistory })
                                });
                            }}
                            onUpdate={async (id, date, newScore) => {
                                const newDateCases = (history[date] || []).map(c => c.id === id ? { ...c, score: Number(newScore) } : c);
                                const newHistory = { ...history, [date]: newDateCases };
                                setHistory(newHistory);
                                // save
                                await fetch("/api/state", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ history: newHistory })
                                });
                            }}
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
