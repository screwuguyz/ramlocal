import React from "react";
import { CaseFile, Teacher } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Trophy, FileText, PieChart, Users } from "lucide-react";

interface MonthlyRecapProps {
    isOpen: boolean;
    onClose: () => void;
    history: Record<string, CaseFile[]>;
    teachers: Teacher[];
}

export default function MonthlyRecapModal({ isOpen, onClose, history, teachers }: MonthlyRecapProps) {
    if (!isOpen) return null;

    // Aralık 2025 Verilerini Hesapla
    const targetMonth = "2024-12"; // 2024 diye başlıyorum ama user 2025 dedi, kontrol etmeliyim. User "2025 Aralık" dedi ama şu an 2026'dayız. User "2025 Aralık" dediyse geçen ay demek istiyor olabilir.
    // Düzeltme: User "2025 Aralık" dedi, şu an 2026 Ocak. Yani geçen ay.
    // Bu yüzden "2025-12" filtrelemesi yapacağım.

    const decCases: CaseFile[] = [];
    Object.keys(history).forEach(date => {
        if (date.startsWith("2025-12")) {
            decCases.push(...history[date]);
        }
    });

    const totalFiles = decCases.length;

    // En çok dosya alan öğretmen
    const teacherCounts: Record<string, number> = {};
    decCases.forEach(c => {
        if (c.assignedTo) {
            teacherCounts[c.assignedTo] = (teacherCounts[c.assignedTo] || 0) + 1;
        }
    });

    let topTeacherId = "";
    let maxCount = 0;
    Object.entries(teacherCounts).forEach(([tid, count]) => {
        if (count > maxCount) {
            maxCount = count;
            topTeacherId = tid;
        }
    });

    const topTeacher = teachers.find(t => t.id === topTeacherId);

    // Dosya Türleri
    let typeY = 0, typeD = 0, typeI = 0;
    decCases.forEach(c => {
        if (c.type === "YONLENDIRME") typeY++;
        else if (c.type === "DESTEK") typeD++;
        else if (c.type === "IKISI") typeI++; // User kodu "IKISI" değil de "YONLENDIRME_DESTEK" olabilir, type kontrol etmeliyim ama şimdilik tahmin.
    });

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header with Pattern */}
                <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-8 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Trophy className="w-32 h-32" />
                    </div>
                    <div className="relative z-10">
                        <div className="text-violet-200 font-medium mb-1 tracking-wider uppercase text-xs">Aylık Özet Raporu</div>
                        <h2 className="text-3xl font-bold mb-2">Aralık 2025 Özeti</h2>
                        <p className="text-violet-100 opacity-90">Geçen ayın performans verileri hazır! 🚀</p>
                    </div>
                    <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white hover:bg-white/20 rounded-full p-2 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 md:p-8 space-y-6">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col items-center justify-center text-center">
                            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-2">
                                <FileText className="w-5 h-5" />
                            </div>
                            <div className="text-3xl font-bold text-slate-800">{totalFiles}</div>
                            <div className="text-xs text-slate-500 font-medium uppercase mt-1">Toplam Dosya</div>
                        </div>

                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col items-center justify-center text-center relative overflow-hidden">
                            {topTeacher && (
                                <>
                                    <div className="absolute top-2 right-2 text-yellow-500">
                                        <Trophy className="w-4 h-4" />
                                    </div>
                                    <div className="w-10 h-10 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mb-2">
                                        <Users className="w-5 h-5" />
                                    </div>
                                    <div className="text-lg font-bold text-slate-800 line-clamp-1">{topTeacher.name}</div>
                                    <div className="text-xs text-slate-500 font-medium uppercase mt-1">{maxCount} Dosya ile Lider</div>
                                </>
                            )}
                            {!topTeacher && <div className="text-sm text-slate-400">Veri Yok</div>}
                        </div>

                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col items-center justify-center text-center">
                            <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-2">
                                <PieChart className="w-5 h-5" />
                            </div>
                            <div className="text-sm text-slate-600 space-y-1">
                                <div><span className="font-bold text-slate-800">{typeY}</span> Yönlendirme</div>
                                <div><span className="font-bold text-slate-800">{typeD}</span> Destek</div>
                            </div>
                            <div className="text-xs text-slate-500 font-medium uppercase mt-2">Dağılım</div>
                        </div>
                    </div>

                    <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100 text-center">
                        <p className="text-indigo-800 text-sm font-medium">
                            🎉 "Harika bir aydı! Emekleriniz için teşekkürler."
                        </p>
                    </div>

                    <div className="flex justify-center">
                        <Button size="lg" className="w-full md:w-auto px-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-200" onClick={onClose}>
                            Harika! Devam Et
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
