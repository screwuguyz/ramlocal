"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Music, Play, Pause, Tv, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function MusicControlPage() {
    const [musicUrl, setMusicUrl] = useState("");
    const [isPlaying, setIsPlaying] = useState(false);
    const [sending, setSending] = useState(false);

    const sendMusicUpdate = async (url: string, playing: boolean) => {
        setSending(true);
        try {
            const channel = supabase.channel('music_state');
            await channel.send({
                type: 'broadcast',
                event: 'music_update',
                payload: { url, playing }
            });
            console.log("[Admin] Music update sent:", { url, playing });
        } catch (err) {
            console.error("[Admin] Music update error:", err);
        } finally {
            setSending(false);
        }
    };

    const handlePlay = async () => {
        if (!musicUrl.trim()) {
            alert("Lütfen bir YouTube URL'si girin");
            return;
        }
        setIsPlaying(true);
        await sendMusicUpdate(musicUrl, true);
    };

    const handlePause = async () => {
        setIsPlaying(false);
        await sendMusicUpdate(musicUrl, false);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
            <div className="max-w-2xl mx-auto space-y-6">
                {/* Geri Butonu */}
                <Link href="/" className="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                    <span>Admin Panele Dön</span>
                </Link>

                {/* Ana Kart */}
                <Card className="bg-white/10 border-purple-500/30 backdrop-blur-xl">
                    <CardHeader className="border-b border-white/10">
                        <CardTitle className="flex items-center gap-3 text-white">
                            <div className="p-2 bg-purple-500/20 rounded-lg">
                                <Music className="w-6 h-6 text-purple-300" />
                            </div>
                            TV Müzik Kontrolü
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-6">
                        {/* URL Input */}
                        <div className="space-y-2">
                            <label className="text-white/80 text-sm font-medium">YouTube URL</label>
                            <Input
                                placeholder="https://www.youtube.com/watch?v=..."
                                value={musicUrl}
                                onChange={(e) => setMusicUrl(e.target.value)}
                                className="bg-white/5 border-white/20 text-white placeholder:text-white/40 h-12"
                            />
                            <p className="text-white/50 text-xs">
                                YouTube video veya canlı yayın URL'si yapıştırın
                            </p>
                        </div>

                        {/* Kontrol Butonları */}
                        <div className="flex gap-4">
                            <Button
                                onClick={handlePlay}
                                disabled={sending || !musicUrl.trim()}
                                className="flex-1 h-14 text-lg bg-green-600 hover:bg-green-700 disabled:bg-green-900"
                            >
                                <Play className="w-5 h-5 mr-2" />
                                {sending ? "Gönderiliyor..." : "Çal"}
                            </Button>
                            <Button
                                onClick={handlePause}
                                disabled={sending}
                                variant="outline"
                                className="flex-1 h-14 text-lg border-red-500/50 text-red-400 hover:bg-red-500/10"
                            >
                                <Pause className="w-5 h-5 mr-2" />
                                Durdur
                            </Button>
                        </div>

                        {/* Durum */}
                        <div className={`p-4 rounded-xl border ${isPlaying ? 'bg-green-500/10 border-green-500/30' : 'bg-slate-500/10 border-slate-500/30'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${isPlaying ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`}></div>
                                <span className="text-white font-medium">
                                    {isPlaying ? 'Müzik TV\'de çalıyor' : 'Müzik durduruldu'}
                                </span>
                            </div>
                        </div>

                        {/* Bilgi */}
                        <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-xl text-blue-200 text-sm space-y-2">
                            <p className="font-bold flex items-center gap-2">
                                <Tv className="w-4 h-4" />
                                Nasıl Çalışır?
                            </p>
                            <ul className="list-disc list-inside space-y-1 text-blue-200/80">
                                <li>YouTube URL'sini yapıştırın ve "Çal" butonuna basın</li>
                                <li>TV ekranında müzik otomatik başlayacak</li>
                                <li>Sıra çağrıldığında müzik otomatik durur, anons biter ve müzik devam eder</li>
                            </ul>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
