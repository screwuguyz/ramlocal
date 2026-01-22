import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

interface StatCardProps {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    trend?: string; // e.g., "+12%" or "High"
    trendDirection?: "up" | "down" | "neutral";
    description?: string;
    colorTheme?: "blue" | "green" | "purple" | "orange" | "pink";
    className?: string;
    onClick?: () => void;
}

const themeStyles = {
    blue: "bg-blue-50 text-blue-900 border-blue-200 hover:border-blue-300",
    green: "bg-emerald-50 text-emerald-900 border-emerald-200 hover:border-emerald-300",
    purple: "bg-purple-50 text-purple-900 border-purple-200 hover:border-purple-300",
    orange: "bg-orange-50 text-orange-900 border-orange-200 hover:border-orange-300",
    pink: "bg-pink-50 text-pink-900 border-pink-200 hover:border-pink-300",
};

const iconStyles = {
    blue: "bg-blue-100 text-blue-600",
    green: "bg-emerald-100 text-emerald-600",
    purple: "bg-purple-100 text-purple-600",
    orange: "bg-orange-100 text-orange-600",
    pink: "bg-pink-100 text-pink-600",
};

export default function StatCard({
    title,
    value,
    icon,
    trend,
    trendDirection = "neutral",
    description,
    colorTheme = "blue",
    className,
    onClick
}: StatCardProps) {
    return (
        <Card
            onClick={onClick}
            className={cn(
                "border transition-all duration-300 hover:shadow-lg cursor-pointer group relative overflow-hidden",
                themeStyles[colorTheme],
                className
            )}
        >
            <CardContent className="p-6">
                <div className="flex items-center justify-between">
                    <div className={cn("p-3 rounded-xl transition-transform duration-300 group-hover:scale-110", iconStyles[colorTheme])}>
                        {icon}
                    </div>
                    {trend && (
                        <div className={cn(
                            "flex items-center text-xs font-semibold px-2 py-1 rounded-full",
                            trendDirection === "up" ? "bg-green-100 text-green-700" :
                                trendDirection === "down" ? "bg-red-100 text-red-700" :
                                    "bg-gray-100 text-gray-700"
                        )}>
                            {trendDirection === "up" && <ArrowUpRight className="w-3 h-3 mr-1" />}
                            {trendDirection === "down" && <ArrowDownRight className="w-3 h-3 mr-1" />}
                            {trendDirection === "neutral" && <Minus className="w-3 h-3 mr-1" />}
                            {trend}
                        </div>
                    )}
                </div>

                <div className="mt-4">
                    <h3 className="text-sm font-medium opacity-80">{title}</h3>
                    <div className="text-3xl font-bold mt-1 tracking-tight">{value}</div>
                    {description && (
                        <p className="text-xs mt-2 opacity-70">{description}</p>
                    )}
                </div>

                {/* Decorative background blob */}
                <div className={cn(
                    "absolute -bottom-4 -right-4 w-24 h-24 rounded-full opacity-10 blur-2xl group-hover:opacity-20 transition-opacity",
                    colorTheme === "blue" ? "bg-blue-500" :
                        colorTheme === "green" ? "bg-emerald-500" :
                            colorTheme === "purple" ? "bg-purple-500" :
                                colorTheme === "orange" ? "bg-orange-500" : "bg-pink-500"
                )} />
            </CardContent>
        </Card>
    );
}
