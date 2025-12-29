"use client";

import { useCallback } from "react";
import { useQueueSync } from "@/hooks/useQueueSync";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Check, RefreshCw, Trash2, Megaphone, Printer } from "lucide-react";
import Link from "next/link";

export default function QueueWidget() {
    // YENİ: Dedicated queue sync hook kullan
    const {
        waitingTickets,
        calledTickets,
        currentTicket: activeTicket,
        callTicket,
        completeTicket,
        clearAll,
        refresh
    } = useQueueSync();

    // Bilet çağırma
    const handleCall = useCallback(async (id: string) => {
        console.log("[QueueWidget] Calling ticket:", id);
        await callTicket(id, "admin");
    }, [callTicket]);

    // Tekrar anons
    const handleRecall = useCallback(async () => {
        if (activeTicket) {
            await callTicket(activeTicket.id, activeTicket.calledBy);
        }
    }, [activeTicket, callTicket]);

    // Tamamla
    const handleComplete = useCallback(async (id: string) => {
        await completeTicket(id);
    }, [completeTicket]);

    // Sıfırla
    const handleResetQueue = useCallback(async () => {
        if (confirm("Tüm sıra silinecek. Emin misiniz?")) {
            await clearAll();
        }
    }, [clearAll]);

    return (
        <Card className="h-full border-l-4 border-l-purple-500 shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Megaphone className="w-5 h-5 text-purple-600" />
                    Dijital Sıramatik
                </CardTitle>
                <div className="flex gap-1">
                    <Link href="/admin/qrcode" target="_blank" title="Karekod Posteri Yazdır">
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-blue-500">
                            <Printer className="w-4 h-4" />
                        </Button>
                    </Link>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-red-500" onClick={handleResetQueue} title="Sırayı Sıfırla">
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* AKTİF BİLET */}
                {activeTicket ? (
                    <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 text-center space-y-3 relative overflow-hidden">
                        <div className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-1 rounded absolute top-2 right-2">
                            ÇAĞRILDI
                        </div>
                        <div>
                            <div className="text-4xl font-black text-slate-900">{activeTicket.no}</div>
                            <div className="text-sm font-medium text-slate-600 truncate px-2">{activeTicket.name || "Misafir"}</div>
                        </div>
                        <div className="flex justify-center gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                className="bg-white hover:bg-purple-100 border-purple-200 text-purple-700"
                                onClick={handleRecall}
                            >
                                <RefreshCw className="w-4 h-4 mr-1" /> Tekrar
                            </Button>
                            <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white"
                                onClick={() => handleComplete(activeTicket.id)}
                            >
                                <Check className="w-4 h-4 mr-1" /> Tamamla
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center text-slate-400 text-sm">
                        Henüz çağrılan yok
                    </div>
                )}

                {/* BEKLEYENLER */}
                <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex justify-between items-center">
                        <span>Bekleyenler ({waitingTickets.length})</span>
                    </div>

                    <div className="max-h-[180px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                        {waitingTickets.length === 0 ? (
                            <div className="text-center text-slate-400 text-sm py-4 italic">
                                Sırada kimse yok
                            </div>
                        ) : (
                            waitingTickets.map(ticket => (
                                <div key={ticket.id} className="flex items-center justify-between p-2 bg-white border border-slate-100 rounded-lg hover:border-purple-200 transition-colors shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-slate-100 text-slate-700 font-bold w-8 h-8 flex items-center justify-center rounded-full text-sm">
                                            {ticket.no}
                                        </div>
                                        <div className="text-sm font-medium text-slate-700 truncate w-24">
                                            {ticket.name || "Misafir"}
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        className="h-7 bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
                                        onClick={() => handleCall(ticket.id)}
                                    >
                                        <Play className="w-3 h-3 mr-1" /> ÇAĞIR
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
