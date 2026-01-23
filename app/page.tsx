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
import { format } from "date-fns";
import { tr } from "date-fns/locale/tr";

import MonthlyReport from "@/components/reports/MonthlyReport";
import DailyReport from "@/components/reports/DailyReport";
import Statistics from "@/components/reports/Statistics";
import WeeklyReport from "@/components/reports/WeeklyReport";
import YearlyReport from "@/components/reports/YearlyReport";
import TeacherPerformanceReport from "@/components/reports/TeacherPerformanceReport";
import FileTypeAnalysis from "@/components/reports/FileTypeAnalysis";
import BackupManager from "@/components/BackupManager";
// Theme imports removed (handled by hook)
import AssignedArchiveView from "@/components/archive/AssignedArchive";
import AssignedArchiveSingleDayView from "@/components/archive/AssignedArchiveSingleDay";
import { Trash2, Search, UserMinus, Plus, FileSpreadsheet, Inbox, X, ChevronLeft, ChevronRight, Volume2 } from "lucide-react";



// === YENİ MODÜLER BİLEŞENLER ===
import AnnouncementPopupModal from "@/components/modals/AnnouncementPopupModal";
import CalendarView from "@/components/reports/CalendarView";
import MiniWidgets from "@/components/dashboard/MiniWidgets";
import DailyAppointmentsCard from "@/components/appointments/DailyAppointmentsCard";
import Header from "@/components/dashboard/Header";
import DashboardHome from "@/components/dashboard/DashboardHome";
import TeacherDashboard from "@/components/dashboard/TeacherDashboard";
import TestDialog from "@/components/modals/TestDialog";
import RulesModal from "@/components/modals/RulesModal";
import PdfPanel from "@/components/modals/PdfPanel";
import LoginModal from "@/components/modals/LoginModal";
import SettingsModal from "@/components/modals/SettingsModal";
import FeedbackModal from "@/components/modals/FeedbackModal";
import VersionPopup from "@/components/modals/VersionPopup";
// FloatingAnimations components removed by user request
// Monthly Recap removed by user request
import { useAppStore } from "@/stores/useAppStore";
// Merkezi tipler ve utility'ler
import type { Teacher, CaseFile, EArchiveEntry, Announcement, PdfAppointment } from "@/types";
import { uid, humanType, csvEscape } from "@/lib/utils";
import { nowISO, getTodayYmd, ymdLocal, ymOf } from "@/lib/date";
import { LS_KEYS, APP_VERSION } from "@/lib/constants";
import TeacherList from "@/components/teachers/TeacherList";
import PhysiotherapistList from "@/components/teachers/PhysiotherapistList";
import CaseList from "@/components/cases/CaseList";
import { logger } from "@/lib/logger";
import { notifyTeacher } from "@/lib/notifications";
import { caseDescription } from "@/lib/scoring";
import { useSupabaseSync } from "@/hooks/useSupabaseSync";
import { useRollover } from "@/hooks/useRollover";
import { useAssignment } from "@/hooks/useAssignment";
import { useAudio } from "@/hooks/useAudio";






// Utility fonksiyonları artık lib'den import ediliyor
// Alias for backward compatibility
const caseDesc = caseDescription;

// LocalStorage anahtarları için alias'lar (geriye uyumluluk için)
const LS_TEACHERS = LS_KEYS.TEACHERS;
const LS_CASES = LS_KEYS.CASES;
const LS_HISTORY = LS_KEYS.HISTORY;
const LS_LAST_ROLLOVER = LS_KEYS.LAST_ROLLOVER;
const LS_ANNOUNCEMENTS = LS_KEYS.ANNOUNCEMENTS;
const LS_SETTINGS = LS_KEYS.SETTINGS;
const LS_PDF_ENTRIES = LS_KEYS.PDF_ENTRIES;
const LS_PDF_DATE = LS_KEYS.PDF_DATE;
const LS_PDF_DATE_ISO = LS_KEYS.PDF_DATE_ISO;
const LS_E_ARCHIVE = LS_KEYS.E_ARCHIVE;
const LS_LAST_ABSENCE_PENALTY = LS_KEYS.LAST_ABSENCE_PENALTY;
const LS_LAST_SEEN_VERSION = LS_KEYS.LAST_SEEN_VERSION;
// Utility fonksiyonları artık lib/utils.ts ve lib/date.ts'den import ediliyor

// Settings tipi ve DEFAULT_SETTINGS artık @/types ve @/lib/constants'dan import ediliyor

// DailyAppointmentsCard bileşeni @/components/appointments/DailyAppointmentsCard.tsx dosyasına taşındı.

const MAX_DAILY_CASES = 2;

const ADMIN_TABS = [
  { id: "home", icon: "🏠", label: "Genel Bakış" },
  { id: "files", icon: "📁", label: "Dosya Atama" },
  { id: "teachers", icon: "👨‍🏫", label: "Öğretmenler" },
  { id: "physiotherapists", icon: "🩺", label: "Fizyoterapist" },
  { id: "reports", icon: "📊", label: "Raporlar" },
  { id: "announcements", icon: "📢", label: "Duyuru" },
  { id: "backup", icon: "💾", label: "Yedekleme" },
] as const;

