"use client";

import React, { useState } from "react";
import { useAppStore } from "@/stores/useAppStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

import { MoreHorizontal, Bell, BellOff, UserCheck, UserX, Crown, FlaskConical, Archive, Trash2, Plus, Cake, KeyRound, ChevronDown, ChevronUp, X } from "lucide-react";

import { uid } from "@/lib/utils";
import { getTodayYmd } from "@/lib/date";
import type { Teacher } from "@/types";

import ScoreAdjustmentModal from "@/components/modals/ScoreAdjustmentModal";

export default function TeacherList() {
    const {
        teachers,
        addTeacher,
        updateTeacher,
        removeTeacher,
        cases,
        setCases,
        absenceRecords,
        setAbsenceRecords,
        settings,
        addToast,
        history,
        lastRollover,
        lastAbsencePenalty,
        announcements,
        eArchive,
        queue
    } = useAppStore();

    const [newTeacherName, setNewTeacherName] = useState("");
    const [newTeacherBirthDate, setNewTeacherBirthDate] = useState("");
    const [newTeacherStartScore, setNewTeacherStartScore] = useState("");

    // UI states
    const [editKeyOpen, setEditKeyOpen] = useState<Record<string, boolean>>({});
    const [editPushover, setEditPushover] = useState<Record<string, string>>({});
    const [editingLoadId, setEditingLoadId] = useState<string | null>(null);
    const [editLoadValue, setEditLoadValue] = useState<string>("");

    // Expanded actions panel state - hangi öğretmenin ek aksiyonları açık
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Score Adjustment Modal State
    const [scoreAdjustTeacher, setScoreAdjustTeacher] = useState<Teacher | null>(null);

    // ---- Helpers
    function hasTestToday(tid: string) {
        const today = getTodayYmd();
        return cases.some(c => c.isTest && !c.absencePenalty && c.assignedTo === tid && c.createdAt.slice(0, 10) === today);
    }

    const activeTeachersList = teachers.filter(t => t.active && !t.isPhysiotherapist);
    const calculatedAvgLoad = activeTeachersList.length > 0
        ? Math.round(activeTeachersList.reduce((sum, t) => sum + t.yearlyLoad, 0) / activeTeachersList.length)
        : 75;

    function handleScoreConfirm(delta: number, reason: string) {
        if (!scoreAdjustTeacher) return;

        const currentYearly = scoreAdjustTeacher.yearlyLoad;
        const newYearly = Math.max(0, currentYearly + delta);

        const today = getTodayYmd();
        const currentMonthKey = today.slice(0, 7);
        const currentMonthly = scoreAdjustTeacher.monthly?.[currentMonthKey] || 0;
        const newMonthly = Math.max(0, currentMonthly + delta);

        const nextMonthly = { ...scoreAdjustTeacher.monthly };
        nextMonthly[currentMonthKey] = newMonthly;

        updateTeacher(scoreAdjustTeacher.id, {
            yearlyLoad: newYearly,
            monthly: nextMonthly
        });

        const adjustmentCase: any = {
            id: uid(),
            student: "Puan Denkleştirme",
            score: delta,
            assignedTo: scoreAdjustTeacher.id,
            createdAt: today + "T12:00:00.000Z",
            type: "DESTEK",
            isNew: false,
            diagCount: 0,
            isTest: false,
            assignReason: reason
        };

        setCases([...cases, adjustmentCase]);
        addToast(`${scoreAdjustTeacher.name}: ${reason} (Yeni Puan: ${newYearly})`);
        setScoreAdjustTeacher(null);
    }

    // ---- Actions
    function handleAddTeacher() {
        const name = newTeacherName.trim();
        if (!name) return;
        const birthDate = newTeacherBirthDate.trim();

        if (!birthDate) {
            alert("Lütfen doğum günü girin (AA-GG). Bu alan zorunludur.");
            return;
        }

        let initialLoad = calculatedAvgLoad;
        const scoreInput = newTeacherStartScore.trim();
        let calculationMsg = `Ortalama (${calculatedAvgLoad})`;

        if (scoreInput) {
            if (scoreInput.startsWith("+") || scoreInput.startsWith("-")) {
                const delta = parseInt(scoreInput);
                initialLoad = calculatedAvgLoad + delta;
                calculationMsg = `Ortalama (${calculatedAvgLoad}) ${delta > 0 ? '+' : ''}${delta}`;
            } else {
                initialLoad = parseInt(scoreInput);
                calculationMsg = `Manuel (${initialLoad})`;
            }
        }

        initialLoad = Math.max(0, initialLoad);

        if (!confirm(`EKLENİYOR:\n\nÖğretmen: ${name}\nDoğum Günü: ${birthDate}\nHesaplanan Puan: ${initialLoad} (${calculationMsg})\n\nOnaylıyor musunuz?`)) {
            return;
        }

        const newTeacher: Teacher = {
            id: uid(),
            name,
            isAbsent: false,
            yearlyLoad: initialLoad,
            monthly: {},
            active: true,
            isTester: false,
            birthDate,
            startingLoad: initialLoad
        };

        addTeacher(newTeacher);

        setTimeout(() => {
            const state = useAppStore.getState();
            if (state.syncFunction) {
                state.syncFunction();
            }
        }, 100);

        setNewTeacherName("");
        setNewTeacherBirthDate("");
        setNewTeacherStartScore("");
        addToast(`Öğretmen eklendi: ${name} (${initialLoad} puan)`);
    }

    function handleToggleAbsent(tid: string) {
        const today = getTodayYmd();
        const currentTeacher = teachers.find(t => t.id === tid);
        if (!currentTeacher) return;

        const newAbsent = !currentTeacher.isAbsent;
        updateTeacher(tid, { isAbsent: newAbsent });

        let nextRecords = [...absenceRecords];
        if (newAbsent) {
            if (!nextRecords.find(r => r.teacherId === tid && r.date === today)) {
                nextRecords.push({ teacherId: tid, date: today });
            }
        } else {
            nextRecords = nextRecords.filter(r => !(r.teacherId === tid && r.date === today));
        }
        setAbsenceRecords(nextRecords);
    }

    function handleToggleActive(tid: string) {
        const t = teachers.find(x => x.id === tid);
        if (t) updateTeacher(tid, { active: !t.active });
    }

    function handleToggleTester(tid: string) {
        const t = teachers.find(x => x.id === tid);
        if (t) updateTeacher(tid, { isTester: !t.isTester });
    }

    const [optimisticBackups, setOptimisticBackups] = useState<Record<string, string | undefined>>({});

    function handleToggleBackupToday(tid: string) {
        const today = getTodayYmd();
        const t = teachers.find(x => x.id === tid);
        if (!t) return;

        const currentVal = optimisticBackups[tid] !== undefined ? optimisticBackups[tid] : t.backupDay;
        const nextBackup = currentVal === today ? undefined : today;

        setOptimisticBackups(prev => ({ ...prev, [tid]: nextBackup }));
        updateTeacher(tid, { backupDay: nextBackup });
        addToast(nextBackup ? `${t.name} yedek yapıldı.` : `${t.name} yedeği iptal edildi.`);
    }

    function handleDeleteTeacher(tid: string) {
        const t = teachers.find(x => x.id === tid);
        if (!t) return;

        const caseCount = cases.filter(c => c.assignedTo === tid).length;
        let confirmMsg = `${t.name} öğretmeni kalıcı olarak silmek istiyor musunuz?`;

        if (caseCount > 0) {
            confirmMsg = `${t.name} öğretmeninin ${caseCount} dosya kaydı var. Silmek raporları etkileyebilir.\n\nYine de KALICI olarak silmek istiyor musunuz?`;
        }

        if (!confirm(confirmMsg)) return;

        removeTeacher(tid);
        const updatedCases = cases.map(c => (c.assignedTo === tid ? { ...c, assignedTo: undefined } : c));
        setCases(updatedCases);
        addToast(`${t.name} silindi.`);

        // Sunucuya hemen senkronize et (silme işlemi diğer PC'lerde de yansısın)
        setTimeout(() => {
            const state = useAppStore.getState();
            if (state.syncFunction) {
                state.syncFunction();
            }
        }, 100);
    }

    async function testNotifyTeacher(t: Teacher) {
        if (!t.pushoverKey) {
            alert("Bu öğretmenin Pushover User Key'i boş.");
            return;
        }
        try {
            const res = await fetch("/api/notify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userKey: t.pushoverKey,
                    title: "Test Bildirim",
                    message: `${t.name} için test bildirimi`,
                    priority: 0,
                }),
            });
            const json = await res.json();
            if (!res.ok) {
                alert("Bildirim hatası: " + (json?.errors?.[0] || JSON.stringify(json)));
            } else {
                alert("Test bildirimi gönderildi!");
            }
        } catch {
            alert("Bildirim gönderilemedi.");
        }
    }

    async function testWebPushNotify(t: Teacher) {
        try {
            const res = await fetch("/api/push-send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    teacherId: t.id,
                    title: "Test Web Push",
                    message: `${t.name} için web push testi`,
                    url: "/"
                }),
            });
            const json = await res.json();
            if (!res.ok) {
                alert("Web Push hatası: " + (json.error || "Bilinmiyor"));
            } else {
                alert(`Sonuç: ${json.sent} gönderildi, ${json.failed} başarısız.`);
            }
        } catch (e: any) {
            alert("Web Push isteği başarısız: " + e.message);
        }
    }

    const activeTeachers = teachers.filter(t => !t.isPhysiotherapist && t.active);
    const inactiveTeachers = teachers.filter(t => !t.isPhysiotherapist && !t.active);

    return (
        <div className="space-y-6">
            <ScoreAdjustmentModal
                isOpen={!!scoreAdjustTeacher}
                onClose={() => setScoreAdjustTeacher(null)}
                targetTeacher={scoreAdjustTeacher}
                allTeachers={teachers}
                onConfirm={handleScoreConfirm}
            />

            {/* Öğretmen Ekle */}
            <div className="bg-gradient-to-r from-indigo-50 via-white to-purple-50 p-5 rounded-2xl border border-indigo-100 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                        <Plus className="w-4 h-4 text-indigo-600" />
                    </div>
                    <h3 className="font-semibold text-slate-800">Yeni Öğretmen Ekle</h3>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[200px]">
                        <Label className="text-xs text-slate-600 mb-1 block">Ad Soyad</Label>
                        <Input
                            value={newTeacherName}
                            onChange={(e) => setNewTeacherName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleAddTeacher()}
                            placeholder="Öğretmen adı..."
                            className="h-10 bg-white border-slate-200 focus:border-indigo-400 focus:ring-indigo-100"
                        />
                    </div>
                    <div className="w-32">
                        <Label className="text-xs text-slate-600 mb-1 flex items-center gap-1">
                            <Cake className="w-3 h-3" /> Doğum Günü
                        </Label>
                        <Input
                            value={newTeacherBirthDate}
                            onChange={(e) => setNewTeacherBirthDate(e.target.value)}
                            placeholder="AA-GG"
                            maxLength={5}
                            className="h-10 bg-white border-slate-200"
                        />
                    </div>
                    <div className="w-28">
                        <Label className="text-xs text-slate-600 mb-1 flex items-center gap-1">
                            📊 Başlangıç Puanı
                        </Label>
                        <Input
                            type="number"
                            value={newTeacherStartScore}
                            onChange={(e) => setNewTeacherStartScore(e.target.value)}
                            placeholder={`${calculatedAvgLoad}`}
                            className="h-10 bg-white border-slate-200 text-center"
                            title={`Ortalama puan: ${calculatedAvgLoad}`}
                        />
                    </div>
                    <Button onClick={handleAddTeacher} className="h-10 px-6 bg-indigo-600 hover:bg-indigo-700">
                        <Plus className="w-4 h-4 mr-1" /> Ekle
                    </Button>
                </div>
            </div>

            {/* Aktif Öğretmenler */}
            <div>
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        Aktif Öğretmenler ({activeTeachers.length})
                    </h3>
                </div>
                <div className="grid gap-3">
                    {activeTeachers.map((t) => {
                        const locked = hasTestToday(t.id);
                        const backupDayVal = optimisticBackups[t.id] !== undefined ? optimisticBackups[t.id] : t.backupDay;
                        const isBackupToday = backupDayVal === getTodayYmd();
                        const isExpanded = expandedId === t.id;

                        return (
                            <div
                                key={t.id}
                                className={`stagger-item group relative bg-white rounded-xl border p-4 transition-all duration-200 hover:shadow-md ${t.isAbsent
                                    ? 'border-rose-200 bg-rose-50/50'
                                    : isBackupToday
                                        ? 'border-amber-200 bg-amber-50/50'
                                        : isExpanded
                                            ? 'border-indigo-300 shadow-md'
                                            : 'border-slate-200 hover:border-slate-300'
                                    }`}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    {/* Sol: Bilgiler */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-semibold text-slate-800">{t.name}</span>
                                            {t.isAbsent && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-700">
                                                    <UserX className="w-3 h-3" /> Devamsız
                                                </span>
                                            )}
                                            {isBackupToday && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                                    <Crown className="w-3 h-3" /> Yedek
                                                </span>
                                            )}
                                            {t.isTester && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                                                    <FlaskConical className="w-3 h-3" /> Testör
                                                </span>
                                            )}
                                            {locked && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                                    🔒 Bugün test aldı
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-3 mt-2 text-sm text-slate-500">
                                            <span
                                                className="inline-flex items-center gap-1 cursor-pointer hover:bg-slate-100 rounded px-1 -mx-1 transition-colors"
                                                onClick={() => {
                                                    const newValStr = window.prompt(`${t.name} için yeni puan girin:`, String(t.yearlyLoad || 0));
                                                    if (newValStr !== null) {
                                                        const newVal = Math.max(0, parseInt(newValStr) || 0);
                                                        updateTeacher(t.id, { yearlyLoad: newVal });
                                                        addToast(`${t.name} puanı ${newVal} olarak güncellendi.`);
                                                    }
                                                }}
                                                title="Puanı düzenlemek için tıklayın"
                                            >
                                                📊 <span className="font-medium text-slate-700">{t.yearlyLoad}</span> puan
                                            </span>
                                            {t.birthDate && (
                                                <span className="inline-flex items-center gap-1">
                                                    <Cake className="w-3.5 h-3.5 text-pink-400" /> {t.birthDate}
                                                </span>
                                            )}
                                            {t.pushoverKey && (
                                                <span className="inline-flex items-center gap-1 text-emerald-600">
                                                    <Bell className="w-3.5 h-3.5" /> Bildirim aktif
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Sağ: Aksiyon Butonları */}
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant={t.isTester ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => handleToggleTester(t.id)}
                                            className={`h-8 ${t.isTester ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
                                        >
                                            <FlaskConical className="w-3.5 h-3.5 mr-1" />
                                            {t.isTester ? 'Testör ✓' : 'Testör'}
                                        </Button>

                                        <Button
                                            variant={t.isAbsent ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => handleToggleAbsent(t.id)}
                                            className={`h-8 ${t.isAbsent ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                                        >
                                            {t.isAbsent ? <><UserCheck className="w-3.5 h-3.5 mr-1" /> Uygun</> : <><UserX className="w-3.5 h-3.5 mr-1" /> Devamsız</>}
                                        </Button>

                                        <Button
                                            variant={isBackupToday ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => handleToggleBackupToday(t.id)}
                                            className={`h-8 ${isBackupToday ? 'bg-amber-500 hover:bg-amber-600' : ''}`}
                                        >
                                            <Crown className="w-3.5 h-3.5 mr-1" />
                                            {isBackupToday ? 'Yedek ✓' : 'Yedek Yap'}
                                        </Button>

                                        {/* 3 nokta butonu → kartı genişletir */}
                                        <Button
                                            variant={isExpanded ? "default" : "ghost"}
                                            size="sm"
                                            className={`h-8 w-8 p-0 transition-all ${isExpanded ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : ''}`}
                                            onClick={() => setExpandedId(isExpanded ? null : t.id)}
                                        >
                                            {isExpanded ? <X className="w-4 h-4" /> : <MoreHorizontal className="w-4 h-4" />}
                                        </Button>
                                    </div>
                                </div>

                                {/* Genişleyen Aksiyon Paneli - kartın içinde açılır */}
                                {isExpanded && (
                                    <div className="mt-3 pt-3 border-t border-indigo-100 animate-in slide-in-from-top-2 duration-200">
                                        <div className="flex flex-wrap gap-2">
                                            {/* Puan Denkleştir */}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                                                onClick={() => { setScoreAdjustTeacher(t); setExpandedId(null); }}
                                            >
                                                <span className="font-bold mr-1">±</span> Puan Denkleştir
                                            </Button>

                                            {/* Test Push */}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8"
                                                onClick={() => { testWebPushNotify(t); setExpandedId(null); }}
                                            >
                                                <Bell className="w-3.5 h-3.5 mr-1" /> Test Push
                                            </Button>

                                            {/* Pushover */}
                                            {!t.pushoverKey ? (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8"
                                                    onClick={() => { setEditKeyOpen(p => ({ ...p, [t.id]: true })); setExpandedId(null); }}
                                                >
                                                    <KeyRound className="w-3.5 h-3.5 mr-1" /> Pushover Key Ekle
                                                </Button>
                                            ) : (
                                                <>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8"
                                                        onClick={() => { testNotifyTeacher(t); setExpandedId(null); }}
                                                    >
                                                        <Bell className="w-3.5 h-3.5 mr-1" /> Pushover Test
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 text-rose-600 border-rose-200 hover:bg-rose-50"
                                                        onClick={() => { updateTeacher(t.id, { pushoverKey: undefined }); setExpandedId(null); }}
                                                    >
                                                        <BellOff className="w-3.5 h-3.5 mr-1" /> Pushover Key Sil
                                                    </Button>
                                                </>
                                            )}

                                            {/* Fizyoterapiste Taşı */}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 text-purple-600 border-purple-200 hover:bg-purple-50"
                                                onClick={() => {
                                                    setExpandedId(null);
                                                    if (confirm(`${t.name} fizyoterapist olarak işaretlenecek ve sıralamaya dahil olmayacak. Emin misiniz?`)) {
                                                        updateTeacher(t.id, { isPhysiotherapist: true });
                                                        addToast(`${t.name} fizyoterapiste taşındı.`);
                                                    }
                                                }}
                                            >
                                                🏥 Fizyoterapiste Taşı
                                            </Button>

                                            {/* Arşivle */}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8"
                                                onClick={() => { handleToggleActive(t.id); setExpandedId(null); }}
                                            >
                                                <Archive className="w-3.5 h-3.5 mr-1" /> Arşivle
                                            </Button>

                                            {/* Kalıcı Sil */}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 text-rose-600 border-rose-200 hover:bg-rose-50"
                                                onClick={() => { handleDeleteTeacher(t.id); setExpandedId(null); }}
                                            >
                                                <Trash2 className="w-3.5 h-3.5 mr-1" /> Kalıcı Sil
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* Pushover Key Input (Inline) */}
                                {editKeyOpen[t.id] && (
                                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
                                        <KeyRound className="w-4 h-4 text-slate-400" />
                                        <Input
                                            autoFocus
                                            className="flex-1 h-9"
                                            placeholder="Pushover User Key..."
                                            value={editPushover[t.id] ?? ""}
                                            onChange={(e) => setEditPushover(prev => ({ ...prev, [t.id]: e.target.value }))}
                                            onBlur={() => {
                                                setEditPushover(prev => { const next = { ...prev }; delete next[t.id]; return next; });
                                                setEditKeyOpen(prev => ({ ...prev, [t.id]: false }));
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    const v = (editPushover[t.id] ?? "").trim();
                                                    if (v) updateTeacher(t.id, { pushoverKey: v });
                                                    setEditPushover(prev => { const next = { ...prev }; delete next[t.id]; return next; });
                                                    setEditKeyOpen(prev => ({ ...prev, [t.id]: false }));
                                                } else if (e.key === "Escape") {
                                                    e.preventDefault();
                                                    setEditPushover(prev => { const next = { ...prev }; delete next[t.id]; return next; });
                                                    setEditKeyOpen(prev => ({ ...prev, [t.id]: false }));
                                                }
                                            }}
                                        />
                                        <Button size="sm" variant="ghost" onClick={() => {
                                            setEditPushover(prev => { const next = { ...prev }; delete next[t.id]; return next; });
                                            setEditKeyOpen(prev => ({ ...prev, [t.id]: false }));
                                        }}>İptal</Button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Arşivlenmiş Öğretmenler */}
            {inactiveTeachers.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                        Arşivlenmiş ({inactiveTeachers.length})
                    </h3>
                    <div className="grid gap-2">
                        {inactiveTeachers.map((t) => (
                            <div
                                key={t.id}
                                className="stagger-item bg-slate-50 rounded-xl border border-slate-200 p-3 flex items-center justify-between opacity-75 hover:opacity-100 transition-opacity"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-slate-600">{t.name}</span>
                                    <span className="text-xs text-slate-400">{t.yearlyLoad} puan</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleToggleActive(t.id)}>
                                        ✨ Aktif Et
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-7 text-xs text-rose-500 hover:text-rose-600" onClick={() => handleDeleteTeacher(t.id)}>
                                        <Trash2 className="w-3 h-3" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
