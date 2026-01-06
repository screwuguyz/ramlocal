"use client";

import React, { useEffect, useState } from "react";
import { useAppStore } from "@/stores/useAppStore";
import { getTodayYmd } from "@/lib/date";

export default function DebugPage() {
    const { teachers, cases, settings } = useAppStore();
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);
    if (!mounted) return <div className="p-8">Yükleniyor...</div>;

    const today = getTodayYmd();
    const currentYear = new Date().getFullYear();

    // 1. Son atanan kişiyi bul
    const sortedCases = [...cases].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const lastCase = sortedCases.length > 0 ? sortedCases[0] : null;
    const lastTid = lastCase?.assignedTo;

    // 2. İlk Yıl Kontrolü (Page.tsx mantığı)
    const thisYearCases = cases.filter(c => c.createdAt.startsWith(String(currentYear)) && c.assignedTo);
    const isFirstOfYear = thisYearCases.length === 0;

    // 3. Rapor oluştur
    const activeTeachersCount = teachers.filter(t => t.active).length;

    const report = teachers.map(t => {
        const logs: string[] = [];
        let isEligible = true;
        let status = "ADAY";

        if (t.isPhysiotherapist) { isEligible = false; logs.push("Fizyoterapist"); }
        if (t.isAbsent) { isEligible = false; logs.push("Devamsız"); }
        if (!t.active) { isEligible = false; logs.push("İnaktif"); }

        const isBackup = t.backupDay === today;
        if (isBackup) { isEligible = false; logs.push(`Bugün Yedek (${t.backupDay})`); }

        const dailyCount = cases.filter(c => c.assignedTo === t.id && c.createdAt.startsWith(today)).length;
        if (dailyCount >= settings.dailyLimit) { isEligible = false; logs.push(`Limit Dolu (${dailyCount}/${settings.dailyLimit})`); }

        let rotationBlocked = false;
        if (activeTeachersCount > 1 && lastTid && lastTid === t.id) {
            rotationBlocked = true;
            if (isEligible) {
                isEligible = false;
                logs.push("🔴 ROTASYON ENGELİ");
            }
        }

        if (!isEligible) status = "ELENDİ";
        return { ...t, status, logs, dailyCount, rotationBlocked, isBackup };
    });

    // 4. Sıralama
    const candidates = report.filter(r => r.status === "ADAY");

    candidates.sort((a, b) => {
        // DİKKAT: Page.tsx'teki isFirstOfYear mantığını simüle etmeliyiz?
        // Hayır, biz doğru mantığı (yearlyLoad) kullanıyoruz.
        // Ama sorunu tespit etmek için buraya NOT düşelim.
        const byLoad = a.yearlyLoad - b.yearlyLoad;
        if (byLoad !== 0) return byLoad;
        return a.dailyCount - b.dailyCount;
    });

    const winner = candidates.length > 0 ? candidates[0] : null;

    return (
        <div className="p-8 max-w-6xl mx-auto font-mono text-sm bg-slate-50 min-h-screen">
            <h1 className="text-3xl font-bold mb-6 text-indigo-700">🕵️‍♂️ Atama Dedektifi v2.0</h1>

            <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-white p-4 rounded shadow border border-indigo-100">
                    <h2 className="font-bold text-lg mb-2 text-gray-700">Sistem</h2>
                    <div>📅 Bugün: <span className="font-bold">{today}</span></div>
                    <div>📊 Toplam Case: <span className="font-bold">{cases.length}</span></div>
                </div>
                <div className="bg-white p-4 rounded shadow border border-red-100">
                    <h2 className="font-bold text-lg mb-2 text-red-700">🚨 Kritik Kontrol</h2>
                    <div>Bu Yıl Dosya Sayısı: <span className="font-bold">{thisYearCases.length}</span></div>
                    <div className={`text-lg font-bold ${isFirstOfYear ? "text-red-600 blink" : "text-green-600"}`}>
                        "Yılın İlk Ataması" Modu: {isFirstOfYear ? "AKTİF (Sorun Olabilir!)" : "PASİF (Normal)"}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">Eğer burası AKTİF ise, sistem geçen yılın puanlarına göre atama yapar.</div>
                </div>
                <div className="bg-white p-4 rounded shadow border border-indigo-100">
                    <h2 className="font-bold text-lg mb-2 text-gray-700">Son Atama</h2>
                    <div>👤 Son Alan: <span className="font-bold font-mono">{lastTid || "YOK"}</span></div>
                    <div>🏷️ İsim: <span className="font-bold text-blue-600">{teachers.find(t => t.id === lastTid)?.name || "Bulunamadı"}</span></div>
                </div>
            </div>

            <div className="bg-white rounded shadow overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-800 text-white">
                        <tr>
                            <th className="p-3">Öğretmen</th>
                            <th className="p-3">Durum</th>
                            <th className="p-3">Yıllık Yük</th>
                            <th className="p-3">Günlük</th>
                            <th className="p-3">Engel</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {report.map(r => {
                            const isWinner = winner?.id === r.id;
                            return (
                                <tr key={r.id} className={isWinner ? "bg-green-100" : r.status === "ELENDİ" ? "bg-red-50" : "bg-white"}>
                                    <td className="p-3 font-bold flex flex-col">
                                        <span>{r.name}</span>
                                        {isWinner && <span className="text-green-600 text-[10px] uppercase">🏆 Kazanan</span>}
                                    </td>
                                    <td className="p-3"><span className={r.status === "ADAY" ? "text-green-600" : "text-red-600"}>{r.status}</span></td>
                                    <td className="p-3">{r.yearlyLoad}</td>
                                    <td className="p-3">{r.dailyCount}</td>
                                    <td className="p-3 text-red-600 text-xs">{r.logs.join(", ")}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* Sample Case Data */}
            <div className="mt-8 text-xs text-gray-400">
                <h3 className="font-bold">Last 3 Cases DEBUG:</h3>
                {sortedCases.slice(0, 3).map(c => (
                    <div key={c.id}>{c.createdAt} - {c.assignedTo}</div>
                ))}
            </div>
        </div>
    );
}
