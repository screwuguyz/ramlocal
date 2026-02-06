"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Activity,
    Server,
    HardDrive,
    Clock,
    Database,
    FileText,
    RefreshCw,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    Mail,
    Loader2
} from "lucide-react";

interface HealthData {
    status: string;
    timestamp: string;
    server: {
        startTime: string;
        uptime: {
            days: number;
            hours: number;
            minutes: number;
            seconds: number;
            formatted: string;
        };
        memory: {
            heapUsed: string;
            heapTotal: string;
            rss: string;
            heapUsedPercent: number;
        };
        node: {
            version: string;
            platform: string;
            pid: number;
        };
    };
    data: {
        stateFile: {
            exists: boolean;
            size: string;
            lastModified: string | null;
        };
        pdfFolder: {
            exists: boolean;
            fileCount: number;
        };
    };
    checks: {
        serverRunning: boolean;
        dataAccessible: boolean;
        memoryHealthy: boolean;
        overall: "HEALTHY" | "WARNING" | "ERROR";
    };
}

export default function HealthStatus() {
    const [health, setHealth] = useState<HealthData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [testingEmail, setTestingEmail] = useState(false);
    const [emailResult, setEmailResult] = useState<string | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(true);

    const fetchHealth = useCallback(async () => {
        try {
            const res = await fetch("/api/health", { cache: "no-store" });
            if (!res.ok) throw new Error("Health check failed");
            const data = await res.json();
            setHealth(data);
            setError(null);
        } catch (err: any) {
            setError(err.message || "Bağlantı hatası");
            setHealth(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchHealth();
    }, [fetchHealth]);

    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(fetchHealth, 10000); // 10 saniyede bir
        return () => clearInterval(interval);
    }, [autoRefresh, fetchHealth]);

    const handleTestEmail = async () => {
        setTestingEmail(true);
        setEmailResult(null);
        try {
            const res = await fetch("/api/health", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "test-email" })
            });
            const data = await res.json();
            setEmailResult(data.success ? `✅ ${data.message}` : `❌ ${data.message}`);
        } catch (err: any) {
            setEmailResult(`❌ Hata: ${err.message}`);
        } finally {
            setTestingEmail(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "HEALTHY": return "text-emerald-600";
            case "WARNING": return "text-amber-600";
            case "ERROR": return "text-red-600";
            default: return "text-slate-600";
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "HEALTHY": return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
            case "WARNING": return <AlertTriangle className="w-5 h-5 text-amber-500" />;
            case "ERROR": return <XCircle className="w-5 h-5 text-red-500" />;
            default: return <Activity className="w-5 h-5 text-slate-500" />;
        }
    };

    const getMemoryBarColor = (percent: number) => {
        if (percent < 50) return "bg-emerald-500";
        if (percent < 75) return "bg-amber-500";
        return "bg-red-500";
    };

    if (loading && !health) {
        return (
            <Card className="border-slate-200">
                <CardContent className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                    <span className="ml-3 text-slate-500">Sunucu durumu kontrol ediliyor...</span>
                </CardContent>
            </Card>
        );
    }

    if (error && !health) {
        return (
            <Card className="border-red-200 bg-red-50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-700">
                        <XCircle className="w-5 h-5" />
                        Sunucu Erişilemiyor
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-red-600 mb-4">{error}</p>
                    <Button onClick={fetchHealth} variant="outline" size="sm">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Tekrar Dene
                    </Button>
                </CardContent>
            </Card>
        );
    }

    if (!health) return null;

    return (
        <Card className="border-slate-200 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Server className="w-5 h-5 text-indigo-600" />
                        Sunucu Durumu
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${health.checks.overall === "HEALTHY"
                            ? "bg-emerald-100 text-emerald-700"
                            : health.checks.overall === "WARNING"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-red-100 text-red-700"
                            }`}>
                            {getStatusIcon(health.checks.overall)}
                            {health.checks.overall === "HEALTHY" ? "Sağlıklı" : health.checks.overall === "WARNING" ? "Uyarı" : "Hata"}
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={fetchHealth}
                            disabled={loading}
                            className="h-8 w-8 p-0"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                        </Button>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
                {/* Uptime */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-3 text-center">
                        <Clock className="w-5 h-5 text-indigo-600 mx-auto mb-1" />
                        <div className="text-2xl font-bold text-indigo-700">{health.server.uptime.days}</div>
                        <div className="text-xs text-indigo-600">Gün</div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-3 text-center">
                        <Clock className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                        <div className="text-2xl font-bold text-purple-700">{health.server.uptime.hours}</div>
                        <div className="text-xs text-purple-600">Saat</div>
                    </div>
                    <div className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-xl p-3 text-center">
                        <Clock className="w-5 h-5 text-pink-600 mx-auto mb-1" />
                        <div className="text-2xl font-bold text-pink-700">{health.server.uptime.minutes}</div>
                        <div className="text-xs text-pink-600">Dakika</div>
                    </div>
                    <div className="bg-gradient-to-br from-rose-50 to-rose-100 rounded-xl p-3 text-center">
                        <Clock className="w-5 h-5 text-rose-600 mx-auto mb-1" />
                        <div className="text-2xl font-bold text-rose-700">{health.server.uptime.seconds}</div>
                        <div className="text-xs text-rose-600">Saniye</div>
                    </div>
                </div>

                {/* Memory & Data */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Memory */}
                    <div className="border rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <HardDrive className="w-4 h-4 text-slate-600" />
                            <span className="font-medium text-slate-700">Bellek Kullanımı</span>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Heap</span>
                                <span className="font-medium">{health.server.memory.heapUsed} / {health.server.memory.heapTotal}</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all ${getMemoryBarColor(health.server.memory.heapUsedPercent)}`}
                                    style={{ width: `${health.server.memory.heapUsedPercent}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-xs text-slate-500">
                                <span>RSS: {health.server.memory.rss}</span>
                                <span>%{health.server.memory.heapUsedPercent}</span>
                            </div>
                        </div>
                    </div>

                    {/* Data Files */}
                    <div className="border rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Database className="w-4 h-4 text-slate-600" />
                            <span className="font-medium text-slate-700">Veri Durumu</span>
                        </div>
                        <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-500">state.json</span>
                                <span className={`flex items-center gap-1 ${health.data.stateFile.exists ? "text-emerald-600" : "text-red-600"}`}>
                                    {health.data.stateFile.exists ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                    {health.data.stateFile.size}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-500">PDF Kayıtları</span>
                                <span className={`flex items-center gap-1 ${health.data.pdfFolder.exists ? "text-emerald-600" : "text-slate-400"}`}>
                                    <FileText className="w-3.5 h-3.5" />
                                    {health.data.pdfFolder.fileCount} dosya
                                </span>
                            </div>
                            {health.data.stateFile.lastModified && (
                                <div className="text-xs text-slate-400 pt-1 border-t">
                                    Son güncelleme: {new Date(health.data.stateFile.lastModified).toLocaleString("tr-TR")}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* System Info & Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t">
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>Node {health.server.node.version}</span>
                        <span>PID: {health.server.node.pid}</span>
                        <span className="hidden sm:inline">Platform: {health.server.node.platform}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleTestEmail}
                            disabled={testingEmail}
                            className="h-8"
                        >
                            {testingEmail ? (
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            ) : (
                                <Mail className="w-4 h-4 mr-1" />
                            )}
                            Email Test
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={async () => {
                                if (!confirm("Sunucuyu yeniden başlatmak istediğinizden emin misiniz?\n\nSayfa birkaç saniye içinde yeniden yüklenecek.")) return;
                                try {
                                    const res = await fetch("/api/restart", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ action: "restart" })
                                    });
                                    const data = await res.json();
                                    if (data.success) {
                                        alert("Sunucu yeniden başlatılıyor...\n\n3 saniye sonra sayfa yenilenecek.");
                                        setTimeout(() => window.location.reload(), 5000);
                                    } else {
                                        alert("Hata: " + (data.error || "Bilinmeyen hata"));
                                    }
                                } catch (err: any) {
                                    alert("Restart hatası: " + err.message);
                                }
                            }}
                            className="h-8"
                        >
                            <RefreshCw className="w-4 h-4 mr-1" />
                            Yeniden Başlat
                        </Button>
                        <Button
                            variant={autoRefresh ? "default" : "outline"}
                            size="sm"
                            onClick={() => setAutoRefresh(!autoRefresh)}
                            className="h-8"
                        >
                            <RefreshCw className={`w-4 h-4 mr-1 ${autoRefresh ? "animate-spin" : ""}`} />
                            {autoRefresh ? "Otomatik" : "Manuel"}
                        </Button>
                    </div>
                </div>

                {/* Email Result */}
                {emailResult && (
                    <div className={`text-sm p-2 rounded-lg ${emailResult.startsWith("✅") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                        }`}>
                        {emailResult}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
