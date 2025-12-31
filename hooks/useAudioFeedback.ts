// ============================================
// RAM Dosya Atama - Audio Feedback Hook
// ============================================

"use client";

import { useRef, useEffect, useCallback } from "react";
import { useAppStore } from "@/stores/useAppStore";
import { AUDIO_FREQUENCIES } from "@/lib/constants";

interface AudioFeedbackHook {
    playAssignSound: () => void;
    playEmergencySound: () => void;
    playClickSound: () => void;
    playAnnouncementSound: () => void;
    playDingDong: () => void;
    testSound: () => void;
    resumeAudioIfNeeded: () => void;
}

export function useAudioFeedback(): AudioFeedbackHook {
    const soundOn = useAppStore((state) => state.soundOn);
    const soundOnRef = useRef(soundOn);
    const audioCtxRef = useRef<AudioContext | null>(null);

    // Keep ref in sync with state
    useEffect(() => {
        soundOnRef.current = soundOn;
    }, [soundOn]);

    // Get or create AudioContext
    const getAudioCtx = useCallback(() => {
        if (typeof window === "undefined") return null;
        if (!audioCtxRef.current) {
            const Ctx =
                (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ||
                (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!Ctx) return null;
            audioCtxRef.current = new Ctx();
        }
        return audioCtxRef.current;
    }, []);

    // Resume audio context if suspended
    const resumeAudioIfNeeded = useCallback(() => {
        const ctx = getAudioCtx();
        if (ctx && ctx.state === "suspended") {
            ctx.resume().catch(() => { });
        }
    }, [getAudioCtx]);

    // Setup interaction listeners to resume audio
    useEffect(() => {
        const onInteract = () => {
            resumeAudioIfNeeded();
            document.removeEventListener("pointerdown", onInteract);
            document.removeEventListener("keydown", onInteract);
            document.removeEventListener("touchstart", onInteract);
        };
        document.addEventListener("pointerdown", onInteract, { passive: true });
        document.addEventListener("keydown", onInteract);
        document.addEventListener("touchstart", onInteract, { passive: true });
        return () => {
            document.removeEventListener("pointerdown", onInteract);
            document.removeEventListener("keydown", onInteract);
            document.removeEventListener("touchstart", onInteract);
        };
    }, [resumeAudioIfNeeded]);

    // Play tone with ADSR envelope
    const playTone = useCallback(
        (
            freq: number,
            durationSec = 0.14,
            volume = 0.18,
            type: OscillatorType = "sine",
            attack = 0.01,
            decay = 0.05,
            sustain = 0.7,
            release = 0.1
        ) => {
            if (!soundOnRef.current) return;
            const ctx = getAudioCtx();
            if (!ctx) return;
            if (ctx.state === "suspended") {
                ctx.resume().catch(() => { });
            }

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type;
            osc.frequency.value = freq;

            const now = ctx.currentTime;
            const attackEnd = now + attack;
            const decayEnd = attackEnd + decay;
            const releaseStart = now + durationSec - release;

            // ADSR envelope
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(volume, attackEnd);
            gain.gain.linearRampToValueAtTime(volume * sustain, decayEnd);
            gain.gain.setValueAtTime(volume * sustain, releaseStart);
            gain.gain.linearRampToValueAtTime(0, now + durationSec);

            osc.connect(gain).connect(ctx.destination);
            osc.start(now);
            osc.stop(now + durationSec);
        },
        [getAudioCtx]
    );

    // Assignment success sound (C major chord + rising melody)
    const playAssignSound = useCallback(() => {
        resumeAudioIfNeeded();
        // C major chord
        playTone(AUDIO_FREQUENCIES.C5, 0.2, 0.2, "sine", 0.02, 0.05, 0.7, 0.1);
        playTone(AUDIO_FREQUENCIES.E5, 0.2, 0.18, "sine", 0.02, 0.05, 0.7, 0.1);
        playTone(AUDIO_FREQUENCIES.G5, 0.2, 0.16, "sine", 0.02, 0.05, 0.7, 0.1);
        // Rising melody
        setTimeout(
            () => playTone(AUDIO_FREQUENCIES.E5, 0.15, 0.18, "sine", 0.01, 0.03, 0.8, 0.08),
            220
        );
        setTimeout(
            () => playTone(AUDIO_FREQUENCIES.G5, 0.18, 0.2, "sine", 0.01, 0.03, 0.8, 0.1),
            380
        );
        setTimeout(
            () => playTone(AUDIO_FREQUENCIES.C6, 0.2, 0.22, "sine", 0.01, 0.03, 0.8, 0.12),
            560
        );
    }, [playTone, resumeAudioIfNeeded]);

    // Emergency/warning sound
    const playEmergencySound = useCallback(() => {
        resumeAudioIfNeeded();
        playTone(880, 0.12, 0.25, "square", 0.005, 0.02, 0.9, 0.05);
        setTimeout(
            () => playTone(660, 0.14, 0.25, "square", 0.005, 0.02, 0.9, 0.05),
            140
        );
        setTimeout(
            () => playTone(880, 0.12, 0.28, "square", 0.005, 0.02, 0.9, 0.05),
            280
        );
        setTimeout(
            () => playTone(1100, 0.15, 0.3, "square", 0.005, 0.02, 0.9, 0.05),
            420
        );
    }, [playTone, resumeAudioIfNeeded]);

    // Click sound
    const playClickSound = useCallback(() => {
        resumeAudioIfNeeded();
        playTone(800, 0.04, 0.1, "sine", 0.001, 0.01, 0.6, 0.02);
    }, [playTone, resumeAudioIfNeeded]);

    // Announcement sound
    const playAnnouncementSound = useCallback(() => {
        resumeAudioIfNeeded();
        playTone(AUDIO_FREQUENCIES.G5, 0.1, 0.16, "sine", 0.01, 0.02, 0.8, 0.05);
        setTimeout(
            () => playTone(AUDIO_FREQUENCIES.B5, 0.12, 0.18, "sine", 0.01, 0.02, 0.8, 0.06),
            120
        );
        setTimeout(
            () => playTone(AUDIO_FREQUENCIES.D6, 0.14, 0.2, "sine", 0.01, 0.02, 0.8, 0.08),
            240
        );
    }, [playTone, resumeAudioIfNeeded]);

    // Ding Dong Sound (Queue Call) - Yüksek ses seviyesi
    const playDingDong = useCallback(() => {
        resumeAudioIfNeeded();
        // Ding (G5) - daha yüksek volume
        playTone(784, 0.6, 0.6, "sine", 0.05, 0.4, 0.6, 0.2);
        // Dong (E5) - biraz gecikmeli
        setTimeout(
            () => playTone(659, 0.8, 0.5, "sine", 0.05, 0.6, 0.5, 0.3),
            500
        );
    }, [playTone, resumeAudioIfNeeded]);

    // Test sound
    const testSound = useCallback(() => {
        resumeAudioIfNeeded();
        playTone(600, 0.12, 0.2, "sine", 0.01, 0.03, 0.8, 0.05);
        setTimeout(
            () => playTone(900, 0.12, 0.2, "sine", 0.01, 0.03, 0.8, 0.05),
            150
        );
        setTimeout(
            () => playTone(1200, 0.15, 0.22, "sine", 0.01, 0.03, 0.8, 0.08),
            300
        );
    }, [playTone, resumeAudioIfNeeded]);

    return {
        playAssignSound,
        playEmergencySound,
        playClickSound,
        playAnnouncementSound,
        playDingDong,
        testSound,
        resumeAudioIfNeeded,
    };
}
