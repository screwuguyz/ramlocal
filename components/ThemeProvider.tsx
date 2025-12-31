"use client";
import { useEffect } from "react";
import { applyTheme } from "@/lib/theme";
import HolidayAnimation from "./HolidayAnimation";

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // İlk yüklemede temayı uygula
    applyTheme();

    // Sistem teması değişikliklerini dinle
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      applyTheme();
    };
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  return (
    <>
      <HolidayAnimation />
      {children}
    </>
  );
}
