// ============================================
// RAM Dosya Atama - Sabitler ve Yapılandırma
// ============================================

import type { Settings } from "@/types";

// ---- Versiyon Bilgisi
export const APP_VERSION = "2.1.0";

// ---- Changelog
export const CHANGELOG: Record<string, string[]> = {
    "2.1.0": [
        "Landing page animasyonları eklendi",
        "Dosya atama bildirimi popup'ı eklendi",
        "Versiyon bildirimi sistemi eklendi",
        "Modüler kod yapısına geçildi",
    ],
    "2.0.0": [
        "Yedek başkan ve devamsızlık için ayarlanabilir puan sistemi",
        "Günlük raporda canlı puan gösterimi",
        "Next.js 15.5.7 güvenlik güncellemesi",
    ],
};

// ---- LocalStorage Anahtarları
export const LS_KEYS = {
    TEACHERS: "dosya_atama_teachers_v2",
    CASES: "dosya_atama_cases_v2",
    HISTORY: "dosya_atama_history_v1",
    LAST_ROLLOVER: "dosya_atama_last_rollover",
    ANNOUNCEMENTS: "dosya_atama_announcements_v1",
    SETTINGS: "dosya_atama_settings_v1",
    PDF_ENTRIES: "dosya_atama_pdf_entries_v1",
    PDF_DATE: "dosya_atama_pdf_date_v1",
    PDF_DATE_ISO: "dosya_atama_pdf_date_iso_v1",
    E_ARCHIVE: "dosya_atama_e_archive_v1",
    LAST_ABSENCE_PENALTY: "dosya_atama_last_absence_penalty",
    LAST_SEEN_VERSION: "dosya_atama_last_seen_version",
    SOUND_ON: "sound_on",
    THEME_MODE: "site_theme_mode",
    COLOR_SCHEME: "site_color_scheme",
    CUSTOM_COLORS: "site_custom_colors",
} as const;

// ---- Varsayılan Ayarlar
export const DEFAULT_SETTINGS: Settings = {
    dailyLimit: 5,
    scoreTest: 10,
    scoreNewBonus: 1,
    scoreTypeY: 1,
    scoreTypeD: 2,
    scoreTypeI: 3,
    backupBonusAmount: 3,
    absencePenaltyAmount: 3,
    musicUrl: "",
    musicPlaying: false,
};

// ---- Dosya Türü Etiketleri
export const CASE_TYPE_LABELS = {
    YONLENDIRME: "Yönlendirme",
    DESTEK: "Destek",
    IKISI: "İkisi",
} as const;

// ---- API Endpoints
export const API_ENDPOINTS = {
    STATE: "/api/state",
    NOTIFY: "/api/notify",
    PDF_IMPORT: "/api/pdf-import",
    LOGIN: "/api/login",
    LOGOUT: "/api/logout",
    SESSION: "/api/session",
    BACKUP: "/api/backup",
    HEALTH: "/api/health",
    FEEDBACK: "/api/feedback",
} as const;

// ---- Supabase Realtime Kanalı
export const REALTIME_CHANNEL = "app-state-sync";

// ---- Animasyon Süreleri (ms)
export const ANIMATION_DURATIONS = {
    TOAST: 2500,
    POPUP: 3000,
    TRANSITION: 300,
} as const;

// ---- Ses Frekansları (Hz)
export const AUDIO_FREQUENCIES = {
    C5: 523.25,
    E5: 659.25,
    G5: 783.99,
    B5: 988,
    C6: 1046.50,
    D6: 1175,
} as const;
