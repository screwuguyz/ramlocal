// ============================================
// Dosya Atama Formu
// ============================================

"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Plus, Minus, FileText } from "lucide-react";
import type { CaseType } from "@/types";

interface CaseFormProps {
    onSubmit: (data: CaseFormData) => void;
    disabled?: boolean;
    initialData?: Partial<CaseFormData>;
}

export interface CaseFormData {
    student: string;
    fileNo: string;
    type: CaseType;
    isNew: boolean;
    diagCount: number;
    isTest: boolean;
    customDate?: string; // YYYY-MM-DD format for historical entries
}

export default function CaseForm({
    onSubmit,
    disabled = false,
    initialData,
}: CaseFormProps) {
    const [student, setStudent] = React.useState(initialData?.student || "");
    const [fileNo, setFileNo] = React.useState(initialData?.fileNo || "");
    const [type, setType] = React.useState<CaseType>(initialData?.type || "YONLENDIRME");
    const [isNew, setIsNew] = React.useState(initialData?.isNew || false);
    const [diagCount, setDiagCount] = React.useState(initialData?.diagCount || 0);
    const [isTest, setIsTest] = React.useState(initialData?.isTest || false);
    const [customDate, setCustomDate] = React.useState(initialData?.customDate || "");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!student.trim()) return;

        onSubmit({
            student: student.trim(),
            fileNo: fileNo.trim(),
            type,
            isNew,
            diagCount,
            isTest,
            customDate: customDate || undefined,
        });

        // Reset form
        setStudent("");
        setFileNo("");
        setType("YONLENDIRME");
        setIsNew(false);
        setDiagCount(0);
        setIsTest(false);
        // Keep customDate - user might want to add more entries for same date
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Row 1: Student name, file no, and date */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                    <Label htmlFor="case-student">Öğrenci Adı *</Label>
                    <Input
                        id="case-student"
                        placeholder="Öğrenci adı..."
                        value={student}
                        onChange={(e) => setStudent(e.target.value)}
                        disabled={disabled}
                        required
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="case-fileno">Dosya No</Label>
                    <Input
                        id="case-fileno"
                        placeholder="Örn: 2024-001"
                        value={fileNo}
                        onChange={(e) => setFileNo(e.target.value)}
                        disabled={disabled}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="case-date">
                        Tarih <span className="text-muted-foreground text-xs">(geçmiş tarih için)</span>
                    </Label>
                    <Input
                        id="case-date"
                        type="date"
                        value={customDate}
                        onChange={(e) => setCustomDate(e.target.value)}
                        disabled={disabled}
                        max={new Date().toISOString().split('T')[0]}
                    />
                </div>
            </div>

            {/* Row 2: Type and options */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                    <Label htmlFor="case-type">Dosya Türü</Label>
                    <Select
                        value={type}
                        onValueChange={(v) => setType(v as CaseType)}
                    >
                        <SelectTrigger id="case-type" disabled={disabled}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="YONLENDIRME">Yönlendirme</SelectItem>
                            <SelectItem value="DESTEK">Destek</SelectItem>
                            <SelectItem value="IKISI">İkisi</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-1.5">
                    <Label>Tanı Sayısı</Label>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            onClick={() => setDiagCount(Math.max(0, diagCount - 1))}
                            disabled={disabled || diagCount <= 0}
                        >
                            <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center font-semibold">{diagCount}</span>
                        <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            onClick={() => setDiagCount(Math.min(6, diagCount + 1))}
                            disabled={disabled || diagCount >= 6}
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <div className="flex flex-col justify-end gap-2">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="case-new"
                                checked={isNew}
                                onCheckedChange={(checked) => setIsNew(checked === true)}
                                disabled={disabled}
                            />
                            <Label htmlFor="case-new" className="text-sm cursor-pointer">
                                Yeni
                            </Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="case-test"
                                checked={isTest}
                                onCheckedChange={(checked) => setIsTest(checked === true)}
                                disabled={disabled}
                            />
                            <Label htmlFor="case-test" className="text-sm cursor-pointer">
                                Test
                            </Label>
                        </div>
                    </div>
                </div>
            </div>

            {/* Submit button */}
            <div className="flex justify-end">
                <Button
                    type="submit"
                    disabled={!student.trim() || disabled}
                    className="min-w-[140px]"
                >
                    <FileText className="h-4 w-4 mr-2" />
                    Dosya Ata
                </Button>
            </div>
        </form>
    );
}
