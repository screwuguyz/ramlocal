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
import { Calendar } from "@/components/ui/calendar";
import MonthlyReport from "@/components/reports/MonthlyReport";
import DailyReport from "@/components/reports/DailyReport";
import AssignedArchiveView from "@/components/archive/AssignedArchive";
import AssignedArchiveSingleDayView from "@/components/archive/AssignedArchiveSingleDay";
import { Calendar as CalendarIcon, Trash2, UserMinus, Plus, FileSpreadsheet, BarChart2, Volume2, VolumeX, X, Printer } from "lucide-react";



// --- Tipler
export type Teacher = {
  id: string;
  name: string;
  isAbsent: boolean;
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
};

const DEFAULT_SETTINGS: Settings = {
  dailyLimit: 4,
  scoreTest: 7,
  scoreNewBonus: 1,
  scoreTypeY: 1,
  scoreTypeD: 2,
  scoreTypeI: 3,
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
}) {
  return (
    <Card className="border border-emerald-200 bg-emerald-50/70">
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <CardTitle>
          Günlük RAM Randevuları
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
          <p className="text-sm text-slate-600">Randevular yükleniyor...</p>
        ) : pdfEntries.length === 0 ? (
          <p className="text-sm text-slate-600">Henüz PDF içe aktarılmadı. Randevu listesi boş.</p>
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
                {pdfEntries.map((entry) => (
                  <tr
                    key={entry.id}
                    className={`border-b last:border-b-0 ${selectedPdfEntryId === entry.id ? "bg-emerald-50" : "bg-white"}`}
                  >
                    <td className="p-2 font-semibold">{entry.time}</td>
                    <td className="p-2">{entry.name}</td>
                    <td className="p-2">{entry.fileNo || "-"}</td>
                    <td className="p-2 text-xs text-slate-600">{entry.extra || "-"}</td>
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DosyaAtamaApp() {

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

  // --- Canlı yayın (Supabase)
  const clientId = React.useMemo(() => uid(), []);
  const channelRef = React.useRef<RealtimeChannel | null>(null);
  const lastAppliedAtRef = React.useRef<string>("")
  const teachersRef = React.useRef<Teacher[]>([]);
  const casesRef = React.useRef<CaseFile[]>([]);
  const lastAbsencePenaltyRef = React.useRef<string>("");
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
  const [isDragging, setIsDragging] = useState(false); // Sürükle-bırak durumu
  // Persist hydration guard: LS'den ilk yükleme bitene kadar yazma yapma
  const [hydrated, setHydrated] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Ayarlar (persist)
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const raw = localStorage.getItem(LS_SETTINGS);
      if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as Settings;
    } catch {}
    return DEFAULT_SETTINGS;
  });
  useEffect(() => {
    try { localStorage.setItem(LS_SETTINGS, JSON.stringify(settings)); } catch {}
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
  const [soundOn, setSoundOn] = useState<boolean>(() => {
    try { return localStorage.getItem("sound_on") !== "0"; } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem("sound_on", soundOn ? "1" : "0"); } catch {}
    if (soundOn) resumeAudioIfNeeded();
  }, [soundOn]);
  // Keep a ref in sync with soundOn to avoid stale closures in long-lived listeners
  const soundOnRef = React.useRef(soundOn);
  useEffect(() => { soundOnRef.current = soundOn; }, [soundOn]);

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
      ctx.resume().catch(() => {});
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
  function playBeep(freq: number, durationSec = 0.14, volume = 0.18) {
    if (!soundOnRef.current) return; // Ses kapalıysa çalma
    const ctx = getAudioCtx();
    if (!ctx) return;
    // iOS/Chrome politika: önce resume etmeyi dene
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = volume;
    osc.type = "triangle"; // daha belirgin
    osc.frequency.value = freq;
    osc.connect(gain).connect(ctx.destination);
    const now = ctx.currentTime;
    osc.start(now);
    osc.stop(now + durationSec);
  }
  function playAssignSound() {
    // Belirgin başarı melodisi (majör arpej)
    playBeep(523, 0.16, 0.22);  // C5
    window.setTimeout(() => playBeep(659, 0.16, 0.22), 170); // E5
    window.setTimeout(() => playBeep(784, 0.18, 0.22), 340); // G5
  }
  function playEmergencySound() {
    // Sirenimsi kısa uyarı (iki frekans arasında hızlı geçiş)
    playBeep(720, 0.14, 0.25);
    window.setTimeout(() => playBeep(480, 0.16, 0.25), 160);
    window.setTimeout(() => playBeep(720, 0.14, 0.25), 340);
  }

  function testSound() {
    // AudioContext'i kesinlikle aç ve kısa bir dizi çal
    resumeAudioIfNeeded();
    playBeep(600, 0.12, 0.2);
    window.setTimeout(() => playBeep(900, 0.12, 0.2), 160);
  }

  function playClickSound() {
    resumeAudioIfNeeded();
    playBeep(520, 0.06, 0.12);
  }

  function playAnnouncementSound() {
    // Kısa onay tonu (yükselen iki nota)
    playBeep(700, 0.12, 0.18);
    window.setTimeout(() => playBeep(920, 0.14, 0.18), 160);
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
      } catch {}
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
      if (!res.ok) return;
      const s = await res.json();
      const incomingTs = Date.parse(String(s.updatedAt || 0));
      const currentTs = Date.parse(String(lastAppliedAtRef.current || 0));
      if (!isNaN(incomingTs) && incomingTs <= currentTs) return;
      lastAppliedAtRef.current = s.updatedAt || new Date().toISOString();
      setTeachers(s.teachers ?? []);
      setCases(s.cases ?? []);
      setHistory(s.history ?? {});
      setLastRollover(s.lastRollover ?? "");
      setLastAbsencePenalty(s.lastAbsencePenalty ?? "");
      if (Array.isArray(s.announcements)) {
        const today = getTodayYmd();
        setAnnouncements((s.announcements || []).filter((a: any) => (a.createdAt || "").slice(0, 10) === today));
      }
      if (s.settings) setSettings((prev) => ({ ...prev, ...s.settings }));
    } catch (err) {
      console.warn("state fetch failed", err);
    } finally {
      setCentralLoaded(true);
    }
  }, []);

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
    if (confirmFirst && !confirm("Yüklenen tüm PDF kayıtlarını silmek istiyor musunuz?")) return;
    try {
      const qs = bypassAuth ? "?bypassAuth=true" : (pdfDateIso ? `?date=${encodeURIComponent(pdfDateIso)}` : "");
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
  const [reportMode, setReportMode] = useState<"none" | "monthly" | "daily" | "archive" | "e-archive">("none");

  const [filterYM, setFilterYM] = useState<string>(ymOf(nowISO()));
  // Admin oturum durumu
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [centralLoaded, setCentralLoaded] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginRemember, setLoginRemember] = useState(true); // Beni hatırla
  const [showLanding, setShowLanding] = useState(true);
  const [showPdfPanel, setShowPdfPanel] = useState<boolean | Date>(false);
  const [showRules, setShowRules] = useState(false);

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
        setAnnouncements((arr || []).filter(a => (a.createdAt || "").slice(0,10) === today));
      }
      if (pRaw) {
        try {
          const parsed = JSON.parse(pRaw);
          if (Array.isArray(parsed)) setPdfEntries(parsed);
        } catch {}
      }
      if (pdRaw) setPdfDate(pdRaw);
      if (pdIsoRaw) setPdfDateIso(pdIsoRaw);
      if (eaRaw) setEArchive(JSON.parse(eaRaw));
    } catch {}
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
    try { localStorage.setItem(LS_ANNOUNCEMENTS, JSON.stringify(announcements)); } catch {}
  }, [announcements, hydrated]);

  // ---- LS'ye yazma
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(LS_TEACHERS, JSON.stringify(teachers)); } catch {}
  }, [teachers, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(LS_CASES, JSON.stringify(cases)); } catch {}
  }, [cases, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(LS_HISTORY, JSON.stringify(history)); } catch {}
  }, [history, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(LS_LAST_ROLLOVER, lastRollover); } catch {}
  }, [lastRollover, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(LS_LAST_ABSENCE_PENALTY, lastAbsencePenalty); } catch {}
  }, [lastAbsencePenalty, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(LS_PDF_ENTRIES, JSON.stringify(pdfEntries)); } catch {}
  }, [pdfEntries, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    if (pdfDate) {
      try { localStorage.setItem(LS_PDF_DATE, pdfDate); } catch {}
    } else {
      try { localStorage.removeItem(LS_PDF_DATE); } catch {}
    }
  }, [pdfDate, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    if (pdfDateIso) {
      try { localStorage.setItem(LS_PDF_DATE_ISO, pdfDateIso); } catch {}
    } else {
      try { localStorage.removeItem(LS_PDF_DATE_ISO); } catch {}
    }
  }, [pdfDateIso, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(LS_E_ARCHIVE, JSON.stringify(eArchive)); } catch {}
  }, [eArchive, hydrated]);



  // ---- Merkezi durum: açılışta Supabase'den oku (LS olsa bile override et)
  useEffect(() => {
    fetchCentralState();
  }, [fetchCentralState]);

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
      .catch(() => {});
  }, []);
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
  });

  // 2) İzleyici "hello" derse admin state göndersin
  ch.on("broadcast", { event: "hello" }, (e) => {
    if (!isAdmin) return;                 // sadece admin cevaplar
    if (!hydrated) return;                // LS yüklenmeden varsayılan state'i yayınlama
    const p = e.payload as any;
    if (!p || p.sender === clientId) return;
    ch.send({
      type: "broadcast",
      event: "state",
      payload: { sender: clientId, teachers, cases, history, lastAbsencePenalty, updatedAt: (lastAppliedAtRef.current || new Date().toISOString()) },
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
  ch.send({
    type: "broadcast",
    event: "state",
    payload: { sender: clientId, teachers, cases, history, lastAbsencePenalty, updatedAt: (lastAppliedAtRef.current || new Date().toISOString()) },
  });
}, [teachers, cases, history, lastAbsencePenalty, isAdmin, clientId, hydrated, centralLoaded]);
// === Admin değiştirince merkezi state'e de yaz (kalıcılık)
useEffect(() => {
  if (!isAdmin) return;
  if (!hydrated) return;
  if (!centralLoaded) return;
  const ctrl = new AbortController();
  const nowTs = new Date().toISOString();
  lastAppliedAtRef.current = nowTs;
  const payload = {
    teachers,
    cases,
    history,
    lastRollover,
    lastAbsencePenalty,
    announcements,
    settings,
    updatedAt: nowTs,
  };
  const t = window.setTimeout(() => {
    fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    }).catch(() => {});
  }, 300);
  return () => { window.clearTimeout(t); ctrl.abort(); };
}, [teachers, cases, history, lastRollover, lastAbsencePenalty, announcements, settings, isAdmin, hydrated, centralLoaded]);

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
    try { await fetch("/api/logout", { method: "POST" }); } catch {}
    setIsAdmin(false);
  }

  // ---- Bugün test alıp almadı kontrolü (kilit)
  function hasTestToday(tid: string) {
    const today = getTodayYmd();
    return cases.some(c => c.isTest && !c.absencePenalty && c.assignedTo === tid && c.createdAt.slice(0,10) === today);
  }
  // Bugün bu öğretmene kaç dosya atanmış (test/normal ayrımı gözetmeksizin)
  function countCasesToday(tid: string) {
    const today = getTodayYmd();
    let n = 0;
    for (const c of cases) {
      if (c.absencePenalty) continue;
      if (c.assignedTo === tid && c.createdAt.slice(0,10) === today) n++;
    }
    return n;
  }
  // Günlük atama sınırı: bir öğretmene bir günde verilebilecek maksimum dosya
  const MAX_DAILY_CASES = 4;
  // Bugün en son kime atama yapıldı? (liste en yeni başta olduğundan ilk uygun kaydı alır)
  function lastAssignedTeacherToday(): string | undefined {
    const today = getTodayYmd();
    const recent = cases.find(c => !c.absencePenalty && c.createdAt.slice(0,10) === today && !!c.assignedTo);
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
  function autoAssign(newCase: CaseFile): Teacher | null {
    // Test dosyasıysa: sadece testörler ve bugün test almamış olanlar
    const todayYmd = getTodayYmd();
    if (newCase.isTest) {
      const testers = teachers.filter(
        (t) => t.isTester && !t.isAbsent && t.active && t.backupDay !== todayYmd && !hasTestToday(t.id) && countCasesToday(t.id) < MAX_DAILY_CASES
      );
      if (!testers.length) return null; // uygun testör yoksa atama yok

      // Önce yıllık yüke göre; eşitse bugün alınan dosya sayısı az olan öne; sonra rastgele
      testers.sort((a, b) => {
        const byLoad = a.yearlyLoad - b.yearlyLoad;
        if (byLoad !== 0) return byLoad;
        const byCount = countCasesToday(a.id) - countCasesToday(b.id);
        if (byCount !== 0) return byCount;
        return Math.random() - 0.5;
      });
      const lastTid = lastAssignedTeacherToday();
      const preferred = testers.find(t => t.id !== lastTid);
      const chosen = preferred || testers[0];

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
      // Atama yapıldıktan sonra öğretmene bildir (tekrar etmeyen, normal bildirim)
      notifyAssigned(chosen, newCase);
      return chosen;
    }

    // Normal dosyada: bugün test almış olsa da normal dosya verilebilir; sadece aktif/uygun, yedek olmayan ve sınır altında olsun
    const available = teachers.filter(
      (t) => !t.isAbsent && t.active && t.backupDay !== todayYmd && countCasesToday(t.id) < settings.dailyLimit
    );
    if (!available.length) return null;

    // Önce yıllık yüke göre; eşitse bugün alınan dosya sayısı az olan öne; sonra rastgele
    available.sort((a, b) => {
      const byLoad = a.yearlyLoad - b.yearlyLoad;
      if (byLoad !== 0) return byLoad;
      const byCount = countCasesToday(a.id) - countCasesToday(b.id);
      if (byCount !== 0) return byCount;
      return Math.random() - 0.5;
    });
    const lastTid = lastAssignedTeacherToday();
    const preferred = available.find(t => t.id !== lastTid);
    const chosen = preferred || available[0];

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
    // Atama yapıldıktan sonra öğretmene bildir (tekrar etmeyen, normal bildirim)
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
      if (chosen) { notifyAssigned(chosen, newCase); playAssignSound(); }
    } else {
      const chosenAuto = autoAssign(newCase);
      if (chosenAuto) {
        playAssignSound();
      }
    }
    setCases(prev => [newCase, ...prev]);
    // PDF kaydı formu doldururken seçili kalsa da listede kalsın; manuel silinecekse
    // kullanıcı "Kaydı Sil" butonunu kullanır.

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
  function removeCase(id: string) {
    const targetNow = cases.find(c => c.id === id);
    if (targetNow) {
      const who = `${targetNow.student}${targetNow.fileNo ? ` (${targetNow.fileNo})` : ""}`;
      if (!confirm(`Bu dosyayı silmek istiyor musunuz?\n${who}`)) return;
    }
    toast("Dosya silindi");
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
  }

  // ---- Öğretmen devamsızlık/aktiflik/silme/testör
  function toggleAbsent(tid: string) {
    setTeachers(prev => prev.map(t => (t.id === tid ? { ...t, isAbsent: !t.isAbsent } : t)));
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

    // Çalışan öğretmenler: aktif, devamsız DEĞİL ve o gün yedek DEĞİL
    const workingTeachers = teachersRef.current.filter((t) => t.active && !t.isAbsent && t.backupDay !== day);
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
    const penaltyScore = Math.max(0, minScore - 3);

    const absentTeachers = teachersRef.current.filter((t) => t.active && t.isAbsent);
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
    const reasonText = `Devamsızlık sonrası dengeleme puanı: en düşük ${minScore} - 3`;

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
    const maxScore = pointsByTeacher.size ? Math.max(...pointsByTeacher.values()) : 0;
    const bonus = maxScore + 3;
    const ym = day.slice(0, 7);
    const reasonText = `Başkan yedek bonusu: en yüksek ${maxScore} + 3`;

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
    () => cases.filter(c => c.createdAt.slice(0,10) === getTodayYmd()),
    [cases]
  );

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
    Object.keys(history).forEach(d => set.add(d.slice(0,7)));
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
    const headers = ['DosyaID','Öğrenci','Tür','Yeni','Tanı','Puan','Tarih','Ay','Test','Atanan Öğretmen'];
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
  function EArchiveView() {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>E-Arşiv (Tüm Atanmış Dosyalar)</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="destructive" onClick={clearEArchive}><Trash2 className="h-4 w-4 mr-2" /> Arşivi Temizle</Button>
            <Button onClick={exportEArchiveCSV}><FileSpreadsheet className="h-4 w-4 mr-2" /> CSV Olarak İndir</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto border rounded-md max-h-[70vh]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted"><tr><th className="p-2 text-left">Öğrenci Adı</th><th className="p-2 text-left">Dosya No</th><th className="p-2 text-left">Atanan Öğretmen</th><th className="p-2 text-left">Atama Tarihi</th></tr></thead>
              <tbody>
                {eArchive.map(entry => (
                  <tr key={entry.id} className="border-t">
                    <td className="p-2 font-medium">{entry.student}</td><td className="p-2">{entry.fileNo || '—'}</td><td className="p-2">{entry.assignedToName}</td><td className="p-2">{new Date(entry.createdAt).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
    const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
    a.href = url;
    a.download = `yedek_${ts}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---- CSV dışa aktar (ayrıştırılmış sütunlar)
  function exportCSV2() {
    const headers = [
      "DosyaID","DosyaNo","Öğrenci","Tür","Yeni","Yeni(1/0)",
      "Tanı","Puan","Tarih","Saat","Gün","Ay","Yıl","ISO",
      "Test","Test(1/0)","Atanan Öğretmen","Neden"
    ];
    const data = getCasesForMonth(filterYM);
    const rows = data.map((c) => {
      const d = new Date(c.createdAt);
      const tarih = d.toLocaleDateString('tr-TR');
      const saat = d.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});
      const gun = String(d.getDate()).padStart(2,'0');
      const ay  = String(d.getMonth()+1).padStart(2,'0');
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
        title: "Yeni Dosya Atandı",
        message: `${t.name} için dosya: ${c.student} (${desc})`,
        priority: 0, // normal
      }),
    });
  } catch {}
}

  
  
  // ---- Atanan Dosyalar: dış bileşen kullanılacak (AssignedArchiveView)
function AssignedArchiveSingleDay() {
  const days = React.useMemo(() => {
    const set = new Set<string>(Object.keys(history));
    const todayYmd = getTodayYmd();
    if (cases.some((c) => c.createdAt.slice(0,10) === todayYmd)) set.add(todayYmd);
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
      ...cases.filter((c) => c.createdAt.slice(0,10) === day),
    ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [day, history, cases]);

  const idx = days.indexOf(day);
  const prevDisabled = idx <= 0;
  const nextDisabled = idx === -1 || idx >= days.length - 1;
  const [openExplainId, setOpenExplainId] = React.useState<string | null>(null);
  const [aiOpenId, setAiOpenId] = React.useState<string | null>(null);
  const [aiLoading, setAiLoading] = React.useState(false);
  const [aiMessages, setAiMessages] = React.useState<Array<{role: 'user'|'assistant', content: string}>>([]);
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
        <CardTitle>Atanan Dosyalar (Tek Gün)</CardTitle>
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
                <tr><td className="p-4 text-center text-muted-foreground" colSpan={6}>Bu günde kayıt yok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

  if (showLanding) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-emerald-100 via-white to-emerald-200 relative text-slate-800 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-60 blur-3xl">
          <img src="/logo.png" alt="Karşıyaka RAM Logo" className="w-[70vw] max-w-4xl opacity-30" />
        </div>
        <div className="relative z-10 max-w-3xl w-full px-8 py-14 text-center space-y-7 bg-white/90 backdrop-blur rounded-[40px] shadow-2xl border border-emerald-100">
          <div className="text-sm md:text-base uppercase tracking-[0.6em] text-emerald-600 font-semibold">
            Karşıyaka Rehberlik ve Araştırma Merkezi
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-emerald-900">
            Özel Eğitim Bölümü Paneli
          </h1>
          <p className="text-lg md:text-2xl text-slate-600 leading-relaxed">
            Hoş geldiniz. Panelde günlük randevu listelerini yükleyebilir, dosya atamalarını yönetebilir ve öğretmen
            bildirimlerini takip edebilirsiniz.
          </p>
          <Button size="lg" className="px-12 py-6 text-xl" onClick={() => setShowLanding(false)}>
            Panele Giriş Yap
          </Button>
        </div>
      </main>
    );
  }

  // Non-admin başlangıç görünümü: Atanan Dosyalar
  if (!isAdmin && reportMode === "none") setReportMode("archive");

  // ---------- TEK RETURN: BİLEŞEN ÇIKIŞI ----------
  return (
    <>
    <div className="container mx-auto p-4 space-y-6">
      {/* Üst araç çubuğu: rapor ve giriş */}
     {/* ÜST BAR (sticky + cam) */}
<div className="sticky top-0 z-40 backdrop-blur bg-white/70 border-b border-slate-200/60">
  <div className="container mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-2 md:gap-3">

    {/* Sol: Ay seçici + rapor butonları */}
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
      <Select value={filterYM} onValueChange={setFilterYM}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Ay seç" />
        </SelectTrigger>
        <SelectContent>
          {allMonths.map((m) => (
            <SelectItem key={m} value={m}>{m}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button variant={reportMode === "monthly" ? "default" : "outline"} size="sm" className="min-h-9" aria-pressed={reportMode === "monthly"} onClick={() => setReportMode("monthly")}>
        <BarChart2 className="h-4 w-4 mr-2" /> Aylık Rapor
      </Button>
      <Button variant={reportMode === "daily" ? "default" : "outline"} size="sm" className="min-h-9" aria-pressed={reportMode === "daily"} onClick={() => setReportMode("daily")}>
        <BarChart2 className="h-4 w-4 mr-2" /> Günlük Rapor
      </Button>
      <Button variant={reportMode === "archive" ? "default" : "outline"} size="sm" className="min-h-9" aria-pressed={reportMode === "archive"} onClick={() => setReportMode("archive")}>
        <BarChart2 className="h-4 w-4 mr-2" /> Atanan Dosyalar
      </Button>
      <Button variant={reportMode === "e-archive" ? "default" : "outline"} size="sm" className="min-h-9" aria-pressed={reportMode === "e-archive"} onClick={() => setReportMode("e-archive")}>
        <FileSpreadsheet className="h-4 w-4 mr-2" /> E-Arşiv
      </Button>

      <Button variant="outline" size="sm" className="min-h-9" onClick={exportCSV2}>
        <FileSpreadsheet className="h-4 w-4 mr-2" /> CSV
      </Button>
      <Button variant="outline" size="sm" className="min-h-9" onClick={exportJSON}>
        <FileSpreadsheet className="h-4 w-4 mr-2" /> JSON Yedek
      </Button>

      <label className="cursor-pointer">
        <Input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
        <Button variant="outline" size="sm" className="min-h-9">JSON İçe Aktar</Button>
      </label>
    </div>

    {/* Sağ: Canlı rozet + giriş/çıkış */}
    <div className="flex items-center gap-3">
      <Button size="sm" variant="outline" className="min-h-9" onClick={() => setShowRules(true)}>Kurallar</Button>

      {/* CANLI ROZET (şık stil) */}
      <span
        className={
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ring-1 " +
          (live === "online"
            ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
            : live === "connecting"
            ? "bg-amber-50 text-amber-700 ring-amber-200"
            : "bg-rose-50 text-rose-700 ring-rose-200")
        }
        title={live === "online" ? "Bağlı" : live === "connecting" ? "Bağlanıyor" : "Bağlı değil"}
      >
        <span className="inline-block size-1.5 rounded-full bg-current animate-pulse" />
        Canlı: {live}
      </span>

      <Button size="sm" variant="outline" className="min-h-9" onClick={() => setFeedbackOpen(true)}>Öneri/Şikayet</Button>

      {isAdmin ? (
  <>
    <span className="text-sm text-emerald-700 font-medium">Admin</span>

    {/* Ses Aç/Kapat */}
    <Button
      size="sm"
      variant="outline"
      className="min-h-9"
      data-silent="true"
      title={soundOn ? "Sesi Kapat" : "Sesi Aç"}
      onClick={() => setSoundOn(v => !v)}
    >
      {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
    </Button>

    {/* Simülasyon Modu */}
    {typeof window !== "undefined" && new URLSearchParams(window.location.search).get("simDate") && (
      <>
        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded font-medium">
          📅 Simülasyon: {new URLSearchParams(window.location.search).get("simDate")}
        </span>
        <Button
          size="sm"
          variant="destructive"
          className="min-h-9"
          onClick={() => {
            if (confirm("Günü bitir ve arşivle? (Devamsızlık cezası + Yedek bonusu uygulanacak)")) {
              doRollover();
              toast("Gün bitirildi! Devamsızlık/yedek puanları uygulandı.");
            }
          }}
        >
          🌙 Günü Bitir
        </Button>
      </>
    )}

    {/* Çıkış */}
    <Button size="sm" variant="outline" className="min-h-9" onClick={() => setSettingsOpen(true)}>Ayarlar</Button>
    <Button size="sm" variant="outline" className="min-h-9" onClick={doLogout}>Çıkış</Button>
  </>
) : (
  <Button size="sm" className="min-h-9" onClick={() => setLoginOpen(true)}>Giriş</Button>
)}
    </div>

  </div>
</div>
      
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
          />
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

      {/* Admin alanı */}
      <div className={`flex flex-col gap-4 lg:flex-row ${isAdmin ? "" : "hidden"}`}>
        {/* Sol: Dosya ekle */}
        <Card className="flex-1">
          <CardHeader><CardTitle>Yeni Dosya Ekle</CardTitle></CardHeader>
          <CardContent
            className="space-y-4"
            onKeyDown={(e) => {
              // Enter: kaydet, Shift+Enter: boş (açıklamada newline)
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                addCase();
              }
            }}
          >
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
                <Label>Öğrenci Adı</Label>
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
                <Label>Dosya No</Label>
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
              <Label>Dosya Türü</Label>
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
                  <Button type="button" variant="outline" size="lg" className="px-3" onClick={() => setDiagCount((n) => Math.max(0, n - 1))}><UserMinus className="h-5 w-5"/></Button>
                  <Input
                    className="w-24 h-12 text-center text-xl font-bold"
                    inputMode="numeric"
                    value={diagCount}
                    onChange={(e) => {
                      const n = Number((e.target.value || "").replace(/[^\d]/g, ""));
                      setDiagCount(Math.max(0, Math.min(6, Number.isFinite(n) ? n : 0)));
                    }}
                  />
                  <Button type="button" variant="outline" size="lg" className="px-3" onClick={() => setDiagCount((n) => Math.min(6, n + 1))}><Plus className="h-5 w-5"/></Button>
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
                <Label>Öğretmeni Manuel Ata (opsiyonel)</Label>
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
                <Label>Açıklama (neden)</Label>
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
                <div className="text-sm text-muted-foreground">Puan: <span className="font-semibold">{calcScore()}</span></div>
              </div>
            </div>

            {/* Duyuru Gönder (admin) */}
            <div className="mt-4">
              <Label>Duyuru (gün içinde gösterilir)</Label>
              <div className="mt-1 flex items-end gap-2">
                <div className="flex-1">
                  <Input value={announcementText} onChange={(e) => setAnnouncementText(e.target.value)} placeholder="Kısa duyuru metni" />
                </div>
                <Button data-silent="true" onClick={async () => { await sendAnnouncement(); playAnnouncementSound(); }}>
                  <Volume2 className="h-4 w-4 mr-1" /> Duyuru Gönder
                </Button>
              </div>
              <div className="text-xs text-muted-foreground mt-1">Gönderince tüm öğretmenlere bildirim gider. Gece sıfırlanır.</div>
              {announcements.length > 0 && (
                <div className="mt-3 space-y-2">
                  <Label className="text-xs">Bugünkü duyurular</Label>
                  <div className="space-y-2">
                    {announcements.map((a) => (
                      <div key={a.id} className="flex items-start justify-between gap-2 border rounded-md p-2">
                        <div className="text-sm">{a.text}</div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => { if (confirm("Duyuruyu silmek istiyor musunuz?")) removeAnnouncement(a.id); }}
                          title="Duyuruyu sil"
                        >
                          Sil
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </CardContent>
        </Card>

        {/* Sağ: Öğretmenler */}
        <Card className="flex-1">
          <CardHeader><CardTitle>Öğretmenler</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {/* Öğretmen Ekle */}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label>Öğretmen Ekle</Label>
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
                <div key={t.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-1">
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
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-muted-foreground mr-2">{t.isAbsent ? "Devamsız" : "Uygun"}</div>
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
                      title="Bugün yedek: dosya almaz. Yarın en yüksek günlük puan +3 ile başlar."
                    >
                      {t.backupDay === getTodayYmd() ? "👑 Yedek İptal" : "👑 Başkan Yedek"}
                    </Button>
                    <Button variant="outline" onClick={() => toggleActive(t.id)}>{t.active ? "📦 Arşivle" : "✨ Aktif Et"}</Button>
                    <Button variant="destructive" size="sm" title="Kalıcı Sil" onClick={() => deleteTeacher(t.id)}>🗑️ Sil</Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

{/* Liste & filtre — BUGÜN */}
      <Card className={isAdmin ? "" : "hidden"}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Dosyalar (Bugün)</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={filterYM} onValueChange={setFilterYM}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Ay seç" /></SelectTrigger>
              <SelectContent>
                {allMonths.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={testSound}>Ses Test</Button>
            <Button variant="outline" onClick={() => setReportMode("monthly")}><BarChart2 className="h-4 w-4 mr-2"/>Aylık Rapor</Button>
            <Button variant="outline" onClick={() => setReportMode("daily")}><BarChart2 className="h-4 w-4 mr-2"/>Günlük Rapor</Button>
            <Button variant={reportMode === "archive" ? "default" : "outline"} aria-pressed={reportMode === "archive"} onClick={() => setReportMode("archive")}><BarChart2 className="h-4 w-4 mr-2"/>Atanan Dosyalar</Button>
            <Button variant="outline" onClick={exportCSV2}><FileSpreadsheet className="h-4 w-4 mr-2"/>CSV</Button>
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
                  <tr key={c.id} className="border-t">
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
                    <td className="p-2">{c.isTest ? "Evet (+5)" : "Hayır"}</td>
                    <td className="p-2 text-sm text-muted-foreground">{caseDesc(c)}</td>
                    <td className="p-2 text-right">
                      <Button size="icon" variant="ghost" onClick={() => removeCase(c.id)} title="Sil">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {filteredCases.length === 0 && (
                  <tr>
                    <td className="p-6 text-center text-muted-foreground" colSpan={7}>Bugün için kayıt yok.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobil: kart görünümü */}
          <div className="md:hidden space-y-2">
            {filteredCases.length === 0 && (
              <div className="text-center text-muted-foreground text-sm py-6 border rounded-md">Bugün için kayıt yok.</div>
            )}
            {filteredCases.map((c) => (
              <div key={c.id} className="border rounded-md p-3 bg-white">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{c.student}</div>
                  <div className="text-sm">Puan: <span className="font-semibold">{c.score}</span></div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">{new Date(c.createdAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}</div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Atanan:</span> {teacherName(c.assignedTo)}</div>
                  <div><span className="text-muted-foreground">Test:</span> {c.isTest ? "Evet (+5)" : "Hayır"}</div>
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
                  <Button size="icon" variant="ghost" onClick={() => removeCase(c.id)} title="Sil">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {reportMode === "monthly" && <MonthlyReport teachers={teachers} />}
      {reportMode === "daily" && (
        <DailyReport teachers={teachers} cases={cases} history={history} />
      )}
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
      {reportMode === "e-archive" && isAdmin && <EArchiveView />}


      
      {/* Öneri/Şikayet Modal */}
      {feedbackOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setFeedbackOpen(false)}>
          <Card className="w-[420px]" onClick={(e) => e.stopPropagation()}>
            <CardHeader><CardTitle>Öneri / Şikayet</CardTitle></CardHeader>
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
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setSettingsOpen(false)}>
          <Card className="w-[420px]" onClick={(e) => e.stopPropagation()}>
            <CardHeader><CardTitle>Ayarlar</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Günlük Limit (öğretmen başına)</Label>
                <Input type="number" value={settings.dailyLimit} onChange={e => setSettings({ ...settings, dailyLimit: Math.max(1, Number(e.target.value) || 0) })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Test Puanı</Label>
                  <Input type="number" value={settings.scoreTest} onChange={e => setSettings({ ...settings, scoreTest: Number(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>Yeni Bonus</Label>
                  <Input type="number" value={settings.scoreNewBonus} onChange={e => setSettings({ ...settings, scoreNewBonus: Number(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>Yönlendirme</Label>
                  <Input type="number" value={settings.scoreTypeY} onChange={e => setSettings({ ...settings, scoreTypeY: Number(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>Destek</Label>
                  <Input type="number" value={settings.scoreTypeD} onChange={e => setSettings({ ...settings, scoreTypeD: Number(e.target.value) || 0 })} />
                </div>
                <div className="col-span-2">
                  <Label>kisi</Label>
                  <Input type="number" value={settings.scoreTypeI} onChange={e => setSettings({ ...settings, scoreTypeI: Number(e.target.value) || 0 })} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setSettings(DEFAULT_SETTINGS)}>Varsayılanlara Dön</Button>
                <Button onClick={() => setSettingsOpen(false)}>Kapat</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
  {/* Login Modal */}
      {loginOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <Card className="w-[360px]">
            <CardHeader><CardTitle>Admin Girişi</CardTitle></CardHeader>
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
      {/* Toast Container */}
      {toasts.length > 0 && (
        <div className="fixed top-3 right-3 z-[100] space-y-2">
          {toasts.map(t => (
            <div key={t.id} className="rounded-md bg-slate-900 text-white text-sm px-3 py-2 shadow-lg">
              {t.text}
            </div>
          ))}
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
                        className={`sm:flex-1 flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                          isDragging
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
              <Card className="border-2 border-slate-300 bg-slate-50 w-full max-w-3xl mx-auto">
                <CardHeader>
                  <CardTitle className="tracking-wide">DOSYA ATAMA KURALLARI</CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="list-decimal marker:text-red-600 pl-5 space-y-3 text-sm md:text-base font-semibold text-slate-800">
                    <li>TEST DOSYALARI: Sadece testör öğretmenlere gider; aynı gün ikinci test verilmez.</li>
                    <li>NORMAL DOSYA UYGUNLUK: Aktif olmalı, devamsız olmamalı, yedek değilse ve günlük sınır (<span className="font-semibold">{settings.dailyLimit}</span>) aşılmamış olmalı. Testörler test almış olsa da normal dosya alabilir.</li>
                    <li>SIRALAMA: Yıllık yük az → Bugün aldığı dosya az → Rastgele; mümkünse son atanan öğretmene arka arkaya verilmez.</li>
                    <li>GÜNLÜK SINIR: Öğretmen başına günde en fazla <span className="font-semibold">{settings.dailyLimit}</span> dosya.</li>
                    <li>MANUEL ATAMA: Admin manuel öğretmen seçerse otomatik seçim devre dışı kalır.</li>
                    <li>DEVAMSIZ: Devamsız olan öğretmene dosya verilmez; gün sonunda devamsızlar için o gün en düşük puanın 3 eksiği “denge puanı” eklenir.</li>
                    <li>BAŞKAN YEDEK: Yedek işaretli öğretmen o gün dosya almaz; gün sonunda diğerlerinin en yüksek günlük puanına +3 eklenerek ertesi güne başlar.</li>
                    <li className="text-xs md:text-sm">PUANLAMA: TEST = {settings.scoreTest}; YÖNLENDİRME = {settings.scoreTypeY}; DESTEK = {settings.scoreTypeD}; İKİSİ = {settings.scoreTypeI}; YENİ = +{settings.scoreNewBonus}; TANI = 0–6 (üst sınır 6).</li>
                    <li>BİLDİRİM: Atama sonrası öğretmene bildirim gönderilir.</li>
                  </ol>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </>
  );
}
