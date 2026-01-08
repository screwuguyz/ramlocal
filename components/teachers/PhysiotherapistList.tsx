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

import { uid } from "@/lib/utils";
import { getTodayYmd } from "@/lib/date";
import type { Teacher } from "@/types";

export default function PhysiotherapistList() {
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

    // ---- Actions
    function handleAddPhysiotherapist() {
        const name = newTeacherName.trim();
        if (!name) return;
        const birthDate = newTeacherBirthDate.trim() || undefined;

        // Fizyoterapist olarak ekle, puan yükü 0 başlayabilir çünkü sıralamaya girmiyorlar
        const newTeacher: Teacher = {
            id: uid(),
            name,
            isAbsent: false,
            yearlyLoad: 0,
            monthly: {},
            active: true,
            isTester: false,
            birthDate,
            isPhysiotherapist: true
        };

        addTeacher(newTeacher);
        setNewTeacherName("");
        setNewTeacherBirthDate("");
        addToast(`Fizyoterapist eklendi: ${name}`);
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

    function handleDeleteTeacher(tid: string) {
        const t = teachers.find(x => x.id === tid);
        if (!t) return;

        const caseCount = cases.filter(c => c.assignedTo === tid).length;
        // Check historical load just in case
        const hasLoad = t.yearlyLoad > 0 || Object.values(t.monthly || {}).some(v => v > 0);

        if (caseCount > 0 || hasLoad) {
            alert("Bu fizyoterapistin geçmiş kaydı var. Silmek raporları etkiler; arşivlendi.");
            updateTeacher(tid, { active: false });
            return;
        }

        if (!confirm("Bu kişiyi kalıcı olarak silmek istiyor musunuz?")) return;

        removeTeacher(tid);
        // Atanmış dosyaların atamasını kaldır
        const updatedCases = cases.map(c => (c.assignedTo === tid ? { ...c, assignedTo: undefined } : c));
        setCases(updatedCases);
        addToast("Fizyoterapist silindi.");
    }

    async function testNotifyTeacher(t: Teacher) {
        if (!t.pushoverKey) {
            alert("Bu kişinin Pushover User Key’i boş.");
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

    return (
        <div className="space-y-4">
            {/* Fizyoterapist Ekle */}
            <div className="flex flex-wrap items-end gap-2 p-4 bg-slate-50 border rounded-lg">
                <div className="w-48">
                    <Label>Ad Soyad</Label>
                    <Input
                        value={newTeacherName}
                        onChange={(e) => setNewTeacherName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddPhysiotherapist()}
                        placeholder="Ad Soyad"
                    />
                </div>
                <div className="w-32">
                    <Label>🎂 Doğum</Label>
                    <Input
                        value={newTeacherBirthDate}
                        onChange={(e) => setNewTeacherBirthDate(e.target.value)}
                        placeholder="AA-GG"
                        maxLength={5}
                    />
                </div>
                <Button onClick={handleAddPhysiotherapist}>➕ Ekle</Button>
            </div>

            {teachers.filter(t => t.isPhysiotherapist).map((t) => {
                return (
                    <div key={t.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200">
                        <div className="space-y-1 min-w-0 flex-shrink">
                            <div className="font-medium">
                                {t.name}
                                <Button size="sm" variant="outline" className="ml-2 h-6 text-xs" onClick={() => testWebPushNotify(t)}>
                                    🔔 Test Push
                                </Button>
                            </div>
                            <div className="text-xs text-muted-foreground">
                                Fizyoterapist {t.birthDate ? ` • 🎂 ${t.birthDate}` : ""}
                                {/* Pushover Key Yönetimi */}
                                {!t.pushoverKey && !editKeyOpen[t.id] ? (
                                    <div className="mt-2">
                                        <Button size="sm" variant="outline" onClick={() => setEditKeyOpen((p) => ({ ...p, [t.id]: true }))}>
                                            Key Yükle
                                        </Button>
                                    </div>
                                ) : null}

                                {editKeyOpen[t.id] ? (
                                    <div className="mt-2 flex items-center gap-2">
                                        <Label className="text-xs w-32">Pushover User Key</Label>
                                        <Input
                                            autoFocus
                                            className="h-8 w-[320px]"
                                            placeholder="uQiRzpo4DXghDmr9QzzfQu27cmVRsG"
                                            value={editPushover[t.id] ?? ""}
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                setEditPushover((prev) => ({ ...prev, [t.id]: v }));
                                            }}
                                            onBlur={() => {
                                                setEditPushover((prev) => {
                                                    const next = { ...prev };
                                                    delete next[t.id];
                                                    return next;
                                                });
                                                setEditKeyOpen((prev) => ({ ...prev, [t.id]: false }));
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    const v = (editPushover[t.id] ?? "").trim();
                                                    if (v) {
                                                        updateTeacher(t.id, { pushoverKey: v });
                                                    }
                                                    setEditPushover((prev) => {
                                                        const next = { ...prev };
                                                        delete next[t.id];
                                                        return next;
                                                    });
                                                    setEditKeyOpen((prev) => ({ ...prev, [t.id]: false }));
                                                } else if (e.key === "Escape") {
                                                    e.preventDefault();
                                                    setEditPushover((prev) => {
                                                        const next = { ...prev };
                                                        delete next[t.id];
                                                        return next;
                                                    });
                                                    setEditKeyOpen((prev) => ({ ...prev, [t.id]: false }));
                                                }
                                            }}
                                        />
                                    </div>
                                ) : null}

                                {t.pushoverKey && !editKeyOpen[t.id] ? (
                                    <div className="mt-2 flex items-center gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => testNotifyTeacher(t)}
                                            title="Telefona test bildirimi gönder"
                                        >
                                            Test Gönder
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                                setEditPushover((prev) => ({ ...prev, [t.id]: t.pushoverKey || "" }));
                                                setEditKeyOpen((prev) => ({ ...prev, [t.id]: true }));
                                            }}
                                        >
                                            Anahtarı değiştir
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => {
                                                updateTeacher(t.id, { pushoverKey: undefined });
                                                setEditPushover((prev) => {
                                                    const next = { ...prev };
                                                    delete next[t.id];
                                                    return next;
                                                });
                                                setEditKeyOpen((prev) => ({ ...prev, [t.id]: false }));
                                            }}
                                        >
                                            Anahtarı temizle
                                        </Button>
                                    </div>
                                ) : null}

                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="text-xs text-muted-foreground mr-2">
                                {t.isAbsent ? (
                                    <span className="text-red-600 font-medium">🚫 Devamsız</span>
                                ) : "Uygun"}
                            </div>
                            <Button variant={t.isAbsent ? "default" : "outline"} onClick={() => handleToggleAbsent(t.id)} size="sm">
                                {t.isAbsent ? "✅ Uygun Yap" : "🚫 Devamsız Yap"}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleToggleActive(t.id)}>{t.active ? "📦 Arşivle" : "✨ Aktif Et"}</Button>
                            <Button variant="destructive" size="sm" title="Kalıcı Sil" onClick={() => handleDeleteTeacher(t.id)}>🗑️ Sil</Button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
