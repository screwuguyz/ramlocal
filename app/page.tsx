"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { z } from "zod";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { format } from "date-fns";
import { tr } from "date-fns/locale/tr";
import { Calendar } from "@/components/ui/calendar";
import MonthlyReport from "@/components/reports/MonthlyReport";
import DailyReport from "@/components/reports/DailyReport";
import Statistics from "@/components/reports/Statistics";
import WeeklyReport from "@/components/reports/WeeklyReport";
import YearlyReport from "@/components/reports/YearlyReport";
import TeacherPerformanceReport from "@/components/reports/TeacherPerformanceReport";
import FileTypeAnalysis from "@/components/reports/FileTypeAnalysis";
import BackupManager from "@/components/BackupManager";
import ThemeSettings from "@/components/ThemeSettings";
import DashboardWidgets from "@/components/DashboardWidgets";
import ThemeToggle from "@/components/ThemeToggle";
import { setSupabaseSyncCallback, loadThemeFromSupabase, getThemeMode, getColorScheme } from "@/lib/theme";
import AssignedArchiveView from "@/components/archive/AssignedArchive";
import AssignedArchiveSingleDayView from "@/components/archive/AssignedArchiveSingleDay";
import { Calendar as CalendarIcon, Trash2, Search, UserMinus, Plus, FileSpreadsheet, BarChart2, Volume2, VolumeX, X, Printer, Loader2, Inbox, FileText, ChevronLeft, ChevronRight } from "lucide-react";

// === YENİ MODÜLER BİLEŞENLER ===
import FeedbackModal from "@/components/modals/FeedbackModal";
import VersionModal from "@/components/modals/VersionModal";
import CalendarView from "@/components/reports/CalendarView";
import QuickSearch from "@/components/search/QuickSearch";
import MiniWidgets from "@/components/dashboard/MiniWidgets";
import { useAppStore } from "@/stores/useAppStore";





// --- Tipler
export type Teacher = {
  id: string;
  name: string;
  isAbsent: boolean;
  absentDay?: string; // Devamsızlık tarihi (YYYY-MM-DD) - rollover için gerekli
  yearlyLoad: number;
  monthly?: Record<string, number>;
  active: boolean;
  pushoverKey?: string;
  isTester: boolean; // <-- YENİ: Testör
  backupDay?: string;
};
type Announcement = { id: string; text: string; createdAt: string };
type PdfAppointment = {
  id: string;
  time: string;
  name: string;
  fileNo: string;
  extra?: string;
};

export type CaseFile = {
  id: string;
  student: string;
  fileNo?: string;
  score: number;
  createdAt: string;      // ISO
  assignedTo?: string;    // teacher.id
  type: "YONLENDIRME" | "DESTEK" | "IKISI";
  isNew: boolean;
  diagCount: number;
  isTest: boolean;
  assignReason?: string;
  absencePenalty?: boolean;
  backupBonus?: boolean;
  sourcePdfEntry?: PdfAppointment; // Randevu listesinden geldiyse, geri yükleme için
}

// E-Arşiv için tip
export type EArchiveEntry = {
  id: string; // case.id
  student: string;
  fileNo?: string;
  assignedToName: string;
  createdAt: string; // ISO
};
function caseDesc(c: CaseFile) {
  if (c.absencePenalty) {
    return c.assignReason || "Devamsızlık sonrası denge puanı (otomatik)";
  }
  let s = `Tür: ${humanType(c.type)} • Yeni: ${c.isNew ? "Evet" : "Hayır"} • Tanı: ${c.diagCount ?? 0}`;
  if (c.isTest) s += " • Test";
  if (c.assignReason) s += ` • Neden: ${c.assignReason}`;
  return s;
}
async function notifyTeacher(userKey: string, title: string, message: string) {
  if (!userKey) return; // key yoksa deneme
  try {
    const res = await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userKey,
        title: title || "Yeni Dosya Atandı",
        message: message || "",
        priority: 0, // normal bildirim (tekrar yok)
      }),
    });
    // Hata olursa console'a yaz (opsiyonel)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      console.warn("notify failed", j);
    }
  } catch (e) {
    console.warn("notify error", e);
  }
}

// ---- Yerel depolama anahtarları
const LS_TEACHERS = "dosya_atama_teachers_v2";
const LS_CASES = "dosya_atama_cases_v2";
const LS_HISTORY = "dosya_atama_history_v1";      // YYYY-MM-DD -> CaseFile[]
const LS_LAST_ROLLOVER = "dosya_atama_last_rollover";
const LS_ANNOUNCEMENTS = "dosya_atama_announcements_v1";
const LS_SETTINGS = "dosya_atama_settings_v1";
const LS_PDF_ENTRIES = "dosya_atama_pdf_entries_v1";
const LS_PDF_DATE = "dosya_atama_pdf_date_v1";
const LS_PDF_DATE_ISO = "dosya_atama_pdf_date_iso_v1";
const LS_E_ARCHIVE = "dosya_atama_e_archive_v1"; // YENİ E-ARŞİV
const LS_LAST_ABSENCE_PENALTY = "dosya_atama_last_absence_penalty";
const LS_LAST_SEEN_VERSION = "dosya_atama_last_seen_version";

// ---- Versiyon ve Changelog
const APP_VERSION = "2.1.0";
const CHANGELOG: Record<string, string[]> = {
  "2.1.0": [
    "Landing page animasyonları eklendi",
    "Dosya atama bildirimi popup'ı eklendi",
    "Versiyon bildirimi sistemi eklendi"
  ],
  "2.0.0": [
    "Yedek başkan ve devamsızlık için ayarlanabilir puan sistemi",
    "Günlük raporda canlı puan gösterimi",
    "Next.js 15.5.7 güvenlik güncellemesi"
  ]
};
// ---- Tarih yardımcıları
function daysInMonth(year: number, month: number) { // month: 1-12
  return new Date(year, month, 0).getDate();
}
function ymOf(dateIso: string) {
  return dateIso.slice(0, 7); // YYYY-MM
}
function nowISO() {
  // Simülasyon modunda simüle edilen tarihi kullan
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const simDate = params.get("simDate");
    if (simDate && /^\d{4}-\d{2}-\d{2}$/.test(simDate)) {
      const now = new Date();
      return `${simDate}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}.000Z`;
    }
  }
  return new Date().toISOString();
}
function ymdLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ---- SİMÜLASYON: URL'de ?simDate=2025-12-06 ile tarih override
function getSimulatedDate(): Date {
  if (typeof window === "undefined") return new Date();
  const params = new URLSearchParams(window.location.search);
  const simDate = params.get("simDate");
  if (simDate && /^\d{4}-\d{2}-\d{2}$/.test(simDate)) {
    return new Date(simDate + "T12:00:00");
  }
  return new Date();
}
function getTodayYmd(): string {
  return ymdLocal(getSimulatedDate());
}
function csvEscape(v: string | number) {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes("\n") || s.includes("\"")) {
    return '"' + s.replaceAll('"', '""') + '"';
  }
  return s;
}

// Küçük benzersiz id üretici
function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// İnsan okunur dosya türü
function humanType(v?: "YONLENDIRME" | "DESTEK" | "IKISI") {
  return v === "YONLENDIRME" ? "Yönlendirme" : v === "DESTEK" ? "Destek" : v === "IKISI" ? "İkisi" : "—";
}

// ---- Ayarlar: günlük limit ve puan ağırlıkları
type Settings = {
  dailyLimit: number;       // öğretmen başına günlük dosya
  scoreTest: number;        // test dosyası puanı
  scoreNewBonus: number;    // yeni dosya bonusu
  scoreTypeY: number;       // yönlendirme
  scoreTypeD: number;       // destek
  scoreTypeI: number;       // ikisi
  // Yedek başkan bonus ayarları (her zaman en yüksek + X)
  backupBonusAmount: number;                   // X değeri (varsayılan 3)
  // Devamsızlık cezası ayarları (her zaman en düşük - X)
  absencePenaltyAmount: number;                // Devamsızlık ceza miktarı (en düşük - X)
};

const DEFAULT_SETTINGS: Settings = {
  dailyLimit: 5,
  scoreTest: 10,
  scoreNewBonus: 1,
  scoreTypeY: 1,
  scoreTypeD: 2,
  scoreTypeI: 3,
  backupBonusAmount: 3,
  absencePenaltyAmount: 3,
};

