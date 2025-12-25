// ============================================
// Hızlı Arama (Spotlight) Bileşeni
// ============================================

"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Search, X, User, FileText, Calendar } from "lucide-react";

interface Teacher {
    id: string;
    name: string;
    isAbsent: boolean;
    active: boolean;
}

interface CaseFile {
    id: string;
    student: string;
    fileNo?: string;
    createdAt: string;
    assignedTo?: string;
    type?: string;
}

interface SearchResult {
    type: "case";
    id: string;
    title: string;
    fileNo?: string;
    teacherName?: string;
    date?: string;
    icon: React.ReactNode;
}

interface QuickSearchProps {
    teachers: Teacher[];
    cases: CaseFile[];
    history: Record<string, CaseFile[]>;
    onSelectTeacher?: (id: string) => void;
    onSelectCase?: (caseFile: CaseFile) => void;
}

export default function QuickSearch({
    teachers,
    cases,
    history,
    onSelectTeacher,
    onSelectCase,
}: QuickSearchProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    // Tüm dosyaları birleştir (bugün + arşiv)
    const allCases = useMemo(() => {
        const archived = Object.values(history).flat();
        return [...cases, ...archived];
    }, [cases, history]);

    // Arama sonuçları - öğrenci adı veya dosya numarası
    const results = useMemo((): SearchResult[] => {
        if (!query.trim()) return [];

        const q = query.toLowerCase().trim();
        const results: SearchResult[] = [];

        // Öğrenci adı veya dosya numarası ile ara
        const seen = new Set<string>();
        allCases
            .filter(c =>
                c.student.toLowerCase().includes(q) ||
                (c.fileNo && c.fileNo.toLowerCase().includes(q))
            )
            .slice(0, 15)
            .forEach(c => {
                // Aynı öğrenciyi tekrar gösterme
                const key = c.student.toLowerCase();
                if (seen.has(key)) return;
                seen.add(key);

                const teacher = teachers.find(t => t.id === c.assignedTo);
                results.push({
                    type: "case",
                    id: c.id,
                    title: c.student,
                    fileNo: c.fileNo,
                    teacherName: teacher?.name,
                    date: c.createdAt.split("T")[0],
                    icon: <FileText className="h-4 w-4 text-emerald-500" />,
                });
            });

        return results;
    }, [query, allCases]);

    // Klavye kısayolu (Ctrl+K)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "k") {
                e.preventDefault();
                setIsOpen(true);
            }
            if (e.key === "Escape") {
                setIsOpen(false);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    // Açılınca input'a odaklan
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
            setQuery("");
            setSelectedIndex(0);
        }
    }, [isOpen]);

    // Klavye navigasyonu
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelectedIndex(i => Math.min(i + 1, results.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelectedIndex(i => Math.max(i - 1, 0));
        } else if (e.key === "Enter" && results[selectedIndex]) {
            handleSelect(results[selectedIndex]);
        }
    };

    // Seçim
    const handleSelect = (result: SearchResult) => {
        if (onSelectCase) {
            const caseFile = allCases.find(c => c.id === result.id);
            if (caseFile) onSelectCase(caseFile);
        }
        setIsOpen(false);
    };

    if (!isOpen) {
        // Üst barda küçük buton
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm transition-all border border-slate-200"
                title="Hızlı Ara (Ctrl+K)"
            >
                <Search className="h-4 w-4" />
                <span className="hidden sm:inline">Ara</span>
                <kbd className="hidden md:inline text-xs bg-white px-1.5 py-0.5 rounded border text-slate-400">⌘K</kbd>
            </button>
        );
    }

    return (
        <div
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-start justify-center pt-[15vh]"
            onClick={() => setIsOpen(false)}
        >
            <div
                className="w-full max-w-lg mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden animate-slide-in-up"
                onClick={e => e.stopPropagation()}
            >
                {/* Arama Input */}
                <div className="flex items-center gap-3 p-4 border-b">
                    <Search className="h-5 w-5 text-slate-400" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Öğrenci adı veya dosya no..."
                        value={query}
                        onChange={e => {
                            setQuery(e.target.value);
                            setSelectedIndex(0);
                        }}
                        onKeyDown={handleKeyDown}
                        className="flex-1 outline-none text-lg placeholder:text-slate-400"
                    />
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-1 hover:bg-slate-100 rounded"
                    >
                        <X className="h-5 w-5 text-slate-400" />
                    </button>
                </div>

                {/* Sonuçlar */}
                <div className="max-h-[60vh] overflow-y-auto">
                    {query && results.length === 0 && (
                        <div className="p-8 text-center text-slate-500">
                            <Search className="h-12 w-12 mx-auto mb-2 opacity-30" />
                            <p>Sonuç bulunamadı</p>
                        </div>
                    )}

                    {results.map((result, index) => (
                        <button
                            key={`${result.type}-${result.id}`}
                            onClick={() => handleSelect(result)}
                            className={`w-full flex items-center gap-3 p-3 text-left transition-colors ${index === selectedIndex
                                ? "bg-teal-50 border-l-4 border-teal-500"
                                : "hover:bg-slate-50"
                                }`}
                        >
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                                {result.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-medium text-slate-800 truncate">
                                    {result.title}
                                </div>
                                <div className="text-xs text-slate-400 flex items-center gap-2">
                                    {result.fileNo && <span>#{result.fileNo}</span>}
                                    {result.teacherName && <span>→ {result.teacherName}</span>}
                                </div>
                            </div>
                            {result.date && (
                                <div className="flex items-center gap-1 text-xs text-slate-400">
                                    <Calendar className="h-3 w-3" />
                                    {result.date}
                                </div>
                            )}
                        </button>
                    ))}

                    {!query && (
                        <div className="p-6 text-center text-slate-400 text-sm">
                            <p>Öğrenci adı yazın</p>
                            <p className="mt-1 text-xs">
                                <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600">↑</kbd>
                                <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 ml-1">↓</kbd>
                                <span className="mx-2">gezin</span>
                                <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600">Enter</kbd>
                                <span className="mx-2">seç</span>
                                <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600">Esc</kbd>
                                <span className="ml-2">kapat</span>
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