export default function DosyaAtamaApp() {
  // Queue state from store
  const {
    queue, setQueue,
    teachers, setTeachers, addTeacher, updateTeacher, removeTeacher,
    cases, setCases, addCase: addCaseAction, updateCase, removeCase: removeCaseAction,
    history, setHistory,
    eArchive, setEArchive, addToEArchive,
    absenceRecords, setAbsenceRecords,
    announcements, setAnnouncements, addAnnouncement, removeAnnouncement,
    pdfEntries, setPdfEntries,
    pdfDate, setPdfDate,
    pdfDateIso, setPdfDateIso,
    selectedPdfEntryId, setSelectedPdfEntryId,
    settings, setSettings, updateSettings,
    liveStatus: live, setLiveStatus: setLive,
    soundOn, setSoundOn,
    toasts, addToast: toast, removeToast,
    assignmentPopup, showAssignmentPopup, hideAssignmentPopup,
    announcementPopupData, showAnnouncementPopup, hideAnnouncementPopup,
    isAdmin, setIsAdmin,
    hydrated, setHydrated
  } = useAppStore();



  // ---- ARŞİV ve DİĞERLERİ (Store'da var ama yerel türevler olabilir)
  const lastRollover = useAppStore(s => s.lastRollover);
  const setLastRollover = useAppStore(s => s.setLastRollover);
  const lastAbsencePenalty = useAppStore(s => s.lastAbsencePenalty);
  const setLastAbsencePenalty = useAppStore(s => s.setLastAbsencePenalty);


  const lastAppliedAtRef = React.useRef<string>("")
  const teachersRef = React.useRef<Teacher[]>([]);
  const casesRef = React.useRef<CaseFile[]>([]);
  const adminSessionIdRef = React.useRef<string | null>(null);

  // ... (Refs continue)

  // ... (Refs continue)

  // =========================================================================================
  // SUPABASE SYNC & DATA MANAGEMENT (REFACTORED)
  // =========================================================================================

  // Use the unified hook for all sync operations
  const { fetchCentralState, syncToServer, isConnected } = useSupabaseSync((payload) => {
    // Realtime update callback
    console.log("[Realtime] Update received", payload);

    // SINGLE ADMIN SESSION CHECK
    if (isAdmin && adminSessionIdRef.current) {
      const remoteSessionId = payload?.new?.state?.adminSessionId;
      if (remoteSessionId && remoteSessionId !== adminSessionIdRef.current) {
        console.warn("[Session] Session ID mismatch! Remote:", remoteSessionId, "Local:", adminSessionIdRef.current);
        alert("Oturumunuz başka bir cihazda açıldığı için sonlandırıldı.");
        doLogout();
        return;
      }
    }

    if (payload.new && payload.new.state) {
      // Trigger fetch to update state
      fetchCentralState();
    }
  });

  // Rollover Hook (Handles auto-rollover at midnight)
  const { doRollover } = useRollover();

  // Assignment Logic Hook
  const {
    autoAssign,
    autoAssignWithTestCheck,
    getRealYearlyLoad,
    countCasesToday,
    countCasesThisMonth,
    hasTestToday,
    lastAssignedTeacherToday
  } = useAssignment();

  // Audio & Effects Hook
  const { playAssignSound, playEmergencySound, triggerFireworks, playAnnouncementSound } = useAudio();

  // LOCAL_MODE: Poll every 5 seconds
  useEffect(() => {
    const isLocalMode = process.env.NEXT_PUBLIC_LOCAL_MODE === "true" || process.env.NEXT_PUBLIC_LOCAL_MODE === "1";
    if (isLocalMode) {
      const interval = setInterval(() => {
        fetchCentralState();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [fetchCentralState]);

  // Removed redundant manual sync logic (syncToSupabase) - The hook handles it now.
  // Removed redundant auto-sync effect - The hook handles it now.
  // Removed redundancy centralLoaded state.

  const lastAbsencePenaltyRef = React.useRef<string>("");
  const supabaseTeacherCountRef = React.useRef<number>(0);
  const studentRef = React.useRef<HTMLInputElement | null>(null);
  const seenAnnouncementIdsRef = React.useRef<Set<string>>(new Set());



  // ---- Girdi durumları
  const [student, setStudent] = useState("");
  const [fileNo, setFileNo] = useState("");
  const [type, setType] = useState<"YONLENDIRME" | "DESTEK" | "IKISI">("YONLENDIRME");
  const [isNew, setIsNew] = useState(false);
  const [diagCount, setDiagCount] = useState(0);
  const [isTestCase, setIsTestCase] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [newTeacherName, setNewTeacherName] = useState("");
  const [newTeacherBirthDate, setNewTeacherBirthDate] = useState("");

  // Geçici Pushover User Key girişleri
  const [editPushover, setEditPushover] = useState<Record<string, string>>({});
  const [editKeyOpen, setEditKeyOpen] = useState<Record<string, boolean>>({});

  // Admin manuel atama alanları
  const [manualTeacherId, setManualTeacherId] = useState<string>("");
  const [manualReason, setManualReason] = useState<string>("");

  const manualAssignRef = React.useRef<HTMLDivElement | null>(null);

  // Duyuru ve PDF UI State (Data store'dan geliyor)
  const [announcementText, setAnnouncementText] = useState("");
  const [selectedPdfUploadDate, setSelectedPdfUploadDate] = useState<string | null>(null); // Takvimden seçilen tarih için PDF yükleme
  const [pdfLoading, setPdfLoading] = useState(false);
  const activePdfEntry = useMemo(() => pdfEntries.find(e => e.id === selectedPdfEntryId) || null, [pdfEntries, selectedPdfEntryId]);

  // Pending Appointments Count calculation
  const pendingAppointmentsCount = useMemo(() => {
    const isEntryAssigned = (entry: PdfAppointment) => {
      const inCases = cases.some((c: CaseFile) => {
        const source = c.sourcePdfEntry;
        if (!source) return false;
        if (source.id === entry.id) return true;
        return (
          source.time === entry.time &&
          source.name === entry.name &&
          (source.fileNo || "") === (entry.fileNo || "")
        );
      });
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
    return pdfEntries.filter(entry => !isEntryAssigned(entry)).length;
  }, [cases, history, pdfEntries]);


  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"general" | "theme" | "widgets">("general");

  // Login Modal State
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginRemember, setLoginRemember] = useState(true);


  // Test Bitti Mi? / Testör Koruma Dialog State
  const [testNotFinishedDialog, setTestNotFinishedDialog] = useState<{
    open: boolean;
    pendingCase: CaseFile | null;
    chosenTeacher: Teacher | null;
    skipTeacherIds: string[];
    confirmType?: 'testNotFinished' | 'testerProtection';

  }>({ open: false, pendingCase: null, chosenTeacher: null, skipTeacherIds: [] });

  // Missing State Definitions
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  /* Feedback State relocated to FeedbackModal */

  const [showVersionPopup, setShowVersionPopup] = useState(false);

  // Keep a ref in sync with settings to avoid stale closures in callbacks
  const settingsRef = React.useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);



  // Tüm butonlara genel tıklama sesi (özel sesler ayrıca çalınır)
  // Audio logic moved to hooks/useAudio.ts
  async function sendAnnouncement() {
    const text = announcementText.trim();
    if (!text) return;
    const createdAt = nowISO();
    const a: Announcement = { id: uid(), text, createdAt };
    addAnnouncement(a);
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
        if (date) {
          // Seçilen tarihte liste yok - bu tarihe PDF yüklenebilir
          const dateIso = format(date, "yyyy-MM-dd");
          setSelectedPdfUploadDate(dateIso);
          toast(`${format(date, "dd.MM.yyyy")} için randevu listesi bulunamadı. PDF yükleyebilirsiniz.`);
        }
        return;
      }

      // Eğer tarih parametresi verilmediyse (başlangıç yüklemesi) ve 
      // dönen tarih bugün değilse, listeyi temizle
      const returnedDateIso = json?.dateIso || null;
      const today = getTodayYmd();
      if (!date && returnedDateIso && returnedDateIso !== today) {
        // Eski günün listesi - bugün için boş göster
        setPdfEntries([]);
        setPdfDate(null);
        setPdfDateIso(null);
        return;
      }

      setPdfEntries(Array.isArray(json.entries) ? json.entries : []);
      setPdfDate(json?.date || null);
      setPdfDateIso(returnedDateIso);
    } catch (err) {
      logger.warn("pdf fetch failed", err);
      setPdfEntries([]);
      setPdfDate(null);
      setPdfDateIso(null);
    } finally {
      setPdfLoading(false);
    }
  }, []);





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
      setPdfDate(null);
      setPdfDateIso(null);
      toast("PDF kayıtları temizlendi");
    } catch (err) {
      logger.warn("pdf clear failed", err);
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
      setPdfEntries(pdfEntries.filter(entry => entry.id !== id));
      if (selectedPdfEntryId === id) setSelectedPdfEntryId(null);
      if (!silent) toast("Kayıt silindi");
    } catch (err) {
      logger.warn("pdf delete failed", err);
      if (!silent) toast("Kayıt silinemedi");
    }
  }

  function applyPdfEntry(entry: PdfAppointment) {
    setStudent(entry.name || "");
    if (entry.fileNo) setFileNo(entry.fileNo);
    setSelectedPdfEntryId(entry.id);
    toast("PDF kaydı forma aktarıldı");
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
  // Admin oturum durumu (Store'dan geliyor: isAdmin)


  // Login modal durumu (Yukarıda tanımlı)

  const [viewMode, setViewMode] = useState<"landing" | "main" | "teacher-tracking" | "archive">("landing");
  const [archivePassword, setArchivePassword] = useState("");
  const [archiveAuthenticated, setArchiveAuthenticated] = useState(false);
  const [archiveSearchTerm, setArchiveSearchTerm] = useState("");
  const [selectedAbsenceDate, setSelectedAbsenceDate] = useState<string | null>(null);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number>(0);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number>(0);
  const [showPdfPanel, setShowPdfPanel] = useState<boolean | Date>(false);
  const [showRules, setShowRules] = useState(false);
  // Versiyon bildirimi (Yukarıda tanımlı)

  // Admin panel tab sistemi
  const [adminTab, setAdminTab] = useState<"home" | "files" | "teachers" | "physiotherapists" | "reports" | "announcements" | "backup" | "timemachine">("home");

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
  // FIX: Ensure Furkan Ata ADIYAMAN is marked as physiotherapist (Data Repair)
  useEffect(() => {
    if (!hydrated || !teachers.length || !isAdmin) return;
    const target = teachers.find(t => ["Furkan Ata ADIYAMAN", "Furkan Ata"].includes(t.name) && !t.isPhysiotherapist);
    if (target) {
      updateTeacher(target.id, { isPhysiotherapist: true });
      console.log("Fixed physiotherapist flag for:", target.name);
    }
  }, [teachers, updateTeacher, hydrated, isAdmin]);


  // ---- Merkezi durum: açılışta Supabase'den oku (LS olsa bile override et)
  // ---- ⌨️ KLAVYE KISAYOLLARI
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (loginOpen) setLoginOpen(false);
        if (settingsOpen) setSettingsOpen(false);
        if (feedbackOpen) setFeedbackOpen(false);
        if (showPdfPanel) setShowPdfPanel(false);
        if (showRules) setShowRules(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && isAdmin && student.trim()) {
        e.preventDefault();
        handleAddCase();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loginOpen, settingsOpen, feedbackOpen, showPdfPanel, showRules, isAdmin, student]);

  // PDF Realtime listener (kept as it is distinct from general app state)
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

  // Versiyon kontrolü
  useEffect(() => {
    if (isAdmin || !hydrated) return;
    try {
      const lastSeenVersion = localStorage.getItem(LS_LAST_SEEN_VERSION);
      if (lastSeenVersion !== APP_VERSION) {
        setShowVersionPopup(true);
      }
    } catch { }
  }, [isAdmin, hydrated]);

  // Connection status (already handled by useSupabaseSync logic via liveStatus in store, but keeping basic check or using hook's isConnected)
  // setLiveStatus is updated by hook, so we don't need manual setLive logic here except for fallback.
  // We can remove the setLive logic here as hook handles it.

  // Theme sync logic removed - handled by hook (eventually) or bundled with other updates.
  // TODO: Move theme state to store for real-time sync.

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

        // SINGLE ADMIN SESSION: Generate new ID and save
        const newSessionId = uid();
        adminSessionIdRef.current = newSessionId;
        console.log("[Session] New Admin Session started:", newSessionId);

        // Save to server immediately
        await fetch("/api/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            adminSessionId: newSessionId,
            // Send current state to ensure valid merge
            updatedAt: new Date().toISOString()
          })
        });

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

  // Günlük atama sınırı: bir öğretmene bir günde verilebilecek maksimum dosya
  const MAX_DAILY_CASES = 4;

  // Assignment helpers moved to hooks/useAssignment.ts

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

  // AutoAssign logic moved to hooks/useAssignment.ts

  // Dialog'da "Bitti" seçildiğinde çağrılır
  function confirmTestFinished() {
    const { pendingCase, chosenTeacher } = testNotFinishedDialog;
    if (!pendingCase || !chosenTeacher) return;

    const ym = ymOf(pendingCase.createdAt);
    updateTeacher(chosenTeacher.id, {
      yearlyLoad: chosenTeacher.yearlyLoad + pendingCase.score,
      monthly: { ...(chosenTeacher.monthly || {}), [ym]: (chosenTeacher.monthly?.[ym] || 0) + pendingCase.score },
    });
    pendingCase.assignedTo = chosenTeacher.id;
    notifyTeacher(chosenTeacher.pushoverKey || "", "Dosya Atandı", `Öğrenci: ${pendingCase.student}`, 0, chosenTeacher.id);

    addCaseAction(pendingCase);
    playAssignSound();
    triggerFireworks();
    showAssignmentPopup({
      teacherName: chosenTeacher.name,
      studentName: pendingCase.student,
      score: pendingCase.score
    });

    // Reset form
    setStudent("");
    setFileNo("");
    setIsNew(false);
    setDiagCount(0);
    setType("YONLENDIRME");
    setIsTestCase(false);
    setFilterYM(ymOf(pendingCase.createdAt));
    setManualTeacherId("");
    setManualReason("");

    setTestNotFinishedDialog({ open: false, pendingCase: null, chosenTeacher: null, skipTeacherIds: [] });
  }

  // Dialog'da "Bitmedi" seçildiğinde çağrılır - bu öğretmeni atla, sonrakine bak
  function skipTestNotFinished() {
    const { pendingCase, chosenTeacher, skipTeacherIds } = testNotFinishedDialog;
    if (!pendingCase || !chosenTeacher) return;

    // Bu öğretmeni skip listesine ekle ve tekrar dene
    const newSkipList = [...skipTeacherIds, chosenTeacher.id];
    const result = autoAssignWithTestCheck(pendingCase, newSkipList);

    if (result.needsConfirm && result.chosen && result.pendingCase) {
      // Bir sonraki aday da test almış, tekrar sor
      setTestNotFinishedDialog({
        open: true,
        pendingCase: result.pendingCase,
        chosenTeacher: result.chosen,
        skipTeacherIds: newSkipList
      });
    } else if (result.chosen) {
      // Atama başarılı
      addCaseAction(pendingCase);
      playAssignSound();
      showAssignmentPopup({
        teacherName: result.chosen.name,
        studentName: pendingCase.student,
        score: pendingCase.score
      });

      // Reset form
      setStudent("");
      setFileNo("");
      setIsNew(false);
      setDiagCount(0);
      setType("YONLENDIRME");
      setIsTestCase(false);
      setFilterYM(ymOf(pendingCase.createdAt));
      setManualTeacherId("");
      setManualReason("");

      setTestNotFinishedDialog({ open: false, pendingCase: null, chosenTeacher: null, skipTeacherIds: [] });
    } else {
      // Uygun öğretmen kalmadı
      toast("⚠️ Uygun öğretmen bulunamadı!");
      setTestNotFinishedDialog({ open: false, pendingCase: null, chosenTeacher: null, skipTeacherIds: [] });
    }
  }

  const [triedAdd, setTriedAdd] = useState(false);

  function handleAddCase() {
    setTriedAdd(true);
    if (!student.trim()) {
      toast("Öğrenci adı gerekli");
      return;
    }
    // Eğer customDate varsa o tarihi kullan, yoksa bugünün tarihini
    const createdAt = customDate
      ? `${customDate}T12:00:00.000Z` // Geçmiş tarih için ISO format
      : nowISO();
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

    // Eğer PDF randevusundan geldiyse, kaynak bilgisini ekle
    if (selectedPdfEntryId && activePdfEntry) {
      newCase.sourcePdfEntry = activePdfEntry;
    }

    // Eğer admin öğretmen seçtiyse, manuel atama uygula
    if (manualTeacherId) {
      newCase.assignedTo = manualTeacherId;
      newCase.assignReason = manualReason.trim() || undefined;
      const chosen = teachers.find((t) => t.id === manualTeacherId);
      if (chosen) {
        const ym = ymOf(newCase.createdAt);
        updateTeacher(chosen.id, {
          yearlyLoad: chosen.yearlyLoad + newCase.score,
          monthly: { ...(chosen.monthly || {}), [ym]: (chosen.monthly?.[ym] || 0) + newCase.score },
        });
        newCase.assignedTo = chosen.id;
        notifyTeacher(chosen.pushoverKey || "", "Dosya Atandı (Manuel)", `Öğrenci: ${newCase.student}`, 0, chosen.id);
        playAssignSound();
        triggerFireworks();
        showAssignmentPopup({
          teacherName: chosen.name,
          studentName: newCase.student,
          score: newCase.score
        });
      }

      addCaseAction(newCase);

      // Atama başarılı olduysa ve PDF randevusundan geldiyse, randevu listesinden sil
      if (selectedPdfEntryId) {
        setPdfEntries(pdfEntries.filter(e => e.id !== selectedPdfEntryId));
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
      setManualTeacherId("");
      setManualReason("");
    } else {
      // 🆕 Otomatik atama - Test kontrolü ile
      const result = autoAssignWithTestCheck(newCase);

      if (result.needsConfirm && result.chosen && result.pendingCase) {
        // Testör koruma veya test bitti dialogu göster
        setTestNotFinishedDialog({
          open: true,
          pendingCase: result.pendingCase,
          chosenTeacher: result.chosen,
          skipTeacherIds: [],
          confirmType: result.confirmType
        });
        // Form resetleme ve case ekleme dialog callbacklerinde yapılacak
        return;
      }

      if (result.chosen) {
        playAssignSound();
        triggerFireworks();
        showAssignmentPopup({
          teacherName: result.chosen.name,
          studentName: newCase.student,
          score: newCase.score
        });
      }

      addCaseAction(newCase);

      // Atama başarılı olduysa ve PDF randevusundan geldiyse, randevu listesinden sil
      if (selectedPdfEntryId) {
        setPdfEntries(pdfEntries.filter(e => e.id !== selectedPdfEntryId));
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
      setManualTeacherId("");
      setManualReason("");
    }
  }
  // Dosya eklendiğinde E-Arşive de ekle
  useEffect(() => {
    // E-Arşiv senkronizasyonu (Add, Update, Remove for Today)
    const today = getTodayYmd();

    // Mevcut eArchive durumu (useAppStore'dan gelen)
    const nextArchive = [...eArchive];
    let changed = false;

    // 1. Cases'den gelenleri güncelle veya ekle
    cases.forEach(c => {
      if (!c.assignedTo || c.absencePenalty || c.backupBonus) return;

      const date = c.createdAt.slice(0, 10);
      const idx = nextArchive.findIndex(a => a.id === c.id);
      const tName = teacherName(c.assignedTo);

      if (idx > -1) {
        // Varsa ve değişiklik gerekiyorsa güncelle
        const entry = nextArchive[idx];
        if (entry.teacherName !== tName || entry.studentName !== c.student || entry.fileNo !== c.fileNo) {
          nextArchive[idx] = { ...entry, teacherName: tName, studentName: c.student, fileNo: c.fileNo || undefined };
          changed = true;
        }
      } else {
        // Yoksa ekle
        nextArchive.push({
          id: c.id,
          studentName: c.student,
          fileNo: c.fileNo || undefined,
          teacherName: tName,
          date: date
        });
        changed = true;
      }
    });

    // 2. (İptal) Bugün silinenleri buradan temizlemek TEHLİKELİ.
    // Çünkü "Günü Bitir" yapınca cases [] olur, bu durumda e-arşivi de siler.
    // Silme işlemini removeCase fonksiyonu zaten yapıyor.
    // Burası sadece Add/Update için kalsın.

    if (changed) {
      setEArchive(nextArchive);
    }
  }, [cases, eArchive]);

  // ---- Admin aracı: E-Arşiv Temizliği
  function cleanupEArchive() {
    if (!confirm("⚠️ E-Arşiv Temizliği\n\nBu işlem, 'Dosyalar' listesinde veya 'Geçmiş'te (Arşiv) bulunmayan ama E-Arşiv'de kalmış olan 'hayalet kayıtları' kalıcı olarak silecektir.\n\nDevam etmek istiyor musunuz?")) return;

    const allValidIds = new Set<string>();
    const state = useAppStore.getState();

    // 1. Bugünkü dosyaların ID'leri
    state.cases.forEach(c => allValidIds.add(c.id));

    // 2. Arşivdeki (Geçmiş) dosyaların ID'leri
    Object.values(state.history).forEach(dayCases => {
      dayCases.forEach(c => allValidIds.add(c.id));
    });

    // 3. E-Arşiv listesini filtrele
    const currentEArchive = state.eArchive;
    const cleanEArchive = currentEArchive.filter(e => allValidIds.has(e.id));

    const removedCount = currentEArchive.length - cleanEArchive.length;

    if (removedCount > 0) {
      setEArchive(cleanEArchive);
      alert(`✅ Temizlik Tamamlandı!\n\nToplam ${removedCount} adet silinmiş (hayalet) dosya E-Arşiv listesinden kaldırıldı.\nSayfa yenileniyor...`);
      // İsteğe bağlı reload, UI'ın kesin güncellenmesi için
      // window.location.reload(); 
    } else {
      alert("✅ E-Arşiv zaten temiz. Silinecek dosya bulunamadı.");
    }
  }



  // ---- Dosya silme (yükleri geri al)
  function removeCase(id: string, skipConfirm = false) {
    const cases = useAppStore.getState().cases;
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
      setPdfEntries([targetNow.sourcePdfEntry!, ...useAppStore.getState().pdfEntries]);
      toast("Dosya geri alındı, randevu listesine eklendi");
    } else {
      toast("Dosya silindi");
    }

    // Öğretmen yükünü düşür
    if (targetNow.assignedTo) {
      const teachers = useAppStore.getState().teachers;
      const t = teachers.find(x => x.id === targetNow.assignedTo);
      if (t) {
        const ym = ymOf(targetNow.createdAt);
        const nextMonthly = { ...(t.monthly || {}) };
        nextMonthly[ym] = Math.max(0, (nextMonthly[ym] || 0) - targetNow.score);
        updateTeacher(t.id, {
          yearlyLoad: Math.max(0, t.yearlyLoad - targetNow.score),
          monthly: nextMonthly
        });
      }
    }

    // Store'dan sil
    removeCaseAction(id);

    // NOT: E-Arşiv'den silme yapmıyoruz çünkü E-Arşiv artık History'den otomatik doluyor
    // ve tarihsel bir kayıt olarak korunmalı
  }



  // Rollover logic moved to hooks/useRollover.ts

  // ---- Liste filtreleme
  // "Dosyalar" sadece BUGÜN
  const filteredCases = useMemo(
    () => cases.filter(c => c.createdAt.slice(0, 10) === getTodayYmd()),
    [cases]
  );

  // ---- Canlı puan hesaplama (Yedek Başkan ve Devamsız için)
  const liveScores = useMemo(() => {
    const today = getTodayYmd();

    // Çalışan öğretmenler: aktif, devamsız DEĞİL, bugün yedek DEĞİL ve fizyoterapist DEĞİL
    const workingTeachers = teachers.filter((t) => t.active && !t.isAbsent && t.backupDay !== today && !t.isPhysiotherapist);
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
    const combined = [...inHistory, ...inToday];

    // DEDUPE: Same ID should only count once
    const seen = new Set<string>();
    const deduped = combined.filter(c => {
      if (!c.id || seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });

    return deduped.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
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
    const rows = eArchive.map((entry: any) => [
      entry.studentName || entry.student || '',
      entry.fileNo || '',
      entry.teacherName || entry.assignedToName || '',
      new Date(entry.date || entry.createdAt).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }),
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

    // Tüm arşiv kayıtlarını oluştur (eArchive + History)
    const allArchiveEntries = useMemo(() => {
      const entries: EArchiveEntry[] = [];

      // 1. Manuel E-Arşiv kayıtları
      eArchive.forEach(entry => {
        entries.push({
          ...entry,
          studentName: entry.studentName || (entry as any).student || "",
          teacherName: entry.teacherName || (entry as any).assignedToName || "",
          date: entry.date || (entry as any).createdAt || "",
          fileNo: entry.fileNo || ""
        });
      });

      // 2. History'den kayıtlar
      const historyCases = Object.values(history).flat();
      historyCases.forEach(c => {
        if (c.fileNo) {
          const t = teachers.find(x => x.id === c.assignedTo);
          entries.push({
            id: c.id,
            studentName: c.student,
            fileNo: c.fileNo,
            teacherName: t ? t.name : "Bilinmiyor",
            date: c.createdAt.slice(0, 10)
          });
        }
      });

      // Aynı dosya numarası için EN YENİ atamanı tut
      // Önce tarihe göre sırala (en yeni en sonda)
      entries.sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateA - dateB;
      });

      // Dosya numarasına göre grupla ve en sonuncuyu (en yeni) tut
      const fileNoMap = new Map<string, EArchiveEntry>();
      entries.forEach(entry => {
        if (entry.fileNo) {
          fileNoMap.set(entry.fileNo, entry);
        }
      });

      // Map'teki benzersiz kayıtları al
      return Array.from(fileNoMap.values());
    }, [eArchive, history, teachers]);

    // Filtrelenmiş liste
    const filteredArchive = useMemo(() => {
      let filtered = [...allArchiveEntries];

      // Öğrenci adına göre filtrele
      if (searchStudent.trim()) {
        const searchLower = searchStudent.toLowerCase().trim();
        filtered = filtered.filter(e =>
          e.studentName.toLowerCase().includes(searchLower)
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
        filtered = filtered.filter(e => e.teacherName === filterTeacher);
      }

      // Tarih aralığı filtreleme
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        filtered = filtered.filter(e => {
          if (!e.date) return false;
          const entryDate = new Date(e.date);
          entryDate.setHours(0, 0, 0, 0);
          return entryDate >= fromDate;
        });
      }

      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        filtered = filtered.filter(e => {
          if (!e.date) return false;
          const entryDate = new Date(e.date);
          return entryDate <= toDate;
        });
      }

      // Tarihe göre sırala (en yeni üstte)
      return filtered.sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
      });
    }, [allArchiveEntries, searchStudent, searchFileNo, filterTeacher, dateFrom, dateTo]);

    // Tüm öğretmen isimlerini al (filtreleme için)
    const teacherNames = useMemo(() => {
      const names = new Set(allArchiveEntries.map(e => e.teacherName).filter(Boolean));
      return Array.from(names).sort();
    }, [allArchiveEntries]);

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
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="p-2 text-left w-12">No</th>
                    <th className="p-2 text-left">Öğrenci Adı</th>
                    <th className="p-2 text-left">Dosya No</th>
                    <th className="p-2 text-left">Atanan Öğretmen</th>
                    <th className="p-2 text-left">Atama Tarihi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredArchive.map((entry, index) => (
                    <tr key={entry.id} className="border-t hover:bg-slate-50">
                      <td className="p-2 font-semibold text-slate-500">{filteredArchive.length - index}</td>
                      <td className="p-2 font-medium">{entry.studentName}</td>
                      <td className="p-2">{entry.fileNo || '—'}</td>
                      <td className="p-2">{entry.teacherName}</td>
                      <td className="p-2">{new Date(entry.date).toLocaleDateString("tr-TR")}</td>
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
          logger.error(safe.error);
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
          {/* Logo/İkon */}
          <div className="flex justify-center mb-6">
            <div className="text-[100px] drop-shadow-xl">🏫</div>
          </div>

          <div className="text-sm md:text-base uppercase tracking-[0.5em] text-teal-600 font-semibold animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            Karşıyaka Rehberlik ve Araştırma Merkezi
          </div>

          <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-teal-600 via-teal-500 to-orange-500 bg-clip-text text-transparent animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            Özel Eğitim Bölümü <span className="text-teal-600">Paneli</span>
          </h1>

          <p className="text-lg md:text-xl text-slate-600 leading-relaxed max-w-xl mx-auto animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            👋 Hoş geldiniz! Günlük randevu listelerini yükleyin, dosya atamalarını yönetin ve öğretmen bildirimlerini takip edin.
          </p>

          {/* Butonlar ... */}


          {/* Özellik kartları - Buton olarak çalışır */}
          <div className="grid grid-cols-3 gap-4 py-4">
            <Button
              onClick={() => {
                setViewMode("main");
              }}
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
            <a
              href="/bildirim"
              className="group p-6 rounded-xl bg-emerald-50 border-2 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-100 transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-emerald-200 animate-card-pop h-auto flex flex-col items-center justify-center"
              style={{ animationDelay: '0.8s' }}
            >
              <div className="text-3xl mb-2 transition-transform duration-300 group-hover:scale-125 group-hover:animate-bounce">🔔</div>
              <div className="text-sm text-emerald-700 font-semibold">Bildirim Aç</div>
            </a>
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

    // Mevcut devamsızlıklar (absenceRecords'dan - bugün için)
    const today = getTodayYmd();
    const currentAbsenceRecords = useAppStore.getState().absenceRecords;
    currentAbsenceRecords.filter(r => r.date === today).forEach(r => {
      const t = teachers.find(tt => tt.id === r.teacherId);
      if (t) {
        if (!absentByDay[today]) absentByDay[today] = [];
        if (!absentByDay[today].find(tt => tt.id === t.id)) {
          absentByDay[today].push(t);
        }
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
    // ⚠️ NOT: Bu şifre client-side'da görünür, sadece basit koruma için kullanılmalı
    // Hassas bilgiler için server-side authentication kullanın
    const ARCHIVE_PASSWORD = process.env.NEXT_PUBLIC_ARCHIVE_PASSWORD;

    if (!ARCHIVE_PASSWORD) {
      console.error("Archive password not set in environment variables");
    }

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
    const existingFiles = new Map<string, EArchiveEntry>();

    // 1. Manuel E-Arşiv kayıtları
    eArchive.forEach(entry => {
      if (entry.fileNo) {
        existingFiles.set(entry.fileNo, entry);
      }
    });

    // 2. Otomatik Atanan Geçmiş (History) kayıtları
    // ÖNEMLİ: Aynı dosya numarası için EN YENİ atamanın görünmesi için
    // tüm history kayıtlarını tarihe göre sıralıyoruz (eskiden yeniye)
    const allHistoryCases = Object.values(history).flat();
    const sortedHistoryCases = allHistoryCases.sort((a, b) => {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    sortedHistoryCases.forEach(c => {
      if (c.fileNo) {
        const t = teachers.find(x => x.id === c.assignedTo);
        existingFiles.set(c.fileNo, {
          id: c.id,
          studentName: c.student,
          fileNo: c.fileNo,
          teacherName: t ? t.name : "Bilinmiyor",
          date: c.createdAt.slice(0, 10),
        });
      }
    });

    // Mevcut dosyaları güncelle
    archiveFiles.forEach(file => {
      const existing = existingFiles.get(file.fileNo);
      if (existing) {
        file.student = existing.studentName;
        file.assignedToName = existing.teacherName;
        file.createdAt = existing.date;
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
          if (entry.studentName.toLowerCase().includes(term)) {
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
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-indigo-50 relative selection:bg-emerald-100 selection:text-emerald-900">
      {/* Animasyonlu arka plan deseni */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-teal-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-orange-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>


      <div className="container mx-auto p-4 space-y-6 relative z-10">
        {/* Üst araç çubuğu: rapor ve giriş */}
        {/* ÜST BAR (sticky + cam) - MOBİL OPTİMİZE */}
        {/* Üst araç çubuğu: Header Component */}
        <Header
          viewMode={viewMode}
          setViewMode={setViewMode}
          isAdmin={isAdmin}
          filterYM={filterYM}
          setFilterYM={setFilterYM}
          allMonths={allMonths}
          teachers={teachers}
          cases={cases}
          history={history}
          live={live}
          doLogout={doLogout}
          setLoginOpen={setLoginOpen}
          setShowRules={setShowRules}
          setFeedbackOpen={setFeedbackOpen}
          soundOn={soundOn}
          setSoundOn={setSoundOn}
          setSettingsOpen={setSettingsOpen}
          doRollover={doRollover}
          toast={toast}
        />

        {/* 📊 DASHBOARD ÖZET KARTLARI */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl p-4 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 cursor-default">
            <div className="text-3xl font-bold">{teachers.filter(t => t.active && !t.isAbsent && !t.isPhysiotherapist).length}</div>
            <div className="text-sm opacity-90">👨‍🏫 Aktif Öğretmen</div>
          </div>
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 cursor-default">
            <div className="text-3xl font-bold">{cases.filter(c => !c.absencePenalty && c.createdAt.slice(0, 10) === getTodayYmd()).length}</div>
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
        <MiniWidgets />


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
              pdfLoading={pdfLoading}
              onShowDetails={(date) => { if (date instanceof Date) { fetchPdfEntriesFromServer(date); } else { setShowPdfPanel(true); } }}
              onRemoveEntry={(id) => removePdfEntry(id)}
              onPrint={handlePrintPdfList}
              onClearAll={() => clearPdfEntries(true, true)}
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
          <Card className="border-2 overflow-hidden">
            {/* Tab Navigation - Modern Tasarım */}
            <div className="border-b bg-gradient-to-r from-slate-50 via-white to-slate-50">
              <div className="flex items-center gap-1 p-2 overflow-x-auto no-scrollbar">
                {ADMIN_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setAdminTab(tab.id)}
                    className={`
                      relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
                      transition-all duration-200 ease-out whitespace-nowrap
                      ${adminTab === tab.id
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                      }
                    `}
                  >
                    <span className="text-base">{tab.icon}</span>
                    <span>{tab.label}</span>
                    {adminTab === tab.id && (
                      <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-8 h-1 bg-white/50 rounded-full" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Dashboard Home View */}
            {adminTab === "home" && (
              <div className="p-6 bg-slate-50 min-h-[500px]">
                <DashboardHome
                  cases={cases}
                  teachers={teachers}
                  history={history}
                  announcements={announcements}
                  onNavigate={(id) => setAdminTab(id as any)}
                  onNewFile={() => setAdminTab("files")}
                  onAnnounce={() => setAdminTab("announcements")}
                />
              </div>
            )}


            {/* Müzik ve Video Kontrolleri - Ayrı Satır */}
            <div className="flex flex-wrap items-center gap-4 p-3 bg-gradient-to-r from-purple-50 to-blue-50 border-b">
              {/* Müzik Kontrolü */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-purple-700">🎵 Müzik:</span>
                <input
                  type="text"
                  placeholder="YouTube URL"
                  value={settings.musicUrl || ""}
                  onChange={(e) => updateSettings({ musicUrl: e.target.value })}
                  className="h-8 w-48 px-2 text-xs border border-purple-200 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white"
                />
                <Button
                  size="sm"
                  variant={settings.musicPlaying ? "destructive" : "default"}
                  onClick={async () => {
                    const newPlaying = !settings.musicPlaying;
                    updateSettings({ musicPlaying: newPlaying });
                    try {
                      const channel = supabase.channel('music_state');
                      await channel.send({
                        type: 'broadcast',
                        event: 'music_update',
                        payload: { url: settings.musicUrl, playing: newPlaying }
                      });
                    } catch (err) {
                      logger.error("[Admin] Music update error:", err);
                    }
                  }}
                  className="h-8"
                >
                  {settings.musicPlaying ? "⏸️ Durdur" : "▶️ Başlat"}
                </Button>
              </div>

              {/* Video Kontrolü */}
              <div className="flex items-center gap-2 pl-4 border-l border-slate-300">
                <span className="text-sm font-medium text-blue-700">🎬 Video:</span>
                <input
                  type="text"
                  placeholder="YouTube URL"
                  value={settings.videoUrl || ""}
                  onChange={(e) => updateSettings({ videoUrl: e.target.value })}
                  className="h-8 w-48 px-2 text-xs border border-blue-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                />
                <Button
                  size="sm"
                  variant={settings.videoPlaying ? "destructive" : "default"}
                  onClick={async () => {
                    const newPlaying = !settings.videoPlaying;
                    updateSettings({ videoPlaying: newPlaying });
                    try {
                      const channel = supabase.channel('video_state');
                      await channel.send({
                        type: 'broadcast',
                        event: 'video_update',
                        payload: { url: settings.videoUrl, playing: newPlaying }
                      });
                    } catch (err) {
                      logger.error("[Admin] Video update error:", err);
                    }
                  }}
                  className="h-8"
                >
                  {settings.videoPlaying ? "⏸️ Durdur" : "▶️ Başlat"}
                </Button>
                {/* Videoyu Kapat Butonu */}
                {settings.videoPlaying && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      updateSettings({ videoPlaying: false, videoUrl: "" });
                      try {
                        const channel = supabase.channel('video_state');
                        await channel.send({
                          type: 'broadcast',
                          event: 'video_update',
                          payload: { url: "", playing: false }
                        });
                      } catch (err) {
                        logger.error("[Admin] Video close error:", err);
                      }
                    }}
                    className="h-8 px-3 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    title="Videoyu Kapat"
                  >
                    ✕ Kapat
                  </Button>
                )}
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
                      handleAddCase();
                    }
                  }}
                >
                  {/* Sol: Dosya Atama Formu */}
                  <div className="space-y-4">
                    <DailyAppointmentsCard
                      pdfLoading={pdfLoading}
                      onApplyEntry={applyPdfEntry}
                      onRemoveEntry={(id) => removePdfEntry(id)}
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
                          onClick={handleAddCase}
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
                              handleAddCase();
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
                    {/* Dosyalar (Bugün) - CaseList Component */}
                    <CaseList />

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

              {adminTab === "teachers" && <TeacherList />}
              {adminTab === "physiotherapists" && <PhysiotherapistList />}

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


              {/* Arşiv Görüntüleyici (Silme İşlemleri İçin) */}
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
        {reportMode === "monthly" && <MonthlyReport teachers={teachers} cases={cases} history={history} />}
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
              onRemove={(id, date) => {
                const currentHistory = useAppStore.getState().history;
                const dayCases = currentHistory[date];
                if (dayCases) {
                  setHistory({
                    ...currentHistory,
                    [date]: dayCases.filter(c => c.id !== id)
                  });
                }

                // E-Arşivden de sil (Veri tutarlılığı için)
                const currentEArchive = useAppStore.getState().eArchive;
                setEArchive(currentEArchive.filter(e => e.id !== id));

                // Eğer o günün cases'i içindeyse (bugün)
                if (date === ymdLocal(new Date())) {
                  removeCaseAction(id);
                }

                toast("✅ Arşiv kaydı silindi.");
              }}
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
        <FeedbackModal
          open={feedbackOpen}
          onClose={() => setFeedbackOpen(false)}
        />

        {/* Settings Modal */}
        <SettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settings={settings}
          updateSettings={updateSettings}
          onCleanupEArchive={cleanupEArchive}
        />
        {/* Login Modal */}
        <LoginModal
          open={loginOpen}
          onClose={() => setLoginOpen(false)}
          email={loginEmail}
          onEmailChange={setLoginEmail}
          password={loginPassword}
          onPasswordChange={setLoginPassword}
          remember={loginRemember}
          onRememberChange={setLoginRemember}
          onLogin={doLogin}
        />
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
        <VersionPopup
          open={showVersionPopup && !isAdmin}
          onClose={() => setShowVersionPopup(false)}
        />
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
          {showPdfPanel && (
            <PdfPanel
              open={true} // Wrapper handles visibility
              onClose={() => { setShowPdfPanel(false); setShowRules(false); }}
              pdfEntries={pdfEntries}
              pdfDate={pdfDate}
              isAdmin={isAdmin}
              activePdfEntryId={selectedPdfEntryId}
              onApplyEntry={applyPdfEntry}
              onRemoveEntry={(id) => removePdfEntry(id)}
              onClearAll={clearPdfEntries}
              onClearSelection={() => setSelectedPdfEntryId(null)}
            />
          )}

          {showRules && (
            <div className="relative w-full max-w-4xl">
              <button
                className="absolute -top-10 right-0 text-white hover:text-emerald-100 z-10"
                onClick={() => { setShowPdfPanel(false); setShowRules(false); }}
                title="Kapat"
              >
                <X className="h-8 w-8" />
              </button>
              <RulesModal open={true} onClose={() => { setShowPdfPanel(false); setShowRules(false); }} />
            </div>
          )}
        </div>
      )}

      {/* 🆕 Test Bitti Mi? / Testör Koruma Dialog */}
      <TestDialog
        open={testNotFinishedDialog.open}
        chosenTeacher={testNotFinishedDialog.chosenTeacher}
        pendingCase={testNotFinishedDialog.pendingCase}
        confirmType={testNotFinishedDialog.confirmType}
        onClose={() => setTestNotFinishedDialog({ open: false, pendingCase: null, chosenTeacher: null, skipTeacherIds: [] })}
        onConfirm={confirmTestFinished}
        onSkip={skipTestNotFinished}
      />

      {/* Duyuru Popup Modal */}
      <AnnouncementPopupModal
        announcement={announcementPopupData}
        onClose={hideAnnouncementPopup}
      />
    </div>
  );
}

