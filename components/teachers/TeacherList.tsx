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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MoreHorizontal, Bell, BellOff, UserCheck, UserX, Crown, FlaskConical, Archive, Trash2, Plus, Cake, KeyRound } from "lucide-react";

import { uid } from "@/lib/utils";
import { getTodayYmd } from "@/lib/date";
import type { Teacher } from "@/types";

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
        addToast
    } = useAppStore();

    const [newTeacherName, setNewTeacherName] = useState("");
    const [newTeacherBirthDate, setNewTeacherBirthDate] = useState("");

    // UI states for inline editing
    const [editKeyOpen, setEditKeyOpen] = useState<Record<string, boolean>>({});
    const [editPushover, setEditPushover] = useState<Record<string, string>>({});

    // ---- Helpers
    function hasTestToday(tid: string) {
        const today = getTodayYmd();
        return cases.some(c => c.isTest && !c.absencePenalty && c.assignedTo === tid && c.createdAt.slice(0, 10) === today);
    }

    // ---- Actions
    function handleAddTeacher() {
        const name = newTeacherName.trim();
        if (!name) return;
        const birthDate = newTeacherBirthDate.trim() || undefined;

        // Aktif öğretmenlerin ortalama puanını hesapla (adil başlangıç için)
        const activeTeachers = teachers.filter(t => t.active && !t.isPhysiotherapist);
        const avgLoad = activeTeachers.length > 0
            ? Math.round(activeTeachers.reduce((sum, t) => sum + t.yearlyLoad, 0) / activeTeachers.length)
            : 0;

        const newTeacher: Teacher = {
            id: uid(),
            name,
            isAbsent: false,
            yearlyLoad: avgLoad,
            monthly: {},
            active: true,
            isTester: false,
            birthDate
        };

        addTeacher(newTeacher);
        setNewTeacherName("");
        setNewTeacherBirthDate("");
        addToast(`Öğretmen eklendi: ${name}`);
    }

    function handleToggleAbsent(tid: string) {
        const today = getTodayYmd();
        const currentTeacher = teachers.find(t => t.id === tid);
        if (!currentTeacher) return;

        const newAbsent = !currentTeacher.isAbsent;

        updateTeacher(tid, {
            isAbsent: newAbsent
        });

        // Devamsızlık kaydını Supabase'de sakla/sil (Store update)
        let nextRecords = [...absenceRecords];
        if (newAbsent) {
            // Ekle
            if (!nextRecords.find(r => r.teacherId === tid && r.date === today)) {
                nextRecords.push({ teacherId: tid, date: today });
            }
        } else {
            // Sil
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

    // Optimistic UI state for backup toggle
    const [optimisticBackups, setOptimisticBackups] = useState<Record<string, string | undefined>>({});

    function handleToggleBackupToday(tid: string) {
        const today = getTodayYmd();
        const t = teachers.find(x => x.id === tid);
        if (!t) return;

        const currentVal = optimisticBackups[tid] !== undefined ? optimisticBackups[tid] : t.backupDay;
        const nextBackup = currentVal === today ? undefined : today;

        // Anında UI güncellemesi
        setOptimisticBackups(prev => ({ ...prev, [tid]: nextBackup }));

        // Store güncellemesi
        updateTeacher(tid, { backupDay: nextBackup });

        addToast(nextBackup ? `${t.name} yedek yapıldı.` : `${t.name} yedeği iptal edildi.`);
    }

    function handleDeleteTeacher(tid: string) {
        const t = teachers.find(x => x.id === tid);
        if (!t) return;

        const caseCount = cases.filter(c => c.assignedTo === tid).length;
        const hasLoad = t.yearlyLoad > 0 || Object.values(t.monthly || {}).some(v => v > 0);

        if (caseCount > 0 || hasLoad) {
            alert("Bu öğretmenin geçmiş kaydı var. Silmek raporları etkiler; öğretmen arşivlendi.");
            updateTeacher(tid, { active: false });
            return;
        }

        if (!confirm("Bu öğretmeni kalıcı olarak silmek istiyor musunuz?")) return;

        removeTeacher(tid);
        // Atanmış dosyaların atamasını kaldır
        const updatedCases = cases.map(c => (c.assignedTo === tid ? { ...c, assignedTo: undefined } : c));
        setCases(updatedCases);
        addToast("Öğretmen silindi.");
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

    // Öğretmenleri aktif/pasif olarak grupla
    const activeTeachers = teachers.filter(t => !t.isPhysiotherapist && t.active);
    const inactiveTeachers = teachers.filter(t => !t.isPhysiotherapist && !t.active);

    return (
        <div className="space-y-6">
            {/* Öğretmen Ekle - Premium Tasarım */}
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
                    <Button onClick={handleAddTeacher} className="h-10 px-6 bg-indigo-600 hover:bg-indigo-700">
                        <Plus className="w-4 h-4 mr-1" /> Ekle
                    </Button>
                </div>
            </div>

            {/* Aktif Öğretmenler */}
            <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Aktif Öğretmenler ({activeTeachers.length})
                </h3>
                <div className="grid gap-3">
                    {activeTeachers.map((t) => {
                        const locked = hasTestToday(t.id);
                        const backupDayVal = optimisticBackups[t.id] !== undefined ? optimisticBackups[t.id] : t.backupDay;
                        const isBackupToday = backupDayVal === getTodayYmd();

                        return (
                            <div
                                key={t.id}
                                className={`stagger-item group relative bg-white rounded-xl border p-4 transition-all duration-200 hover:shadow-md ${t.isAbsent
                                    ? 'border-rose-200 bg-rose-50/50'
                                    : isBackupToday
                                        ? 'border-amber-200 bg-amber-50/50'
                                        : 'border-slate-200 hover:border-slate-300'
                                    }`}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    {/* Sol: Bilgiler */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-semibold text-slate-800">{t.name}</span>

                                            {/* Durum Badge'leri */}
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
                                            <span className="inline-flex items-center gap-1">
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
                                        {/* Hızlı Aksiyonlar */}
                                        <Button
                                            variant={t.isTester ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => handleToggleTester(t.id)}
                                            className={`h-8 ${t.isTester ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
                                            title="Test dosyalarını bu öğretmene atanabilir hale getirir"
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
                                            title={`Bugün yedek: dosya almaz. Gün sonunda en yüksek puan +${settings.backupBonusAmount} ile başlar.`}
                                        >
                                            <Crown className="w-3.5 h-3.5 mr-1" />
                                            {isBackupToday ? 'Yedek ✓' : 'Yedek Yap'}
                                        </Button>

                                        {/* Diğer Aksiyonlar - Popover */}
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                    <MoreHorizontal className="w-4 h-4" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-56 p-2" align="end">
                                                <div className="space-y-1">

                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="w-full justify-start h-9"
                                                        onClick={() => testWebPushNotify(t)}
                                                    >
                                                        <Bell className="w-4 h-4 mr-2" />
                                                        Test Push Gönder
                                                    </Button>

                                                    {/* Pushover Key Yönetimi */}
                                                    {!t.pushoverKey ? (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="w-full justify-start h-9"
                                                            onClick={() => setEditKeyOpen(p => ({ ...p, [t.id]: true }))}
                                                        >
                                                            <KeyRound className="w-4 h-4 mr-2" />
                                                            Pushover Key Ekle
                                                        </Button>
                                                    ) : (
                                                        <>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="w-full justify-start h-9"
                                                                onClick={() => testNotifyTeacher(t)}
                                                            >
                                                                <Bell className="w-4 h-4 mr-2" />
                                                                Pushover Test
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="w-full justify-start h-9 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                                                onClick={() => {
                                                                    updateTeacher(t.id, { pushoverKey: undefined });
                                                                }}
                                                            >
                                                                <BellOff className="w-4 h-4 mr-2" />
                                                                Pushover Key Sil
                                                            </Button>
                                                        </>
                                                    )}

                                                    <div className="h-px bg-slate-100 my-1" />

                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="w-full justify-start h-9"
                                                        onClick={() => handleToggleActive(t.id)}
                                                    >
                                                        <Archive className="w-4 h-4 mr-2" />
                                                        Arşivle
                                                    </Button>

                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="w-full justify-start h-9 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                                        onClick={() => handleDeleteTeacher(t.id)}
                                                    >
                                                        <Trash2 className="w-4 h-4 mr-2" />
                                                        Kalıcı Sil
                                                    </Button>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>

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

