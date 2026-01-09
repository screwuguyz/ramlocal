"use client";

import { cn } from "@/lib/utils";

interface SuccessCheckProps {
    className?: string;
    size?: number;
    color?: string;
}

export default function SuccessCheck({
    className,
    size = 48,
    color = "#10b981"
}: SuccessCheckProps) {
    return (
        <svg
            className={cn("checkmark-circle", className)}
            width={size}
            height={size}
            viewBox="0 0 52 52"
        >
            <circle
                cx="26"
                cy="26"
                r="24"
                fill="none"
                stroke={color}
                strokeWidth="3"
                opacity="0.2"
            />
            <circle
                cx="26"
                cy="26"
                r="24"
                fill="none"
                stroke={color}
                strokeWidth="3"
                strokeLinecap="round"
                className="checkmark-circle"
            />
            <path
                className="checkmark-check"
                fill="none"
                stroke={color}
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14 27l8 8 16-16"
            />
        </svg>
    );
}
