// ============================================
// iOS Install Prompt Component
// ============================================

"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Share, PlusSquare, ArrowDown } from "lucide-react";

interface IOSInstallPromptProps {
    onDismiss?: () => void;
}

export default function IOSInstallPrompt({ onDismiss }: IOSInstallPromptProps) {
    const [show, setShow] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        // Check if iOS
        const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        setIsIOS(iOS);

        // Check if already installed
        const standalone =
            (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
            window.matchMedia("(display-mode: standalone)").matches;
        setIsStandalone(standalone);

        // Show prompt if iOS and not installed
        if (iOS && !standalone) {
            const dismissed = localStorage.getItem("ios-install-dismissed");
            const dismissedAt = dismissed ? parseInt(dismissed) : 0;
            const hoursPassed = (Date.now() - dismissedAt) / (1000 * 60 * 60);

            // Show again after 24 hours
            if (!dismissed || hoursPassed > 24) {
                setTimeout(() => setShow(true), 3000); // Show after 3 seconds
            }
        }
    }, []);

    const handleDismiss = () => {
        setShow(false);
        localStorage.setItem("ios-install-dismissed", Date.now().toString());
        onDismiss?.();
    };

    if (!show || !isIOS || isStandalone) return null;

    return (
        <div className="fixed inset-x-0 bottom-0 z-[9999] p-4 animate-slide-in-up">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-w-md mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-500 to-teal-600">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                            <span className="text-2xl">📋</span>
                        </div>
                        <div className="text-white">
                            <h3 className="font-semibold">RAM Atama</h3>
                            <p className="text-sm opacity-80">Uygulamayı yükle</p>
                        </div>
                    </div>
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleDismiss}
                        className="text-white/80 hover:text-white hover:bg-white/20"
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                {/* Instructions */}
                <div className="p-4 space-y-4">
                    <p className="text-sm text-slate-600">
                        Bu uygulamayı ana ekranınıza ekleyerek daha hızlı erişebilirsiniz:
                    </p>

                    <div className="space-y-3">
                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                <Share className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm font-medium">1. Paylaş butonuna tıklayın</p>
                                <p className="text-xs text-slate-500">Safari'nin alt menüsünde</p>
                            </div>
                        </div>

                        <div className="flex items-center justify-center">
                            <ArrowDown className="h-4 w-4 text-slate-400" />
                        </div>

                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                <PlusSquare className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-sm font-medium">2. "Ana Ekrana Ekle"yi seçin</p>
                                <p className="text-xs text-slate-500">Listede aşağı kaydırın</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 border-t">
                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={handleDismiss}
                    >
                        Daha Sonra
                    </Button>
                </div>
            </div>

            {/* Arrow pointing to Share button */}
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
                <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white"></div>
            </div>
        </div>
    );
}