// Günlük Randevular Kartı (Bileşen)
function DailyAppointmentsCard({
  pdfDate,
  pdfLoading,
  pdfEntries,
  selectedPdfEntryId,
  onShowDetails,
  isAdmin,
  onApplyEntry,
  onRemoveEntry,
  onPrint,
  onClearAll,
  cases,
  history,
}: {
  pdfDate: string | null;
  pdfLoading: boolean;
  pdfEntries: PdfAppointment[];
  selectedPdfEntryId: string | null;
  onShowDetails: (date?: Date) => void;
  isAdmin?: boolean;
  onApplyEntry?: (entry: PdfAppointment) => void;
  onRemoveEntry?: (id: string) => void;
  onPrint?: () => void;
  onClearAll?: () => void;
  cases?: CaseFile[];
  history?: Record<string, CaseFile[]>;
}) {
  return (
    <Card className="border border-emerald-200 bg-emerald-50/70">
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <CardTitle>
          📆 Günlük RAM Randevuları
          {pdfDate && <span className="ml-2 text-sm text-emerald-700 font-normal">({pdfDate})</span>}
        </CardTitle>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className="w-[240px] justify-start text-left font-normal"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {pdfDate ? pdfDate : <span>Tarih seç</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" onSelect={(date) => onShowDetails(date)} initialFocus />
          </PopoverContent>
        </Popover>
        <div className="flex items-center gap-2">
          {onClearAll && (
            <Button size="sm" variant="destructive" onClick={onClearAll} disabled={pdfEntries.length === 0}>
              <Trash2 className="h-4 w-4 mr-1.5" />
              PDF'yi Temizle
            </Button>
          )}
          {onPrint && (
            <Button size="sm" variant="outline" onClick={onPrint} disabled={pdfEntries.length === 0}>
              <Printer className="h-4 w-4 mr-1.5" />
              Yazdır
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => onShowDetails()}>
            Detaylı Gör
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {pdfLoading ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-600">
            <Loader2 className="h-8 w-8 animate-spin mb-3 text-emerald-600" />
            <p className="text-sm">Randevular yükleniyor...</p>
          </div>
        ) : pdfEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Inbox className="h-12 w-12 mb-3 text-slate-400" />
            <p className="text-sm font-medium">Henüz PDF içe aktarılmadı</p>
            <p className="text-xs text-slate-400 mt-1">Randevu listesi boş</p>
          </div>
        ) : (
          <div className="overflow-auto border rounded-md max-h-64">
            <table className="min-w-full text-xs md:text-sm">
              <thead className="bg-emerald-100 text-emerald-900">
                <tr>
                  <th className="p-2 text-left">Saat</th>
                  <th className="p-2 text-left">Ad Soyad</th>
                  <th className="p-2 text-left">Dosya No</th>
                  <th className="p-2 text-left">Açıklama</th>
                  {isAdmin && <th className="p-2 text-right">İşlem</th>}
                </tr>
              </thead>
              <tbody>
                {pdfEntries.map((entry) => {
                  // Bu randevunun atanıp atanmadığını kontrol et
                  let isAssigned = false;
                  if (cases || history) {
                    // Eşleştirme fonksiyonu: ID veya saat+isim+dosyaNo kombinasyonu
                    const matchesEntry = (sourceEntry: PdfAppointment | undefined) => {
                      if (!sourceEntry) return false;
                      // Önce ID'ye göre kontrol et (hızlı)
                      if (sourceEntry.id === entry.id) return true;
                      // ID eşleşmezse, saat + isim + dosya numarasına göre kontrol et
                      // (PDF geri yüklendiğinde ID'ler değişebilir ama bu alanlar aynı kalır)
                      return (
                        sourceEntry.time === entry.time &&
                        sourceEntry.name === entry.name &&
                        (sourceEntry.fileNo || "") === (entry.fileNo || "")
                      );
                    };

                    // cases içinde kontrol et
                    const inCases = cases?.some(c => matchesEntry(c.sourcePdfEntry)) || false;
                    // history içinde kontrol et
                    const inHistory = history ? Object.values(history).some(dayCases =>
                      dayCases.some(c => matchesEntry(c.sourcePdfEntry))
                    ) : false;
                    isAssigned = inCases || inHistory;
                  }

                  return (
                    <tr
                      key={entry.id}
                      className={`border-b last:border-b-0 ${selectedPdfEntryId === entry.id ? "bg-emerald-50" : "bg-white"} ${isAssigned ? "relative opacity-75" : ""}`}
                    >
                      {isAssigned && (
                        <div className="absolute inset-0 pointer-events-none z-10">
                          <div className="absolute top-1/2 left-0 right-0 h-1 bg-red-500 transform -translate-y-1/2 shadow-sm"></div>
                        </div>
                      )}
                      <td className={`p-2 font-semibold relative z-0 ${isAssigned ? "text-red-600" : ""}`}>{entry.time}</td>
                      <td className={`p-2 relative z-0 ${isAssigned ? "text-red-600" : ""}`}>{entry.name}</td>
                      <td className={`p-2 relative z-0 ${isAssigned ? "text-red-600" : ""}`}>{entry.fileNo || "-"}</td>
                      <td className={`p-2 text-xs text-slate-600 relative z-0 ${isAssigned ? "text-red-600" : ""}`}>{entry.extra || "-"}</td>
                      {isAdmin && onApplyEntry && onRemoveEntry && (
                        <td className="p-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="outline" onClick={() => onApplyEntry(entry)}>
                              Forma Aktar
                            </Button>
                            <Button size="icon" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => onRemoveEntry(entry.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DosyaAtamaApp() {
  // Queue state from store
  const { queue, setQueue } = useAppStore();

  // ---- Öğretmenler
  const [teachers, setTeachers] = useState<Teacher[]>([])

  // ---- Dosyalar (BUGÜN)
  const [cases, setCases] = useState<CaseFile[]>([]);

  // ---- ARŞİV (günlük)
  const [history, setHistory] = useState<Record<string, CaseFile[]>>({});
  const [lastRollover, setLastRollover] = useState<string>("");
  const [lastAbsencePenalty, setLastAbsencePenalty] = useState<string>("");
  // ---- E-ARŞİV (sürekli)
  const [eArchive, setEArchive] = useState<EArchiveEntry[]>([]);
  // ---- DEVAMSIZLIK KAYITLARI (Supabase'de saklanır)
  const [absenceRecords, setAbsenceRecords] = useState<Array<{ teacherId: string; date: string }>>([]);

  // --- Canlı yayın (Supabase)
  const clientId = React.useMemo(() => uid(), []);
  const channelRef = React.useRef<RealtimeChannel | null>(null);
  const lastAppliedAtRef = React.useRef<string>("")
  const teachersRef = React.useRef<Teacher[]>([]);
  const casesRef = React.useRef<CaseFile[]>([]);
  const lastAbsencePenaltyRef = React.useRef<string>("");
  const supabaseTeacherCountRef = React.useRef<number>(0); // Koruma: Supabase'deki öğretmen sayısı
  const [live, setLive] = useState<"connecting" | "online" | "offline">("connecting");
  const studentRef = React.useRef<HTMLInputElement | null>(null);
  // ---- Öneri/Şikayet modal durumu
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [fbName, setFbName] = useState("");
  const [fbEmail, setFbEmail] = useState("");
  const [fbType, setFbType] = useState<"oneri" | "sikayet">("oneri");
  const [fbMessage, setFbMessage] = useState("");

  // ---- Girdi durumları
  const [student, setStudent] = useState("");
  const [fileNo, setFileNo] = useState("");
  const [type, setType] = useState<"YONLENDIRME" | "DESTEK" | "IKISI">("YONLENDIRME");
  const [isNew, setIsNew] = useState(false);
  const [diagCount, setDiagCount] = useState(0); // 0-6
  const [isTestCase, setIsTestCase] = useState(false); // <-- YENİ: Test dosyası
  const [newTeacherName, setNewTeacherName] = useState(""); // <-- yeni öğretmen ekleme
  // Geçici Pushover User Key girişleri (öğretmen başına)
  const [editPushover, setEditPushover] = useState<Record<string, string>>({});
  // Pushover input görünürlüğü (öğretmen başına)
  const [editKeyOpen, setEditKeyOpen] = useState<Record<string, boolean>>({});
  // Admin manuel atama alanları
  const [manualTeacherId, setManualTeacherId] = useState<string>("");
  const [manualReason, setManualReason] = useState<string>("");
  // Manuel atama alanı (ref gerekirse ileride kullanırız)
  const manualAssignRef = React.useRef<HTMLDivElement | null>(null);
  const pdfInputRef = React.useRef<HTMLInputElement | null>(null);
  // Duyurular (gün içinde gösterilir, gece sıfırlanır)
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementText, setAnnouncementText] = useState("");
  const [pdfEntries, setPdfEntries] = useState<PdfAppointment[]>([]);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [pdfUploadError, setPdfUploadError] = useState<string | null>(null);
  const [selectedPdfEntryId, setSelectedPdfEntryId] = useState<string | null>(null);
  const [pdfDate, setPdfDate] = useState<string | null>(null);
  const [pdfDateIso, setPdfDateIso] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const activePdfEntry = useMemo(() => pdfEntries.find(e => e.id === selectedPdfEntryId) || null, [pdfEntries, selectedPdfEntryId]);
  // Atanmamış randevuları say (kırmızı çizilmemiş olanlar)
  const pendingAppointmentsCount = useMemo(() => {
    // Eşleştirme fonksiyonu: ID veya saat+isim+dosyaNo kombinasyonu
    const isEntryAssigned = (entry: PdfAppointment) => {
      // cases içinde kontrol et
      const inCases = cases.some((c: CaseFile) => {
        const source = c.sourcePdfEntry;
        if (!source) return false;
        // Önce ID'ye göre kontrol et
        if (source.id === entry.id) return true;
        // ID eşleşmezse, saat + isim + dosya numarasına göre kontrol et
        return (
          source.time === entry.time &&
          source.name === entry.name &&
          (source.fileNo || "") === (entry.fileNo || "")
        );
      });

      // history içinde kontrol et
      const inHistory = Object.values(history).some((dayCases: CaseFile[]) =>
        dayCases.some((c: CaseFile) => {
          const source = c.sourcePdfEntry;
          if (!source) return false;
          if (source.id === entry.id) return true;
          return (
            source.time === entry.time &&
            source.name === entry.name &&
            (source.fileNo || "") === (entry.fileNo || "")
          );
        })
      );

      return inCases || inHistory;
    };

    // Toplam randevu sayısından atananları çıkar
    return pdfEntries.filter(entry => !isEntryAssigned(entry)).length;
  }, [cases, history, pdfEntries]);
  const [isDragging, setIsDragging] = useState(false); // Sürükle-bırak durumu
  // Persist hydration guard: LS'den ilk yükleme bitene kadar yazma yapma
  const [hydrated, setHydrated] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"general" | "theme" | "widgets">("general");
  // Ayarlar (persist)
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const raw = localStorage.getItem(LS_SETTINGS);
      if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as Settings;
    } catch { }
    return DEFAULT_SETTINGS;
  });
  useEffect(() => {
    try { localStorage.setItem(LS_SETTINGS, JSON.stringify(settings)); } catch { }
  }, [settings]);
  // Basit toast altyapısı
  const [toasts, setToasts] = useState<Array<{ id: string; text: string }>>([]);
  function toast(text: string) {
    const id = uid();
    setToasts((prev) => [...prev, { id, text }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2500);
  }

  // Dosya atama bildirimi (büyük animasyonlu popup)
  const [assignmentPopup, setAssignmentPopup] = useState<{ teacherName: string; studentName: string; score: number } | null>(null);
  function showAssignmentPopup(teacherName: string, studentName: string, score: number) {
    setAssignmentPopup({ teacherName, studentName, score });
    window.setTimeout(() => {
      setAssignmentPopup(null);
    }, 3000);
  }
  const [soundOn, setSoundOn] = useState<boolean>(() => {
    try { return localStorage.getItem("sound_on") !== "0"; } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem("sound_on", soundOn ? "1" : "0"); } catch { }
    if (soundOn) resumeAudioIfNeeded();
  }, [soundOn]);
  // Keep a ref in sync with soundOn to avoid stale closures in long-lived listeners
  const soundOnRef = React.useRef(soundOn);
  useEffect(() => { soundOnRef.current = soundOn; }, [soundOn]);
  // Keep a ref in sync with settings to avoid stale closures in callbacks
  const settingsRef = React.useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // Sesli uyarılar (Web Audio API)
  const audioCtxRef = React.useRef<AudioContext | null>(null);
  function getAudioCtx() {
    if (typeof window === "undefined") return null;
    if (!audioCtxRef.current) {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return null;
      audioCtxRef.current = new Ctx();
    }
    return audioCtxRef.current;
  }
  // Kullanıcı etkileşimi ile ses motorunu aç (tarayıcı kısıtları için)
  function resumeAudioIfNeeded() {
    const ctx = getAudioCtx();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => { });
    }
  }
  useEffect(() => {
    const onInteract = () => {
      resumeAudioIfNeeded();
      // Bir kez açılması yeterli, listener'ı kaldır
      document.removeEventListener("pointerdown", onInteract);
      document.removeEventListener("keydown", onInteract);
      document.removeEventListener("touchstart", onInteract);
    };
    document.addEventListener("pointerdown", onInteract, { passive: true });
    document.addEventListener("keydown", onInteract);
    document.addEventListener("touchstart", onInteract, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", onInteract);
      document.removeEventListener("keydown", onInteract);
      document.removeEventListener("touchstart", onInteract);
    };
  }, []);

  // Tüm butonlara genel tıklama sesi (özel sesler ayrıca çalınır)
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!soundOnRef.current) return; // ses kapalıysa hiçbir butonda click sesi çalma
      const el = e.target as HTMLElement | null;
      if (!el) return;
      const btn = el.closest("button");
      if (!btn) return;
      if ((btn as HTMLButtonElement).disabled) return;
      // data-silent ile sessiz işaretlenen butonları atla
      if ((btn as HTMLElement).getAttribute("data-silent") === "true") return;
      playClickSound();
    };
    document.addEventListener("pointerdown", onPointerDown, { capture: true });
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, []);
  // Modern ses efekti: ADSR envelope ile daha profesyonel ton
  function playTone(freq: number, durationSec = 0.14, volume = 0.18, type: OscillatorType = "sine", attack = 0.01, decay = 0.05, sustain = 0.7, release = 0.1) {
    if (!soundOnRef.current) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => { });
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;

    const now = ctx.currentTime;
    const attackEnd = now + attack;
    const decayEnd = attackEnd + decay;
    const releaseStart = now + durationSec - release;

    // ADSR envelope
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, attackEnd);
    gain.gain.linearRampToValueAtTime(volume * sustain, decayEnd);
    gain.gain.setValueAtTime(volume * sustain, releaseStart);
    gain.gain.linearRampToValueAtTime(0, now + durationSec);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationSec);
  }

  // Eski beep fonksiyonu (geriye uyumluluk için)
  function playBeep(freq: number, durationSec = 0.14, volume = 0.18) {
    playTone(freq, durationSec, volume, "sine", 0.01, 0.02, 0.8, 0.05);
  }

  function playAssignSound() {
    // Modern başarı melodisi (majör akor + yükselen melodi)
    resumeAudioIfNeeded();
    const ctx = getAudioCtx();
    if (!ctx) return;

    // C majör akor (C-E-G) - daha zengin ses
    playTone(523.25, 0.2, 0.2, "sine", 0.02, 0.05, 0.7, 0.1);  // C5
    playTone(659.25, 0.2, 0.18, "sine", 0.02, 0.05, 0.7, 0.1); // E5
    playTone(783.99, 0.2, 0.16, "sine", 0.02, 0.05, 0.7, 0.1);  // G5

    // Yükselen melodi
    window.setTimeout(() => playTone(659.25, 0.15, 0.18, "sine", 0.01, 0.03, 0.8, 0.08), 220);
    window.setTimeout(() => playTone(783.99, 0.18, 0.2, "sine", 0.01, 0.03, 0.8, 0.1), 380);
    window.setTimeout(() => playTone(1046.50, 0.2, 0.22, "sine", 0.01, 0.03, 0.8, 0.12), 560); // C6
  }

  function playEmergencySound() {
    // Modern uyarı sesi (daha belirgin ve profesyonel)
    resumeAudioIfNeeded();
    playTone(880, 0.12, 0.25, "square", 0.005, 0.02, 0.9, 0.05);
    window.setTimeout(() => playTone(660, 0.14, 0.25, "square", 0.005, 0.02, 0.9, 0.05), 140);
    window.setTimeout(() => playTone(880, 0.12, 0.28, "square", 0.005, 0.02, 0.9, 0.05), 280);
    window.setTimeout(() => playTone(1100, 0.15, 0.3, "square", 0.005, 0.02, 0.9, 0.05), 420);
  }

  function testSound() {
    // Modern test sesi
    resumeAudioIfNeeded();
    playTone(600, 0.12, 0.2, "sine", 0.01, 0.03, 0.8, 0.05);
    window.setTimeout(() => playTone(900, 0.12, 0.2, "sine", 0.01, 0.03, 0.8, 0.05), 150);
    window.setTimeout(() => playTone(1200, 0.15, 0.22, "sine", 0.01, 0.03, 0.8, 0.08), 300);
  }

  function playClickSound() {
    // Modern hafif tık sesi
    resumeAudioIfNeeded();
    playTone(800, 0.04, 0.1, "sine", 0.001, 0.01, 0.6, 0.02);
  }

  function playAnnouncementSound() {
    // Modern onay tonu (daha melodik)
    resumeAudioIfNeeded();
    playTone(784, 0.1, 0.16, "sine", 0.01, 0.02, 0.8, 0.05); // G5
    window.setTimeout(() => playTone(988, 0.12, 0.18, "sine", 0.01, 0.02, 0.8, 0.06), 120); // B5
    window.setTimeout(() => playTone(1175, 0.14, 0.2, "sine", 0.01, 0.02, 0.8, 0.08), 240); // D6
  }

  // === Duyuru gönder (admin): state'e ekle + tüm öğretmenlere Pushover bildirimi ===
  async function sendAnnouncement() {
    const text = announcementText.trim();
    if (!text) return;
    const createdAt = nowISO();
    const a: Announcement = { id: uid(), text, createdAt };
    setAnnouncements(prev => [...prev, a]);
    setAnnouncementText("");
    toast("Duyuru eklendi");
    // Tüm pushoverKey'i olan öğretmenlere gönder
    const keys = teachers.map(t => t.pushoverKey).filter(Boolean) as string[];
    for (const key of keys) {
      try {
        await fetch("/api/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userKey: key, title: "Duyuru", message: text, priority: 0 })
        });
      } catch { }
    }
  }

  function removeAnnouncement(id: string) {
    setAnnouncements(prev => prev.filter(a => a.id !== id));
  }

  const fetchPdfEntriesFromServer = React.useCallback(async (date?: Date) => {
    setPdfLoading(true);
    try {
      let url = "/api/pdf-import";
      if (date) {
        const dateIso = format(date, "yyyy-MM-dd");
        url += `?date=${dateIso}`;
      }
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPdfEntries([]);
        setPdfDate(null);
        setPdfDateIso(null);
        if (date) toast("Seçilen tarih için randevu listesi bulunamadı.");
        return;
      }
      setPdfEntries(Array.isArray(json.entries) ? json.entries : []);
      setPdfDate(json?.date || null);
      setPdfDateIso(json?.dateIso || null);
    } catch (err) {
      console.warn("pdf fetch failed", err);
      setPdfEntries([]);
      setPdfDate(null);
      setPdfDateIso(null);
    } finally {
      setPdfLoading(false);
    }
  }, []);

  const fetchCentralState = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/state?ts=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) {
        console.error("[fetchCentralState] HTTP error:", res.status);
        return;
      }
      const s = await res.json();
      // Supabase hatası varsa logla
      if (s._error) {
        console.error("[fetchCentralState] Supabase error:", s._error);
        toast(`Supabase bağlantı hatası: ${s._error}`);
      }

      // Supabase'den gelen öğretmen sayısını kaydet (koruma için)
      const supabaseTeacherCount = s.teachers?.length || 0;
      supabaseTeacherCountRef.current = supabaseTeacherCount;
      console.log("[fetchCentralState] Supabase teacher count:", supabaseTeacherCount);

      const incomingTs = Date.parse(String(s.updatedAt || 0));
      const currentTs = Date.parse(String(lastAppliedAtRef.current || 0));
      if (!isNaN(incomingTs) && incomingTs <= currentTs) return;
      lastAppliedAtRef.current = s.updatedAt || new Date().toISOString();

      // KORUMA: Eğer Supabase'de öğretmen yoksa ama mevcut state'te varsa, mevcut state'i koru
      // Ayrıca localStorage henüz yüklenmemişse (hydrated false), Supabase'den gelen boş veriyi kullanma
      const supabaseTeachers = s.teachers ?? [];
      const currentTeachers = teachersRef.current || [];

      // Eğer localStorage henüz yüklenmemişse ve Supabase'de öğretmen yoksa, öğretmenleri güncelleme
      // (localStorage yüklemesi tamamlanana kadar bekle)
      if (!hydrated && supabaseTeachers.length === 0) {
        console.log("[fetchCentralState] localStorage henüz yüklenmedi, öğretmenleri güncellemiyoruz.");
        // Öğretmenleri güncelleme, sadece diğer verileri güncelle
      } else if (supabaseTeachers.length === 0 && currentTeachers.length > 0) {
        console.warn("[fetchCentralState] Supabase'de öğretmen yok ama mevcut state'te var. Mevcut state'i koruyoruz.");
        // Öğretmenleri güncelleme, sadece diğer verileri güncelle
      } else if (supabaseTeachers.length > 0) {
        // Supabase'de öğretmen varsa, onları kullan
        setTeachers(supabaseTeachers);
      }
      // Eğer hem Supabase hem mevcut state boşsa, zaten boş kalacak

      setCases(s.cases ?? []);
      setHistory(s.history ?? {});
      setLastRollover(s.lastRollover ?? "");
      setLastAbsencePenalty(s.lastAbsencePenalty ?? "");
      if (Array.isArray(s.announcements)) {
        const today = getTodayYmd();
        setAnnouncements((s.announcements || []).filter((a: any) => (a.createdAt || "").slice(0, 10) === today));
      }
      if (s.settings) setSettings((prev) => ({ ...prev, ...s.settings }));
      // Tema ayarlarını Supabase'den yükle
      if (s.themeSettings) {
        loadThemeFromSupabase(s.themeSettings);
      }
      // E-Arşiv'i Supabase'den yükle (varsa)
      if (Array.isArray(s.eArchive) && s.eArchive.length > 0) {
        setEArchive(s.eArchive);
      }
      // Devamsızlık kayıtlarını Supabase'den yükle
      if (Array.isArray(s.absenceRecords)) {
        setAbsenceRecords(s.absenceRecords);
      }
      // Queue'yu Supabase'den yükle
      // Eğer Supabase'de queue varsa onu kullan (her zaman Supabase öncelikli)
      if (Array.isArray(s.queue)) {
        // Supabase'de queue var (boş olsa bile array olarak var)
        if (s.queue.length > 0) {
          console.log("[fetchCentralState] Loading queue from Supabase:", s.queue.length, "tickets");
          setQueue(s.queue);
        } else {
          // Supabase'de queue boş array olarak var
          console.log("[fetchCentralState] Supabase queue is empty array");
          setQueue([]); // Boş array olarak set et
        }
      } else {
        // Supabase'de queue property yok
        console.log("[fetchCentralState] No queue property in Supabase state");
        // Local state'te queue varsa onu koru, yoksa boş array set et
        const currentLocalQueue = useAppStore.getState().queue;
        if (Array.isArray(currentLocalQueue) && currentLocalQueue.length > 0) {
          console.log("[fetchCentralState] Keeping local queue:", currentLocalQueue.length, "tickets (will sync to Supabase)");
          // Local queue'yu koru (setQueue çağırma, zaten var)
        } else {
          setQueue([]);
        }
      }
      console.log("[fetchCentralState] Loaded, teachers:", s.teachers?.length || 0, "eArchive:", s.eArchive?.length || 0, "absenceRecords:", s.absenceRecords?.length || 0, "queue:", s.queue?.length || 0);
    } catch (err) {
      console.error("[fetchCentralState] Network error:", err);
    } finally {
      setCentralLoaded(true);
    }
  }, [hydrated, setQueue]);

  function handlePdfFileChange(file: File | null) {
    setPdfFile(file);
    setPdfUploadError(null);
  }

  async function uploadPdfFromFile() {
    if (!pdfFile) {
      toast("Lütfen PDF seçin");
      return;
    }
    const formData = new FormData();
    formData.append("pdf", pdfFile);
    setPdfUploading(true);
    setPdfUploadError(null);
    try {
      const res = await fetch("/api/pdf-import", {
        method: "POST",
        body: formData,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPdfUploadError(json?.error || "PDF yüklenemedi.");
        return;
      }
      setPdfEntries(Array.isArray(json.entries) ? json.entries : []);
      setPdfDate(json?.date || null);
      setPdfDateIso(json?.dateIso || null);
      setSelectedPdfEntryId(null);
      setPdfFile(null);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
      toast("PDF başarıyla içe aktarıldı");
    } catch (err) {
      console.warn("pdf upload failed", err);
      setPdfUploadError("Sunucuya ulaşılamadı.");
    } finally {
      setPdfUploading(false);
    }
  }

  async function clearPdfEntries(confirmFirst = true, bypassAuth = false) {
    if (!pdfEntries.length) return;
    if (confirmFirst && !confirm("Bu tarihin PDF kayıtlarını silmek istiyor musunuz?")) return;
    try {
      // Hem tarihi hem bypassAuth'u query string'e ekle
      const params = new URLSearchParams();
      if (pdfDateIso) params.set("date", pdfDateIso);
      if (bypassAuth) params.set("bypassAuth", "true");
      const qs = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`/api/pdf-import${qs}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(json?.error || "PDF kayıtları silinemedi");
        return;
      }
      setPdfEntries([]);
      setSelectedPdfEntryId(null);
      setPdfFile(null);
      setPdfDate(null);
      setPdfDateIso(null);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
      toast("PDF kayıtları temizlendi");
    } catch (err) {
      console.warn("pdf clear failed", err);
      toast("PDF kayıtları silinemedi");
    }
  }

  async function removePdfEntry(id: string, silent = false) {
    if (!id) return;
    try {
      const res = await fetch(`/api/pdf-import?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (!silent) toast(json?.error || "Kayıt silinemedi");
        return;
      }
      setPdfEntries(prev => prev.filter(entry => entry.id !== id));
      if (selectedPdfEntryId === id) setSelectedPdfEntryId(null);
      if (!silent) toast("Kayıt silindi");
    } catch (err) {
      console.warn("pdf delete failed", err);
      if (!silent) toast("Kayıt silinemedi");
    }
  }

  function applyPdfEntry(entry: PdfAppointment) {
    setStudent(entry.name || "");
    if (entry.fileNo) setFileNo(entry.fileNo);
    setSelectedPdfEntryId(entry.id);
    toast("PDF kaydı forma aktarıldı");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handlePrintPdfList() {
    document.body.classList.add("print-pdf-list");
    window.print();
  }

  function clearActivePdfEntry() {
    setSelectedPdfEntryId(null);
    setStudent("");
    setFileNo("");
    toast("Form temizlendi");
  }

  // ---- Rapor & filtre
  const [reportMode, setReportMode] = useState<"none" | "monthly" | "daily" | "archive" | "e-archive" | "statistics" | "weekly" | "yearly" | "teacher-performance" | "file-type-analysis" | "calendar">("none");

  const [filterYM, setFilterYM] = useState<string>(ymOf(nowISO()));
  // Admin oturum durumu
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [centralLoaded, setCentralLoaded] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginRemember, setLoginRemember] = useState(true); // Beni hatırla
  const [viewMode, setViewMode] = useState<"landing" | "main" | "teacher-tracking" | "archive">("landing");
  const [archivePassword, setArchivePassword] = useState("");
  const [archiveAuthenticated, setArchiveAuthenticated] = useState(false);
  const [archiveSearchTerm, setArchiveSearchTerm] = useState("");
  const [selectedAbsenceDate, setSelectedAbsenceDate] = useState<string | null>(null);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number>(0);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number>(0);
  const [showPdfPanel, setShowPdfPanel] = useState<boolean | Date>(false);
  const [showRules, setShowRules] = useState(false);
  // Versiyon bildirimi (admin olmayan kullanıcılar için)
  const [showVersionPopup, setShowVersionPopup] = useState(false);
  // Admin panel tab sistemi
  const [adminTab, setAdminTab] = useState<"files" | "teachers" | "reports" | "announcements" | "backup">("files");

  // ---- LS'den yükleme (migration alanları)
  useEffect(() => {
    try {
      const tRaw = localStorage.getItem(LS_TEACHERS);
      const cRaw = localStorage.getItem(LS_CASES);
      const hRaw = localStorage.getItem(LS_HISTORY);
      const lrRaw = localStorage.getItem(LS_LAST_ROLLOVER);
      const lapRaw = localStorage.getItem(LS_LAST_ABSENCE_PENALTY);
      const aRaw = localStorage.getItem(LS_ANNOUNCEMENTS);
      const pRaw = localStorage.getItem(LS_PDF_ENTRIES);
      const pdRaw = localStorage.getItem(LS_PDF_DATE);
      const pdIsoRaw = localStorage.getItem(LS_PDF_DATE_ISO);
      const eaRaw = localStorage.getItem(LS_E_ARCHIVE);

      if (tRaw) {
        const arr = JSON.parse(tRaw);
        setTeachers(arr.map((t: any) => ({
          id: t.id,
          name: t.name,
          isAbsent: !!t.isAbsent,
          absentDay: t.absentDay, // Devamsızlık tarihi
          yearlyLoad: Number(t.yearlyLoad || 0),
          monthly: t.monthly ?? {},
          active: t.active ?? true,
          isTester: !!t.isTester, // <-- migration
          pushoverKey: t.pushoverKey, // <-- Pushover anahtarını geri yükle
          backupDay: t.backupDay,
        })));
      }
      if (cRaw) setCases(JSON.parse(cRaw));
      if (hRaw) setHistory(JSON.parse(hRaw));
      if (lrRaw) setLastRollover(lrRaw);
      if (lapRaw) setLastAbsencePenalty(lapRaw);
      // Duyurular: sadece bugüne ait olanları yükle
      if (aRaw) {
        const arr = JSON.parse(aRaw) as Announcement[];
        const today = getTodayYmd();
        setAnnouncements((arr || []).filter(a => (a.createdAt || "").slice(0, 10) === today));
      }
      if (pRaw) {
        try {
          const parsed = JSON.parse(pRaw);
          if (Array.isArray(parsed)) setPdfEntries(parsed);
        } catch { }
      }
      if (pdRaw) setPdfDate(pdRaw);
      if (pdIsoRaw) setPdfDateIso(pdIsoRaw);
      if (eaRaw) setEArchive(JSON.parse(eaRaw));
    } catch { }
    // Hydration tamam
    setHydrated(true);
  }, []);

  useEffect(() => {
    fetchPdfEntriesFromServer();
  }, [fetchPdfEntriesFromServer]);

  useEffect(() => { teachersRef.current = teachers; }, [teachers]);
  useEffect(() => { casesRef.current = cases; }, [cases]);
  useEffect(() => { lastAbsencePenaltyRef.current = lastAbsencePenalty; }, [lastAbsencePenalty]);

  // Duyuruları LS'ye yaz
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(LS_ANNOUNCEMENTS, JSON.stringify(announcements)); } catch { }
  }, [announcements, hydrated]);

  // ---- LS'ye yazma
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(LS_TEACHERS, JSON.stringify(teachers)); } catch { }
  }, [teachers, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(LS_CASES, JSON.stringify(cases)); } catch { }
  }, [cases, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(LS_HISTORY, JSON.stringify(history)); } catch { }
  }, [history, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(LS_LAST_ROLLOVER, lastRollover); } catch { }
  }, [lastRollover, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(LS_LAST_ABSENCE_PENALTY, lastAbsencePenalty); } catch { }
  }, [lastAbsencePenalty, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(LS_PDF_ENTRIES, JSON.stringify(pdfEntries)); } catch { }
  }, [pdfEntries, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    if (pdfDate) {
      try { localStorage.setItem(LS_PDF_DATE, pdfDate); } catch { }
    } else {
      try { localStorage.removeItem(LS_PDF_DATE); } catch { }
    }
  }, [pdfDate, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    if (pdfDateIso) {
      try { localStorage.setItem(LS_PDF_DATE_ISO, pdfDateIso); } catch { }
    } else {
      try { localStorage.removeItem(LS_PDF_DATE_ISO); } catch { }
    }
  }, [pdfDateIso, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(LS_E_ARCHIVE, JSON.stringify(eArchive)); } catch { }
  }, [eArchive, hydrated]);



  // ---- Merkezi durum: açılışta Supabase'den oku (LS olsa bile override et)
  useEffect(() => {
    fetchCentralState();
  }, [fetchCentralState]);

  // ---- ⌨️ KLAVYE KISAYOLLARI
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Escape: Tüm modalları kapat
      if (e.key === "Escape") {
        if (loginOpen) setLoginOpen(false);
        if (settingsOpen) setSettingsOpen(false);
        if (feedbackOpen) setFeedbackOpen(false);
        if (showPdfPanel) setShowPdfPanel(false);
        if (showRules) setShowRules(false);
      }

      // Ctrl+Enter veya Cmd+Enter: Dosya ekle (admin ise)
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && isAdmin && student.trim()) {
        e.preventDefault();
        addCase();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loginOpen, settingsOpen, feedbackOpen, showPdfPanel, showRules, isAdmin, student]);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DISABLE_REALTIME === "1") return;
    const channel = supabase
      .channel("realtime:app_state")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_state" },
        (payload: any) => {
          const targetId = payload?.new?.id ?? payload?.old?.id;
          if (targetId && targetId !== "global") return;
          fetchCentralState();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCentralState]);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DISABLE_REALTIME === "1") return;
    const channel = supabase
      .channel("realtime:ram_pdf_appointments")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ram_pdf_appointments" },
        () => {
          fetchPdfEntriesFromServer();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPdfEntriesFromServer]);
  // Oturum bilgisini sunucudan çek
  useEffect(() => {
    fetch("/api/session").then(r => r.ok ? r.json() : { isAdmin: false })
      .then((d: any) => setIsAdmin(!!d.isAdmin))
      .catch(() => { });
  }, []);

  // Versiyon kontrolü - Admin olmayan kullanıcılar için
  useEffect(() => {
    if (isAdmin || !hydrated) return; // Admin ise veya henüz yüklenmediyse gösterme

    try {
      const lastSeenVersion = localStorage.getItem(LS_LAST_SEEN_VERSION);
      if (lastSeenVersion !== APP_VERSION) {
        setShowVersionPopup(true);
      }
    } catch { }
  }, [isAdmin, hydrated]);
  // === Realtime abonelik: canlı güncelleme + ilk açılışta snapshot ===
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DISABLE_REALTIME === '1') { setLive('offline'); return; }
    const ch = supabase.channel("dosya-atama");
    channelRef.current = ch;

    // 1) Tam state yayınını dinle
    ch.on("broadcast", { event: "state" }, (e) => {
      const p = e.payload as any;
      if (!p || p.sender === clientId) return; // kendi yayınımı alma
      const inc = Date.parse(String(p.updatedAt || 0));
      const cur = Date.parse(String(lastAppliedAtRef.current || 0));
      if (!isNaN(inc) && inc <= cur) return;
      lastAppliedAtRef.current = p.updatedAt || new Date().toISOString();
      setTeachers(p.teachers ?? []);
      setCases(p.cases ?? []);
      if (p.history) setHistory(p.history);
      if (typeof p.lastAbsencePenalty === "string") setLastAbsencePenalty(p.lastAbsencePenalty);
      // Tema ayarlarını güncelle
      if (p.themeSettings) {
        loadThemeFromSupabase(p.themeSettings);
      }
    });

    // 2) İzleyici "hello" derse admin state göndersin
    ch.on("broadcast", { event: "hello" }, (e) => {
      if (!isAdmin) return;                 // sadece admin cevaplar
      if (!hydrated) return;                // LS yüklenmeden varsayılan state'i yayınlama
      const p = e.payload as any;
      if (!p || p.sender === clientId) return;
      const themeMode = getThemeMode();
      const colorSchemeName = typeof window !== "undefined" ? (localStorage.getItem("site_color_scheme") || "default") : "default";
      const customColors = typeof window !== "undefined" ? (() => {
        try {
          const custom = localStorage.getItem("site_custom_colors");
          return custom ? JSON.parse(custom) : undefined;
        } catch {
          return undefined;
        }
      })() : undefined;

      ch.send({
        type: "broadcast",
        event: "state",
        payload: {
          sender: clientId,
          teachers,
          cases,
          history,
          lastAbsencePenalty,
          absenceRecords,
          themeSettings: {
            themeMode,
            colorScheme: colorSchemeName,
            customColors: colorSchemeName === "custom" ? customColors : undefined,
          },
          updatedAt: (lastAppliedAtRef.current || new Date().toISOString())
        },
      });
    });

    // 3) Bağlanınca herkes "hello" göndersin → snapshot iste
    ch.subscribe((status) => {
      setLive(status === "SUBSCRIBED" ? "online" : "connecting");
      if (status === "SUBSCRIBED") {
        ch.send({ type: "broadcast", event: "hello", payload: { sender: clientId } });
      }
    });

    // 4) Temizlik
    return () => {
      setLive("offline");
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    };
  }, [clientId, isAdmin, teachers, cases, history, hydrated, centralLoaded]);

  // === Admin değiştirince herkese yayınla ===
  useEffect(() => {
    if (!isAdmin) return;
    if (!hydrated) return; // LS yüklenmeden yayınlama
    if (!centralLoaded) return; // Merkez yüklenmeden yayınlama
    const ch = channelRef.current;
    if (!ch) return;
    const themeMode = getThemeMode();
    const colorSchemeName = typeof window !== "undefined" ? (localStorage.getItem("site_color_scheme") || "default") : "default";
    const customColors = typeof window !== "undefined" ? (() => {
      try {
        const custom = localStorage.getItem("site_custom_colors");
        return custom ? JSON.parse(custom) : undefined;
      } catch {
        return undefined;
      }
    })() : undefined;

    ch.send({
      type: "broadcast",
      event: "state",
      payload: {
        sender: clientId,
        teachers,
        cases,
        history,
        lastAbsencePenalty,
        themeSettings: {
          themeMode,
          colorScheme: colorSchemeName,
          customColors: colorSchemeName === "custom" ? customColors : undefined,
        },
        updatedAt: (lastAppliedAtRef.current || new Date().toISOString())
      },
    });
  }, [teachers, cases, history, lastAbsencePenalty, isAdmin, clientId, hydrated, centralLoaded]);

  // === Admin değiştirince merkezi state'e de yaz (kalıcılık)
  useEffect(() => {
    if (!isAdmin) return;
    if (!hydrated) return;
    if (!centralLoaded) return;
    
    // KORUMA: Eğer Supabase'de öğretmen varsa ama local'de yoksa, yazma!
    // Bu, yeni tarayıcı/boş localStorage'ın Supabase verisini silmesini önler
    if (supabaseTeacherCountRef.current > 0 && teachers.length === 0) {
      console.warn("[state POST] BLOCKED: Supabase has", supabaseTeacherCountRef.current, "teachers but local has 0. Refusing to overwrite.");
      return;
    }
    
    // KORUMA: Queue boşsa ve Supabase'de queue varsa, yazma!
    // Bu, /api/queue endpoint'inin yazdığı queue'yu silmeyi önler
    // Queue sadece admin panelinde değişiklik yapıldığında yazılmalı
    // /api/queue endpoint'i zaten queue'yu Supabase'e yazıyor
    const currentQueue = useAppStore.getState().queue;
    if (!Array.isArray(currentQueue) || currentQueue.length === 0) {
      // Queue boş, Supabase'e yazma (queue sadece /api/queue veya admin panelinde değişiklik yapıldığında yazılmalı)
      console.log("[state POST] Skipping queue sync - queue is empty (will be written by /api/queue endpoint)");
    }
    
    const ctrl = new AbortController();
    const nowTs = new Date().toISOString();
    lastAppliedAtRef.current = nowTs;
    // Tema ayarlarını payload'a ekle
    const themeMode = getThemeMode();
    const colorSchemeName = typeof window !== "undefined" ? (localStorage.getItem("site_color_scheme") || "default") : "default";
    const customColors = typeof window !== "undefined" ? (() => {
      try {
        const custom = localStorage.getItem("site_custom_colors");
        return custom ? JSON.parse(custom) : undefined;
      } catch {
        return undefined;
      }
    })() : undefined;

    const payload = {
      teachers,
      cases,
      history,
      lastRollover,
      lastAbsencePenalty,
      announcements,
      settings,
      themeSettings: {
        themeMode,
        colorScheme: colorSchemeName,
        customColors: colorSchemeName === "custom" ? customColors : undefined,
      },
      eArchive,
      absenceRecords,
      // Queue'yu sadece boş değilse ekle
      ...(Array.isArray(currentQueue) && currentQueue.length > 0 ? { queue: currentQueue } : {}),
      updatedAt: nowTs,
    };
    const t = window.setTimeout(() => {
      fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      })
        .then(async (res) => {
          if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            console.error("[state POST] Error:", json);
            toast(`Supabase kayıt hatası: ${json?.error || res.status}`);
          } else {
            console.log("[state POST] Success, teachers:", teachers.length, "queue:", currentQueue.length);
          }
        })
        .catch((err) => {
          if (err.name !== "AbortError") {
            console.error("[state POST] Network error:", err);
          }
        });
    }, 300);
    return () => { window.clearTimeout(t); ctrl.abort(); };
  }, [teachers, cases, history, lastRollover, lastAbsencePenalty, announcements, settings, eArchive, absenceRecords, queue, isAdmin, hydrated, centralLoaded]);

  // Tema ayarlarını Supabase'e senkronize et
  useEffect(() => {
    if (!isAdmin) return;
    if (!hydrated) return;

    // Supabase sync callback'i ayarla
    setSupabaseSyncCallback((themeMode, colorScheme, customColors) => {
      // Tema değişikliği olduğunda Supabase'e kaydet
      const nowTs = new Date().toISOString();
      fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teachers,
          cases,
          history,
          lastRollover,
          lastAbsencePenalty,
          announcements,
          settings,
          themeSettings: {
            themeMode,
            colorScheme,
            customColors: colorScheme === "custom" ? customColors : undefined,
          },
          eArchive,
          absenceRecords,
          updatedAt: nowTs,
        }),
      }).catch((err) => {
        console.error("[theme sync] Failed:", err);
      });
    });
  }, [isAdmin, hydrated, teachers, cases, history, lastRollover, lastAbsencePenalty, announcements, settings, eArchive, absenceRecords]);

  async function doLogin(e?: React.FormEvent) {
    e?.preventDefault?.();
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail.trim(), password: loginPassword, remember: loginRemember })
      });
      if (res.ok) {
        setIsAdmin(true);
        setLoginOpen(false);
        setLoginEmail("");
        setLoginPassword("");
        setLoginRemember(true);
      } else {
        alert("Giriş başarısız. E-posta/şifreyi kontrol edin.");
      }
    } catch {
      alert("Giriş sırasında hata oluştu.");
    }
  }
  async function doLogout() {
    try { await fetch("/api/logout", { method: "POST" }); } catch { }
    setIsAdmin(false);
  }

  // ---- Bugün test alıp almadı kontrolü (kilit)
  function hasTestToday(tid: string) {
    const today = getTodayYmd();
    return cases.some(c => c.isTest && !c.absencePenalty && c.assignedTo === tid && c.createdAt.slice(0, 10) === today);
  }
  // Bugün bu öğretmene kaç dosya atanmış (test/normal ayrımı gözetmeksizin)
  function countCasesToday(tid: string) {
    const today = getTodayYmd();
    let n = 0;
    for (const c of cases) {
      if (c.absencePenalty) continue;
      if (c.assignedTo === tid && c.createdAt.slice(0, 10) === today) n++;
    }
    return n;
  }
  // Günlük atama sınırı: bir öğretmene bir günde verilebilecek maksimum dosya
  const MAX_DAILY_CASES = 4;
  // Bugün en son kime atama yapıldı? (liste en yeni başta olduğundan ilk uygun kaydı alır)
  function lastAssignedTeacherToday(): string | undefined {
    const today = getTodayYmd();
    const recent = cases.find(c => !c.absencePenalty && c.createdAt.slice(0, 10) === today && !!c.assignedTo);
    return recent?.assignedTo;
  }

  // ---- Puanlama
  function calcScore() {
    // Test dosyaları ayarlardaki puanı kullanır
    if (isTestCase) return settings.scoreTest;
    let score = 0;
    if (type === "YONLENDIRME") score += settings.scoreTypeY;
    if (type === "DESTEK") score += settings.scoreTypeD;
    if (type === "IKISI") score += settings.scoreTypeI;
    if (isNew) score += settings.scoreNewBonus;
    if (diagCount > 0) score += Math.min(6, Math.max(0, diagCount));
    return score;
  }

  // ---- Otomatik atama (test/normal ayrımı ve kilit)
  // 🔄 ZORUNLU ROTASYON: Aynı kişiye art arda dosya VERİLMEZ (tek kişi kalmadıkça)
  function autoAssign(newCase: CaseFile): Teacher | null {
    const todayYmd = getTodayYmd();
    const lastTid = lastAssignedTeacherToday();

    // Test dosyasıysa: sadece testörler ve bugün test almamış olanlar
    if (newCase.isTest) {
      let testers = teachers.filter(
        (t) => t.isTester && !t.isAbsent && t.active && t.backupDay !== todayYmd && !hasTestToday(t.id) && countCasesToday(t.id) < MAX_DAILY_CASES
      );
      if (!testers.length) return null; // uygun testör yoksa atama yok

      // 🔄 ZORUNLU ROTASYON: Son atanan kişiyi listeden ÇIKAR (birden fazla aday varsa)
      if (testers.length > 1 && lastTid) {
        testers = testers.filter(t => t.id !== lastTid);
      }

      // Sıralama: 1) Yıllık yük en az, 2) Bugün en az dosya alan, 3) Rastgele
      testers.sort((a, b) => {
        const byLoad = a.yearlyLoad - b.yearlyLoad;
        if (byLoad !== 0) return byLoad;
        const byCount = countCasesToday(a.id) - countCasesToday(b.id);
        if (byCount !== 0) return byCount;
        return Math.random() - 0.5;
      });

      const chosen = testers[0];

      const ym = ymOf(newCase.createdAt);
      setTeachers((prev) =>
        prev.map((t) =>
          t.id === chosen.id
            ? {
              ...t,
              yearlyLoad: t.yearlyLoad + newCase.score,
              monthly: { ...(t.monthly || {}), [ym]: (t.monthly?.[ym] || 0) + newCase.score },
            }
            : t
        )
      );

      newCase.assignedTo = chosen.id;
      notifyAssigned(chosen, newCase);
      return chosen;
    }

    // Normal dosyada: bugün test almış olsa da normal dosya verilebilir
    let available = teachers.filter(
      (t) => !t.isAbsent && t.active && t.backupDay !== todayYmd && countCasesToday(t.id) < settings.dailyLimit
    );
    if (!available.length) return null;

    // 🔄 ZORUNLU ROTASYON: Son atanan kişiyi listeden ÇIKAR (birden fazla aday varsa)
    if (available.length > 1 && lastTid) {
      available = available.filter(t => t.id !== lastTid);
    }

    // Sıralama: 1) Yıllık yük en az, 2) Bugün en az dosya alan, 3) Rastgele
    available.sort((a, b) => {
      const byLoad = a.yearlyLoad - b.yearlyLoad;
      if (byLoad !== 0) return byLoad;
      const byCount = countCasesToday(a.id) - countCasesToday(b.id);
      if (byCount !== 0) return byCount;
      return Math.random() - 0.5;
    });

    const chosen = available[0];

    const ym = ymOf(newCase.createdAt);
    setTeachers((prev) =>
      prev.map((t) =>
        t.id === chosen.id
          ? {
            ...t,
            yearlyLoad: t.yearlyLoad + newCase.score,
            monthly: { ...(t.monthly || {}), [ym]: (t.monthly?.[ym] || 0) + newCase.score },
          }
          : t
      )
    );

    newCase.assignedTo = chosen.id;
    notifyAssigned(chosen, newCase);
    return chosen;
  }

  const [triedAdd, setTriedAdd] = useState(false);

  function addCase() {
    setTriedAdd(true);
    if (!student.trim()) {
      toast("Öğrenci adı gerekli");
      return;
    }
    const createdAt = nowISO();
    const newCase: CaseFile = {
      id: uid(),
      student: student.trim() || "(İsimsiz)",
      fileNo: fileNo.trim() || undefined,
      score: calcScore(),
      createdAt,
      type,
      isNew,
      diagCount,
      isTest: isTestCase,
    };
    // Eğer admin öğretmen seçtiyse, manuel atama uygula
    if (manualTeacherId) {
      newCase.assignedTo = manualTeacherId;
      newCase.assignReason = manualReason.trim() || undefined;
      const ym = ymOf(newCase.createdAt);
      setTeachers((prev) =>
        prev.map((t) =>
          t.id === manualTeacherId
            ? {
              ...t,
              yearlyLoad: t.yearlyLoad + newCase.score,
              monthly: { ...(t.monthly || {}), [ym]: (t.monthly?.[ym] || 0) + newCase.score },
            }
            : t
        )
      );
      const chosen = teachers.find((t) => t.id === manualTeacherId);
      if (chosen) {
        notifyAssigned(chosen, newCase);
        playAssignSound();
        showAssignmentPopup(chosen.name, newCase.student, newCase.score);
      }
    } else {
      const chosenAuto = autoAssign(newCase);
      if (chosenAuto) {
        playAssignSound();
        showAssignmentPopup(chosenAuto.name, newCase.student, newCase.score);
      }
    }
    // Eğer PDF randevusundan geldiyse, kaynak bilgisini ekle
    if (selectedPdfEntryId && activePdfEntry) {
      newCase.sourcePdfEntry = activePdfEntry;
    }

    setCases(prev => [newCase, ...prev]);

    // Atama başarılı olduysa ve PDF randevusundan geldiyse, randevu listesinden sil (sadece local state'ten)
    if (selectedPdfEntryId) {
      setPdfEntries(prev => prev.filter(e => e.id !== selectedPdfEntryId));
      setSelectedPdfEntryId(null);
    }

    // reset inputs
    setStudent("");
    setFileNo("");
    setIsNew(false);
    setDiagCount(0);
    setType("YONLENDIRME");
    setIsTestCase(false);
    setFilterYM(ymOf(createdAt));
    // Manuel seçimleri temizle
    setManualTeacherId("");
    setManualReason("");
  }
  // Dosya eklendiğinde E-Arşive de ekle
  useEffect(() => {
    // Bu kancanın sadece yeni bir dosya eklendiğinde çalışmasını sağlamak için
    // ve mevcut dosyaların güncellenmesinden etkilenmemesi için `cases` dizisinin tamamı yerine
    // sadece `cases.length` ve `cases[0]`'ın atanma durumunu dinliyoruz.
    if (!cases.length || !cases[0]) return;
    const lastCase = cases[0]; // En son eklenen dosya
    // Eğer bu dosya zaten arşivde varsa, tekrar ekleme
    if (eArchive.some(entry => entry.id === lastCase.id)) return;
    // Sadece atanmış dosyaları arşive ekle
    if (lastCase.assignedTo) {
      const newArchiveEntry: EArchiveEntry = {
        id: lastCase.id, student: lastCase.student, fileNo: lastCase.fileNo || undefined,
        assignedToName: teacherName(lastCase.assignedTo), createdAt: lastCase.createdAt,
      };
      setEArchive(prev => [newArchiveEntry, ...prev]);
    }
  }, [cases.length, cases[0]?.assignedTo]);

  // ---- Öğretmen ekleme (yeni)
  function addTeacher() {
    const name = newTeacherName.trim();
    if (!name) return;
    setTeachers(prev => [
      { id: uid(), name, isAbsent: false, yearlyLoad: 0, monthly: {}, active: true, isTester: false },
      ...prev,
    ]);
    setNewTeacherName("");
  }

  // ---- Dosya silme (yükleri geri al)
  function removeCase(id: string, skipConfirm = false) {
    const targetNow = cases.find(c => c.id === id);
    if (!targetNow) return;

    const who = `${targetNow.student}${targetNow.fileNo ? ` (${targetNow.fileNo})` : ""}`;
    const hasSourcePdf = !!targetNow.sourcePdfEntry;

    if (!skipConfirm) {
      const msg = hasSourcePdf
        ? `Bu dosyayı geri almak istiyor musunuz?\n${who}\n\nRandevu listesine geri dönecek.`
        : `Bu dosyayı silmek istiyor musunuz?\n${who}`;
      if (!confirm(msg)) return;
    }

    // Eğer PDF randevusundan geldiyse, randevu listesine geri ekle
    if (hasSourcePdf && targetNow.sourcePdfEntry) {
      setPdfEntries(prev => [targetNow.sourcePdfEntry!, ...prev]);
      toast("Dosya geri alındı, randevu listesine eklendi");
    } else {
      toast("Dosya silindi");
    }

    setCases(prev => {
      const target = prev.find(c => c.id === id);
      if (!target) return prev;
      if (target.assignedTo) {
        const ym = ymOf(target.createdAt);
        setTeachers(ts => ts.map(t => {
          if (t.id !== target.assignedTo) return t;
          const nextMonthly = { ...(t.monthly || {}) };
          nextMonthly[ym] = Math.max(0, (nextMonthly[ym] || 0) - target.score);
          return {
            ...t,
            yearlyLoad: Math.max(0, t.yearlyLoad - target.score),
            monthly: nextMonthly,
          };
        }));
      }
      return prev.filter(c => c.id !== id);
    });

    // E-Arşiv'den de sil
    setEArchive(prev => prev.filter(e => e.id !== id));
  }

  // ---- Öğretmen devamsızlık/aktiflik/silme/testör
  function toggleAbsent(tid: string) {
    const today = getTodayYmd();
    // Önce mevcut durumu kontrol et
    const currentTeacher = teachers.find(t => t.id === tid);
    const newAbsent = !currentTeacher?.isAbsent;

    setTeachers(prev => prev.map(t => {
      if (t.id !== tid) return t;
      return {
        ...t,
        isAbsent: newAbsent,
        // Devamsız işaretlenirken tarihi kaydet, uygun yapılırken temizle
        absentDay: newAbsent ? today : undefined
      };
    }));

    // Devamsızlık kaydını Supabase'de sakla/sil
    setAbsenceRecords(prev => {
      if (newAbsent) {
        // Devamsız yapılıyor - kayıt ekle
        const newRecord = { teacherId: tid, date: today };
        if (!prev.find(r => r.teacherId === tid && r.date === today)) {
          return [...prev, newRecord];
        }
        return prev;
      } else {
        // Uygun yapılıyor - kaydı sil
        return prev.filter(r => !(r.teacherId === tid && r.date === today));
      }
    });
  }
  function toggleActive(tid: string) {
    setTeachers(prev => prev.map(t => (t.id === tid ? { ...t, active: !t.active } : t)));
  }
  function toggleTester(tid: string) {
    setTeachers(prev => prev.map(t => (t.id === tid ? { ...t, isTester: !t.isTester } : t)));
  }
  function toggleBackupToday(tid: string) {
    const today = getTodayYmd();
    setTeachers(prev => prev.map(t => {
      if (t.id !== tid) return t;
      const nextBackup = t.backupDay === today ? undefined : today;
      return { ...t, backupDay: nextBackup };
    }));
  }
  function deleteTeacher(tid: string) {
    const t = teachers.find(x => x.id === tid);
    if (!t) return;
    const caseCount = cases.filter(c => c.assignedTo === tid).length;
    const hasLoad = t.yearlyLoad > 0 || Object.values(t.monthly || {}).some(v => v > 0);
    if (caseCount > 0 || hasLoad) {
      alert("Bu öğretmenin geçmiş kaydı var. Silmek raporları etkiler; öğretmen arşivlendi.");
      setTeachers(prev => prev.map(tt => (tt.id === tid ? { ...tt, active: false } : tt)));
      return;
    }
    if (!confirm("Bu öğretmeni kalıcı olarak silmek istiyor musunuz?")) return;
    setTeachers(prev => prev.filter(x => x.id !== tid));
    setCases(prev => prev.map(c => (c.assignedTo === tid ? { ...c, assignedTo: undefined } : c)));
  }

  // ---- Devamsızlar için dengeleme puanı (gün sonu, rollover öncesi)
  const applyAbsencePenaltyForDay = React.useCallback((day: string) => {
    if (!isAdmin) return;
    if (!centralLoaded) return;
    if (!hydrated) return;
    if (lastAbsencePenaltyRef.current === day) return;

    // Çalışan öğretmenler: aktif, o gün devamsız DEĞİL ve o gün yedek DEĞİL
    // absentDay === day kontrolü: öğretmen o gün için devamsız işaretlenmişse çalışmıyor sayılır
    const workingTeachers = teachersRef.current.filter((t) =>
      t.active &&
      t.absentDay !== day && // O gün için devamsız değil
      !t.isAbsent && // Şu an devamsız değil
      t.backupDay !== day
    );
    const workingIds = new Set(workingTeachers.map((t) => t.id));
    const dayWorkingCases = casesRef.current.filter(
      (c) =>
        !c.absencePenalty &&
        c.assignedTo &&
        c.createdAt.slice(0, 10) === day &&
        workingIds.has(c.assignedTo)
    );

    const pointsByTeacher = new Map<string, number>();
    workingTeachers.forEach((t) => pointsByTeacher.set(t.id, 0));
    for (const c of dayWorkingCases) {
      const tid = c.assignedTo as string;
      pointsByTeacher.set(tid, (pointsByTeacher.get(tid) || 0) + c.score);
    }

    const minScore = pointsByTeacher.size ? Math.min(...pointsByTeacher.values()) : 0;
    const { absencePenaltyAmount } = settingsRef.current;
    const penaltyScore = Math.max(0, minScore - absencePenaltyAmount);

    // Devamsız öğretmenler: o gün için devamsız işaretlenmiş VEYA şu an devamsız olan aktif öğretmenler
    const absentTeachers = teachersRef.current.filter((t) =>
      t.active && (t.absentDay === day || t.isAbsent)
    );
    const absentIds = new Set(absentTeachers.map((t) => t.id));

    if (!absentTeachers.length) {
      setLastAbsencePenalty(day);
      lastAbsencePenaltyRef.current = day;
      return;
    }

    const existingPenaltyCases = casesRef.current.filter(
      (c) => c.absencePenalty && c.createdAt.slice(0, 10) === day
    );
    const keepNonPenalty = casesRef.current.filter(
      (c) => !(c.absencePenalty && c.createdAt.slice(0, 10) === day)
    );

    const loadDelta = new Map<string, number>();
    const newPenaltyCases: CaseFile[] = [];
    const reasonText = `Devamsızlık sonrası dengeleme puanı: en düşük ${minScore} - ${absencePenaltyAmount} = ${penaltyScore}`;

    for (const t of absentTeachers) {
      const existing = existingPenaltyCases.find((c) => c.assignedTo === t.id);
      const prevScore = existing?.score ?? 0;
      const score = penaltyScore;
      const createdAt = existing?.createdAt ?? `${day}T23:59:00.000Z`;
      const id = existing?.id ?? uid();
      newPenaltyCases.push({
        id,
        student: `${t.name} - Devamsız`,
        score,
        createdAt,
        assignedTo: t.id,
        type: "DESTEK",
        isNew: false,
        diagCount: 0,
        isTest: false,
        assignReason: reasonText,
        absencePenalty: true,
      });
      const delta = score - prevScore;
      if (delta) loadDelta.set(t.id, (loadDelta.get(t.id) || 0) + delta);
    }

    for (const c of existingPenaltyCases) {
      const tid = c.assignedTo;
      if (!tid) continue;
      if (!absentIds.has(tid)) {
        const delta = -c.score;
        if (delta) loadDelta.set(tid, (loadDelta.get(tid) || 0) + delta);
      }
    }

    let changedCases = existingPenaltyCases.length !== newPenaltyCases.length;
    if (!changedCases) {
      for (const np of newPenaltyCases) {
        const ex = existingPenaltyCases.find((c) => c.assignedTo === np.assignedTo);
        if (!ex || ex.score !== np.score || ex.assignReason !== np.assignReason) {
          changedCases = true;
          break;
        }
      }
    }

    if (changedCases) {
      const nextCases = [...newPenaltyCases, ...keepNonPenalty];
      setCases(nextCases);
      casesRef.current = nextCases;
    }

    if (loadDelta.size > 0) {
      const ym = day.slice(0, 7);
      setTeachers((prev) => {
        const next = prev.map((t) => {
          const delta = loadDelta.get(t.id) || 0;
          if (!delta) return t;
          const nextMonthly = { ...(t.monthly || {}) };
          nextMonthly[ym] = Math.max(0, (nextMonthly[ym] || 0) + delta);
          return {
            ...t,
            yearlyLoad: Math.max(0, t.yearlyLoad + delta),
            monthly: nextMonthly,
          };
        });
        teachersRef.current = next;
        return next;
      });
    }

    setLastAbsencePenalty(day);
    lastAbsencePenaltyRef.current = day;
  }, [isAdmin, centralLoaded, hydrated, setCases, setTeachers, setLastAbsencePenalty]);

  // ---- Başkan yedek: bugün dosya alma, yarın bonusla başlat
  const applyBackupBonusForDay = React.useCallback((day: string) => {
    const backups = teachersRef.current.filter((t) => t.active && t.backupDay === day);
    if (!backups.length) return;

    const dayCases = casesRef.current.filter(
      (c) => !c.absencePenalty && !c.backupBonus && c.assignedTo && c.createdAt.slice(0, 10) === day
    );
    const pointsByTeacher = new Map<string, number>();
    for (const c of dayCases) {
      const tid = c.assignedTo as string;
      pointsByTeacher.set(tid, (pointsByTeacher.get(tid) || 0) + c.score);
    }

    // Ayarlardan bonus miktarını al
    const { backupBonusAmount } = settingsRef.current;
    const maxScore = pointsByTeacher.size ? Math.max(...pointsByTeacher.values()) : 0;

    // Bonus hesapla (her zaman en yüksek + X)
    const bonus = maxScore + backupBonusAmount;
    const reasonText = `Başkan yedek bonusu: en yüksek ${maxScore} + ${backupBonusAmount} = ${bonus}`;
    const ym = day.slice(0, 7);

    // Bonus CaseFile'ları oluştur (günlük raporda görünsün)
    const existingBonusCases = casesRef.current.filter(
      (c) => c.backupBonus && c.createdAt.slice(0, 10) === day
    );
    const keepNonBonus = casesRef.current.filter(
      (c) => !(c.backupBonus && c.createdAt.slice(0, 10) === day)
    );

    const newBonusCases: CaseFile[] = [];
    const loadDelta = new Map<string, number>();

    for (const t of backups) {
      const existing = existingBonusCases.find((c) => c.assignedTo === t.id);
      const prevScore = existing?.score ?? 0;
      const score = bonus;
      const createdAt = existing?.createdAt ?? `${day}T23:58:00.000Z`;
      const id = existing?.id ?? uid();
      newBonusCases.push({
        id,
        student: `${t.name} - Başkan Yedek`,
        score,
        createdAt,
        assignedTo: t.id,
        type: "DESTEK",
        isNew: false,
        diagCount: 0,
        isTest: false,
        assignReason: reasonText,
        backupBonus: true,
      });
      const delta = score - prevScore;
      if (delta) loadDelta.set(t.id, (loadDelta.get(t.id) || 0) + delta);
    }

    // Cases güncelle
    const nextCases = [...newBonusCases, ...keepNonBonus];
    setCases(nextCases);
    casesRef.current = nextCases;

    // Teachers güncelle
    setTeachers((prev) => {
      const next = prev.map((t) => {
        if (t.backupDay !== day) return t;
        const delta = loadDelta.get(t.id) || 0;
        const nextMonthly = { ...(t.monthly || {}) };
        nextMonthly[ym] = Math.max(0, (nextMonthly[ym] || 0) + delta);
        return {
          ...t,
          backupDay: undefined,
          yearlyLoad: Math.max(0, t.yearlyLoad + delta),
          monthly: nextMonthly,
        };
      });
      teachersRef.current = next;
      return next;
    });
  }, [setTeachers, setCases]);

  // ---- ROLLOVER: Gece 00:00 arşivle & sıfırla
  function doRollover() {
    const dayOfCases = cases[0]?.createdAt.slice(0, 10) || getTodayYmd();
    applyAbsencePenaltyForDay(dayOfCases);
    applyBackupBonusForDay(dayOfCases);
    const sourceCases = casesRef.current.length ? casesRef.current : cases;
    const nextHistory: Record<string, CaseFile[]> = { ...history };
    for (const c of sourceCases) {
      const day = c.createdAt.slice(0, 10); // ISO gün
      nextHistory[day] = [...(nextHistory[day] || []), c];
    }
    setHistory(nextHistory);
    setCases([]); // bugünkü liste sıfırlansın (kilitler de sıfırlanır)
    setLastRollover(getTodayYmd());
  }

  // Uygulama açıldığında kaçırılmış rollover varsa uygula, sonra bir sonraki gece için zamanla
  useEffect(() => {
    const today = getTodayYmd();
    if (lastRollover && lastRollover !== today) {
      doRollover();
    } else if (!lastRollover) {
      setLastRollover(today);
    }

    function msToNextMidnight() {
      const now = new Date();
      const next = new Date(now);
      next.setHours(24, 0, 0, 0); // bugün 24:00 = yarın 00:00
      return next.getTime() - now.getTime();
    }

    let timeoutId: number | undefined;
    function schedule() {
      timeoutId = window.setTimeout(() => {
        doRollover();  // 00:00’da arşivle & sıfırla
        schedule();    // ertesi gün için tekrar kur
      }, msToNextMidnight());
    }
    schedule();
    return () => { if (timeoutId) clearTimeout(timeoutId); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastRollover, cases, history]);

  // ---- Liste filtreleme
  // "Dosyalar" sadece BUGÜN
  const filteredCases = useMemo(
    () => cases.filter(c => c.createdAt.slice(0, 10) === getTodayYmd()),
    [cases]
  );

  // ---- Canlı puan hesaplama (Yedek Başkan ve Devamsız için)
  const liveScores = useMemo(() => {
    const today = getTodayYmd();

    // Çalışan öğretmenler: aktif, devamsız DEĞİL ve bugün yedek DEĞİL
    const workingTeachers = teachers.filter((t) => t.active && !t.isAbsent && t.backupDay !== today);
    const workingIds = new Set(workingTeachers.map((t) => t.id));

    // Bugünkü çalışan öğretmenlerin dosyaları (ceza/bonus hariç)
    const todayCases = cases.filter(
      (c) => !c.absencePenalty && !c.backupBonus && c.assignedTo && c.createdAt.slice(0, 10) === today && workingIds.has(c.assignedTo)
    );

    // Öğretmen başına puan hesapla
    const pointsByTeacher = new Map<string, number>();
    workingTeachers.forEach((t) => pointsByTeacher.set(t.id, 0));
    for (const c of todayCases) {
      const tid = c.assignedTo as string;
      pointsByTeacher.set(tid, (pointsByTeacher.get(tid) || 0) + c.score);
    }

    const scores = Array.from(pointsByTeacher.values());
    const maxScore = scores.length ? Math.max(...scores) : 0;
    const minScore = scores.length ? Math.min(...scores) : 0;

    // Yedek başkan için hesaplanan bonus (her zaman en yüksek + X)
    const backupBonus = maxScore + settings.backupBonusAmount;

    // Devamsız için hesaplanan ceza puanı (her zaman en düşük - X)
    const absencePenalty = Math.max(0, minScore - settings.absencePenaltyAmount);

    return {
      maxScore,
      minScore,
      backupBonus,
      absencePenalty,
      workingCount: workingTeachers.length,
    };
  }, [cases, teachers, settings.backupBonusAmount, settings.absencePenaltyAmount]);

  // Seçili aya ait (YYYY-MM) tüm kayıtlar (arşiv + bugün)
  function getCasesForMonth(ym: string) {
    const inHistory = Object.entries(history)
      .filter(([day]) => day.startsWith(ym))
      .flatMap(([, arr]) => arr);
    const inToday = cases.filter(c => c.createdAt.slice(0, 7) === ym);
    return [...inHistory, ...inToday].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  // Ay seçimleri: arşivdeki aylar + bugünkü ay
  const allMonths = useMemo(() => {
    const set = new Set<string>();
    Object.keys(history).forEach(d => set.add(d.slice(0, 7)));
    cases.forEach(c => set.add(ymOf(c.createdAt)));
    if (set.size === 0) set.add(ymOf(nowISO()));
    return Array.from(set).sort();
  }, [history, cases]);

  function teacherName(id?: string) {
    if (!id) return "—";
    return teachers.find(t => t.id === id)?.name || "(silinmiş)";
  }

  function teacherById(id?: string) {
    if (!id) return undefined;
    return teachers.find(t => t.id === id);
  }

  // === ACİL: Öğrenci beklemesin → tekrarlı alarm (priority 2)
  async function notifyEmergencyNow(c: CaseFile) {
    playEmergencySound();
    const t = teacherById(c.assignedTo);
    if (!t || !t.pushoverKey) {
      alert("Bu dosyada atanmış öğretmenin Pushover anahtarı yok.");
      return;
    }
    const desc = `Tür: ${humanType(c.type)} • Yeni: ${c.isNew ? "Evet" : "Hayır"} • Tanı: ${c.diagCount ?? 0}`;
    try {
      const res = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userKey: t.pushoverKey,
          title: "ACİL: Öğrenci Bekliyor",
          message: `${t.name}, ${c.student} bekliyor. Lütfen hemen gelin. (${desc})`,
          priority: 0, // non-emergency: tekrar yok
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert("Acil bildirim hatası: " + (j?.errors?.[0] || JSON.stringify(j)));
      }
    } catch {
      alert("Acil bildirim gönderilemedi.");
    }
  }

  // ---- CSV dışa aktar (arşiv + bugün, seçili ay)
  function exportCSV() {
    const headers = ['DosyaID', 'Öğrenci', 'Tür', 'Yeni', 'Tanı', 'Puan', 'Tarih', 'Ay', 'Test', 'Atanan Öğretmen'];
    const fmt = (iso: string) => new Date(iso).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });

    const data = getCasesForMonth(filterYM);
    const rows = data.map((c) => [
      c.id,
      c.student,
      humanType(c.type),
      c.isNew ? 'Evet' : 'Hayır',
      c.diagCount ?? 0,
      c.score,
      fmt(c.createdAt),
      ymOf(c.createdAt),
      c.isTest ? 'Evet' : 'Hayır',
      teacherName(c.assignedTo),
    ]);
    const csv = [headers, ...rows].map((r) => r.map(csvEscape).join(',')).join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dosyalar_${filterYM}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---- E-Arşiv sıfırlama
  function clearEArchive() {
    if (confirm("Tüm e-arşiv kayıtlarını kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.")) {
      setEArchive([]);
      toast("E-arşiv temizlendi.");
    }
  }

  // ---- E-Arşiv için CSV dışa aktarma
  function exportEArchiveCSV() {
    const headers = ['Öğrenci Adı', 'Dosya No', 'Atanan Öğretmen', 'Atama Tarihi'];
    const rows = eArchive.map((entry) => [
      entry.student,
      entry.fileNo || '',
      entry.assignedToName,
      new Date(entry.createdAt).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }),
    ]);
    const csv = [headers, ...rows].map((r) => r.map(csvEscape).join(',')).join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `e-arsiv_${getTodayYmd()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // E-Arşiv Görüntüleme Bileşeni
  function EArchiveView({ showAdminButtons = false }: { showAdminButtons?: boolean }) {
    const [searchStudent, setSearchStudent] = useState("");
    const [searchFileNo, setSearchFileNo] = useState("");
    const [filterTeacher, setFilterTeacher] = useState<string>("");
    const [dateFrom, setDateFrom] = useState<string>("");
    const [dateTo, setDateTo] = useState<string>("");

    // Filtrelenmiş liste
    const filteredArchive = useMemo(() => {
      let filtered = [...eArchive];

      // Öğrenci adına göre filtrele
      if (searchStudent.trim()) {
        const searchLower = searchStudent.toLowerCase().trim();
        filtered = filtered.filter(e =>
          e.student.toLowerCase().includes(searchLower)
        );
      }

      // Dosya numarasına göre filtrele
      if (searchFileNo.trim()) {
        const searchLower = searchFileNo.toLowerCase().trim();
        filtered = filtered.filter(e =>
          e.fileNo?.toLowerCase().includes(searchLower)
        );
      }

      // Öğretmen bazlı filtrele
      if (filterTeacher) {
        filtered = filtered.filter(e => e.assignedToName === filterTeacher);
      }

      // Tarih aralığı filtreleme
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        filtered = filtered.filter(e => {
          const entryDate = new Date(e.createdAt);
          entryDate.setHours(0, 0, 0, 0);
          return entryDate >= fromDate;
        });
      }

      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        filtered = filtered.filter(e => {
          const entryDate = new Date(e.createdAt);
          return entryDate <= toDate;
        });
      }

      // Tarihe göre sırala (en yeni üstte)
      return filtered.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }, [eArchive, searchStudent, searchFileNo, filterTeacher, dateFrom, dateTo]);

    // Tüm öğretmen isimlerini al (filtreleme için)
    const teacherNames = useMemo(() => {
      const names = new Set(eArchive.map(e => e.assignedToName));
      return Array.from(names).sort();
    }, [eArchive]);

    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>🗄️ E-Arşiv (Tüm Atanmış Dosyalar)</CardTitle>
          <div className="flex items-center gap-2">
            {/* Silme butonu sadece admin'e gösterilir */}
            {showAdminButtons && (
              <Button variant="destructive" onClick={clearEArchive}><Trash2 className="h-4 w-4 mr-2" /> Arşivi Temizle</Button>
            )}
            <Button onClick={exportEArchiveCSV}><FileSpreadsheet className="h-4 w-4 mr-2" /> CSV Olarak İndir</Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Arama ve Filtreleme */}
          <div className="mb-4 space-y-3 p-4 bg-slate-50 rounded-lg border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-600 mb-1 block">🔍 Öğrenci Adı</Label>
                <Input
                  placeholder="Öğrenci adına göre ara..."
                  value={searchStudent}
                  onChange={(e) => setSearchStudent(e.target.value)}
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1 block">📁 Dosya No</Label>
                <Input
                  placeholder="Dosya numarasına göre ara..."
                  value={searchFileNo}
                  onChange={(e) => setSearchFileNo(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-slate-600 mb-1 block">👨‍🏫 Öğretmen</Label>
                <Select value={filterTeacher} onValueChange={setFilterTeacher}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Tüm öğretmenler" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Tüm öğretmenler</SelectItem>
                    {teacherNames.map(name => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1 block">📅 Başlangıç Tarihi</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1 block">📅 Bitiş Tarihi</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
            {(searchStudent || searchFileNo || filterTeacher || dateFrom || dateTo) && (
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-xs text-slate-600">
                  {filteredArchive.length} sonuç bulundu (toplam {eArchive.length})
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSearchStudent("");
                    setSearchFileNo("");
                    setFilterTeacher("");
                    setDateFrom("");
                    setDateTo("");
                  }}
                  className="h-7 text-xs"
                >
                  ✕ Filtreleri Temizle
                </Button>
              </div>
            )}
          </div>

          {eArchive.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="text-4xl mb-3">📭</div>
              <div className="font-medium">E-Arşiv boş</div>
              <div className="text-sm">Henüz atanmış dosya bulunmuyor.</div>
            </div>
          ) : filteredArchive.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="text-4xl mb-3">🔍</div>
              <div className="font-medium">Sonuç bulunamadı</div>
              <div className="text-sm">Arama kriterlerinize uygun dosya yok.</div>
            </div>
          ) : (
            <div className="overflow-auto border rounded-md max-h-[70vh]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted"><tr><th className="p-2 text-left">Öğrenci Adı</th><th className="p-2 text-left">Dosya No</th><th className="p-2 text-left">Atanan Öğretmen</th><th className="p-2 text-left">Atama Tarihi</th></tr></thead>
                <tbody>
                  {filteredArchive.map(entry => (
                    <tr key={entry.id} className="border-t hover:bg-slate-50">
                      <td className="p-2 font-medium">{entry.student}</td><td className="p-2">{entry.fileNo || '—'}</td><td className="p-2">{entry.assignedToName}</td><td className="p-2">{new Date(entry.createdAt).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
  // ---- JSON yedek / içe aktar (arşiv dahil)
  function exportJSON() {
    const data = { teachers, cases, history, lastRollover, lastAbsencePenalty };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    a.href = url;
    a.download = `yedek_${ts}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---- CSV dışa aktar (ayrıştırılmış sütunlar)
  function exportCSV2() {
    const headers = [
      "DosyaID", "DosyaNo", "Öğrenci", "Tür", "Yeni", "Yeni(1/0)",
      "Tanı", "Puan", "Tarih", "Saat", "Gün", "Ay", "Yıl", "ISO",
      "Test", "Test(1/0)", "Atanan Öğretmen", "Neden"
    ];
    const data = getCasesForMonth(filterYM);
    const rows = data.map((c) => {
      const d = new Date(c.createdAt);
      const tarih = d.toLocaleDateString('tr-TR');
      const saat = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      const gun = String(d.getDate()).padStart(2, '0');
      const ay = String(d.getMonth() + 1).padStart(2, '0');
      const yil = String(d.getFullYear());
      return [
        c.id,
        c.fileNo || '',
        c.student,
        humanType(c.type),
        c.isNew ? 'Evet' : 'Hayır',
        c.isNew ? 1 : 0,
        c.diagCount ?? 0,
        c.score,
        tarih,
        saat,
        gun,
        ay,
        yil,
        c.createdAt,
        c.isTest ? 'Evet' : 'Hayır',
        c.isTest ? 1 : 0,
        teacherName(c.assignedTo),
        c.assignReason || ''
      ];
    });
    const csv = [headers, ...rows].map((r) => r.map(csvEscape).join(',')).join('\r\n');
    const bom = '\ufeff';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dosyalar_${filterYM}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function handleImportJSON(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const TeacherSchema = z.object({
          id: z.string(),
          name: z.string(),
          isAbsent: z.boolean(),
          yearlyLoad: z.number(),
          monthly: z.record(z.number()).optional(),
          active: z.boolean(),
          pushoverKey: z.string().optional(),
          isTester: z.boolean(),
          backupDay: z.string().optional(),
        });
        const CaseFileSchema = z.object({
          id: z.string(),
          student: z.string(),
          fileNo: z.string().optional(),
          score: z.number(),
          createdAt: z.string(),
          assignedTo: z.string().optional(),
          type: z.union([z.literal("YONLENDIRME"), z.literal("DESTEK"), z.literal("IKISI")]),
          isNew: z.boolean(),
          diagCount: z.number(),
          isTest: z.boolean(),
          assignReason: z.string().optional(),
          absencePenalty: z.boolean().optional(),
        });
        const BackupSchema = z.object({
          teachers: z.array(TeacherSchema),
          cases: z.array(CaseFileSchema),
          history: z.record(z.array(CaseFileSchema)).default({}),
          lastRollover: z.string().optional(),
          lastAbsencePenalty: z.string().optional(),
        });

        const safe = BackupSchema.safeParse(parsed);
        if (!safe.success) {
          console.error(safe.error);
          alert("Geçersiz JSON: veri şeması hatalı.");
          return;
        }
        const data = safe.data;
        setTeachers(data.teachers);
        setCases(data.cases);
        setHistory(data.history || {});
        setLastRollover(data.lastRollover || getTodayYmd());
        setLastAbsencePenalty(data.lastAbsencePenalty || "");
      } catch {
        alert("JSON okunamadı.");
      } finally {
        e.currentTarget.value = "";
      }
    };
    reader.readAsText(file);
  }
  // === Pushover Test Bildirimi ===
  async function testNotifyTeacher(t: Teacher) {
    if (!t.pushoverKey) {
      alert("Bu öğretmenin Pushover User Key’i boş.");
      return;
    }
    try {
      const res = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userKey: t.pushoverKey,
          title: "Test Bildirim",
          message: `${t.name} için test bildirimi`,
          priority: 0, // normal
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert("Bildirim hatası: " + (json?.errors?.[0] || JSON.stringify(json)));
      } else {
        alert("Test bildirimi gönderildi!");
      }
    } catch {
      alert("Bildirim gönderilemedi.");
    }
  }
  // === Otomatik atamada/yeniden atamada haber ver ===
  async function notifyAssigned(t: Teacher, c: CaseFile) {
    if (!t?.pushoverKey) return; // key yoksa sessizce çık
    const desc = `Tür: ${humanType(c.type)} • Yeni: ${c.isNew ? "Evet" : "Hayır"} • Tanı: ${c.diagCount ?? 0}`;
    try {
      await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userKey: t.pushoverKey,
          title: "📁 Yeni Dosya Atandı",
          message: `${t.name} için dosya: ${c.student}\n${desc}`,
          priority: 0, // normal
        }),
      });
    } catch { }
  }



  // ---- Atanan Dosyalar: dış bileşen kullanılacak (AssignedArchiveView)
  function AssignedArchiveSingleDay() {
    const days = React.useMemo(() => {
      const set = new Set<string>(Object.keys(history));
      const todayYmd = getTodayYmd();
      if (cases.some((c) => c.createdAt.slice(0, 10) === todayYmd)) set.add(todayYmd);
      return Array.from(set).sort();
    }, [history, cases]);

    const [day, setDay] = React.useState<string>(() => {
      const today = getTodayYmd();
      if (days.length === 0) return today;
      return days.includes(today) ? today : days[days.length - 1];
    });

    // Gün listesi değişirse mevcut gün yoksa en yakın son güne git
    React.useEffect(() => {
      if (days.length === 0) return;
      if (!days.includes(day)) setDay(days[days.length - 1]);
    }, [days, day]);

    const list = React.useMemo(() => {
      return [
        ...(history[day] || []),
        ...cases.filter((c) => c.createdAt.slice(0, 10) === day),
      ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }, [day, history, cases]);

    const idx = days.indexOf(day);
    const prevDisabled = idx <= 0;
    const nextDisabled = idx === -1 || idx >= days.length - 1;
    const [openExplainId, setOpenExplainId] = React.useState<string | null>(null);
    const [aiOpenId, setAiOpenId] = React.useState<string | null>(null);
    const [aiLoading, setAiLoading] = React.useState(false);
    const [aiMessages, setAiMessages] = React.useState<Array<{ role: 'user' | 'assistant', content: string }>>([]);
    const [aiInput, setAiInput] = React.useState("");

    function explainWhy(c: CaseFile): string {
      const t = teacherById(c.assignedTo);
      if (!t) return "ATANAN ÖĞRETMEN BULUNAMADI.";
      if (c.assignReason) {
        return `BU DOSYA YÖNETİCİ TARAFINDAN MANUEL OLARAK '${t.name}' ÖĞRETMENİNE ATANMIŞTIR. NEDEN: ${c.assignReason}.`;
      }
      const reasons: string[] = [];
      if (c.isTest) {
        reasons.push("DOSYA TEST OLDUĞU İÇİN SADECE TESTÖR ÖĞRETMENLER DEĞERLENDİRİLDİ.");
      }
      reasons.push("UYGUNLUK FİLTRELERİ: AKTİF, DEVAMSIZ DEĞİL, BUGÜN TEST ALMAMIŞ, GÜNLÜK SINIRI AŞMAMIŞ.");
      reasons.push("SIRALAMA: ÖNCE YILLIK YÜK AZ, EŞİTSE BUGÜNKÜ DOSYA SAYISI AZ, SONRA RASTGELE.");
      reasons.push("ART ARDA AYNI ÖĞRETMENE ATAMA YAPMAMAK İÇİN MÜMKÜNSE FARKLI ÖĞRETMEN TERCİH EDİLDİ.");
      reasons.push(`GÜNLÜK ÜST SINIR: ÖĞRETMEN BAŞINA EN FAZLA ${MAX_DAILY_CASES} DOSYA.`);
      reasons.push(`SEÇİM SONUCU: '${t.name}' BU KRİTERLERE GÖRE EN UYGUN ADAYDI.`);
      return reasons.join(" ");
    }

    return (
      <Card className="mt-4">
        <CardHeader className="flex items-center justify-between">
          <CardTitle>📋 Atanan Dosyalar (Tek Gün)</CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={prevDisabled} onClick={() => !prevDisabled && setDay(days[idx - 1])}>
              Önceki
            </Button>
            <Select value={day} onValueChange={setDay}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Gün seç" /></SelectTrigger>
              <SelectContent>
                {days.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" disabled={nextDisabled} onClick={() => !nextDisabled && setDay(days[idx + 1])}>
              Sonraki
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full text-sm border border-border">
              <thead>
                <tr className="bg-muted">
                  <th className="p-2 text-left">Öğrenci</th>
                  <th className="p-2 text-right">Puan</th>
                  <th className="p-2 text-left">Saat</th>
                  <th className="p-2 text-left">Atanan</th>
                  <th className="p-2 text-left">Test</th>
                  <th className="p-2 text-left">Açıklama</th>
                  <th className="p-2 text-left">Neden?</th>
                  <th className="p-2 text-left">Yapay Zeka</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <React.Fragment key={c.id}>
                    <tr className="border-t">
                      <td className="p-2">{c.student}</td>
                      <td className="p-2 text-right">{c.score}</td>
                      <td className="p-2">
                        {new Date(c.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="p-2">{teacherName(c.assignedTo)}</td>
                      <td className="p-2">{c.isTest ? `Evet (+${settings.scoreTest})` : "Hayır"}</td>
                      <td className="p-2 text-sm text-muted-foreground">{caseDesc(c)}</td>
                      <td className="p-2">
                        {!isAdmin && (
                          <Button size="sm" variant="outline" onClick={() => setOpenExplainId(id => id === c.id ? null : c.id)}>
                            NEDEN?
                          </Button>
                        )}
                      </td>
                      <td className="p-2">
                        {!isAdmin && (
                          <Button size="sm" onClick={() => {
                            setAiOpenId(prev => prev === c.id ? null : c.id);
                            setAiMessages(prev => prev.length ? prev : [{ role: 'user', content: 'Bu dosyayı neden bu öğretmen aldı?' }]);
                          }}>YAPAY ZEKA İLE AÇIKLA</Button>
                        )}
                      </td>
                    </tr>
                    {openExplainId === c.id && (
                      <tr className="border-t bg-slate-50">
                        <td className="p-3" colSpan={7}>
                          <div className="text-sm leading-relaxed">
                            {explainWhy(c)}
                          </div>
                        </td>
                      </tr>
                    )}
                    {aiOpenId === c.id && (
                      <tr className="border-t bg-white">
                        <td className="p-3" colSpan={8}>
                          <div className="border rounded-md p-3 space-y-3">
                            <div className="font-medium">Yapay Zeka Açıklaması</div>
                            <div className="space-y-2 max-h-64 overflow-auto">
                              {aiMessages.map((m, idx) => (
                                <div key={idx} className={m.role === 'user' ? 'text-slate-800' : 'text-emerald-800'}>
                                  <span className="text-xs uppercase font-semibold mr-2">{m.role === 'user' ? 'Siz' : 'Asistan'}</span>
                                  <span>{m.content}</span>
                                </div>
                              ))}
                            </div>
                            <form className="flex gap-2" onSubmit={async (e) => {
                              e.preventDefault();
                              const q = aiInput.trim() || 'Bu dosyayı neden bu öğretmen aldı?';
                              setAiMessages(msgs => [...msgs, { role: 'user', content: q }]);
                              setAiInput('');
                              setAiLoading(true);
                              try {
                                const rules = [
                                  'ÖNCE TEST DOSYALARI YALNIZCA TESTÖR ÖĞRETMENLERE ATANIR.',
                                  'UYGUNLUK: AKTİF, DEVAMSIZ DEĞİL, BUGÜN TEST ALMAMIŞ, GÜNLÜK SINIRI AŞMAMIŞ.',
                                  'SIRALAMA: ÖNCE YILLIK YÜK AZ → DAHA SONRA BUGÜN ALINAN DOSYA SAYISI AZ → RASTGELE.',
                                  'ARDIŞIK AYNI ÖĞRETMENE ATAMA YAPILMAZSA TERCİH EDİLİR.',
                                  `GÜNLÜK ÜST SINIR: ÖĞRETMEN BAŞINA EN FAZLA ${MAX_DAILY_CASES} DOSYA.`,
                                ];
                                const res = await fetch('/api/explain', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    question: q,
                                    caseFile: c,
                                    selectedTeacher: teacherById(c.assignedTo),
                                    rules,
                                    context: { today: day, countsToday: Object.fromEntries(teachers.map(t => [t.id, countCasesToday(t.id)])) },
                                  }),
                                });
                                const json = await res.json();
                                const answer = json?.answer || json?.error || '(Yanıt alınamadı)';
                                setAiMessages(msgs => [...msgs, { role: 'assistant', content: String(answer) }]);
                              } catch (err: any) {
                                setAiMessages(msgs => [...msgs, { role: 'assistant', content: 'Bir hata oluştu.' }]);
                              } finally {
                                setAiLoading(false);
                              }
                            }}>
                              <Input
                                value={aiInput}
                                onChange={(e) => setAiInput(e.target.value)}
                                placeholder="Sorunuzu yazın..."
                                className="flex-1"
                              />
                              <Button type="submit" disabled={aiLoading}>{aiLoading ? 'Gönderiliyor...' : 'Gönder'}</Button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {list.length === 0 && (
                  <tr>
                    <td className="p-8 text-center" colSpan={6}>
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <Inbox className="h-10 w-10 mb-2 text-slate-400" />
                        <p className="text-sm font-medium">Bu günde kayıt yok</p>
                        <p className="text-xs text-slate-400 mt-1">Seçili tarihte dosya atanmamış</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (viewMode === "landing") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-teal-50 via-white to-orange-50 relative text-slate-800 overflow-hidden">
        {/* Animasyonlu arka plan deseni */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-teal-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-orange-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
          <div className="absolute top-40 left-40 w-80 h-80 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
        </div>

        <div className="relative z-10 max-w-3xl w-full mx-4 px-8 py-14 text-center space-y-8 bg-white/80 backdrop-blur-xl rounded-[40px] shadow-2xl border border-white/50 animate-landing-card">
          {/* Logo/İkon - Floating animasyonu */}
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-gradient-to-br from-teal-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-xl animate-logo-float hover:animate-logo-spin cursor-pointer">
              <span className="text-4xl">📚</span>
            </div>
          </div>

          <div className="text-sm md:text-base uppercase tracking-[0.5em] text-teal-600 font-semibold animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            Karşıyaka Rehberlik ve Araştırma Merkezi
          </div>

          <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-teal-600 via-teal-500 to-orange-500 bg-clip-text text-transparent animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            Özel Eğitim Bölümü Paneli
          </h1>

          <p className="text-lg md:text-xl text-slate-600 leading-relaxed max-w-xl mx-auto animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            👋 Hoş geldiniz! Günlük randevu listelerini yükleyin, dosya atamalarını yönetin ve öğretmen bildirimlerini takip edin.
          </p>

          {/* Özellik kartları - Buton olarak çalışır */}
          <div className="grid grid-cols-3 gap-4 py-4">
            <Button
              onClick={() => setViewMode("main")}
              className="group p-6 rounded-xl bg-teal-50 border-2 border-teal-200 hover:border-teal-400 hover:bg-teal-100 transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-teal-200 animate-card-pop h-auto flex flex-col items-center justify-center"
              style={{ animationDelay: '0.5s' }}
            >
              <div className="text-3xl mb-2 transition-transform duration-300 group-hover:scale-125 group-hover:animate-bounce">📁</div>
              <div className="text-sm text-teal-700 font-semibold">Dosya Atama</div>
            </Button>
            <Button
              onClick={() => setViewMode("teacher-tracking")}
              className="group p-6 rounded-xl bg-orange-50 border-2 border-orange-200 hover:border-orange-400 hover:bg-orange-100 transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-orange-200 animate-card-pop h-auto flex flex-col items-center justify-center"
              style={{ animationDelay: '0.6s' }}
            >
              <div className="text-3xl mb-2 transition-transform duration-300 group-hover:scale-125 group-hover:animate-bounce">👨‍🏫</div>
              <div className="text-sm text-orange-700 font-semibold">Öğretmen Takibi</div>
            </Button>
            <Button
              onClick={() => setViewMode("archive")}
              className="group p-6 rounded-xl bg-purple-50 border-2 border-purple-200 hover:border-purple-400 hover:bg-purple-100 transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-purple-200 animate-card-pop h-auto flex flex-col items-center justify-center"
              style={{ animationDelay: '0.7s' }}
            >
              <div className="text-3xl mb-2 transition-transform duration-300 group-hover:scale-125 group-hover:animate-bounce">🗄️</div>
              <div className="text-sm text-purple-700 font-semibold">Arşiv</div>
            </Button>
          </div>

          <div className="text-xs text-slate-400 animate-fade-in-up" style={{ animationDelay: '0.9s' }}>
            v{APP_VERSION} • Son güncelleme: {new Date().toLocaleDateString('tr-TR')}
          </div>
        </div>
      </main>
    );
  }

  // Non-admin başlangıç görünümü: Atanan Dosyalar
  if (!isAdmin && reportMode === "none") setReportMode("archive");

  // Öğretmen Takibi sayfası
  if (viewMode === "teacher-tracking") {
    const absentByDay: Record<string, Teacher[]> = {};

    // Supabase'deki devamsızlık kayıtlarından oku (ana kaynak)
    absenceRecords.forEach(record => {
      const teacher = teachers.find(t => t.id === record.teacherId);
      if (teacher) {
        if (!absentByDay[record.date]) absentByDay[record.date] = [];
        // Aynı öğretmen aynı gün için zaten eklenmemişse ekle
        if (!absentByDay[record.date].find(t => t.id === teacher.id)) {
          absentByDay[record.date].push(teacher);
        }
      }
    });

    // Mevcut devamsızlıklar (absentDay'den - bugün için)
    const today = getTodayYmd();
    teachers.filter(t => t.absentDay === today).forEach(t => {
      if (!absentByDay[today]) absentByDay[today] = [];
      if (!absentByDay[today].find(tt => tt.id === t.id)) {
        absentByDay[today].push(t);
      }
    });

    // Geçmiş devamsızlıklar (history'den absencePenalty kayıtları)
    Object.keys(history).forEach(day => {
      history[day].forEach(entry => {
        if (entry.absencePenalty && entry.assignedTo) {
          const teacher = teachers.find(t => t.id === entry.assignedTo);
          if (teacher) {
            if (!absentByDay[day]) absentByDay[day] = [];
            // Aynı öğretmen aynı gün için zaten eklenmemişse ekle
            if (!absentByDay[day].find(t => t.id === teacher.id)) {
              absentByDay[day].push(teacher);
            }
          }
        }
      });
    });

    const sortedDays = Object.keys(absentByDay).sort((a, b) => b.localeCompare(a));

    // Seçili tarih yoksa veya listede yoksa en son tarihi seç
    let currentSelectedDate = selectedAbsenceDate;
    if (!currentSelectedDate || !sortedDays.includes(currentSelectedDate)) {
      currentSelectedDate = sortedDays.length > 0 ? sortedDays[0] : null;
      if (currentSelectedDate && currentSelectedDate !== selectedAbsenceDate) {
        // State'i güncelle (ama render sırasında setState yapamayız, bu yüzden sadece kullanacağız)
      }
    }
    const currentIndex = currentSelectedDate ? sortedDays.indexOf(currentSelectedDate) : -1;
    // sortedDays büyükten küçüğe sıralı (en yeni en başta), bu yüzden:
    // Önceki = daha eski tarih = dizide daha sonraki eleman (index + 1)
    // Sonraki = daha yeni tarih = dizide daha önceki eleman (index - 1)
    const prevDate = currentIndex >= 0 && currentIndex < sortedDays.length - 1 ? sortedDays[currentIndex + 1] : null;
    const nextDate = currentIndex > 0 ? sortedDays[currentIndex - 1] : null;

    // Haftalık gruplama
    const weeklyGroups: Record<string, { week: string; teachers: Teacher[]; days: string[] }> = {};
    sortedDays.forEach(day => {
      const date = new Date(day);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay()); // Pazar günü
      const weekKey = format(weekStart, 'yyyy-MM-dd');
      if (!weeklyGroups[weekKey]) {
        weeklyGroups[weekKey] = { week: weekKey, teachers: [], days: [] };
      }
      absentByDay[day].forEach(t => {
        if (!weeklyGroups[weekKey].teachers.find(tt => tt.id === t.id)) {
          weeklyGroups[weekKey].teachers.push(t);
        }
      });
      weeklyGroups[weekKey].days.push(day);
    });

    // Aylık gruplama
    const monthlyGroups: Record<string, { month: string; teachers: Teacher[]; days: string[] }> = {};
    sortedDays.forEach(day => {
      const monthKey = day.substring(0, 7); // YYYY-MM
      if (!monthlyGroups[monthKey]) {
        monthlyGroups[monthKey] = { month: monthKey, teachers: [], days: [] };
      }
      absentByDay[day].forEach(t => {
        if (!monthlyGroups[monthKey].teachers.find(tt => tt.id === t.id)) {
          monthlyGroups[monthKey].teachers.push(t);
        }
      });
      monthlyGroups[monthKey].days.push(day);
    });

    // Sıralı hafta ve ay listeleri
    const sortedWeeks = Object.values(weeklyGroups).sort((a, b) => b.week.localeCompare(a.week));
    const sortedMonths = Object.values(monthlyGroups).sort((a, b) => b.month.localeCompare(a.month));

    // Seçili hafta ve ay index'lerini kontrol et
    const currentWeekIndex = Math.min(selectedWeekIndex, sortedWeeks.length - 1);
    const currentMonthIndex = Math.min(selectedMonthIndex, sortedMonths.length - 1);
    const currentWeek = sortedWeeks[currentWeekIndex] || null;
    const currentMonth = sortedMonths[currentMonthIndex] || null;

    return (
      <div className="container mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-teal-700">👨‍🏫 Öğretmen Takibi</h1>
          <Button onClick={() => setViewMode("landing")} variant="outline">← Ana Sayfa</Button>
        </div>

        <div className="space-y-6">
          {/* Günlük Liste */}
          <Card>
            <CardHeader>
              <CardTitle>📅 Günlük Devamsızlık Listesi</CardTitle>
            </CardHeader>
            <CardContent>
              {sortedDays.length === 0 ? (
                <p className="text-slate-500">Henüz devamsızlık kaydı yok.</p>
              ) : currentSelectedDate ? (
                <div className="space-y-4">
                  {/* Tarih navigasyonu */}
                  <div className="flex items-center justify-between mb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => prevDate && setSelectedAbsenceDate(prevDate)}
                      disabled={!prevDate}
                      className="flex items-center gap-2"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Önceki
                    </Button>
                    <div className="font-semibold text-lg text-teal-700 text-center flex-1">
                      {format(new Date(currentSelectedDate), 'dd MMMM yyyy EEEE', { locale: tr })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => nextDate && setSelectedAbsenceDate(nextDate)}
                      disabled={!nextDate}
                      className="flex items-center gap-2"
                    >
                      Sonraki
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                  {/* Seçili tarihin devamsızlıkları */}
                  <div className="border rounded-lg p-4">
                    <div className="space-y-1">
                      {absentByDay[currentSelectedDate]?.map(t => (
                        <div key={t.id} className="flex items-center gap-2 text-slate-700">
                          <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                          <span>{t.name}</span>
                        </div>
                      ))}
                      {(!absentByDay[currentSelectedDate] || absentByDay[currentSelectedDate].length === 0) && (
                        <p className="text-slate-500 text-sm">Bu tarihte devamsızlık kaydı yok.</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-slate-500">Henüz devamsızlık kaydı yok.</p>
              )}
            </CardContent>
          </Card>

          {/* Haftalık Liste */}
          <Card>
            <CardHeader>
              <CardTitle>📆 Haftalık Devamsızlık Özeti</CardTitle>
            </CardHeader>
            <CardContent>
              {sortedWeeks.length === 0 ? (
                <p className="text-slate-500">Henüz haftalık devamsızlık kaydı yok.</p>
              ) : currentWeek ? (
                <div className="space-y-4">
                  {/* Hafta navigasyonu */}
                  <div className="flex items-center justify-between mb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedWeekIndex(Math.min(sortedWeeks.length - 1, currentWeekIndex + 1))}
                      disabled={currentWeekIndex === sortedWeeks.length - 1}
                      className="flex items-center gap-2"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Önceki
                    </Button>
                    <div className="font-semibold text-lg text-orange-700 text-center flex-1">
                      Hafta: {format(new Date(currentWeek.week), 'dd MMMM yyyy', { locale: tr })} - {format(new Date(new Date(currentWeek.week).getTime() + 6 * 24 * 60 * 60 * 1000), 'dd MMMM yyyy', { locale: tr })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedWeekIndex(Math.max(0, currentWeekIndex - 1))}
                      disabled={currentWeekIndex === 0}
                      className="flex items-center gap-2"
                    >
                      Sonraki
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                  {/* Seçili haftanın devamsızlıkları */}
                  <div className="border rounded-lg p-4">
                    <div className="text-sm text-slate-600 mb-2">
                      {currentWeek.days.length} gün devamsızlık kaydı
                    </div>
                    <div className="space-y-1">
                      {currentWeek.teachers.map(t => {
                        // Bu öğretmenin bu hafta içinde hangi günler devamsız olduğunu bul
                        const teacherAbsentDays = currentWeek.days.filter(day =>
                          absentByDay[day]?.some(teacher => teacher.id === t.id)
                        ).sort();

                        // Günleri formatla (örn: "14, 16, 19 Aralık")
                        const formattedDays = teacherAbsentDays.map(day => {
                          const date = new Date(day);
                          return format(date, 'd MMMM', { locale: tr });
                        }).join(', ');

                        return (
                          <div key={t.id} className="flex items-center gap-2 text-slate-700">
                            <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                            <span className="font-medium">{t.name}</span>
                            {formattedDays && (
                              <span className="text-xs text-slate-500 ml-2">({formattedDays})</span>
                            )}
                          </div>
                        );
                      })}
                      {currentWeek.teachers.length === 0 && (
                        <p className="text-slate-500 text-sm">Bu hafta devamsızlık kaydı yok.</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-slate-500">Henüz haftalık devamsızlık kaydı yok.</p>
              )}
            </CardContent>
          </Card>

          {/* Aylık Liste */}
          <Card>
            <CardHeader>
              <CardTitle>📊 Aylık Devamsızlık Özeti</CardTitle>
            </CardHeader>
            <CardContent>
              {sortedMonths.length === 0 ? (
                <p className="text-slate-500">Henüz aylık devamsızlık kaydı yok.</p>
              ) : currentMonth ? (
                <div className="space-y-4">
                  {/* Ay navigasyonu */}
                  <div className="flex items-center justify-between mb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedMonthIndex(Math.min(sortedMonths.length - 1, currentMonthIndex + 1))}
                      disabled={currentMonthIndex === sortedMonths.length - 1}
                      className="flex items-center gap-2"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Önceki
                    </Button>
                    <div className="font-semibold text-lg text-purple-700 text-center flex-1">
                      {format(new Date(currentMonth.month + '-01'), 'MMMM yyyy', { locale: tr })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedMonthIndex(Math.max(0, currentMonthIndex - 1))}
                      disabled={currentMonthIndex === 0}
                      className="flex items-center gap-2"
                    >
                      Sonraki
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                  {/* Seçili ayın devamsızlıkları */}
                  <div className="border rounded-lg p-4">
                    <div className="text-sm text-slate-600 mb-2">
                      {currentMonth.days.length} gün devamsızlık kaydı, {currentMonth.teachers.length} öğretmen
                    </div>
                    <div className="space-y-1">
                      {currentMonth.teachers.map(t => {
                        // Bu öğretmenin bu ay içinde hangi günler devamsız olduğunu bul
                        const teacherAbsentDays = currentMonth.days.filter(day =>
                          absentByDay[day]?.some(teacher => teacher.id === t.id)
                        ).sort();

                        // Günleri formatla (örn: "14, 16, 19 Aralık")
                        const formattedDays = teacherAbsentDays.map(day => {
                          const date = new Date(day);
                          return format(date, 'd MMMM', { locale: tr });
                        }).join(', ');

                        return (
                          <div key={t.id} className="flex items-center gap-2 text-slate-700">
                            <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                            <span className="font-medium">{t.name}</span>
                            {formattedDays && (
                              <span className="text-xs text-slate-500 ml-2">({formattedDays})</span>
                            )}
                          </div>
                        );
                      })}
                      {currentMonth.teachers.length === 0 && (
                        <p className="text-slate-500 text-sm">Bu ay devamsızlık kaydı yok.</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-slate-500">Henüz aylık devamsızlık kaydı yok.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Arşiv sayfası - Şifre korumalı
  if (viewMode === "archive") {
    const ARCHIVE_PASSWORD = "ram2025"; // Şifreyi buradan değiştirebilirsiniz

    if (!archiveAuthenticated) {
      return (
        <div className="container mx-auto p-4">
          <div className="max-w-md mx-auto mt-20">
            <Card>
              <CardHeader>
                <CardTitle className="text-center">🗄️ Arşiv Girişi</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Parola</Label>
                  <Input
                    type="password"
                    value={archivePassword}
                    onChange={(e) => setArchivePassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && archivePassword === ARCHIVE_PASSWORD) {
                        setArchiveAuthenticated(true);
                      }
                    }}
                    placeholder="Parolayı girin"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    if (archivePassword === ARCHIVE_PASSWORD) {
                      setArchiveAuthenticated(true);
                    } else {
                      alert("Yanlış parola!");
                      setArchivePassword("");
                    }
                  }}
                >
                  Giriş Yap
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setViewMode("landing")}
                >
                  ← Ana Sayfa
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }

    // Arşiv içeriği - 1-10000 arası dosyalar
    const archiveFiles = Array.from({ length: 10000 }, (_, i) => i + 1).map(num => ({
      id: `archive-${num}`,
      fileNo: num.toString(),
      student: `Dosya ${num}`,
      assignedToName: "Bilinmiyor",
      createdAt: "",
    }));

    // E-Archive'den mevcut dosyaları al
    // E-Archive'den mevcut dosyaları al
    const existingFiles = new Map<string, EArchiveEntry>();

    // 1. Manuel E-Arşiv kayıtları
    eArchive.forEach(entry => {
      if (entry.fileNo) {
        existingFiles.set(entry.fileNo, entry);
      }
    });

    // 2. Otomatik Atanan Geçmiş (History) kayıtları
    Object.values(history).flat().forEach(c => {
      if (c.fileNo) {
        const t = teachers.find(x => x.id === c.assignedTo);
        existingFiles.set(c.fileNo, {
          id: c.id,
          student: c.student,
          fileNo: c.fileNo,
          assignedToName: t ? t.name : "Bilinmiyor",
          createdAt: c.createdAt
        });
      }
    });

    // Mevcut dosyaları güncelle
    archiveFiles.forEach(file => {
      const existing = existingFiles.get(file.fileNo);
      if (existing) {
        file.student = existing.student;
        file.assignedToName = existing.assignedToName;
        file.createdAt = existing.createdAt;
      }
    });

    // Arama Fonksiyonu
    const handleArchiveSearch = () => {
      const term = archiveSearchTerm.toLowerCase().trim();
      if (!term) return;

      let targetFileNo = "";

      // Sayı mı?
      const num = parseInt(term);
      if (!isNaN(num) && num > 0 && num <= 10000) {
        targetFileNo = num.toString();
      } else {
        // İsim ara
        for (const [fileNo, entry] of existingFiles.entries()) {
          if (entry.student.toLowerCase().includes(term)) {
            targetFileNo = fileNo;
            break;
          }
        }
      }

      if (targetFileNo) {
        const el = document.getElementById(`archive-${targetFileNo}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          // Highlight
          el.classList.remove("bg-slate-50", "bg-teal-50");
          el.classList.add("bg-purple-100", "ring-2", "ring-purple-500");
          setTimeout(() => {
            el.classList.remove("bg-purple-100", "ring-2", "ring-purple-500");
            // Orijinal rengine dönmesi için classList'i eski haline getiremiyoruz ama
            // re-render bekleyebiliriz veya basitçe style kullanabiliriz.
            // En temiz yöntem: inline style ile backgroundColor set etmekti ama Tailwind classları var.
            // Neyse, 2 saniye sonra classları silince React state'ine göre eski classlar geri gelmeyebilir
            // ama parent re-render olmazsa classlar silinmiş kalır.
            // Bu yüzden en iyisi style manipülasyonu veya sadece ring eklemek.
          }, 2000);
        } else {
          alert("Dosya görünür alanda değil.");
        }
      } else {
        alert("Bulunamadı.");
      }
    };

    return (
      <div className="container mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-purple-700">🗄️ RAM Arşivi (1-10.000)</h1>
          <div className="flex gap-2">

            <div className="flex items-center gap-2 mr-4 bg-white p-1 rounded-lg border shadow-sm">
              <Search className="h-4 w-4 text-slate-400 ml-2" />
              <Input
                placeholder="Öğrenci veya Dosya No..."
                className="border-none shadow-none focus-visible:ring-0 h-8 w-64"
                value={archiveSearchTerm}
                onChange={(e) => setArchiveSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleArchiveSearch()}
              />
              <Button size="sm" onClick={handleArchiveSearch} variant="outline" className="h-8 bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200">Ara</Button>
            </div>

            <Button onClick={() => { setArchiveAuthenticated(false); setArchivePassword(""); }} variant="outline">
              Çıkış
            </Button>
            <Button onClick={() => setViewMode("landing")} variant="outline">← Ana Sayfa</Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Dosya Listesi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {archiveFiles.map(file => (
                <div
                  key={file.id}
                  id={`archive-${file.fileNo}`}
                  className={`p-3 border rounded-lg transition-colors duration-500 ${existingFiles.has(file.fileNo) ? 'bg-teal-50 border-teal-200' : 'bg-slate-50 border-slate-200'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold w-24 inline-block">Dosya No: {file.fileNo}</span>
                      {existingFiles.has(file.fileNo) && (
                        <>
                          <span className="ml-4 text-slate-800 font-medium">Öğrenci: {file.student}</span>
                          {/* Atanan öğretmen gizlendi */}
                          {file.createdAt && (
                            <span className="ml-4 text-slate-500 text-sm">
                              {format(new Date(file.createdAt), 'dd.MM.yyyy')}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    {existingFiles.has(file.fileNo) && (
                      <span className="px-2 py-1 bg-teal-100 text-teal-700 rounded text-xs font-medium">
                        Atanmış
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Ana sayfa (Dosya Atama) - sadece viewMode === "main" olduğunda
  if (viewMode !== "main") {
    return null; // Diğer modlar zaten yukarıda handle edildi
  }

  // ---------- TEK RETURN: BİLEŞEN ÇIKIŞI ----------
  return (
    <>
      <ThemeToggle />
      <div className="container mx-auto p-4 space-y-6">
        {/* Üst araç çubuğu: rapor ve giriş */}
        {/* ÜST BAR (sticky + cam) - MOBİL OPTİMİZE */}
        <div className="sticky top-0 z-40 backdrop-blur bg-white/70 border-b border-slate-200/60">
          <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-3">

            {/* Satır 1: Ana kontroller */}
            <div className="flex items-center justify-between gap-2">
              {/* Sol: Ana sayfa + Ay + Arama */}
              <div className="flex items-center gap-1 sm:gap-2">
                <Button size="sm" variant="outline" className="px-2 sm:px-3 text-xs sm:text-sm" onClick={() => setViewMode("landing")}>
                  🏠 <span className="hidden sm:inline">Ana Sayfa</span>
                </Button>
                {isAdmin && (
                  <Select value={filterYM} onValueChange={setFilterYM}>
                    <SelectTrigger className="w-[90px] sm:w-[130px] text-xs sm:text-sm">
                      <SelectValue placeholder="Ay" />
                    </SelectTrigger>
                    <SelectContent>
                      {allMonths.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {/* Hızlı Arama Butonu */}
                <QuickSearch
                  teachers={teachers}
                  cases={cases}
                  history={history}
                  onSelectTeacher={(id) => {
                    const teacher = teachers.find(t => t.id === id);
                    if (teacher) toast(`${teacher.name} seçildi`);
                  }}
                  onSelectCase={(caseFile) => {
                    toast(`${caseFile.student} - ${caseFile.createdAt.split("T")[0]}`);
                  }}
                />
              </div>

              {/* Sağ: Canlı rozet + Admin/Giriş */}
              <div className="flex items-center gap-1 sm:gap-2">
                {/* CANLI ROZET - Kısa versiyon mobilde */}
                <span
                  className={
                    "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ring-1 " +
                    (live === "online"
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                      : live === "connecting"
                        ? "bg-amber-50 text-amber-700 ring-amber-200"
                        : "bg-rose-50 text-rose-700 ring-rose-200")
                  }
                  title={live === "online" ? "Bağlı" : live === "connecting" ? "Bağlanıyor" : "Bağlı değil"}
                >
                  <span className="inline-block size-1.5 rounded-full bg-current animate-pulse" />
                  <span className="hidden sm:inline">🔴 Canlı:</span> {live}
                </span>

                {isAdmin ? (
                  <>
                    <span className="hidden sm:inline text-xs sm:text-sm text-emerald-700 font-medium">👑 Admin</span>
                    {/* Çıkış Butonu - HER ZAMAN GÖRÜNÜR */}
                    <Button
                      size="sm"
                      variant="destructive"
                      className="px-2 sm:px-3 text-xs sm:text-sm"
                      onClick={doLogout}
                    >
                      🚪 <span className="hidden sm:inline">Çıkış</span>
                    </Button>
                  </>
                ) : (
                  <Button size="sm" className="px-2 sm:px-3 text-xs sm:text-sm" onClick={() => setLoginOpen(true)}>
                    🔐 <span className="hidden sm:inline">Giriş</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Satır 2: Ek butonlar (mobilde kaydırılabilir) */}
            <div className="flex items-center gap-1 sm:gap-2 mt-2 overflow-x-auto pb-1 no-scrollbar">
              <Button size="sm" variant="outline" className="shrink-0 px-2 sm:px-3 text-xs sm:text-sm" onClick={() => setShowRules(true)}>
                📖 <span className="hidden sm:inline">Kurallar</span>
              </Button>
              <Button size="sm" variant="outline" className="shrink-0 px-2 sm:px-3 text-xs sm:text-sm" onClick={() => setFeedbackOpen(true)}>
                💬 <span className="hidden xs:inline">Öneri</span><span className="hidden sm:inline">/Şikayet</span>
              </Button>

              {isAdmin && (
                <>
                  {/* Ses Aç/Kapat */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 px-2"
                    data-silent="true"
                    title={soundOn ? "Sesi Kapat" : "Sesi Aç"}
                    onClick={() => setSoundOn(v => !v)}
                  >
                    {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                  </Button>

                  {/* Ayarlar */}
                  <Button size="sm" variant="outline" className="shrink-0 px-2 sm:px-3 text-xs sm:text-sm" onClick={() => setSettingsOpen(true)}>
                    ⚙️ <span className="hidden sm:inline">Ayarlar</span>
                  </Button>

                  {/* Simülasyon Modu */}
                  {typeof window !== "undefined" && new URLSearchParams(window.location.search).get("simDate") && (
                    <>
                      <span className="shrink-0 text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded font-medium">
                        📅 {new URLSearchParams(window.location.search).get("simDate")}
                      </span>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="shrink-0 px-2 sm:px-3 text-xs"
                        onClick={() => {
                          if (confirm("Günü bitir ve arşivle? (Devamsızlık cezası + Yedek bonusu uygulanacak)")) {
                            doRollover();
                            toast("Gün bitirildi! Devamsızlık/yedek puanları uygulandı.");
                          }
                        }}
                      >
                        🌙 <span className="hidden sm:inline">Günü Bitir</span>
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>

          </div>
        </div>

        {/* 📊 DASHBOARD ÖZET KARTLARI */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl p-4 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 cursor-default">
            <div className="text-3xl font-bold">{teachers.filter(t => t.active && !t.isAbsent).length}</div>
            <div className="text-sm opacity-90">👨‍🏫 Aktif Öğretmen</div>
          </div>
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 cursor-default">
            <div className="text-3xl font-bold">{cases.filter(c => !c.absencePenalty).length}</div>
            <div className="text-sm opacity-90">📁 Bugün Atanan</div>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 cursor-default">
            <div className="text-3xl font-bold">{pendingAppointmentsCount}</div>
            <div className="text-sm opacity-90">📋 Bekleyen Randevu</div>
          </div>
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 cursor-default">
            <div className="text-3xl font-bold">{Object.keys(history).length}</div>
            <div className="text-sm opacity-90">📅 Arşivli Gün</div>
          </div>
        </div>

        {/* 📊 DASHBOARD WIDGET'LAR (Herkes için) */}
        <MiniWidgets
          teachers={teachers}
          cases={cases}
          pdfEntries={pdfEntries}
          history={history}
          isAdmin={isAdmin}
        />


        {/* Admin olmayan kullanıcılar için randevu listesi ve duyurular */}
        {!isAdmin && (
          <>
            {announcements.length > 0 && (
              <div className="border rounded-md p-3 bg-amber-50 border-amber-300 animate-pulse">
                <div className="font-medium text-amber-900">Duyuru</div>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  {announcements.map((a) => (
                    <li key={a.id} className="text-sm text-amber-900">{a.text}</li>
                  ))}
                </ul>
                <div className="text-xs text-amber-800 mt-1">Bu duyurular gün sonunda temizlenir.</div>
              </div>
            )}
            <DailyAppointmentsCard
              pdfDate={pdfDate}
              pdfLoading={pdfLoading}
              pdfEntries={pdfEntries}
              selectedPdfEntryId={selectedPdfEntryId}
              onShowDetails={(date) => { if (date instanceof Date) { fetchPdfEntriesFromServer(date); } else { setShowPdfPanel(true); } }}
              onPrint={handlePrintPdfList}
              onClearAll={() => clearPdfEntries(true, true)}
              cases={cases}
              history={history}
            />

            {/* Non-admin için Raporlar ve Atanan Dosyalar */}
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>📊 Raporlar ve Arşiv</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant={["statistics", "weekly", "yearly", "teacher-performance", "file-type-analysis"].includes(reportMode) ? "default" : "outline"}>
                        📈 İstatistikler
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-2">
                      <div className="flex flex-col gap-1">
                        <Button
                          variant={reportMode === "statistics" ? "default" : "ghost"}
                          className="w-full justify-start"
                          onClick={() => setReportMode("statistics")}
                        >
                          📈 İstatistikler
                        </Button>
                        <Button
                          variant={reportMode === "weekly" ? "default" : "ghost"}
                          className="w-full justify-start"
                          onClick={() => setReportMode("weekly")}
                        >
                          📆 Haftalık Rapor
                        </Button>
                        <Button
                          variant={reportMode === "yearly" ? "default" : "ghost"}
                          className="w-full justify-start"
                          onClick={() => setReportMode("yearly")}
                        >
                          📆 Yıllık Rapor
                        </Button>
                        <Button
                          variant={reportMode === "teacher-performance" ? "default" : "ghost"}
                          className="w-full justify-start"
                          onClick={() => setReportMode("teacher-performance")}
                        >
                          👨‍🏫 Öğretmen Performansı
                        </Button>
                        <Button
                          variant={reportMode === "file-type-analysis" ? "default" : "ghost"}
                          className="w-full justify-start"
                          onClick={() => setReportMode("file-type-analysis")}
                        >
                          📊 Dosya Türü Analizi
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Button variant={reportMode === "daily" ? "default" : "outline"} onClick={() => setReportMode("daily")}>
                    📅 Günlük Rapor
                  </Button>
                  <Button variant={reportMode === "monthly" ? "default" : "outline"} onClick={() => setReportMode("monthly")}>
                    📊 Aylık Rapor
                  </Button>
                  <Button variant={reportMode === "calendar" ? "default" : "outline"} onClick={() => setReportMode("calendar")}>
                    🗓️ Takvim
                  </Button>
                  <Button variant={reportMode === "archive" ? "default" : "outline"} onClick={() => setReportMode("archive")}>
                    📋 Atanan Dosyalar
                  </Button>
                  <Button variant={reportMode === "e-archive" ? "default" : "outline"} onClick={() => setReportMode("e-archive")}>
                    🗄️ E-Arşiv
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* İzleyici/Normal kullanıcı için Duyuru Paneli */}
        {!isAdmin && announcements.length > 0 && (
          <div className="border rounded-md p-3 bg-amber-50 border-amber-300 animate-pulse">
            <div className="font-medium text-amber-900">Duyuru</div>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              {announcements.map((a) => (
                <li key={a.id} className="text-sm text-amber-900">{a.text}</li>
              ))}
            </ul>
            <div className="text-xs text-amber-800 mt-1">Bu duyurular gün sonunda temizlenir.</div>
          </div>
        )}

        {/* Admin alanı - Tab Sistemi */}
        {isAdmin && (
          <Card className="border-2">
            {/* Tab Navigation */}
            <div className="border-b">
              <div className="flex flex-wrap gap-2 p-3 bg-slate-50">
                <Button
                  variant={adminTab === "files" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setAdminTab("files")}
                  className="min-h-9"
                >
                  📁 Dosya Atama
                </Button>
                <Button
                  variant={adminTab === "teachers" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setAdminTab("teachers")}
                  className="min-h-9"
                >
                  👨‍🏫 Öğretmenler
                </Button>
                <Button
                  variant={adminTab === "reports" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setAdminTab("reports")}
                  className="min-h-9"
                >
                  📊 Raporlar
                </Button>
                <Button
                  variant={adminTab === "announcements" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setAdminTab("announcements")}
                  className="min-h-9"
                >
                  📢 Duyuru
                </Button>
                <Button
                  variant={adminTab === "backup" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setAdminTab("backup")}
                  className="min-h-9"
                >
                  💾 Yedekleme
                </Button>
              </div>
            </div>

            {/* Tab Content */}
            <div className="p-4">
              {adminTab === "files" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"
                  onKeyDown={(e) => {
                    // Enter: kaydet, Shift+Enter: boş (açıklamada newline)
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      addCase();
                    }
                  }}
                >
                  {/* Sol: Dosya Atama Formu */}
                  <div className="space-y-4">
                    <DailyAppointmentsCard
                      pdfDate={pdfDate}
                      pdfLoading={pdfLoading}
                      pdfEntries={pdfEntries}
                      selectedPdfEntryId={selectedPdfEntryId}
                      isAdmin={isAdmin}
                      onApplyEntry={applyPdfEntry}
                      onRemoveEntry={removePdfEntry}
                      onPrint={handlePrintPdfList}
                      onClearAll={() => clearPdfEntries()}
                      onShowDetails={(date) => { if (date instanceof Date) { fetchPdfEntriesFromServer(date); } else { setShowPdfPanel(true); } }}
                      cases={cases}
                      history={history}
                    />
                    {activePdfEntry && (
                      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="font-semibold">{activePdfEntry.name} — {activePdfEntry.time}</div>
                          <div className="text-xs text-emerald-800">
                            Dosya: {activePdfEntry.fileNo || "—"}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => applyPdfEntry(activePdfEntry!)}>Tekrar Aktar</Button>
                          <Button size="sm" variant="ghost" onClick={clearActivePdfEntry}>Seçimi Kaldır</Button>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>👤 Öğrenci Adı</Label>
                        <Input
                          value={student}
                          onChange={(e) => setStudent(e.target.value)}
                          placeholder="Örn. Ali Veli"
                          className={(!student.trim() && triedAdd) ? "border-red-500 focus-visible:ring-red-500" : ""}
                        />
                        {(!student.trim() && triedAdd) && (
                          <div className="text-xs text-red-600">Bu alan gerekli.</div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>🔢 Dosya No</Label>
                        <Input value={fileNo} onChange={(e) => setFileNo(e.target.value)} placeholder="Örn. 2025-001" />
                      </div>
                    </div>

                    {/* İzleyici/Normal kullanıcı için Duyuru Paneli */}
                    {!isAdmin && announcements.length > 0 && (
                      <div className="border rounded-md p-3 bg-amber-50 border-amber-300 animate-pulse">
                        <div className="font-medium text-amber-900">Duyuru</div>
                        <ul className="list-disc pl-5 mt-1 space-y-1">
                          {announcements.map((a) => (
                            <li key={a.id} className="text-sm text-amber-900">{a.text}</li>
                          ))}
                        </ul>
                        <div className="text-xs text-amber-800 mt-1">Bu duyurular gün sonunda temizlenir.</div>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>📑 Dosya Türü</Label>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <Button variant={type === "YONLENDIRME" ? "default" : "outline"} onClick={() => setType("YONLENDIRME")}>Yönlendirme (+{settings.scoreTypeY})</Button>
                        <Button variant={type === "DESTEK" ? "default" : "outline"} onClick={() => setType("DESTEK")}>Destek (+{settings.scoreTypeD})</Button>
                        <Button variant={type === "IKISI" ? "default" : "outline"} onClick={() => setType("IKISI")}>Yönlendirme+Destek (+{settings.scoreTypeI})</Button>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                      <Checkbox id="isNew" checked={isNew} onCheckedChange={(v) => setIsNew(Boolean(v))} className="h-5 w-5" />
                      <Label htmlFor="isNew" className="text-base">Yeni başvuru (+{settings.scoreNewBonus})</Label>
                    </div>

                    <div className="space-y-2 pt-2">
                      <Label className="text-base">Tanı sayısı (0-6) (+n)</Label>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <Button type="button" variant="outline" size="lg" className="px-3" onClick={() => setDiagCount((n) => Math.max(0, n - 1))}><UserMinus className="h-5 w-5" /></Button>
                          <Input
                            className="w-24 h-12 text-center text-xl font-bold"
                            inputMode="numeric"
                            value={diagCount}
                            onChange={(e) => {
                              const n = Number((e.target.value || "").replace(/[^\d]/g, ""));
                              setDiagCount(Math.max(0, Math.min(6, Number.isFinite(n) ? n : 0)));
                            }}
                          />
                          <Button type="button" variant="outline" size="lg" className="px-3" onClick={() => setDiagCount((n) => Math.min(6, n + 1))}><Plus className="h-5 w-5" /></Button>
                        </div>
                        <Button
                          data-silent="true"
                          onClick={addCase}
                          disabled={!student.trim()}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-5"
                        >
                          📁 DOSYA ATA
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox id="isTest" checked={isTestCase} onCheckedChange={(v) => setIsTestCase(Boolean(v))} />
                      <Label htmlFor="isTest">Test dosyası (+{settings.scoreTest})</Label>
                    </div>
                    {/* Manuel atama (opsiyonel) + Ekle butonu tek kapsayıcıda (click-away ref) */}
                    <div ref={manualAssignRef}>
                      <div className="space-y-2">
                        <Label>👨‍🏫 Öğretmeni Manuel Ata (opsiyonel)</Label>
                        <Select value={manualTeacherId} onValueChange={(v) => setManualTeacherId(v)}>
                          <SelectTrigger className="w-full"><SelectValue placeholder="Öğretmen seçin" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">— Manuel atama yok —</SelectItem>
                            {teachers.filter(t => t.active).map(t => (
                              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex justify-end mt-2">
                          <Button size="sm" variant="ghost" onClick={() => { setManualTeacherId(""); setManualReason(""); }}>
                            Seçimi temizle
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2 mt-3">
                        <Label>📝 Açıklama (neden)</Label>
                        <textarea
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          rows={2}
                          value={manualReason}
                          onChange={(e) => setManualReason(e.target.value)}
                          placeholder="Örn. Öğrenci talebi / yoğunluk dengesi"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && e.shiftKey) {
                              // Allow newline (default)
                              return;
                            }
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addCase();
                            }
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <div className="text-sm text-muted-foreground">
                          Puan: <span className="font-semibold">{calcScore()}</span>
                          <span className="hidden md:inline ml-3 text-xs opacity-60">⌨️ Ctrl+Enter ile hızlı ekle</span>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Sağ: Dosyalar (Bugün) ve Atanan Dosyalar */}
                  <div className="space-y-4">
                    {/* Dosyalar (Bugün) */}
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>📂 Dosyalar (Bugün)</CardTitle>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={testSound}>Ses Test</Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {/* md+ masaüstü: tablo görünümü */}
                        <div className="overflow-auto hidden md:block">
                          <table className="w-full text-sm border border-border">
                            <thead className="sticky top-0 z-10 bg-muted">
                              <tr>
                                <th className="p-2 text-left">Öğrenci</th>
                                <th className="p-2 text-right">Puan</th>
                                <th className="p-2 text-left">Tarih</th>
                                <th className="p-2 text-left">Atanan</th>
                                <th className="p-2 text-left">Test</th>
                                <th className="p-2 text-left">Açıklama</th>
                                <th className="p-2"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredCases.map((c) => (
                                <tr key={c.id} className="border-t hover:bg-slate-50 transition-colors duration-150">
                                  <td className="p-2">{c.student}</td>
                                  <td className="p-2 text-right">{c.score}</td>
                                  <td className="p-2">{new Date(c.createdAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                                  <td className="p-2">{teacherName(c.assignedTo)}
                                    {c.assignedTo ? (
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        className="ml-2"
                                        data-silent="true"
                                        title="Acil çağrı: Tekrarlı bildirim gönder"
                                        onClick={() => notifyEmergencyNow(c)}
                                      >
                                        Acil
                                      </Button>
                                    ) : null}
                                  </td>
                                  <td className="p-2">{c.isTest ? `Evet (+${settings.scoreTest})` : "Hayır"}</td>
                                  <td className="p-2 text-sm text-muted-foreground">{caseDesc(c)}</td>
                                  <td className="p-2 text-right">
                                    {c.sourcePdfEntry ? (
                                      <Button size="sm" variant="outline" onClick={() => removeCase(c.id)} title="Randevu listesine geri al" className="text-amber-600 hover:text-amber-700">
                                        ↩️ Geri Al
                                      </Button>
                                    ) : (
                                      <Button size="icon" variant="ghost" onClick={() => removeCase(c.id)} title="Sil">
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                              {filteredCases.length === 0 && (
                                <tr>
                                  <td className="p-8 text-center" colSpan={7}>
                                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                                      <FileText className="h-10 w-10 mb-2 text-slate-400" />
                                      <p className="text-sm font-medium">Bugün için kayıt yok</p>
                                      <p className="text-xs text-slate-400 mt-1">Henüz dosya atanmamış</p>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobil: kart görünümü */}
                        <div className="md:hidden space-y-2">
                          {filteredCases.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border rounded-lg bg-slate-50">
                              <FileText className="h-10 w-10 mb-2 text-slate-400" />
                              <p className="text-sm font-medium">Bugün için kayıt yok</p>
                              <p className="text-xs text-slate-400 mt-1">Henüz dosya atanmamış</p>
                            </div>
                          )}
                          {filteredCases.map((c) => (
                            <div key={c.id} className="border rounded-lg p-3 bg-white shadow-sm hover:shadow-md transition-shadow duration-200">
                              <div className="flex items-center justify-between">
                                <div className="font-medium">{c.student}</div>
                                <div className="text-sm">Puan: <span className="font-semibold">{c.score}</span></div>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">{new Date(c.createdAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}</div>
                              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                                <div><span className="text-muted-foreground">Atanan:</span> {teacherName(c.assignedTo)}</div>
                                <div><span className="text-muted-foreground">Test:</span> {c.isTest ? `Evet (+${settings.scoreTest})` : "Hayır"}</div>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">{caseDesc(c)}</div>
                              <div className="flex items-center justify-end gap-2 mt-2">
                                {c.assignedTo ? (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    title="Acil çağrı: Tekrarlı bildirim gönder"
                                    onClick={() => notifyEmergencyNow(c)}
                                  >
                                    Acil
                                  </Button>
                                ) : null}
                                {c.sourcePdfEntry ? (
                                  <Button size="sm" variant="outline" onClick={() => removeCase(c.id)} title="Randevu listesine geri al" className="text-amber-600 hover:text-amber-700">
                                    ↩️ Geri Al
                                  </Button>
                                ) : (
                                  <Button size="icon" variant="ghost" onClick={() => removeCase(c.id)} title="Sil">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Atanan Dosyalar (Tek Gün) */}
                    <AssignedArchiveSingleDayView
                      history={history}
                      cases={cases}
                      teacherName={teacherName}
                      caseDesc={caseDesc}
                      teachers={teachers}
                      settings={settings}
                    />
                  </div>
                </div>
              )}

              {adminTab === "teachers" && (
                <div className="space-y-4">
                  {/* Öğretmen Ekle */}
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label>➕ Öğretmen Ekle</Label>
                      <Input
                        value={newTeacherName}
                        onChange={(e) => setNewTeacherName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addTeacher()}
                        placeholder="Ad Soyad"
                      />
                    </div>
                    <Button onClick={addTeacher}>➕ Ekle</Button>
                  </div>

                  {teachers.map((t) => {
                    const locked = hasTestToday(t.id);
                    return (
                      <div key={t.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200">
                        <div className="space-y-1 min-w-0 flex-shrink">
                          <div className="font-medium">{t.name}</div>
                          <div className="text-xs text-muted-foreground">
                            Yıllık Yük: {t.yearlyLoad} {t.isTester ? " • Testör" : ""} {locked ? " • Bugün test aldı" : ""} {t.backupDay === getTodayYmd() ? " • Yedek" : ""}
                            {/* Pushover: opsiyonel giriş */}
                            {!t.pushoverKey && !editKeyOpen[t.id] ? (
                              <div className="mt-2">
                                <Button size="sm" variant="outline" onClick={() => setEditKeyOpen((p) => ({ ...p, [t.id]: true }))}>
                                  Key Yükle
                                </Button>
                              </div>
                            ) : null}

                            {editKeyOpen[t.id] ? (
                              <div className="mt-2 flex items-center gap-2">
                                <Label className="text-xs w-32">Pushover User Key</Label>
                                <Input
                                  autoFocus
                                  className="h-8 w-[320px]"
                                  placeholder="uQiRzpo4DXghDmr9QzzfQu27cmVRsG"
                                  value={editPushover[t.id] ?? ""}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setEditPushover((prev) => ({ ...prev, [t.id]: v }));
                                  }}
                                  onBlur={() => {
                                    // Dışarı tıklanınca kaydetmeden kapat
                                    setEditPushover((prev) => {
                                      const next = { ...prev } as Record<string, string>;
                                      delete next[t.id];
                                      return next;
                                    });
                                    setEditKeyOpen((prev) => ({ ...prev, [t.id]: false }));
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      const v = (editPushover[t.id] ?? "").trim();
                                      if (v) {
                                        setTeachers((prev) =>
                                          prev.map((tt) => (tt.id === t.id ? { ...tt, pushoverKey: v } : tt))
                                        );
                                      }
                                      setEditPushover((prev) => {
                                        const next = { ...prev };
                                        delete next[t.id];
                                        return next;
                                      });
                                      setEditKeyOpen((prev) => ({ ...prev, [t.id]: false }));
                                    } else if (e.key === "Escape") {
                                      // Vazgeç: kaydetmeden kapat
                                      e.preventDefault();
                                      setEditPushover((prev) => {
                                        const next = { ...prev } as Record<string, string>;
                                        delete next[t.id];
                                        return next;
                                      });
                                      setEditKeyOpen((prev) => ({ ...prev, [t.id]: false }));
                                    }
                                  }}
                                />
                              </div>
                            ) : null}

                            {t.pushoverKey && !editKeyOpen[t.id] ? (
                              <div className="mt-2 flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => testNotifyTeacher(t)}
                                  title="Telefona test bildirimi gönder"
                                >
                                  Test Gönder
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditPushover((prev) => ({ ...prev, [t.id]: t.pushoverKey || "" }));
                                    setEditKeyOpen((prev) => ({ ...prev, [t.id]: true }));
                                  }}
                                >
                                  Anahtarı değiştir
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    setTeachers((prev) =>
                                      prev.map((tt) => (tt.id === t.id ? { ...tt, pushoverKey: undefined } : tt))
                                    );
                                    setEditPushover((prev) => {
                                      const next = { ...prev };
                                      delete next[t.id];
                                      return next;
                                    });
                                    setEditKeyOpen((prev) => ({ ...prev, [t.id]: false }));
                                  }}
                                >
                                  Anahtarı temizle
                                </Button>
                              </div>
                            ) : null}

                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-xs text-muted-foreground mr-2">
                            {t.isAbsent ? (
                              <span className="text-red-600 font-medium">🚫 Devamsız</span>
                            ) : t.backupDay === getTodayYmd() ? (
                              <span className="text-amber-600 font-medium">👑 Yedek</span>
                            ) : "Uygun"}
                          </div>
                          <Button variant={t.isAbsent ? "default" : "outline"} onClick={() => toggleAbsent(t.id)} size="sm">
                            {t.isAbsent ? "✅ Uygun Yap" : "🚫 Devamsız Yap"}
                          </Button>
                          <Button variant={t.isTester ? "default" : "outline"} onClick={() => toggleTester(t.id)} size="sm">
                            {t.isTester ? "🧪 Testör (Açık)" : "🧪 Testör Yap"}
                          </Button>
                          <Button
                            variant={t.backupDay === getTodayYmd() ? "default" : "outline"}
                            onClick={() => toggleBackupToday(t.id)}
                            size="sm"
                            title={`Bugün yedek: dosya almaz. Gün sonunda en yüksek puan +${settings.backupBonusAmount} ile başlar.`}
                          >
                            {t.backupDay === getTodayYmd() ? "👑 Yedek İptal" : "👑 Başkan Yedek"}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => toggleActive(t.id)}>{t.active ? "📦 Arşivle" : "✨ Aktif Et"}</Button>
                          <Button variant="destructive" size="sm" title="Kalıcı Sil" onClick={() => deleteTeacher(t.id)}>🗑️ Sil</Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {adminTab === "reports" && (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant={["statistics", "weekly", "yearly", "teacher-performance", "file-type-analysis"].includes(reportMode) ? "default" : "outline"}>
                          📈 İstatistikler
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-2">
                        <div className="flex flex-col gap-1">
                          <Button
                            variant={reportMode === "statistics" ? "default" : "ghost"}
                            className="w-full justify-start"
                            onClick={() => setReportMode("statistics")}
                          >
                            📈 İstatistikler
                          </Button>
                          <Button
                            variant={reportMode === "weekly" ? "default" : "ghost"}
                            className="w-full justify-start"
                            onClick={() => setReportMode("weekly")}
                          >
                            📆 Haftalık Rapor
                          </Button>
                          <Button
                            variant={reportMode === "yearly" ? "default" : "ghost"}
                            className="w-full justify-start"
                            onClick={() => setReportMode("yearly")}
                          >
                            📆 Yıllık Rapor
                          </Button>
                          <Button
                            variant={reportMode === "teacher-performance" ? "default" : "ghost"}
                            className="w-full justify-start"
                            onClick={() => setReportMode("teacher-performance")}
                          >
                            👨‍🏫 Öğretmen Performansı
                          </Button>
                          <Button
                            variant={reportMode === "file-type-analysis" ? "default" : "ghost"}
                            className="w-full justify-start"
                            onClick={() => setReportMode("file-type-analysis")}
                          >
                            📊 Dosya Türü Analizi
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                    <Button variant={reportMode === "daily" ? "default" : "outline"} onClick={() => setReportMode("daily")}>
                      📅 Günlük Rapor
                    </Button>
                    <Button variant={reportMode === "monthly" ? "default" : "outline"} onClick={() => setReportMode("monthly")}>
                      📊 Aylık Rapor
                    </Button>
                    <Button variant={reportMode === "calendar" ? "default" : "outline"} onClick={() => setReportMode("calendar")}>
                      🗓️ Takvim
                    </Button>
                    <Button variant={reportMode === "e-archive" ? "default" : "outline"} onClick={() => setReportMode("e-archive")}>
                      🗄️ E-Arşiv
                    </Button>
                  </div>
                  <div className="border-t pt-4">
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={exportCSV2}>
                        📥 CSV Dışa Aktar
                      </Button>
                      <Button variant="outline" onClick={exportJSON}>
                        💾 JSON Yedek
                      </Button>
                      <label className="cursor-pointer">
                        <Input type="file" accept=".json" onChange={handleImportJSON} className="hidden" id="json-import-input" />
                        <Button variant="outline" type="button" onClick={() => (document.getElementById('json-import-input') as HTMLInputElement)?.click()}>
                          📤 JSON İçe Aktar
                        </Button>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {adminTab === "announcements" && (
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>📢 Duyuru Yönetimi</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>📢 Yeni Duyuru (gün içinde gösterilir)</Label>
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <Input
                              value={announcementText}
                              onChange={(e) => setAnnouncementText(e.target.value)}
                              placeholder="Kısa duyuru metni"
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  sendAnnouncement().then(() => playAnnouncementSound());
                                }
                              }}
                            />
                          </div>
                          <Button
                            data-silent="true"
                            onClick={async () => {
                              await sendAnnouncement();
                              playAnnouncementSound();
                            }}
                            disabled={!announcementText.trim()}
                          >
                            <Volume2 className="h-4 w-4 mr-1" /> Duyuru Gönder
                          </Button>
                        </div>
                        <div className="text-xs text-muted-foreground">Gönderince tüm öğretmenlere bildirim gider. Gece sıfırlanır.</div>
                      </div>

                      {announcements.length > 0 && (
                        <div className="space-y-3">
                          <Label className="text-base font-semibold">Bugünkü Duyurular ({announcements.length})</Label>
                          <div className="space-y-2">
                            {announcements.map((a) => (
                              <div key={a.id} className="flex items-start justify-between gap-2 border rounded-md p-3 bg-amber-50 border-amber-200">
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-amber-900">{a.text}</div>
                                  <div className="text-xs text-amber-700 mt-1">
                                    {new Date(a.createdAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    if (confirm("Duyuruyu silmek istiyor musunuz?")) removeAnnouncement(a.id);
                                  }}
                                  title="Duyuruyu sil"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {announcements.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border rounded-lg bg-slate-50">
                          <Volume2 className="h-10 w-10 mb-2 text-slate-400" />
                          <p className="text-sm font-medium">Henüz bugün için duyuru yok</p>
                          <p className="text-xs text-slate-400 mt-1">Duyuru gönderildiğinde burada görünecek</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {adminTab === "backup" && (
                <BackupManager
                  currentState={{
                    teachers,
                    cases,
                    history,
                    lastRollover,
                    lastAbsencePenalty,
                    announcements,
                    settings,
                    eArchive,
                  }}
                  onRestore={(state) => {
                    if (state.teachers) setTeachers(state.teachers);
                    if (state.cases) setCases(state.cases);
                    if (state.history) setHistory(state.history);
                    if (state.announcements) setAnnouncements(state.announcements);
                    if (state.settings) setSettings(state.settings);
                    if (state.eArchive) setEArchive(state.eArchive);
                  }}
                />
              )}
            </div>
          </Card>
        )}

        {reportMode === "statistics" && <Statistics teachers={teachers} cases={cases} history={history} />}
        {reportMode === "daily" && (
          <DailyReport
            teachers={teachers}
            cases={cases}
            history={history}
            liveScores={liveScores}
            settings={{
              backupBonusAmount: settings.backupBonusAmount,
              absencePenaltyAmount: settings.absencePenaltyAmount,
            }}
          />
        )}
        {reportMode === "weekly" && <WeeklyReport teachers={teachers} cases={cases} history={history} />}
        {reportMode === "monthly" && <MonthlyReport teachers={teachers} />}
        {reportMode === "yearly" && <YearlyReport teachers={teachers} cases={cases} history={history} />}
        {reportMode === "teacher-performance" && <TeacherPerformanceReport teachers={teachers} cases={cases} history={history} />}
        {reportMode === "file-type-analysis" && <FileTypeAnalysis teachers={teachers} cases={cases} history={history} />}
        {reportMode === "archive" && (
          isAdmin ? (
            <AssignedArchiveView
              history={history}
              cases={cases}
              teacherName={teacherName}
              caseDesc={caseDesc}
              settings={settings}
            />
          ) : (
            <AssignedArchiveSingleDayView
              history={history}
              cases={cases}
              teacherName={teacherName}
              caseDesc={caseDesc}
              teachers={teachers}
              settings={settings}
            />
          )
        )}
        {reportMode === "e-archive" && <EArchiveView showAdminButtons={isAdmin} />}
        {reportMode === "calendar" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🗓️ Takvim Görünümü
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CalendarView
                history={history}
                teachers={teachers}
              />
            </CardContent>
          </Card>
        )}



        {/* Öneri/Şikayet Modal */}
        {feedbackOpen && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setFeedbackOpen(false)}>
            <Card className="w-[420px] shadow-2xl border-0" onClick={(e) => e.stopPropagation()}>
              <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg">
                <CardTitle className="text-white flex items-center gap-2">
                  <span className="text-2xl">💬</span>
                  <span>Öneri / Şikayet</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <Label>Ad Soyad</Label>
                    <Input value={fbName} onChange={e => setFbName(e.target.value)} placeholder="Ad Soyad" />
                  </div>
                  <div>
                    <Label>E‑posta</Label>
                    <Input value={fbEmail} onChange={e => setFbEmail(e.target.value)} placeholder="ornek@eposta.com" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="whitespace-nowrap">Tür</Label>
                    <Select value={fbType} onValueChange={(v) => setFbType(v as any)}>
                      <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tür seç" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="oneri">Öneri</SelectItem>
                        <SelectItem value="sikayet">Şikayet</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Mesaj</Label>
                    <textarea className="w-full border rounded-md p-2 text-sm min-h-28" value={fbMessage} onChange={e => setFbMessage(e.target.value)} placeholder="Mesajınızı yazın..." />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" onClick={() => setFeedbackOpen(false)}>Kapat</Button>
                  <Button onClick={async () => {
                    const payload = { name: fbName.trim(), email: fbEmail.trim(), type: fbType, message: fbMessage.trim() } as any;
                    if (!payload.name || !payload.email || payload.message.length < 10) { toast("Lütfen ad, e‑posta ve en az 10 karakterlik mesaj girin."); return; }
                    try {
                      const res = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
                      if (res.ok) { toast("Gönderildi. Teşekkür ederiz!"); setFeedbackOpen(false); setFbName(""); setFbEmail(""); setFbMessage(""); setFbType("oneri"); }
                      else { const j = await res.json().catch(() => ({})); toast("Gönderilemedi: " + (j?.error || res.statusText)); }
                    } catch { toast("Ağ hatası: Gönderilemedi"); }
                  }}>Gönder</Button>
                </div>
                <div className="text-[11px] text-muted-foreground">Gönderimler <strong>ataafurkan@gmail.com</strong> adresine iletilir.</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Settings Modal */}
        {settingsOpen && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setSettingsOpen(false)}>
            <Card className="w-[600px] max-h-[90vh] overflow-y-auto shadow-2xl border-0" onClick={(e) => e.stopPropagation()}>
              <CardHeader className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-t-lg sticky top-0 z-10">
                <CardTitle className="text-white flex items-center gap-2">
                  <span className="text-2xl">⚙️</span>
                  <span>Ayarlar</span>
                </CardTitle>
                {/* Tab Navigation */}
                <div className="flex gap-2 mt-4">
                  <Button
                    variant={settingsTab === "general" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSettingsTab("general")}
                    className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                  >
                    Genel
                  </Button>
                  <Button
                    variant={settingsTab === "theme" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSettingsTab("theme")}
                    className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                  >
                    🎨 Tema
                  </Button>
                  <Button
                    variant={settingsTab === "widgets" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSettingsTab("widgets")}
                    className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                  >
                    📊 Widget'lar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {settingsTab === "general" && (
                  <>
                    <div>
                      <Label className="text-slate-900 font-semibold">Günlük Limit (öğretmen başına)</Label>
                      <Input type="number" value={settings.dailyLimit} onChange={e => setSettings({ ...settings, dailyLimit: Math.max(1, Number(e.target.value) || 0) })} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-slate-900 font-semibold">Test Puanı</Label>
                        <Input type="number" value={settings.scoreTest} onChange={e => setSettings({ ...settings, scoreTest: Number(e.target.value) || 0 })} />
                      </div>
                      <div>
                        <Label className="text-slate-900 font-semibold">Yeni Bonus</Label>
                        <Input type="number" value={settings.scoreNewBonus} onChange={e => setSettings({ ...settings, scoreNewBonus: Number(e.target.value) || 0 })} />
                      </div>
                      <div>
                        <Label className="text-slate-900 font-semibold">Yönlendirme</Label>
                        <Input type="number" value={settings.scoreTypeY} onChange={e => setSettings({ ...settings, scoreTypeY: Number(e.target.value) || 0 })} />
                      </div>
                      <div>
                        <Label className="text-slate-900 font-semibold">Destek</Label>
                        <Input type="number" value={settings.scoreTypeD} onChange={e => setSettings({ ...settings, scoreTypeD: Number(e.target.value) || 0 })} />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-slate-900 font-semibold">İkisi</Label>
                        <Input type="number" value={settings.scoreTypeI} onChange={e => setSettings({ ...settings, scoreTypeI: Number(e.target.value) || 0 })} />
                      </div>
                    </div>
                    {/* Yedek Başkan Bonus Ayarları */}
                    <div className="border-t border-slate-200 pt-4 mt-4">
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                        <Label className="text-sm font-semibold mb-2 block text-amber-900 flex items-center gap-2">
                          <span>👑</span>
                          <span>Yedek Başkan Bonus Ayarları</span>
                        </Label>
                        <div>
                          <Label className="text-xs text-slate-900 font-semibold">Bonus Miktarı (En Yüksek + X)</Label>
                          <Input type="number" min={0} value={settings.backupBonusAmount} onChange={e => setSettings({ ...settings, backupBonusAmount: Math.max(0, Number(e.target.value) || 0) })} />
                        </div>
                        <p className="text-[11px] text-amber-700 mt-1">
                          Yedek başkan: O günün en yüksek puanına +{settings.backupBonusAmount} eklenir.
                        </p>
                      </div>
                    </div>
                    {/* Devamsızlık Cezası Ayarları */}
                    <div className="border-t border-slate-200 pt-4 mt-4">
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                        <Label className="text-sm font-semibold mb-2 block text-red-900 flex items-center gap-2">
                          <span>🚫</span>
                          <span>Devamsızlık Cezası Ayarları</span>
                        </Label>
                        <div>
                          <Label className="text-xs text-slate-900 font-semibold">Puan Farkı (En Düşük - X)</Label>
                          <Input type="number" min={0} value={settings.absencePenaltyAmount} onChange={e => setSettings({ ...settings, absencePenaltyAmount: Math.max(0, Number(e.target.value) || 0) })} />
                        </div>
                        <p className="text-[11px] text-red-700 mt-1">
                          Devamsız öğretmen: O günün en düşük puanından -{settings.absencePenaltyAmount} çıkarılır.
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <Button variant="outline" onClick={() => setSettings(DEFAULT_SETTINGS)}>Varsayılanlara Dön</Button>
                      <Button onClick={() => setSettingsOpen(false)}>Kapat</Button>
                    </div>
                  </>
                )}

                {settingsTab === "theme" && (
                  <div className="space-y-4">
                    <ThemeSettings />
                    <div className="flex justify-end gap-2 pt-1">
                      <Button onClick={() => setSettingsOpen(false)}>Kapat</Button>
                    </div>
                  </div>
                )}

                {settingsTab === "widgets" && (
                  <div className="space-y-4">
                    <DashboardWidgets />
                    <div className="flex justify-end gap-2 pt-1">
                      <Button onClick={() => setSettingsOpen(false)}>Kapat</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
        {/* Login Modal */}
        {loginOpen && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
            <Card className="w-[400px] shadow-2xl border-0">
              <CardHeader className="bg-gradient-to-r from-slate-700 to-slate-800 text-white rounded-t-lg">
                <CardTitle className="text-white flex items-center gap-2">
                  <span className="text-2xl">🔐</span>
                  <span>Admin Girişi</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label>E-posta</Label>
                  <Input value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="admin@example.com" />
                </div>
                <div className="space-y-1">
                  <Label>Parola</Label>
                  <Input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Checkbox id="remember" checked={loginRemember} onCheckedChange={(v) => setLoginRemember(Boolean(v))} />
                  <Label htmlFor="remember" className="text-sm font-normal">Beni Hatırla</Label>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setLoginOpen(false)}>İptal</Button>
                  <Button onClick={doLogin}>Giriş Yap</Button>
                </div>
                <div className="text-xs text-muted-foreground">
                  Sadece yetkili admin işlem yapabilir; diğer kullanıcılar raporları görüntüler.
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        {/* Dosya Atama Bildirimi - Büyük Animasyonlu Popup */}
        {assignmentPopup && (
          <div className="fixed inset-0 flex items-center justify-center z-[200] pointer-events-none">
            <div className="animate-assignment-popup bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 text-white rounded-3xl shadow-2xl p-8 max-w-md mx-4 text-center transform">
              <div className="text-6xl mb-4 animate-bounce">📁</div>
              <div className="text-lg font-medium opacity-90 mb-2">Dosya Atandı!</div>
              <div className="text-3xl font-bold mb-3">{assignmentPopup.teacherName}</div>
              <div className="bg-white/20 rounded-xl px-4 py-2 mb-3">
                <div className="text-sm opacity-80">Öğrenci</div>
                <div className="font-semibold truncate">{assignmentPopup.studentName}</div>
              </div>
              <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-1">
                <span className="text-sm">Puan:</span>
                <span className="text-xl font-bold">+{assignmentPopup.score}</span>
              </div>
            </div>
          </div>
        )}
        {/* Versiyon Güncelleme Bildirimi - Admin olmayan kullanıcılar için */}
        {showVersionPopup && !isAdmin && (
          <div className="fixed top-3 right-3 z-[150] max-w-md animate-slide-in-right">
            <div className="bg-gradient-to-br from-teal-500 to-teal-600 text-white rounded-xl shadow-2xl border border-teal-400/30 overflow-hidden">
              <div className="flex items-start justify-between p-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">✨</span>
                    <h3 className="font-bold text-lg">Uygulama Güncellendi</h3>
                  </div>
                  <div className="text-sm font-semibold mb-3 opacity-90">
                    Versiyon {APP_VERSION}
                  </div>
                  <div className="text-sm space-y-1 mb-3">
                    <div className="font-medium mb-1">Yapılan Değişiklikler:</div>
                    <ul className="list-disc list-inside space-y-0.5 text-xs opacity-90">
                      {CHANGELOG[APP_VERSION]?.map((change, idx) => (
                        <li key={idx}>{change}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="text-xs font-medium bg-white/20 rounded px-2 py-1 inline-block mt-2">
                    🔄 Sayfayı yenileyin
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowVersionPopup(false);
                    try {
                      localStorage.setItem(LS_LAST_SEEN_VERSION, APP_VERSION);
                    } catch { }
                  }}
                  className="ml-3 text-white/80 hover:text-white hover:bg-white/20 rounded p-1 transition-colors"
                  aria-label="Kapat"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Toast Container - Renkli */}
        {toasts.length > 0 && (
          <div className="fixed top-3 right-3 z-[100] space-y-2">
            {toasts.map(t => {
              const isError = t.text.toLowerCase().includes('hata') || t.text.toLowerCase().includes('error');
              const isSuccess = t.text.toLowerCase().includes('başarı') || t.text.toLowerCase().includes('eklendi') || t.text.toLowerCase().includes('silindi');
              return (
                <div
                  key={t.id}
                  className={`rounded-xl text-white text-sm px-4 py-3 shadow-xl flex items-center gap-2 animate-slide-in-right ${isError ? 'bg-gradient-to-r from-red-500 to-red-600' :
                    isSuccess ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' :
                      'bg-gradient-to-r from-slate-700 to-slate-800'
                    }`}
                >
                  <span>{isError ? '❌' : isSuccess ? '✅' : '💬'}</span>
                  <span>{t.text}</span>
                </div>
              );
            })}
          </div>
        )}
        {/* Yazdırma için özel stil */}
        <style jsx global>{`
        @media print {
          body.print-pdf-list .printable-pdf-list {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          body.print-pdf-list > div > *:not(.printable-pdf-list) {
            display: none !important;
          }
          body.print-pdf-list .printable-pdf-list .no-print {
            display: none !important;
          }
        }
      `}</style>
      </div>
      {(showPdfPanel || showRules) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl border border-emerald-100 p-6 space-y-5">
            <button
              className="absolute top-4 right-4 text-slate-600 hover:text-slate-900 z-10"
              onClick={() => { setShowPdfPanel(false); setShowRules(false); }}
              title="Kapat"
            >
              <X className="h-6 w-6" />
            </button>
            {showPdfPanel && (
              <>
                <Card className="border border-dashed border-emerald-300 bg-white/90">
                  <CardHeader>
                    <CardTitle>RAM Randevu PDF Yükle</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <label
                        className={`sm:flex-1 flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isDragging
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-emerald-300 hover:bg-emerald-50/50"
                          }`}
                        onDragEnter={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
                            setIsDragging(true);
                          }
                        }}
                        onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsDragging(false);
                          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                            const file = e.dataTransfer.files[0];
                            if (file.type === "application/pdf") {
                              handlePdfFileChange(file);
                            } else {
                              toast("Lütfen sadece PDF dosyası sürükleyin.");
                            }
                          }
                        }}
                      >
                        <input
                          type="file"
                          accept="application/pdf"
                          ref={pdfInputRef}
                          onChange={(e) => handlePdfFileChange(e.target.files?.[0] || null)}
                          className="hidden"
                        />
                        <div className="text-center text-slate-600">
                          {pdfFile ? <span className="font-semibold text-emerald-800">{pdfFile.name}</span> : "PDF dosyasını buraya sürükleyin veya tıklayıp seçin"}
                        </div>
                      </label>
                      <Button onClick={uploadPdfFromFile} disabled={pdfUploading || !pdfFile}>
                        {pdfUploading ? "Yükleniyor..." : "PDF Ekle"}
                      </Button>
                    </div>
                    <p className="text-xs text-slate-600">
                      Sistem, PDF başlığındaki tarihi (örn: "21.11.2025 Tarihli Randevu Listesi") otomatik olarak okur. Yükleme, o tarihe ait mevcut listeyi siler ve yenisiyle değiştirir.
                    </p>
                    {pdfUploadError && <p className="text-sm text-red-600">{pdfUploadError}</p>}
                    {!pdfUploadError && pdfEntries.length > 0 && (
                      <p className="text-sm text-emerald-700">
                        Son yüklemede {pdfEntries.length} randevu bulundu
                        {pdfDate ? ` (${pdfDate})` : ""}. Bu liste tüm kullanıcılarla paylaşılır.
                      </p>
                    )}
                  </CardContent>
                </Card>
                <Card className="border border-emerald-200 bg-emerald-50/60">
                  <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <CardTitle>
                      Yüklenen PDF Randevuları
                      {pdfDate && <span className="ml-2 text-sm text-emerald-700 font-normal">({pdfDate})</span>}
                    </CardTitle>
                    {isAdmin ? (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          data-silent="true"
                          onClick={() => clearPdfEntries()}
                          disabled={!pdfEntries.length || pdfLoading}
                        >
                          PDF'yi Temizle
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          data-silent="true"
                          onClick={() => setSelectedPdfEntryId(null)}
                          disabled={!selectedPdfEntryId}
                        >
                          Seçimi Temizle
                        </Button>
                      </div>
                    ) : null}
                  </CardHeader>
                  <CardContent>
                    {pdfLoading ? (
                      <p className="text-sm text-slate-600">Randevular yükleniyor...</p>
                    ) : pdfEntries.length === 0 ? (
                      <p className="text-sm text-slate-600">Henüz PDF içe aktarılmadı. İlk sayfadaki panelden PDF yükleyebilirsiniz.</p>
                    ) : (
                      <div className="overflow-auto border rounded-md">
                        <table className="min-w-full text-xs md:text-sm">
                          <thead className="bg-emerald-100 text-emerald-900">
                            <tr>
                              <th className="p-2 text-left">Saat</th>
                              <th className="p-2 text-left">Ad Soyad</th>
                              <th className="p-2 text-left">Dosya No</th>
                              <th className="p-2 text-left">Açıklama</th>
                              {isAdmin && <th className="p-2 text-right">İşlem</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {pdfEntries.map((entry) => (
                              <tr
                                key={entry.id}
                                className={`border-b last:border-b-0 ${selectedPdfEntryId === entry.id ? "bg-emerald-50" : "bg-white"}`}
                              >
                                <td className="p-2 font-semibold">{entry.time}</td>
                                <td className="p-2">{entry.name}</td>
                                <td className="p-2">{entry.fileNo || "-"}</td>
                                <td className="p-2 text-xs text-slate-600">{entry.extra || "-"}</td>
                                {isAdmin && (
                                  <td className="p-2 flex flex-col gap-1 items-end">
                                    <Button size="sm" onClick={() => applyPdfEntry(entry)}>Forma Aktar</Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-red-600 hover:text-red-700"
                                      onClick={() => removePdfEntry(entry.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
            {showRules && (
              <div className="w-full max-w-4xl mx-auto">
                <div className="bg-gradient-to-br from-emerald-50 via-white to-blue-50 rounded-2xl shadow-xl border border-emerald-100/50 overflow-hidden">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-5 border-b border-emerald-800/20">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                      <span className="text-3xl">📋</span>
                      <span>Dosya Atama Kuralları</span>
                    </h2>
                    <p className="text-emerald-100 text-sm mt-1">Sistemin otomatik dosya atama mantığı ve puanlama kuralları</p>
                  </div>

                  {/* Content */}
                  <div className="p-6 md:p-8">
                    <div className="grid gap-4 md:gap-5">
                      {/* Rule 1 */}
                      <div className="bg-white rounded-xl p-5 border-l-4 border-purple-500 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center text-purple-700 font-bold text-sm">
                            1
                          </div>
                          <div className="flex-1">
                            <h3 className="font-bold text-slate-900 mb-1.5">Test Dosyaları</h3>
                            <p className="text-slate-700 text-sm leading-relaxed">Sadece testör öğretmenlere gider; aynı gün ikinci test verilmez.</p>
                          </div>
                        </div>
                      </div>

                      {/* Rule 2 */}
                      <div className="bg-white rounded-xl p-5 border-l-4 border-blue-500 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-700 font-bold text-sm">
                            2
                          </div>
                          <div className="flex-1">
                            <h3 className="font-bold text-slate-900 mb-1.5">Normal Dosya Uygunluk</h3>
                            <p className="text-slate-700 text-sm leading-relaxed">
                              Aktif olmalı, devamsız olmamalı, yedek değilse ve günlük sınır (<span className="font-semibold text-blue-600">{settings.dailyLimit}</span>) aşılmamış olmalı. Testörler test almış olsa da normal dosya alabilir.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Rule 3 */}
                      <div className="bg-white rounded-xl p-5 border-l-4 border-indigo-500 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-700 font-bold text-sm">
                            3
                          </div>
                          <div className="flex-1">
                            <h3 className="font-bold text-slate-900 mb-1.5">Sıralama</h3>
                            <p className="text-slate-700 text-sm leading-relaxed">
                              Yıllık yük az → Bugün aldığı dosya az → Rastgele; mümkünse son atanan öğretmene arka arkaya verilmez.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Rule 4 */}
                      <div className="bg-white rounded-xl p-5 border-l-4 border-cyan-500 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 w-8 h-8 bg-cyan-100 rounded-lg flex items-center justify-center text-cyan-700 font-bold text-sm">
                            4
                          </div>
                          <div className="flex-1">
                            <h3 className="font-bold text-slate-900 mb-1.5">Günlük Sınır</h3>
                            <p className="text-slate-700 text-sm leading-relaxed">
                              Öğretmen başına günde en fazla <span className="font-semibold text-cyan-600">{settings.dailyLimit}</span> dosya.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Rule 5 */}
                      <div className="bg-white rounded-xl p-5 border-l-4 border-teal-500 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center text-teal-700 font-bold text-sm">
                            5
                          </div>
                          <div className="flex-1">
                            <h3 className="font-bold text-slate-900 mb-1.5">Manuel Atama</h3>
                            <p className="text-slate-700 text-sm leading-relaxed">Admin manuel öğretmen seçerse otomatik seçim devre dışı kalır.</p>
                          </div>
                        </div>
                      </div>

                      {/* Rule 6 */}
                      <div className="bg-white rounded-xl p-5 border-l-4 border-orange-500 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center text-orange-700 font-bold text-sm">
                            6
                          </div>
                          <div className="flex-1">
                            <h3 className="font-bold text-slate-900 mb-1.5">Devamsız</h3>
                            <p className="text-slate-700 text-sm leading-relaxed">
                              Devamsız olan öğretmene dosya verilmez; gün sonunda devamsızlar için o gün en düşük puanın <span className="font-semibold text-orange-600">{settings.absencePenaltyAmount}</span> eksiği "denge puanı" eklenir.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Rule 7 */}
                      <div className="bg-white rounded-xl p-5 border-l-4 border-amber-500 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center text-amber-700 font-bold text-sm">
                            7
                          </div>
                          <div className="flex-1">
                            <h3 className="font-bold text-slate-900 mb-1.5">Başkan Yedek</h3>
                            <p className="text-slate-700 text-sm leading-relaxed">
                              Yedek işaretli öğretmen o gün dosya almaz; gün sonunda diğerlerinin en yüksek günlük puanına <span className="font-semibold text-amber-600">+{settings.backupBonusAmount}</span> eklenir.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Rule 8 */}
                      <div className="bg-white rounded-xl p-5 border-l-4 border-emerald-500 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-700 font-bold text-sm">
                            8
                          </div>
                          <div className="flex-1">
                            <h3 className="font-bold text-slate-900 mb-1.5">Puanlama</h3>
                            <p className="text-slate-700 text-sm leading-relaxed">
                              TEST = <span className="font-semibold text-emerald-600">{settings.scoreTest}</span>; YÖNLENDİRME = <span className="font-semibold text-emerald-600">{settings.scoreTypeY}</span>; DESTEK = <span className="font-semibold text-emerald-600">{settings.scoreTypeD}</span>; İKİSİ = <span className="font-semibold text-emerald-600">{settings.scoreTypeI}</span>; YENİ = <span className="font-semibold text-emerald-600">+{settings.scoreNewBonus}</span>; TANI = 0–6 (üst sınır 6).
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Rule 9 */}
                      <div className="bg-white rounded-xl p-5 border-l-4 border-green-500 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center text-green-700 font-bold text-sm">
                            9
                          </div>
                          <div className="flex-1">
                            <h3 className="font-bold text-slate-900 mb-1.5">Bildirim</h3>
                            <p className="text-slate-700 text-sm leading-relaxed">Atama sonrası öğretmene bildirim gönderilir.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
