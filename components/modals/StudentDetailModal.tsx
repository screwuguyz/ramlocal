
import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { CaseFile } from "@/types";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

interface StudentDetailModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    studentName: string;
    fileNo?: string;
    history: CaseFile[];
}

export default function StudentDetailModal({
    open,
    onOpenChange,
    studentName,
    fileNo,
    history,
    variant = "dialog"
}: StudentDetailModalProps & { variant?: "dialog" | "absolute" }) {
    // Sort by date descending (newest first)
    const sortedHistory = [...history].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Helper: Get educational stage label based on grade
    const getStageLabel = (grade?: string): string => {
        if (!grade) return "";
        if (grade === "Okul Öncesi") return "Okul Öncesi";
        if (grade === "Halk Eğitim") return "Halk Eğitim";
        if (["1. Sınıf", "2. Sınıf", "3. Sınıf", "4. Sınıf"].includes(grade)) return "İlkokul";
        if (["5. Sınıf", "6. Sınıf", "7. Sınıf", "8. Sınıf"].includes(grade)) return "Ortaokul";
        if (["9. Sınıf", "10. Sınıf", "11. Sınıf", "12. Sınıf"].includes(grade)) return "Lise";
        return "";
    };

    // Helper: Format type display with stage prefix for guidance
    const formatTypeDisplay = (type: string, grade?: string): string => {
        const stageLabel = getStageLabel(grade);

        if (type === "YONLENDIRME") {
            return stageLabel ? `${stageLabel} Yönlendirme` : "Yönlendirme";
        } else if (type === "IKISI") {
            return stageLabel ? `${stageLabel} Yönlendirme + Destek` : "Yönlendirme + Destek";
        } else if (type === "DESTEK") {
            return "Destek";
        }
        return type;
    };

    const Content = (
        <div className="flex flex-col h-full">
            <div className="flex flex-col gap-1 mb-4">
                <span className="text-xl font-bold">{studentName}</span>
                {fileNo && <span className="text-sm font-normal text-muted-foreground">Dosya No: {fileNo}</span>}
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
                <h3 className="text-sm font-medium mb-4 text-muted-foreground">Öğrenci Geçmişi</h3>

                {sortedHistory.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        Geçmiş kayıt bulunamadı.
                    </div>
                ) : (
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Tarih</TableHead>
                                    <TableHead>Sınıf</TableHead>
                                    <TableHead>İşlem</TableHead>
                                    <TableHead>Puan</TableHead>
                                    <TableHead className="text-right">Durum</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedHistory.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-medium">
                                            {format(new Date(item.createdAt), "d MMMM yyyy", { locale: tr })}
                                        </TableCell>
                                        <TableCell>
                                            {item.grade || <span className="text-muted-foreground italic">-</span>}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span>{formatTypeDisplay(item.type, item.grade)}</span>
                                                {item.assignReason && (
                                                    <span className="text-xs text-muted-foreground">{item.assignReason}</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>{item.score}</TableCell>
                                        <TableCell className="text-right">
                                            {item.isTest ? (
                                                <Badge variant="secondary">Test</Badge>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">Normal</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>
        </div>
    );

    if (variant === "absolute") {
        if (!open) return null;
        return (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[1px] rounded-xl p-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="relative w-full h-full max-w-4xl bg-white rounded-lg shadow-2xl flex flex-col p-6 animate-in slide-in-from-bottom-2">
                    <button
                        onClick={() => onOpenChange(false)}
                        className="absolute right-4 top-4 p-2 rounded-full hover:bg-slate-100 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x h-5 w-5 text-slate-500"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                    </button>
                    {Content}
                </div>
            </div>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-full max-w-3xl max-h-[85vh] overflow-y-auto bg-white text-slate-900 border-slate-200 shadow-xl p-6">
                {/* Header ve title dialog içinde ayrıca render edilebilir ama içerik ortak */}
                {Content}
            </DialogContent>
        </Dialog>
    );
}
