import React, { useMemo, useState, useEffect } from "react";
import StatCard from "./StatCard";
import { CaseFile, Teacher, Announcement } from "@/types";
import { format, isSameDay, parseISO } from "date-fns";
import { tr } from "date-fns/locale/tr";
import {
    FilePlus,
    Users,
    Activity,
    Clock,
    Megaphone,
    CalendarDays,
    FileText,
    Search,
    ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTodayYmd } from "@/lib/date";

interface DashboardHomeProps {
    cases: CaseFile[];
    teachers: Teacher[];
    history: Record<string, CaseFile[]>;
    announcements: Announcement[];
    onNavigate: (tabId: string) => void;
    onNewFile: () => void;
    onAnnounce: () => void;
}

export default function DashboardHome({
    cases,
    teachers,
    history,
    announcements,
    onNavigate,
    onNewFile,
    onAnnounce
}: DashboardHomeProps) {
    const [greeting, setGreeting] = useState("");

    useEffect(() => {
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 12) setGreeting("Günaydın");
        else if (hour >= 12 && hour < 18) setGreeting("İyi Günler");
        else if (hour >= 18 && hour < 22) setGreeting("İyi Akşamlar");
        else setGreeting("İyi Geceler");
    }, []);

    // --- Metrics Calculation ---
    const todayYmd = getTodayYmd();

    const todayCasesCount = useMemo(() => {
        return cases.filter(c => c.createdAt.startsWith(todayYmd)).length;
    }, [cases, todayYmd]);

    const activeTeachersCount = useMemo(() => {
        return teachers.filter(t => t.active && !t.isAbsent).length;
    }, [teachers]);

    const totalTeachersCount = teachers.length;

    const lastCase = useMemo(() => {
        const allCases = [...cases].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return allCases.length > 0 ? allCases[0] : null;
    }, [cases]);

    // System Load (Conceptual: active teachers * daily limit (2) vs today's cases)
    const systematicLoad = useMemo(() => {
        const capacity = activeTeachersCount * 2; // Assuming limit is 2
        if (capacity === 0) return 100;
        const load = Math.round((todayCasesCount / capacity) * 100);
        return Math.min(load, 100);
    }, [activeTeachersCount, todayCasesCount]);

    const lastActivities = useMemo(() => {
        // Combine recent cases and announcements for a "feed"
        const recentCases = [...cases]
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, 5)
            .map(c => ({
                id: c.id,
                type: "case",
                title: `Yeni Dosya: ${c.student}`,
                desc: `${c.assignedTo ? "Atanan: " + teachers.find(t => t.id === c.assignedTo)?.name : "Bekliyor"}`,
                time: c.createdAt,
                icon: <FilePlus className="w-4 h-4 text-blue-500" />
            }));

        const recentAnnouncements = [...announcements]
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, 3)
            .map(a => ({
                id: a.id,
                type: "announcement",
                title: "Duyuru Yayınlandı",
                desc: a.text,
                time: a.createdAt,
                icon: <Megaphone className="w-4 h-4 text-orange-500" />
            }));

        return [...recentCases, ...recentAnnouncements]
            .sort((a, b) => b.time.localeCompare(a.time))
            .slice(0, 5);
    }, [cases, announcements, teachers]);


    return (
        <div className="space-y-8 animate-fade-in-up">
            {/* 1. Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                        {greeting}, Yönetici 👋
                    </h1>
                    <p className="text-slate-500 mt-1">İşte bugünkü RAM operasyon özeti.</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full flex items-center gap-2">
                        <CalendarDays className="w-4 h-4" />
                        {format(new Date(), "d MMMM yyyy, EEEE", { locale: tr })}
                    </span>
                </div>
            </div>

            {/* 2. Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Bugün Atanan"
                    value={todayCasesCount}
                    icon={<FilePlus className="w-6 h-6" />}
                    description="Bekleyen dosya yok"
                    colorTheme="blue"
                    trend="+2"
                    trendDirection="up"
                    onClick={() => onNavigate("files")}
                />
                <StatCard
                    title="Aktif Öğretmen"
                    value={`${activeTeachersCount} / ${totalTeachersCount}`}
                    icon={<Users className="w-6 h-6" />}
                    description={`${totalTeachersCount - activeTeachersCount} kişi devamsız/pasif`}
                    colorTheme="purple"
                    onClick={() => onNavigate("teachers")}
                />
                <StatCard
                    title="Sistem Yükü"
                    value={`%${systematicLoad}`}
                    icon={<Activity className="w-6 h-6" />}
                    description="Günlük kapasite doluluk oranı"
                    colorTheme={systematicLoad > 80 ? "orange" : "green"}
                    trend={systematicLoad > 80 ? "Yüksek" : "Normal"}
                    trendDirection={systematicLoad > 80 ? "up" : "neutral"}
                />
                <StatCard
                    title="Son İşlem"
                    value={lastCase ? format(parseISO(lastCase.createdAt), "HH:mm") : "--:--"}
                    icon={<Clock className="w-6 h-6" />}
                    description={lastCase ? `${lastCase.student} atandı` : "Henüz işlem yok"}
                    colorTheme="pink"
                    onClick={() => onNavigate("reports")}
                />
            </div>

            {/* 3. Main Content Split */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left: Quick Actions & Navigation */}
                <div className="lg:col-span-2 space-y-6">
                    <h2 className="text-xl font-semibold text-slate-800">Hızlı İşlemler</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        <Button
                            size="lg"
                            className="h-auto py-6 flex flex-col items-center gap-2 bg-gradient-to-br from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 shadow-lg shadow-indigo-200"
                            onClick={onNewFile}
                        >
                            <FilePlus className="w-8 h-8" />
                            <span>Yeni Dosya Ekle</span>
                        </Button>

                        <Button
                            size="lg"
                            variant="outline"
                            className="h-auto py-6 flex flex-col items-center gap-2 border-2 hover:bg-slate-50 hover:border-slate-300"
                            onClick={onAnnounce}
                        >
                            <Megaphone className="w-8 h-8 text-orange-500" />
                            <span>Duyuru Gönder</span>
                        </Button>

                        <Button
                            size="lg"
                            variant="outline"
                            className="h-auto py-6 flex flex-col items-center gap-2 border-2 hover:bg-slate-50 hover:border-slate-300"
                            onClick={() => onNavigate("reports")}
                        >
                            <FileText className="w-8 h-8 text-emerald-500" />
                            <span>Raporları İncele</span>
                        </Button>
                    </div>

                    {/* Banner / Info Area */}
                    <div className="bg-gradient-to-r from-teal-500 to-emerald-600 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden group cursor-pointer transition-transform hover:scale-[1.01]" onClick={() => onNavigate("reports")}>
                        <div className="relative z-10">
                            <h3 className="text-lg font-bold mb-2">Aylık Rapor Hazır mı?</h3>
                            <p className="text-teal-100 max-w-md mb-4">Bu ayın dosya dağılımlarını ve öğretmen performanslarını incelemek için raporlar sekmesine göz atın.</p>
                            <div className="flex items-center text-sm font-semibold bg-white/20 w-fit px-3 py-1.5 rounded-lg hover:bg-white/30 transition-colors">
                                Raporlara Git <ArrowRight className="w-4 h-4 ml-2" />
                            </div>
                        </div>
                        {/* Decor */}
                        <FileText className="absolute -bottom-6 -right-6 w-40 h-40 text-white opacity-10 rotate-12 group-hover:rotate-0 transition-transform duration-500" />
                    </div>
                </div>

                {/* Right: Recent Activity Feed */}
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-slate-800">Son Hareketler</h2>
                    <Card className="border-0 shadow-lg bg-white/80 backdrop-blur">
                        <CardContent className="p-0">
                            <div className="divide-y">
                                {lastActivities.map(item => (
                                    <div key={item.id} className="p-4 flex gap-3 hover:bg-slate-50 transition-colors">
                                        <div className="mt-1 bg-slate-100 p-2 rounded-full h-fit">
                                            {item.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-900 truncate">{item.title}</p>
                                            <p className="text-xs text-slate-500 truncate">{item.desc}</p>
                                        </div>
                                        <div className="text-xs text-slate-400 whitespace-nowrap">
                                            {format(parseISO(item.time), "HH:mm")}
                                        </div>
                                    </div>
                                ))}
                                {lastActivities.length === 0 && (
                                    <div className="p-8 text-center text-slate-400 text-sm">
                                        Henüz bir hareket yok.
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

            </div>
        </div>
    );
}
