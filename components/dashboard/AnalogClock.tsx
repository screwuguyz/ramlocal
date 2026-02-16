"use client";

import React, { useState, useEffect } from "react";

/**
 * Klasik analog saat — İstanbul saatine göre (UTC+3)
 */
export default function AnalogClock({ size = 36 }: { size?: number }) {
    const [time, setTime] = useState<{ h: number; m: number; s: number } | null>(null);

    useEffect(() => {
        function tick() {
            // UTC+3 (İstanbul)
            const now = new Date();
            const utc = now.getTime() + now.getTimezoneOffset() * 60000;
            const istanbul = new Date(utc + 3 * 3600000);
            setTime({
                h: istanbul.getHours(),
                m: istanbul.getMinutes(),
                s: istanbul.getSeconds(),
            });
        }
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, []);

    if (!time) return <div style={{ width: size, height: size }} />;

    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 2;

    // Açı hesapları (12 yukarıda, saat yönünde)
    const secAngle = (time.s / 60) * 360 - 90;
    const minAngle = ((time.m + time.s / 60) / 60) * 360 - 90;
    const hrAngle = (((time.h % 12) + time.m / 60) / 12) * 360 - 90;

    const toRad = (deg: number) => (deg * Math.PI) / 180;

    // İbre uçları
    const hand = (angle: number, len: number) => ({
        x: cx + Math.cos(toRad(angle)) * len,
        y: cy + Math.sin(toRad(angle)) * len,
    });

    const hourHand = hand(hrAngle, r * 0.5);
    const minuteHand = hand(minAngle, r * 0.72);
    const secondHand = hand(secAngle, r * 0.82);

    return (
        <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="flex-shrink-0"
            style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.1))" }}
        >
            {/* Kadran */}
            <circle cx={cx} cy={cy} r={r} fill="white" stroke="#cbd5e1" strokeWidth="1.5" />

            {/* Saat rakamları */}
            {Array.from({ length: 12 }).map((_, i) => {
                const num = i + 1;
                const angle = (num / 12) * 360 - 90;
                const numR = r * 0.73;
                const x = cx + Math.cos(toRad(angle)) * numR;
                const y = cy + Math.sin(toRad(angle)) * numR;
                return (
                    <text
                        key={num}
                        x={x}
                        y={y}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={size * 0.14}
                        fontWeight={num % 3 === 0 ? "bold" : "normal"}
                        fill={num % 3 === 0 ? "#1e293b" : "#64748b"}
                        fontFamily="Arial, sans-serif"
                    >
                        {num}
                    </text>
                );
            })}

            {/* Akrep (saat) */}
            <line
                x1={cx} y1={cy}
                x2={hourHand.x} y2={hourHand.y}
                stroke="#1e293b" strokeWidth={2.2} strokeLinecap="round"
            />

            {/* Yelkovan (dakika) */}
            <line
                x1={cx} y1={cy}
                x2={minuteHand.x} y2={minuteHand.y}
                stroke="#334155" strokeWidth={1.5} strokeLinecap="round"
            />

            {/* Saniye */}
            <line
                x1={cx} y1={cy}
                x2={secondHand.x} y2={secondHand.y}
                stroke="#dc2626" strokeWidth={0.7} strokeLinecap="round"
            />

            {/* Merkez nokta */}
            <circle cx={cx} cy={cy} r={1.5} fill="#dc2626" />
        </svg>
    );
}
