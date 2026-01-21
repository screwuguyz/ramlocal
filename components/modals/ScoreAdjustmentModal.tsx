"use client";

import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Teacher } from "@/types";

interface ScoreAdjustmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    targetTeacher: Teacher | null;
    allTeachers: Teacher[];
    onConfirm: (delta: number, reason: string) => void;
}

type AdjustmentMode = "min_relative" | "avg_relative" | "fixed";

export default function ScoreAdjustmentModal({
    isOpen,
    onClose,
    targetTeacher,
    allTeachers,
    onConfirm,
}: ScoreAdjustmentModalProps) {
    const [mode, setMode] = useState<AdjustmentMode>("min_relative");
    const [offset, setOffset] = useState<string>("5"); // Default offset (e.g. Min - 5)
    const [fixedValue, setFixedValue] = useState<string>("");

    // Calculate Statistics (Active & Present teachers only)
    const stats = useMemo(() => {
        if (!targetTeacher) return { min: 0, avg: 0, max: 0, count: 0 };

        // Filter: Active, Not the target teacher, Not absent (optional)
        const activeTeachers = allTeachers.filter(t => t.active && t.id !== targetTeacher.id);

        if (activeTeachers.length === 0) return { min: 0, avg: 0, max: 0, count: 0 };

        const loads = activeTeachers.map(t => t.yearlyLoad);
        const min = Math.min(...loads);
        const max = Math.max(...loads);
        const sum = loads.reduce((a, b) => a + b, 0);
        const avg = Math.round(sum / activeTeachers.length);

        return { min, avg, max, count: activeTeachers.length };
    }, [allTeachers, targetTeacher]);

    // Calculate Proposed New Score based on inputs
    const proposedScore = useMemo(() => {
        if (!targetTeacher) return 0;
        const off = parseInt(offset) || 0;
        if (mode === "min_relative") return Math.max(0, stats.min - off);
        if (mode === "avg_relative") return Math.max(0, stats.avg - off);
        if (mode === "fixed") return parseInt(fixedValue) || 0;
        return targetTeacher.yearlyLoad;
    }, [mode, offset, fixedValue, stats, targetTeacher]);

    if (!targetTeacher) return null;

    const delta = proposedScore - targetTeacher.yearlyLoad;

    const handleConfirm = () => {
        let reason = "";
        if (mode === "min_relative") reason = `En Düşük (${stats.min}) - ${offset} Puan`;
        else if (mode === "avg_relative") reason = `Ortalama (${stats.avg}) - ${offset} Puan`;
        else reason = `Manuel Puan Ayarı: ${proposedScore}`;

        onConfirm(delta, reason);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Puan Denkleştirme: {targetTeacher.name}</DialogTitle>
                    <DialogDescription>
                        Uzun süreli izin dönüşlerinde öğretmenin puanını diğerleriyle dengelemek için kullanın.
                        Bu işlem mevcut puanın üzerine ekleme/çıkarma yapacaktır.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="p-4 bg-muted rounded-md space-y-1 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Mevcut Puan:</span>
                            <span className="font-bold">{targetTeacher.yearlyLoad}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Aktif Öğrt. En Düşük:</span>
                            <span>{stats.min}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Aktif Öğrt. Ortalama:</span>
                            <span>{stats.avg}</span>
                        </div>
                    </div>

                    <RadioGroup value={mode} onValueChange={(v) => setMode(v as AdjustmentMode)} className="gap-4">
                        {/* Option 1: Min Relative */}
                        <div className="flex items-start space-x-2 border p-3 rounded-md hover:bg-accent/50 transition-colors">
                            <RadioGroupItem value="min_relative" id="min_relative" className="mt-1" />
                            <div className="grid gap-1.5 flex-1">
                                <Label htmlFor="min_relative" className="font-semibold cursor-pointer">
                                    En Düşük Puana Göre
                                </Label>
                                <p className="text-xs text-muted-foreground">En düşük puandan X puan daha az olsun.</p>
                                {mode === "min_relative" && (
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="text-sm">En Düşük ({stats.min}) - </span>
                                        <Input
                                            type="number"
                                            value={offset}
                                            onChange={e => setOffset(e.target.value)}
                                            className="w-20 h-8"
                                        />
                                        <span className="text-sm font-bold text-primary">= {Math.max(0, stats.min - (parseInt(offset) || 0))}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Option 2: Avg Relative */}
                        <div className="flex items-start space-x-2 border p-3 rounded-md hover:bg-accent/50 transition-colors">
                            <RadioGroupItem value="avg_relative" id="avg_relative" className="mt-1" />
                            <div className="grid gap-1.5 flex-1">
                                <Label htmlFor="avg_relative" className="font-semibold cursor-pointer">
                                    Ortalamaya Göre
                                </Label>
                                <p className="text-xs text-muted-foreground">Ortalamadan X puan daha az olsun.</p>
                                {mode === "avg_relative" && (
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="text-sm">Ortalama ({stats.avg}) - </span>
                                        <Input
                                            type="number"
                                            value={offset}
                                            onChange={e => setOffset(e.target.value)}
                                            className="w-20 h-8"
                                        />
                                        <span className="text-sm font-bold text-primary">= {Math.max(0, stats.avg - (parseInt(offset) || 0))}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Option 3: Fixed */}
                        <div className="flex items-start space-x-2 border p-3 rounded-md hover:bg-accent/50 transition-colors">
                            <RadioGroupItem value="fixed" id="fixed" className="mt-1" />
                            <div className="grid gap-1.5 flex-1">
                                <Label htmlFor="fixed" className="font-semibold cursor-pointer">
                                    Sabit Değer
                                </Label>
                                <p className="text-xs text-muted-foreground">Puanı doğrudan elle belirleyin.</p>
                                {mode === "fixed" && (
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="text-sm">Yeni Puan:</span>
                                        <Input
                                            type="number"
                                            value={fixedValue}
                                            onChange={e => setFixedValue(e.target.value)}
                                            placeholder="Örn: 102"
                                            className="w-24 h-8"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </RadioGroup>

                    <div className="bg-primary/10 p-3 rounded-md text-sm flex justify-between items-center border border-primary/20">
                        <span className="font-semibold text-primary">Yapılacak Değişim (Fark):</span>
                        <span className={`font-bold text-lg ${delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {delta > 0 ? "+" : ""}{delta} Puan
                        </span>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>İptal</Button>
                    <Button onClick={handleConfirm} disabled={isNaN(proposedScore)}>
                        Uygula
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
