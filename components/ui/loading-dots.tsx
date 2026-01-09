"use client";

import { cn } from "@/lib/utils";

interface LoadingDotsProps {
    className?: string;
    size?: "sm" | "md" | "lg";
}

export default function LoadingDots({ className, size = "md" }: LoadingDotsProps) {
    const sizeClasses = {
        sm: "w-1.5 h-1.5",
        md: "w-2 h-2",
        lg: "w-3 h-3",
    };

    return (
        <div className={cn("loading-dots", className)}>
            <span className={sizeClasses[size]}></span>
            <span className={sizeClasses[size]}></span>
            <span className={sizeClasses[size]}></span>
        </div>
    );
}
