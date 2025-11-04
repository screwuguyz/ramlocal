"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { z } from "zod";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import MonthlyReport from "@/components/reports/MonthlyReport";
import DailyReport from "@/components/reports/DailyReport";
import AssignedArchiveView from "@/components/archive/AssignedArchive";
import AssignedArchiveSingleDayView from "@/components/archive/AssignedArchiveSingleDay";
import { Trash2, UserMinus, Plus, FileSpreadsheet, BarChart2, Volume2, VolumeX } from "lucide-react";



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
};
type Announcement = { id: string; text: string; createdAt: string };

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
}
function caseDesc(c: CaseFile) {
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

// ---- Tarih yardımcıları
function daysInMonth(year: number, month: number) { // month: 1-12
  return new Date(year, month, 0).getDate();
}
function ymOf(dateIso: string) {
  return dateIso.slice(0, 7); // YYYY-MM
}
function nowISO() {
  return new Date().toISOString();
}
function ymdLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

export default function DosyaAtamaApp() {
  ;

  // ---- Öğretmenler
  const [teachers, setTeachers] = useState<Teacher[]>([
    { id: uid(), name: "ANIL DENİZ ÖZGÜL", isAbsent: false, yearlyLoad: 0, monthly: {}, active: true, isTester: false },
    { id: uid(), name: "ARMAN GÖKDAĞ",    isAbsent: false, yearlyLoad: 0, monthly: {}, active: true, isTester: false },
    { id: uid(), name: "AYTEN DİNÇEL",     isAbsent: false, yearlyLoad: 0, monthly: {}, active: true, isTester: false },
    { id: uid(), name: "AYGÜN ÇELİK",      isAbsent: false, yearlyLoad: 0, monthly: {}, active: true, isTester: false },
    { id: uid(), name: "NESLİHAN ŞAHİNER", isAbsent: false, yearlyLoad: 0, monthly: {}, active: true, isTester: false },
    { id: uid(), name: "NURAY KIZILGÜNEŞ", isAbsent: false, yearlyLoad: 0, monthly: {}, active: true, isTester: false },
  ])

  // ---- Dosyalar (BUGÜN)
  const [cases, setCases] = useState<CaseFile[]>([]);

  // ---- ARŞİV (günlük)
  const [history, setHistory] = useState<Record<string, CaseFile[]>>({});
  const [lastRollover, setLastRollover] = useState<string>("");
  // --- Canlı yayın (Supabase)
  const clientId = React.useMemo(() => uid(), []);
  const channelRef = React.useRef<RealtimeChannel | null>(null);
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
  // Duyurular (gün içinde gösterilir, gece sıfırlanır)
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementText, setAnnouncementText] = useState("");
// Persist hydration guard: LS'den ilk y�kleme bitene kadar yazma yapma
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

  // ---- Rapor & filtre
  const [reportMode, setReportMode] = useState<"none" | "monthly" | "daily" | "archive">("none");

  const [filterYM, setFilterYM] = useState<string>(ymOf(nowISO()));
  // Admin oturum durumu
  const [isAdmin, setIsAdmin] = useState<boolean>(false)
  // Non-admin başlangıç görünümü: Atanan Dosyalar
  useEffect(() => {
    if (!isAdmin && reportMode === "none") setReportMode("archive");
  }, [isAdmin, reportMode]);;
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // ---- LS'den yükleme (migration alanları)
  useEffect(() => {
    try {
      const tRaw = localStorage.getItem(LS_TEACHERS);
      const cRaw = localStorage.getItem(LS_CASES);
      const hRaw = localStorage.getItem(LS_HISTORY);
      const lrRaw = localStorage.getItem(LS_LAST_ROLLOVER);
      const aRaw = localStorage.getItem(LS_ANNOUNCEMENTS);

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
        })));
      }
      if (cRaw) setCases(JSON.parse(cRaw));
      if (hRaw) setHistory(JSON.parse(hRaw));
      if (lrRaw) setLastRollover(lrRaw);
      // Duyurular: sadece bugüne ait olanları yükle
      if (aRaw) {
        const arr = JSON.parse(aRaw) as Announcement[];
        const today = ymdLocal(new Date());
        setAnnouncements((arr || []).filter(a => (a.createdAt || "").slice(0,10) === today));
      }
    } catch {}
    // Hydration tamam
    setHydrated(true);
  }, []);

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


  // ---- Merkezi durum: açılışta Supabase'den oku (LS olsa bile override et)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/state?ts=${Date.now()}` as any, { cache: "no-store" });
        if (!res.ok) return;
        const s = await res.json();
        setTeachers(s.teachers ?? []);
        setCases(s.cases ?? []);
        setHistory(s.history ?? {});
        setLastRollover(s.lastRollover ?? "");
        if (Array.isArray(s.announcements)) {
          const today = ymdLocal(new Date());
          setAnnouncements((s.announcements || []).filter((a: any) => (a.createdAt || "").slice(0,10) === today));
        }
        if (s.settings) setSettings((prev) => ({ ...prev, ...s.settings }));
      } catch {}
    })();
  }, []);
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
    setTeachers(p.teachers ?? []);
    setCases(p.cases ?? []);
    if (p.history) setHistory(p.history);
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
      payload: { sender: clientId, teachers, cases, history },
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
  if (!hydrated) return; // LS yüklenmeden yayınlama\r\n  if (!centralLoaded) return; // Merkez yüklenmeden yayınlama
  const ch = channelRef.current;
  if (!ch) return;
  ch.send({
    type: "broadcast",
    event: "state",
    payload: { sender: clientId, teachers, cases, history },
  });
}, [teachers, cases, history, isAdmin, clientId, hydrated, centralLoaded]);
// === Admin değiştirince merkezi state'e de yaz (kalıcılık)
useEffect(() => {
  if (!isAdmin) return;
  if (!hydrated) return;\r\n  if (!centralLoaded) return;\r\n  const ctrl = new AbortController();
  const payload = {
    teachers,
    cases,
    history,
    lastRollover,
    announcements,
    settings,
    updatedAt: new Date().toISOString(),
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
}, [teachers, cases, history, lastRollover, announcements, settings, isAdmin, hydrated, centralLoaded]);

  async function doLogin(e?: React.FormEvent) {
    e?.preventDefault?.();
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail.trim(), password: loginPassword })
      });
      if (res.ok) {
        setIsAdmin(true);
        setLoginOpen(false);
        setLoginEmail("");
        setLoginPassword("");
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
    const today = ymdLocal(new Date());
    return cases.some(c => c.isTest && c.assignedTo === tid && c.createdAt.slice(0,10) === today);
  }
  // Bugün bu öğretmene kaç dosya atanmış (test/normal ayrımı gözetmeksizin)
  function countCasesToday(tid: string) {
    const today = ymdLocal(new Date());
    let n = 0;
    for (const c of cases) {
      if (c.assignedTo === tid && c.createdAt.slice(0,10) === today) n++;
    }
    return n;
  }
  // Günlük atama sınırı: bir öğretmene bir günde verilebilecek maksimum dosya
  const MAX_DAILY_CASES = 4;
  // Bugün en son kime atama yapıldı? (liste en yeni başta olduğundan ilk uygun kaydı alır)
  function lastAssignedTeacherToday(): string | undefined {
    const today = ymdLocal(new Date());
    const recent = cases.find(c => c.createdAt.slice(0,10) === today && !!c.assignedTo);
    return recent?.assignedTo;
  }

  // ---- Puanlama
  function calcScore() {
    // Test dosyaları sabit 7 puan
    if (isTestCase) return 7;
    let score = 0;
    if (type === "YONLENDIRME") score += 1;
    if (type === "DESTEK") score += 2;
    if (type === "IKISI") score += 3;
    if (isNew) score += 1;
    if (diagCount > 0) score += Math.min(6, Math.max(0, diagCount));
    return score;
  }

  // ---- Otomatik atama (test/normal ayrımı ve kilit)
  function autoAssign(newCase: CaseFile): Teacher | null {
    // Test dosyasıysa: sadece testörler ve bugün test almamış olanlar
    if (newCase.isTest) {
      const testers = teachers.filter(
        (t) => t.isTester && !t.isAbsent && t.active && !hasTestToday(t.id) && countCasesToday(t.id) < MAX_DAILY_CASES
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

    // Normal dosyada: bugün test almış (kilitli) olanları dışla
    const available = teachers.filter(
      (t) => !t.isAbsent && t.active && !hasTestToday(t.id) && countCasesToday(t.id) < settings.dailyLimit
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

  // ---- ROLLOVER: Gece 00:00 arşivle & sıfırla
  function doRollover() {
    if (!cases.length) {
      setLastRollover(ymdLocal(new Date()));
      return;
    }
    const nextHistory: Record<string, CaseFile[]> = { ...history };
    for (const c of cases) {
      const day = c.createdAt.slice(0, 10); // ISO gün
      nextHistory[day] = [...(nextHistory[day] || []), c];
    }
    setHistory(nextHistory);
    setCases([]); // bugünkü liste sıfırlansın (kilitler de sıfırlanır)
    setLastRollover(ymdLocal(new Date()));
  }

  // Uygulama açıldığında kaçırılmış rollover varsa uygula, sonra bir sonraki gece için zamanla
  useEffect(() => {
    const today = ymdLocal(new Date());
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
    () => cases.filter(c => c.createdAt.slice(0,10) === ymdLocal(new Date())),
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
    const headers = ["DosyaID","Öğrenci","Tür","Yeni","Tanı","Puan","Tarih","Ay","Test","Atanan Öğretmen"];
    const fmt = (iso: string) => new Date(iso).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });

    const data = getCasesForMonth(filterYM);
    const rows = data.map((c) => [
      c.id,
      c.student,
      humanType(c.type),
      c.isNew ? "Evet" : "Hayır",
      c.diagCount ?? 0,
      c.score,
      fmt(c.createdAt),
      ymOf(c.createdAt),
      c.isTest ? "Evet" : "Hayır",
      teacherName(c.assignedTo),
    ]);
    const csv = [headers, ...rows].map((r) => r.map(csvEscape).join(",")).join("\r\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dosyalar_${filterYM}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---- JSON yedek / içe aktar (arşiv dahil)
  function exportJSON() {
    const data = { teachers, cases, history, lastRollover };
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
    const csv = [headers, ...rows].map(r => r.map(csvEscape).join(',')).join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
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
        });
        const BackupSchema = z.object({
          teachers: z.array(TeacherSchema),
          cases: z.array(CaseFileSchema),
          history: z.record(z.array(CaseFileSchema)).default({}),
          lastRollover: z.string().optional(),
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
        setLastRollover(data.lastRollover || ymdLocal(new Date()));
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
    const todayYmd = ymdLocal(new Date());
    if (cases.some((c) => c.createdAt.slice(0,10) === todayYmd)) set.add(todayYmd);
    return Array.from(set).sort();
  }, [history, cases]);

  const [day, setDay] = React.useState<string>(() => {
    const today = ymdLocal(new Date());
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

  // ---------- TEK RETURN: BİLEŞEN ÇIKIŞI ----------
  return (
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
      {/* İzleyici/Normal kullanıcı için Kurallar Paneli */}
      {!isAdmin && (
        <Card className="border-2 border-slate-300 bg-slate-50 animate-pulse">
          <CardHeader>
            <CardTitle className="tracking-wide">DOSYA ATAMA KURALLARI</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal marker:text-red-600 pl-5 space-y-2 text-sm md:text-base font-semibold text-slate-800">
              <li>ÖNCE TEST DOSYALARI YALNIZCA TESTÖR ÖĞRETMENLERE ATANIR.</li>
              <li>UYGUNLUK: AKTİF OLMALI, DEVAMSIZ OLMAMALI, BUGÜN TEST ALMAMIŞ OLMALI, GÜNLÜK SINIRI AŞMAMIŞ OLMALI.</li>
              <li>SIRALAMA: ÖNCE YILLIK YÜK AZ → DAHA SONRA BUGÜN ALINAN DOSYA SAYISI AZ → RASTGELE.</li>
              <li>ART ARDA AYNI ÖĞRETMENE ATAMA YAPILMAZ; MÜMKÜNSE ARAYA EN AZ 1 ÖĞRETMEN GİRER.</li>
              <li>GÜNLÜK ÜST SINIR: ÖĞRETMEN BAŞINA GÜNDE EN FAZLA {settings.dailyLimit} DOSYA.</li>
              <li>MANUEL ATAMA YAPILIRSA SİSTEMİN OTOMATİK ATAMASI GEÇERSİZ OLUR.</li>
              <li>PUANLAMA: TEST = {settings.scoreTest}; YÖNLENDİRME = {settings.scoreTypeY}, DESTEK = {settings.scoreTypeD}, İKİSİ = {settings.scoreTypeI}; YENİ = +{settings.scoreNewBonus}; TANI = 0–6 (ÜST SINIR 6).</li>
              <li>ATAMA SONRASI ÖĞRETMENE BİLDİRİM GÖNDERİLİR.</li>
            </ol>
          </CardContent>
        </Card>
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
                <Button variant={type === "IKISI" ? "default" : "outline"} onClick={() => setType("IKISI")}>İkisi (+{settings.scoreTypeI})</Button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox id="isNew" checked={isNew} onCheckedChange={(v) => setIsNew(Boolean(v))} />
              <Label htmlFor="isNew">Yeni başvuru (+{settings.scoreNewBonus})</Label>
            </div>

            <div className="space-y-2">
              <Label>Tanı sayısı (0-6) (+n)</Label>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="icon" onClick={() => setDiagCount((n) => Math.max(0, n - 1))}><UserMinus className="h-4 w-4"/></Button>
                <Input
                  className="w-20 text-center"
                  inputMode="numeric"
                  value={diagCount}
                  onChange={(e) => {
                    const n = Number((e.target.value || "").replace(/[^\d]/g, ""));
                    setDiagCount(Math.max(0, Math.min(6, Number.isFinite(n) ? n : 0)));
                  }}
                />
                <Button type="button" variant="outline" size="icon" onClick={() => setDiagCount((n) => Math.min(6, n + 1))}><Plus className="h-4 w-4"/></Button>
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
                <Button data-silent="true" onClick={addCase} disabled={!student.trim()}>
                  <Plus className="h-4 w-4 mr-1" /> Ekle
                </Button>
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

            {/* Bugün atanan dosyalar — admin sol kart içinde de göster */}
            <div className="mt-6">
              <Label className="font-medium">Dosyalar (Bugün)</Label>
              {/* Table view for md+ */}
              <div className="mt-2 overflow-auto max-h-[360px] border rounded-md hidden md:block">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-muted">
                    <tr>
                      <th className="p-2 text-left">Öğrenci</th>
                      <th className="p-2 text-right">Puan</th>
                      <th className="p-2 text-left">Tarih</th>
                      <th className="p-2 text-left">Atanan</th>
                      <th className="p-2 text-left">Test</th>
                      <th className="p-2 text-left">Açıklama</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCases.map((c) => (
                      <tr key={c.id} className="border-t odd:bg-muted/30">
                        <td className="p-2">{c.student}</td>
                        <td className="p-2 text-right">{c.score}</td>
                        <td className="p-2">{new Date(c.createdAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                        <td className="p-2">{teacherName(c.assignedTo)}</td>
                        <td className="p-2">{c.isTest ? `Evet (+${settings.scoreTest})` : "Hayır"}</td>
                        <td className="p-2 text-sm text-muted-foreground">{caseDesc(c)}</td>
                      </tr>
                    ))}
                    {filteredCases.length === 0 && (
                      <tr>
                        <td className="p-4 text-center text-muted-foreground" colSpan={6}>Bugün için kayıt yok.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {/* Card view for mobile */}
              <div className="md:hidden mt-2 space-y-2">
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
                      <div><span className="text-muted-foreground">Test:</span> {c.isTest ? `Evet (+${settings.scoreTest})` : "Hayır"}</div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{caseDesc(c)}</div>
                  </div>
                ))}
              </div>
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
              <Button onClick={addTeacher}>Ekle</Button>
            </div>

            {teachers.map((t) => {
              const locked = hasTestToday(t.id);
              return (
                <div key={t.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-1">
                    <div className="font-medium">{t.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Yıllık Yük: {t.yearlyLoad} {t.isTester ? " • Testör" : ""} {locked ? " • Bugün test aldı" : ""}
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
                      {t.isAbsent ? "Uygun Yap" : "Devamsız Yap"}
                    </Button>
                    <Button variant={t.isTester ? "default" : "outline"} onClick={() => toggleTester(t.id)} size="sm">
                      {t.isTester ? "Testör (Açık)" : "Testör Yap"}
                    </Button>
                    <Button variant="outline" onClick={() => toggleActive(t.id)}>{t.active ? "Arşivle" : "Aktif Et"}</Button>
                    <Button variant="destructive" size="sm" title="Kalıcı Sil" onClick={() => deleteTeacher(t.id)}>Sil</Button>
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
          />
        ) : (
          <AssignedArchiveSingleDayView
            history={history}
            cases={cases}
            teacherName={teacherName}
            caseDesc={caseDesc}
            teachers={teachers}
          />
        )
      )}


      
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
    </div>
  );
}







