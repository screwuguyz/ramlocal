// ============================================
// Duyuru Popup Modal
// ============================================

"use client";

import React from "react";
import { X, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Announcement } from "@/types";

interface AnnouncementPopupModalProps {
    announcement: Announcement | null;
    onClose: () => void;
}

export default function AnnouncementPopupModal({ announcement, onClose }: AnnouncementPopupModalProps) {
    if (!announcement) return null;

    // Format time
    const timeString = announcement.createdAt
        ? new Date(announcement.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
        : "";

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 animate-fade-in">
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-slide-in-up overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-amber-400 to-orange-500">
                    <div className="flex items-center gap-2 text-white">
                        <Volume2 className="h-5 w-5" />
                        <h2 className="text-lg font-bold">📢 Yeni Duyuru</h2>
                    </div>
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={onClose}
                        className="text-white hover:bg-white/20 h-8 w-8"
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                {/* Content */}
                <div className="p-6">
                    <p className="text-lg text-slate-800 leading-relaxed">
                        {announcement.text}
                    </p>
                    {timeString && (
                        <p className="text-sm text-slate-400 mt-4">
                            Gönderilme: {timeString}
                        </p>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 pb-6">
                    <Button
                        onClick={onClose}
                        className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                    >
                        Tamam
                    </Button>
                </div>
            </div>
        </div>
    );
}
