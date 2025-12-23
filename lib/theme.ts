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

// Supabase senkronizasyon için callback
let syncToSupabaseCallback: ((themeMode: ThemeMode, colorScheme: string, customColors?: ColorScheme) => void) | null = null;

export function setSupabaseSyncCallback(callback: (themeMode: ThemeMode, colorScheme: string, customColors?: ColorScheme) => void) {
  syncToSupabaseCallback = callback;
}

export function getThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "auto";
  const saved = localStorage.getItem(THEME_MODE_KEY) as ThemeMode | null;
  return saved === "light" || saved === "dark" || saved === "auto" ? saved : "auto";
}

export function setThemeMode(mode: ThemeMode, syncToSupabase = true) {
  if (typeof window === "undefined") return;
  localStorage.setItem(THEME_MODE_KEY, mode);
  applyTheme();
  
  // Supabase'e senkronize et
  if (syncToSupabase && syncToSupabaseCallback) {
    const schemeName = localStorage.getItem(COLOR_SCHEME_KEY) || "default";
    const customColors = localStorage.getItem(CUSTOM_COLORS_KEY);
    try {
      const custom = customColors ? JSON.parse(customColors) : undefined;
      syncToSupabaseCallback(mode, schemeName, custom);
    } catch {
      syncToSupabaseCallback(mode, schemeName);
    }
  }
}

export function getColorScheme(): ColorScheme {
  if (typeof window === "undefined") return DEFAULT_COLOR_SCHEMES.default;
  
  // Özel renkler var mı kontrol et
  const customColors = localStorage.getItem(CUSTOM_COLORS_KEY);
  if (customColors) {
    try {
      const parsed = JSON.parse(customColors);
      // Dark mode için renkleri ayarla
      const theme = getEffectiveTheme();
      if (theme === "dark") {
        return {
          ...parsed,
          bgBase: parsed.bgBase || "#0f172a",
          bgWarm: parsed.bgWarm || "#1e293b",
          bgCard: parsed.bgCard || "#1e293b",
          textMain: parsed.textMain || "#f1f5f9",
          textMuted: parsed.textMuted || "#94a3b8",
          textLight: parsed.textLight || "#64748b",
        };
      }
      return parsed;
    } catch {
      // Hatalı JSON, varsayılan döndür
    }
  }
  
  // Seçili şema
  const schemeName = localStorage.getItem(COLOR_SCHEME_KEY) || "default";
  const scheme = DEFAULT_COLOR_SCHEMES[schemeName] || DEFAULT_COLOR_SCHEMES.default;
  
  // Dark mode için renkleri ayarla
  const theme = getEffectiveTheme();
  if (theme === "dark") {
    return {
      ...scheme,
      bgBase: "#0f172a",
      bgWarm: "#1e293b",
      bgCard: "#1e293b",
      textMain: "#f1f5f9",
      textMuted: "#94a3b8",
      textLight: "#64748b",
    };
  }
  
  return scheme;
}

export function setColorScheme(schemeName: string, syncToSupabase = true) {
  if (typeof window === "undefined") return;
  localStorage.setItem(COLOR_SCHEME_KEY, schemeName);
  localStorage.removeItem(CUSTOM_COLORS_KEY); // Özel renkleri temizle
  applyTheme();
  
  // Supabase'e senkronize et
  if (syncToSupabase && syncToSupabaseCallback) {
    const mode = getThemeMode();
    syncToSupabaseCallback(mode, schemeName);
  }
}

export function setCustomColors(colors: Partial<ColorScheme>, syncToSupabase = true) {
  if (typeof window === "undefined") return;
  const currentScheme = getColorScheme();
  const customScheme = { ...currentScheme, ...colors, name: "Özel Tema" };
  localStorage.setItem(CUSTOM_COLORS_KEY, JSON.stringify(customScheme));
  localStorage.setItem(COLOR_SCHEME_KEY, "custom");
  applyTheme();
  
  // Supabase'e senkronize et
  if (syncToSupabase && syncToSupabaseCallback) {
    const mode = getThemeMode();
    syncToSupabaseCallback(mode, "custom", customScheme);
  }
}

// Supabase'den tema ayarlarını yükle
export function loadThemeFromSupabase(themeSettings: { themeMode?: string; colorScheme?: string; customColors?: ColorScheme } | null | undefined) {
  if (typeof window === "undefined" || !themeSettings) return;
  
  if (themeSettings.themeMode && (themeSettings.themeMode === "light" || themeSettings.themeMode === "dark" || themeSettings.themeMode === "auto")) {
    localStorage.setItem(THEME_MODE_KEY, themeSettings.themeMode);
  }
  
  if (themeSettings.colorScheme) {
    localStorage.setItem(COLOR_SCHEME_KEY, themeSettings.colorScheme);
    
    if (themeSettings.colorScheme === "custom" && themeSettings.customColors) {
      localStorage.setItem(CUSTOM_COLORS_KEY, JSON.stringify(themeSettings.customColors));
    } else {
      localStorage.removeItem(CUSTOM_COLORS_KEY);
    }
  }
  
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

