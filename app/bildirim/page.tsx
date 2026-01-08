"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Loader2, Check, Smartphone } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface Teacher {
    id: string;
    name: string;
    active?: boolean;
}

export default function BildirimPage() {
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<string>("");

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    // Fetch teachers on mount
    useEffect(() => {
        const fetchTeachers = async () => {
            try {
                const res = await fetch("/api/state");
                const data = await res.json();
                const activeTeachers = (data.teachers || []).filter((t: Teacher) => t.active !== false);
                setTeachers(activeTeachers);
            } catch (e) {
                console.error("Failed to fetch teachers:", e);
            }
        };
        fetchTeachers();
    }, []);

    // Check subscription when teacher selected
    useEffect(() => {
        if (!selectedTeacherId) return;

        const checkSubscription = async () => {
            try {
                const registration = await navigator.serviceWorker.getRegistration();
                if (registration) {
                    const subscription = await registration.pushManager.getSubscription();
                    setIsSubscribed(!!subscription);
                }
            } catch (e) {
                // Silent
            }
        };
        checkSubscription();
    }, [selectedTeacherId]);

    const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
        const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, "+")
            .replace(/_/g, "/");
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    };

    const subscribe = async () => {
        if (!selectedTeacherId) {
            setMessage("Lütfen önce adınızı seçin");
            return;
        }

        if (!vapidPublicKey) {
            setMessage("Push bildirimleri yapılandırılmamış");
            return;
        }

        if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
            setMessage("Bu tarayıcı bildirimleri desteklemiyor. Chrome veya Safari kullanın.");
            return;
        }

        setIsLoading(true);
        setMessage("");

        try {
            // Request notification permission
            const permission = await Notification.requestPermission();
            if (permission !== "granted") {
                setMessage("Bildirim izni reddedildi. Tarayıcı ayarlarından izin verin.");
                setIsLoading(false);
                return;
            }

            // Register service worker if not already
            let registration = await navigator.serviceWorker.getRegistration();
            if (!registration) {
                registration = await navigator.serviceWorker.register("/sw.js");
                await navigator.serviceWorker.ready;
            }

            // Subscribe to push
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey).buffer as ArrayBuffer,
            });

            // Send subscription to server
            const res = await fetch("/api/push-subscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    teacherId: selectedTeacherId,
                    subscription: subscription.toJSON(),
                }),
            });

            if (res.ok) {
                setIsSubscribed(true);
                setMessage("✅ Bildirimler açıldı! Artık dosya atandığında bu telefona bildirim gelecek.");
            } else {
                throw new Error("Failed to save subscription");
            }
        } catch (e) {
            console.error("Subscribe error:", e);
            setMessage("Kayıt başarısız. Lütfen tekrar deneyin.");
        } finally {
            setIsLoading(false);
        }
    };

    const unsubscribe = async () => {
        setIsLoading(true);
        try {
            const registration = await navigator.serviceWorker.getRegistration();
            if (registration) {
                const subscription = await registration.pushManager.getSubscription();
                if (subscription) {
                    await subscription.unsubscribe();
                    await fetch(`/api/push-subscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`, {
                        method: "DELETE",
                    });
                }
            }
            setIsSubscribed(false);
            setMessage("Bildirimler kapatıldı.");
        } catch (e) {
            console.error("Unsubscribe error:", e);
            setMessage("İptal başarısız.");
        } finally {
            setIsLoading(false);
        }
    };

    const selectedTeacher = teachers.find(t => t.id === selectedTeacherId);

    return (
        <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-emerald-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-teal-400 to-emerald-500 rounded-full mb-4">
                            <Smartphone className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-800">Bildirim Aktivasyonu</h1>
                        <p className="text-slate-500 mt-2">Dosya atandığında telefona bildirim al</p>
                    </div>

                    {/* Teacher Select */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Adınızı Seçin
                        </label>
                        <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                            <SelectTrigger className="w-full h-12 text-base">
                                <SelectValue placeholder="Öğretmen seçin..." />
                            </SelectTrigger>
                            <SelectContent>
                                {teachers.map((t) => (
                                    <SelectItem key={t.id} value={t.id}>
                                        {t.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Subscribe Button */}
                    {selectedTeacherId && (
                        <div className="space-y-4">
                            <Button
                                onClick={isSubscribed ? unsubscribe : subscribe}
                                disabled={isLoading}
                                className={`w-full h-14 text-lg ${isSubscribed
                                        ? "bg-emerald-500 hover:bg-emerald-600"
                                        : "bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600"
                                    }`}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                        İşleniyor...
                                    </>
                                ) : isSubscribed ? (
                                    <>
                                        <Check className="w-5 h-5 mr-2" />
                                        Bildirimler Açık
                                    </>
                                ) : (
                                    <>
                                        <Bell className="w-5 h-5 mr-2" />
                                        Bildirimleri Aç
                                    </>
                                )}
                            </Button>

                            {isSubscribed && (
                                <Button
                                    variant="outline"
                                    onClick={unsubscribe}
                                    disabled={isLoading}
                                    className="w-full"
                                >
                                    <BellOff className="w-4 h-4 mr-2" />
                                    Bildirimleri Kapat
                                </Button>
                            )}
                        </div>
                    )}

                    {/* Message */}
                    {message && (
                        <div className={`mt-6 p-4 rounded-lg text-center ${message.includes("✅")
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}>
                            {message}
                        </div>
                    )}

                    {/* Instructions */}
                    <div className="mt-8 pt-6 border-t border-slate-100">
                        <h3 className="text-sm font-semibold text-slate-700 mb-3">📋 Nasıl Çalışır?</h3>
                        <ol className="text-sm text-slate-500 space-y-2">
                            <li>1. Adınızı seçin</li>
                            <li>2. "Bildirimleri Aç" butonuna basın</li>
                            <li>3. Tarayıcı izin isterse "İzin Ver" deyin</li>
                            <li>4. Dosya atandığında bu telefona bildirim gelecek!</li>
                        </ol>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-xs text-slate-400 mt-4">
                    RAM Dosya Atama Sistemi
                </p>
            </div>
        </div>
    );
}
