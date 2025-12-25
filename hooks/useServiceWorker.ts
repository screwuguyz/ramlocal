// ============================================
// Service Worker Registration Hook
// ============================================

"use client";

import { useEffect } from "react";

export function useServiceWorker() {
    useEffect(() => {
        if (typeof window !== "undefined" && "serviceWorker" in navigator) {
            // Register service worker
            navigator.serviceWorker
                .register("/sw.js")
                .then((registration) => {
                    console.log("[SW] Registered:", registration.scope);

                    // Check for updates periodically
                    setInterval(() => {
                        registration.update();
                    }, 60 * 60 * 1000); // Every hour
                })
                .catch((error) => {
                    console.warn("[SW] Registration failed:", error);
                });

            // Handle controller change (new SW activated)
            navigator.serviceWorker.addEventListener("controllerchange", () => {
                console.log("[SW] New service worker activated");
            });
        }
    }, []);
}

/**
 * Check if app is running as PWA (standalone mode)
 */
export function useIsPWA(): boolean {
    if (typeof window === "undefined") return false;

    // Check display-mode
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;

    // Check iOS specific
    const isIOSPWA = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    return isStandalone || isIOSPWA;
}

/**
 * Check if app can be installed
 */
export function useInstallPrompt() {
    useEffect(() => {
        let deferredPrompt: BeforeInstallPromptEvent | null = null;

        const handleBeforeInstall = (e: Event) => {
            e.preventDefault();
            deferredPrompt = e as BeforeInstallPromptEvent;
            console.log("[PWA] Install prompt available");
        };

        window.addEventListener("beforeinstallprompt", handleBeforeInstall);

        return () => {
            window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
        };
    }, []);
}

// Type for BeforeInstallPromptEvent
interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    readonly userChoice: Promise<{
        outcome: "accepted" | "dismissed";
        platform: string;
    }>;
    prompt(): Promise<void>;
}
