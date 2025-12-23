"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Monitor } from "lucide-react";
import { getThemeMode, setThemeMode, getEffectiveTheme, type ThemeMode } from "@/lib/theme";

export default function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("auto");
  const [effectiveTheme, setEffectiveTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    setMode(getThemeMode());
    setEffectiveTheme(getEffectiveTheme());
    
    // Sistem teması değişikliklerini dinle
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (mode === "auto") {
        setEffectiveTheme(getEffectiveTheme());
      }
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [mode]);

  function cycleTheme() {
    const modes: ThemeMode[] = ["light", "dark", "auto"];
    const currentIndex = modes.indexOf(mode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    setMode(nextMode);
    setThemeMode(nextMode, false); // Supabase sync'i burada yapma, sadece localStorage'a kaydet
    // Tema değişikliğini hemen uygula
    setTimeout(() => {
      setEffectiveTheme(getEffectiveTheme());
    }, 0);
  }

  const getIcon = () => {
    if (mode === "auto") return <Monitor className="h-4 w-4" />;
    return effectiveTheme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />;
  };

  const getLabel = () => {
    if (mode === "auto") return "Otomatik";
    return effectiveTheme === "dark" ? "Koyu" : "Açık";
  };

  return (
    <div className="fixed right-3 top-3 z-50">
      <Button variant="outline" size="sm" onClick={cycleTheme} className="shadow">
        {getIcon()}
        <span className="ml-2 hidden sm:inline">{getLabel()}</span>
      </Button>
    </div>
  );
}
