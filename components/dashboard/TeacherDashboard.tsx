import React, { useMemo, useState, useEffect } from "react";
import StatCard from "./StatCard";
import { CaseFile, Teacher, Announcement, PdfAppointment } from "@/types";
import { format, parseISO } from "date-fns";
import { tr } from "date-fns/locale/tr";
import {
    FilePlus,
    Users,
    Clock,
    Megaphone,
    CalendarDays,
    FileText,
    Target,
    ArrowRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTodayYmd } from "@/lib/date";

interface TeacherDashboardProps {
    cases: CaseFile[];
    teachers: Teacher[];
    history: Record<string, CaseFile[]>;
    announcements: Announcement[];
    pdfEntries?: PdfAppointment[];
}

export default function TeacherDashboard({
    cases,
    teachers,
    history,
    announcements,
    pdfEntries = []
}: TeacherDashboardProps) {
    const [greeting, setGreeting] = useState("");

    useEffect(() => {
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 12) setGreeting("Günaydın");
        else if (hour >= 12 && hour < 18) setGreeting("İyi Günler");
        else if (hour >= 18 && hour < 22) setGreeting("İyi Akşamlar");
        else setGreeting("İyi Geceler");
    }, []);

    const todayYmd = getTodayYmd();

    // --- Today's Stats ---
    const todayCasesCount = useMemo(() => {
        return cases.filter(c => c.createdAt.startsWith(todayYmd)).length;
    }, [cases, todayYmd]);

    const activeTeachersCount = useMemo(() => {
        return teachers.filter(t => t.active && !t.isAbsent).length;
    }, [teachers]);

    const absentTeachersCount = useMemo(() => {
        return teachers.filter(t => t.isAbsent).length;
    }, [teachers]);

    const lastCase = useMemo(() => {
        const allCases = [...cases].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return allCases.length > 0 ? allCases[0] : null;
    }, [cases]);

    // Today's Announcements
    const todayAnnouncements = useMemo(() => {
        return announcements.filter(a => a.createdAt.startsWith(todayYmd));
    }, [announcements, todayYmd]);

    // Recent activities (last 5 assignments)
    const recentAssignments = useMemo(() => {
        return [...cases]
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, 5)
            .map(c => ({
                id: c.id,
                student: c.student,
                teacher: teachers.find(t => t.id === c.assignedTo)?.name || "Bekliyor",
                time: c.createdAt,
            }));
    }, [cases, teachers]);

    // --- Pending/Unassigned PDF Entries ---
    const pendingEntries = useMemo(() => {
        // Filter entries that are not yet assigned
        return pdfEntries.filter(entry => {
            const inCases = cases.some(c => {
                const source = c.sourcePdfEntry;
                if (!source) return false;
                return source.id === entry.id || (
                    source.time === entry.time &&
                    source.name === entry.name &&
                    (source.fileNo || "") === (entry.fileNo || "")
                );
            });
            const inHistory = Object.values(history).some(dayCases =>
                dayCases.some(c => {
                    const source = c.sourcePdfEntry;
                    if (!source) return false;
                    return source.id === entry.id || (
                        source.time === entry.time &&
                        source.name === entry.name &&
                        (source.fileNo || "") === (entry.fileNo || "")
                    );
                })
            );
            return !inCases && !inHistory;
        });
    }, [pdfEntries, cases, history]);

    // --- Prediction Logic ---
    const predictedAssignments = useMemo(() => {
        // Get eligible teachers
        const eligibleTeachers = teachers.filter(t =>
            t.active &&
            !t.isAbsent &&
            !t.isPhysiotherapist &&
            !["Furkan Ata ADIYAMAN", "Furkan Ata"].includes(t.name) &&
            t.backupDay !== todayYmd
        );

        if (eligibleTeachers.length === 0 || pendingEntries.length === 0) return [];

        // Calculate current load for each teacher
        const todayCounts: Record<string, number> = {};
        cases.forEach(c => {
            if (c.assignedTo && !c.absencePenalty && c.createdAt.startsWith(todayYmd)) {
                todayCounts[c.assignedTo] = (todayCounts[c.assignedTo] || 0) + 1;
            }
        });

        // Sort teachers by: 1) yearly load, 2) today's count
        const sortedTeachers = [...eligibleTeachers].sort((a, b) => {
            const aLoad = a.yearlyLoad;
            const bLoad = b.yearlyLoad;
            if (aLoad !== bLoad) return aLoad - bLoad;

            const aToday = todayCounts[a.id] || 0;
            const bToday = todayCounts[b.id] || 0;
            return aToday - bToday;
        });

        // Simulate assignments for pending entries (max 5)
        const predictions: { entry: PdfAppointment; teacher: Teacher; position: number }[] = [];
        const simulatedCounts = { ...todayCounts };
        let lastAssignedIdx = -1;

        pendingEntries.slice(0, 5).forEach((entry, idx) => {
            // Find best teacher (rotation: avoid same teacher consecutively)
            let candidateTeachers = sortedTeachers.filter(t =>
                (simulatedCounts[t.id] || 0) < 2 // Daily limit
            );

            // Rotation: prefer different teacher
            if (candidateTeachers.length > 1 && lastAssignedIdx >= 0) {
                const lastTeacher = sortedTeachers[lastAssignedIdx];
                candidateTeachers = candidateTeachers.filter(t => t.id !== lastTeacher.id);
                if (candidateTeachers.length === 0) {
                    candidateTeachers = sortedTeachers.filter(t => (simulatedCounts[t.id] || 0) < 2);
                }
            }

            // Re-sort by simulated load
            candidateTeachers.sort((a, b) => {
                const aLoad = a.yearlyLoad + (simulatedCounts[a.id] || 0) * 5;
                const bLoad = b.yearlyLoad + (simulatedCounts[b.id] || 0) * 5;
                return aLoad - bLoad;
            });

            if (candidateTeachers.length > 0) {
                const chosen = candidateTeachers[0];
                predictions.push({ entry, teacher: chosen, position: idx + 1 });
                simulatedCounts[chosen.id] = (simulatedCounts[chosen.id] || 0) + 1;
                lastAssignedIdx = sortedTeachers.findIndex(t => t.id === chosen.id);
            }
        });

        return predictions;
    }, [teachers, cases, pendingEntries, todayYmd]);

    return (
        <div className="space-y-8 animate-fade-in-up p-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-700 to-emerald-600 bg-clip-text text-transparent">
                        {greeting} 👋
                    </h1>
                    <p className="text-slate-500 mt-1">Bugünkü RAM durumu hakkında bilgi edinin.</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full flex items-center gap-2">
                        <CalendarDays className="w-4 h-4" />
                        {format(new Date(), "d MMMM yyyy, EEEE", { locale: tr })}
                    </span>
                </div>
            </div>

            {/* Today's Announcements Banner */}
            {todayAnnouncements.length > 0 && (
                <div className="bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl p-5 text-white shadow-lg">
                    <div className="flex items-start gap-3">
                        <Megaphone className="w-6 h-6 flex-shrink-0 mt-0.5" />
                        <div>
                            <h3 className="font-bold mb-2">📢 Bugünkü Duyurular</h3>
                            <ul className="space-y-1 text-sm">
                                {todayAnnouncements.map(a => (
                                    <li key={a.id} className="flex items-start gap-2">
                                        <span className="text-amber-200">•</span>
                                        <span>{a.text}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Bugün Atanan Dosya"
                    value={todayCasesCount}
                    icon={<FilePlus className="w-6 h-6" />}
                    description="Toplam atama sayısı"
                    colorTheme="blue"
                />
                <StatCard
                    title="Aktif Öğretmen"
                    value={activeTeachersCount}
                    icon={<Users className="w-6 h-6" />}
                    description={`${absentTeachersCount} kişi devamsız`}
                    colorTheme="green"
                />
                <StatCard
                    title="Son Atama"
                    value={lastCase ? format(parseISO(lastCase.createdAt), "HH:mm") : "--:--"}
                    icon={<Clock className="w-6 h-6" />}
                    description={lastCase ? lastCase.student : "Henüz atama yok"}
                    colorTheme="purple"
                />
                <StatCard
                    title="Bekleyen Dosya"
                    value={pendingEntries.length}
                    icon={<Target className="w-6 h-6" />}
                    description="Atama bekliyor"
                    colorTheme="orange"
                />
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Recent Assignments */}
                <Card className="border shadow-md">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <FileText className="w-5 h-5 text-blue-500" />
                            Son Atamalar
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="divide-y">
                            {recentAssignments.map(item => (
                                <div key={item.id} className="py-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-slate-800">{item.student}</p>
                                        <p className="text-xs text-slate-500">→ {item.teacher}</p>
                                    </div>
                                    <span className="text-xs text-slate-400">
                                        {format(parseISO(item.time), "HH:mm")}
                                    </span>
                                </div>
                            ))}
                            {recentAssignments.length === 0 && (
                                <div className="py-6 text-center text-slate-400 text-sm">
                                    Henüz atama yapılmadı.
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Predicted Assignments */}
                <Card className="border shadow-md bg-gradient-to-br from-indigo-50 to-white">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Target className="w-5 h-5 text-indigo-500" />
                            Tahmini Atama Sırası
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {predictedAssignments.map(({ entry, teacher, position }) => (
                                <div key={entry.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-indigo-100 shadow-sm">
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-indigo-500 text-white font-bold text-sm">
                                        {position}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-slate-800 truncate">{entry.name}</p>
                                        <div className="flex items-center gap-1 text-xs text-slate-500">
                                            <span>{entry.time || "Saat yok"}</span>
                                            {entry.fileNo && <span>• {entry.fileNo}</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <ArrowRight className="w-4 h-4 text-indigo-400" />
                                        <span className="text-sm font-semibold text-indigo-600 truncate max-w-[100px]">
                                            {teacher.name}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {predictedAssignments.length === 0 && pendingEntries.length === 0 && (
                                <div className="py-6 text-center text-slate-400 text-sm">
                                    <Target className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                                    Bekleyen dosya yok.
                                </div>
                            )}
                            {predictedAssignments.length === 0 && pendingEntries.length > 0 && (
                                <div className="py-6 text-center text-slate-400 text-sm">
                                    <Target className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                                    Uygun öğretmen bulunamadı.
                                </div>
                            )}
                        </div>
                        {pendingEntries.length > 5 && (
                            <p className="text-xs text-center text-slate-400 mt-3">
                                +{pendingEntries.length - 5} dosya daha bekliyor
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Info Footer */}
            <div className="text-center text-xs text-slate-400 pt-4">
                Bu ekran bilgilendirme amaçlıdır. İşlem yapmak için yönetici girişi yapmanız gerekmektedir.
            </div>
        </div>
    );
}
