"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type BirthDateResult = {
    months: number;
    gradeLabel: string; // "Okul Öncesi (37-66)" veya "Okul Öncesi (67-78)"
};

/**
 * Doğum tarihinden bugüne kadar geçen tam ay sayısını hesaplar.
 * Örn: doğum 2023-01-15, bugün 2026-02-19 → 37 ay (15 gün atalım: 36 ay + günler)
 */
function calculateMonths(birthDate: Date, today: Date): number {
    let months = (today.getFullYear() - birthDate.getFullYear()) * 12;
    months += today.getMonth() - birthDate.getMonth();
    // Eğer bugünün günü doğum gününden küçükse, henüz o ayı tamamlamamıştır
    if (today.getDate() < birthDate.getDate()) {
        months -= 1;
    }
    return months;
}

export default function BirthDateModal({
    open,
    onClose,
    onResult,
}: {
    open: boolean;
    onClose: () => void;
    onResult: (result: BirthDateResult | null) => void;
}) {
    const [birthDateStr, setBirthDateStr] = useState("");
    const [error, setError] = useState("");
    const [resultInfo, setResultInfo] = useState<{ months: number; label: string } | null>(null);

    if (!open) return null;

    function handleCalculate() {
        setError("");
        setResultInfo(null);

        if (!birthDateStr) {
            setError("Lütfen doğum tarihini giriniz.");
            return;
        }

        const birthDate = new Date(birthDateStr);
        if (isNaN(birthDate.getTime())) {
            setError("Geçersiz tarih formatı.");
            return;
        }

        const today = new Date();
        const months = calculateMonths(birthDate, today);

        if (months < 0) {
            setError("Doğum tarihi gelecekte olamaz.");
            return;
        }

        if (months < 37) {
            // 36 ayı tamamlamamış - Okul Öncesi olamaz
            setError(`Bu çocuk ${months} aylık. Henüz 36 ayı tamamlamamış, Okul Öncesi kaydı yapılamaz.`);
            return;
        }

        if (months > 78) {
            setError(`Bu çocuk ${months} aylık. 78 ayı geçmiş, 1. Sınıf olarak değerlendirilmelidir.`);
            return;
        }

        let label = "";
        if (months >= 37 && months <= 66) {
            label = "Okul Öncesi (37-66)";
        } else if (months >= 67 && months <= 78) {
            label = "Okul Öncesi (67-78)";
        }

        setResultInfo({ months, label });
    }

    function handleConfirm() {
        if (!resultInfo) return;
        onResult({ months: resultInfo.months, gradeLabel: resultInfo.label });
        // Reset
        setBirthDateStr("");
        setError("");
        setResultInfo(null);
    }

    function handleCancel() {
        onResult(null);
        setBirthDateStr("");
        setError("");
        setResultInfo(null);
        onClose();
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 space-y-4">
                <h2 className="text-lg font-bold text-center">🎂 Doğum Tarihi Girişi</h2>
                <p className="text-sm text-muted-foreground text-center">
                    Okul Öncesi kaydı için öğrencinin doğum tarihini giriniz. Aylık yaşına göre sınıflandırma yapılacaktır.
                </p>

                <div className="space-y-2">
                    <Label htmlFor="birthDate">Doğum Tarihi</Label>
                    <Input
                        id="birthDate"
                        type="date"
                        value={birthDateStr}
                        onChange={(e) => {
                            setBirthDateStr(e.target.value);
                            setError("");
                            setResultInfo(null);
                        }}
                        max={new Date().toISOString().split("T")[0]}
                    />
                </div>

                {error && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                        ⚠️ {error}
                    </div>
                )}

                {resultInfo && (
                    <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm space-y-1">
                        <div>✅ Çocuk <strong>{resultInfo.months} aylık</strong></div>
                        <div>📋 Sınıflandırma: <strong>{resultInfo.label}</strong></div>
                    </div>
                )}

                <div className="flex gap-2 pt-2">
                    {!resultInfo ? (
                        <>
                            <Button variant="outline" className="flex-1" onClick={handleCancel}>
                                İptal
                            </Button>
                            <Button className="flex-1" onClick={handleCalculate}>
                                Hesapla
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="outline" className="flex-1" onClick={handleCancel}>
                                İptal
                            </Button>
                            <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={handleConfirm}>
                                ✅ Onayla: {resultInfo.label}
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
