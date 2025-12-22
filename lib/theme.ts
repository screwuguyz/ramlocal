// Tema yönetimi için utility fonksiyonlar

export type ThemeMode = "light" | "dark" | "auto";

export type ColorScheme = {
  name: string;
  primary: string;
  primaryDark: string;
  primaryLight: string;
  accent: string;
  accentDark: string;
  accentLight: string;
  bgBase: string;
  bgWarm: string;
  bgCard: string;
  textMain: string;
  textMuted: string;
  textLight: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
};

export const DEFAULT_COLOR_SCHEMES: Record<string, ColorScheme> = {
  default: {
    name: "Varsayılan (Teal-Orange)",
    primary: "#0d9488",
    primaryDark: "#0f766e",
    primaryLight: "#5eead4",
    accent: "#f97316",
    accentDark: "#ea580c",
    accentLight: "#fed7aa",
    bgBase: "#faf8f5",
    bgWarm: "#f5f2ed",
    bgCard: "#ffffff",
    textMain: "#1e293b",
    textMuted: "#64748b",
    textLight: "#94a3b8",
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
    info: "#3b82f6",
  },
  blue: {
    name: "Mavi Tema",
    primary: "#3b82f6",
    primaryDark: "#2563eb",
    primaryLight: "#93c5fd",
    accent: "#8b5cf6",
    accentDark: "#7c3aed",
    accentLight: "#c4b5fd",
    bgBase: "#f0f9ff",
    bgWarm: "#e0f2fe",
    bgCard: "#ffffff",
    textMain: "#1e293b",
    textMuted: "#64748b",
    textLight: "#94a3b8",
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
    info: "#3b82f6",
  },
  green: {
    name: "Yeşil Tema",
    primary: "#10b981",
    primaryDark: "#059669",
    primaryLight: "#6ee7b7",
    accent: "#f59e0b",
    accentDark: "#d97706",
    accentLight: "#fde68a",
    bgBase: "#f0fdf4",
    bgWarm: "#dcfce7",
    bgCard: "#ffffff",
    textMain: "#1e293b",
    textMuted: "#64748b",
    textLight: "#94a3b8",
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
    info: "#3b82f6",
  },
  purple: {
    name: "Mor Tema",
    primary: "#8b5cf6",
    primaryDark: "#7c3aed",
    primaryLight: "#c4b5fd",
    accent: "#ec4899",
    accentDark: "#db2777",
    accentLight: "#fbcfe8",
    bgBase: "#faf5ff",
    bgWarm: "#f3e8ff",
    bgCard: "#ffffff",
    textMain: "#1e293b",
    textMuted: "#64748b",
    textLight: "#94a3b8",
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
    info: "#3b82f6",
  },
  red: {
    name: "Kırmızı Tema",
    primary: "#ef4444",
    primaryDark: "#dc2626",
    primaryLight: "#fca5a5",
    accent: "#f97316",
    accentDark: "#ea580c",
    accentLight: "#fed7aa",
    bgBase: "#fef2f2",
    bgWarm: "#fee2e2",
    bgCard: "#ffffff",
    textMain: "#1e293b",
    textMuted: "#64748b",
    textLight: "#94a3b8",
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
    info: "#3b82f6",
  },
};

const THEME_MODE_KEY = "site_theme_mode";
const COLOR_SCHEME_KEY = "site_color_scheme";
const CUSTOM_COLORS_KEY = "site_custom_colors";

export function getThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "auto";
  const saved = localStorage.getItem(THEME_MODE_KEY) as ThemeMode | null;
  return saved === "light" || saved === "dark" || saved === "auto" ? saved : "auto";
}

export function setThemeMode(mode: ThemeMode) {
  if (typeof window === "undefined") return;
  localStorage.setItem(THEME_MODE_KEY, mode);
  applyTheme();
}

export function getColorScheme(): ColorScheme {
  if (typeof window === "undefined") return DEFAULT_COLOR_SCHEMES.default;
  
  // Özel renkler var mı kontrol et
  const customColors = localStorage.getItem(CUSTOM_COLORS_KEY);
  if (customColors) {
    try {
      return JSON.parse(customColors);
    } catch {
      // Hatalı JSON, varsayılan döndür
    }
  }
  
  // Seçili şema
  const schemeName = localStorage.getItem(COLOR_SCHEME_KEY) || "default";
  return DEFAULT_COLOR_SCHEMES[schemeName] || DEFAULT_COLOR_SCHEMES.default;
}

export function setColorScheme(schemeName: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(COLOR_SCHEME_KEY, schemeName);
  localStorage.removeItem(CUSTOM_COLORS_KEY); // Özel renkleri temizle
  applyTheme();
}

export function setCustomColors(colors: Partial<ColorScheme>) {
  if (typeof window === "undefined") return;
  const currentScheme = getColorScheme();
  const customScheme = { ...currentScheme, ...colors, name: "Özel Tema" };
  localStorage.setItem(CUSTOM_COLORS_KEY, JSON.stringify(customScheme));
  localStorage.setItem(COLOR_SCHEME_KEY, "custom");
  applyTheme();
}

export function getEffectiveTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  
  const mode = getThemeMode();
  if (mode === "auto") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    return prefersDark ? "dark" : "light";
  }
  return mode;
}

export function applyTheme() {
  if (typeof window === "undefined") return;
  
  const theme = getEffectiveTheme();
  const colors = getColorScheme();
  const root = document.documentElement;
  
  // Tema modunu uygula
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
  
  // Renkleri uygula
  root.style.setProperty("--primary", colors.primary);
  root.style.setProperty("--primary-dark", colors.primaryDark);
  root.style.setProperty("--primary-light", colors.primaryLight);
  root.style.setProperty("--accent", colors.accent);
  root.style.setProperty("--accent-dark", colors.accentDark);
  root.style.setProperty("--accent-light", colors.accentLight);
  root.style.setProperty("--bg-base", colors.bgBase);
  root.style.setProperty("--bg-warm", colors.bgWarm);
  root.style.setProperty("--bg-card", colors.bgCard);
  root.style.setProperty("--text-main", colors.textMain);
  root.style.setProperty("--text-muted", colors.textMuted);
  root.style.setProperty("--text-light", colors.textLight);
  root.style.setProperty("--success", colors.success);
  root.style.setProperty("--warning", colors.warning);
  root.style.setProperty("--danger", colors.danger);
  root.style.setProperty("--info", colors.info);
}

// İlk yüklemede tema uygula
if (typeof window !== "undefined") {
  applyTheme();
  
  // Sistem teması değişikliklerini dinle (auto mod için)
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (getThemeMode() === "auto") {
      applyTheme();
    }
  });
}

