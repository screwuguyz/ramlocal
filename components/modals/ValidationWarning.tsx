import React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface ValidationWarningProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    message: string;
}

export default function ValidationWarning({
    open,
    onOpenChange,
    message,
}: ValidationWarningProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl bg-white dark:bg-slate-900 border-4 border-amber-400">
                <div className="flex flex-col items-center justify-center gap-10 py-12 px-8">
                    {/* HUGE Warning Icon */}
                    <div className="flex h-32 w-32 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30 ring-8 ring-amber-200 dark:ring-amber-800">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                            className="h-20 w-20 text-amber-600 dark:text-amber-400"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                            />
                        </svg>
                    </div>

                    {/* HUGE Warning Message */}
                    <div className="text-center space-y-4 max-w-xl">
                        <h2 className="text-5xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                            DİKKAT!
                        </h2>
                        <p className="text-3xl font-bold text-slate-800 dark:text-slate-200 leading-tight px-6">
                            {message}
                        </p>
                    </div>

                    {/* HUGE OK Button */}
                    <button
                        onClick={() => onOpenChange(false)}
                        className="mt-6 px-16 py-5 text-2xl font-black text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl transition-all shadow-2xl hover:shadow-emerald-500/50 hover:scale-105 transform"
                    >
                        TAMAM
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
