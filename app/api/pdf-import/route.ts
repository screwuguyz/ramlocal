// app/api/pdf-import/route.ts (Supabase + LOCAL_MODE)
import { NextRequest, NextResponse } from "next/server";
import pdfParse from "pdf-parse";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rateLimit";
import {
  isLocalMode,
  readPdfByDate,
  writePdfByDate,
  deletePdfByDate,
  getLatestPdfDate
} from "@/lib/localStorage";

type PdfEntry = {
  id: string;
  time: string;
  name: string;
  fileNo: string;
  extra: string;
};

function makeId() {
  try {
    return randomUUID();
  } catch {
    return Math.random().toString(36).slice(2, 10);
  }
}

export const runtime = "nodejs";
const TABLE_NAME = "ram_pdf_appointments";
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPA_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SUPA_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function formatDisplayDate(iso?: string | null) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

function parseDateLabelToIso(label?: string | null) {
  if (!label) return null;
  const parts = label.split(".");
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts;
  if (!dd || !mm || !yyyy) return null;
  return `${yyyy}-${mm}-${dd}`;
}

// LOCAL_MODE: Fetch from local file
async function fetchLatestFromLocal() {
  const latestDate = await getLatestPdfDate();
  if (!latestDate) return { entries: [], dateIso: null };
  const entries = await readPdfByDate(latestDate);
  return { entries: entries || [], dateIso: latestDate };
}

// SUPABASE: Fetch from database
async function fetchLatestFromSupabase() {
  if (!SUPA_URL || !SUPA_ANON_KEY) return { entries: [] as PdfEntry[], dateIso: null as string | null };
  const client = createClient(SUPA_URL, SUPA_ANON_KEY);
  const { data: latestDates, error: latestErr } = await client
    .from(TABLE_NAME)
    .select("appointment_date")
    .order("appointment_date", { ascending: false })
    .limit(1);
  if (latestErr) throw latestErr;
  const latestDate = latestDates?.[0]?.appointment_date ?? null;
  if (!latestDate) return { entries: [], dateIso: null };
  const { data: rows, error } = await client
    .from(TABLE_NAME)
    .select("id,time,name,file_no,extra,order_index")
    .eq("appointment_date", latestDate)
    .order("order_index", { ascending: true });
  if (error) throw error;
  const entries = (rows || []).map((row) => ({
    id: row.id,
    time: row.time,
    name: row.name,
    fileNo: row.file_no || "",
    extra: row.extra || "",
  }));
  return { entries, dateIso: latestDate };
}

function parsePdfText(text: string): { entries: PdfEntry[]; dateLabel: string | null } {
  const normalizedLines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\u0000/g, "").trim())
    .filter(Boolean);
  const dateMatch = text.match(/(\d{2}\.\d{2}\.\d{4})\s+TARİHLİ RANDEVU LİSTESİ/i);
  const footerMatch = text.match(/(\d{2}\.\d{2}\.\d{4})\s+\d{2}:\d{2}:\d{2}/);
  const dateLabel = dateMatch?.[1] || footerMatch?.[1] || null;

  const blocks: Array<string[]> = [];
  let current: string[] = [];
  // in parsePdfText function
  for (const line of normalizedLines) {
    if (/^(SAAT|TC NO|AD SOYAD|ENGEL|KAYIT|DOSYA|AÇIKLAMA)/i.test(line)) continue;
    // Allow whitespace before TC
    if (/^\s*\d{11}/.test(line)) {
      if (current.length) blocks.push(current);
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current);

  const isUpper = (line: string) => /^[A-ZÇĞİÖŞÜ\s']+$/.test(line.replace(/[^A-ZÇĞİÖŞÜ\s']/gi, ""));
  const engelTurleri = [
    "Bedensel Yetersizlik", "Hafif Düzeyde Otizm", "Hafif Düzeyde Zihinsel",
    "Orta Düzeyde Zihinsel", "Özel Öğrenme", "Özel Yetenekli",
    "Dil ve Konuşma", "İşitme Yetersizliği", "Görme Yetersizliği", "Normal"
  ];

  const entries = blocks
    .map((lines) => {
      const head = lines[0] || "";
      // Allow whitespace before TC capture
      const headMatch = head.match(/^\s*(\d{11})(.*)$/);
      if (!headMatch) return null;
      let rest = headMatch[2] ?? "";
      const nameParts: string[] = [];
      let time = "";
      let fileNo = "";
      const extraParts: string[] = [];

      if (rest.trim()) {
        const timeInRest = rest.match(/(\d{1,2}:\d{2})/);
        if (timeInRest) {
          time = timeInRest[1];
          rest = rest.replace(timeInRest[1], " ");
        }
        let foundEngel = "";
        for (const engel of engelTurleri) {
          if (rest.includes(engel)) {
            foundEngel = engel;
            rest = rest.replace(engel, " ");
            break;
          }
        }
        if (foundEngel) extraParts.push(foundEngel);
        const kayitMatch = rest.match(/(\d{7})/);
        if (kayitMatch) rest = rest.replace(kayitMatch[1], " ");
        const nameMatch = rest.match(/([A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ\s']+)/);
        if (nameMatch) nameParts.push(nameMatch[1].trim());
      }

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const timeMatch = line.match(/(\d{1,2}:\d{2})/);
        if (timeMatch && !time) { time = timeMatch[1]; continue; }
        const timeEndMatch = line.match(/(\d{1,2}:\d{2})$/);
        if (timeEndMatch && !time) {
          time = timeEndMatch[1];
          const beforeTime = line.slice(0, -5).trim();
          if (beforeTime && !beforeTime.match(/^\d+$/)) extraParts.push(beforeTime);
          continue;
        }
        if (!time && isUpper(line)) { nameParts.push(line.replace(/^\d{5,}\s+/, "").trim()); continue; }
        if (/^[A-ZÇĞİÖŞÜ\s]*\*{3}$/.test(line) || /^[A-ZÇĞİÖŞÜ]{0,2}\s?\d{2,7}$/.test(line)) {
          fileNo = line.replace(/\s+/g, " ").trim();
          continue;
        }
        if (/^\d{2,7}$/.test(line) && !fileNo) { fileNo = line; continue; }
        extraParts.push(line);
      }

      return {
        id: makeId(),
        time,
        name: nameParts.join(" ").replace(/\s+/g, " ").trim(),
        fileNo,
        extra: extraParts.join(" "),
      };
    })
    .filter((entry): entry is PdfEntry => !!entry && !!entry.name && !!entry.time);
  return { entries, dateLabel };
}

// ============================================
// GET
// ============================================
export async function GET(req: NextRequest) {
  const clientIp = getClientIp(req);
  const rateLimit = checkRateLimit(clientIp, RATE_LIMITS.API);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  try {
    const url = new URL(req.url);
    const dateQuery = url.searchParams.get("date");

    // LOCAL_MODE
    if (isLocalMode()) {
      if (dateQuery) {
        const entries = await readPdfByDate(dateQuery);
        if (!entries || entries.length === 0) {
          return NextResponse.json({ error: "Bu tarih için kayıt bulunamadı." }, { status: 404 });
        }
        return NextResponse.json({ entries, date: formatDisplayDate(dateQuery), dateIso: dateQuery }, { headers: { "Cache-Control": "no-store" } });
      } else {
        const { entries, dateIso } = await fetchLatestFromLocal();
        return NextResponse.json({ entries, date: formatDisplayDate(dateIso), dateIso }, { headers: { "Cache-Control": "no-store" } });
      }
    }

    // SUPABASE MODE
    if (dateQuery) {
      if (!SUPA_URL || !SUPA_ANON_KEY) {
        return NextResponse.json({ error: "Supabase config missing" }, { status: 500 });
      }
      const client = createClient(SUPA_URL, SUPA_ANON_KEY);
      const { data: rows, error } = await client
        .from(TABLE_NAME)
        .select("id,time,name,file_no,extra,order_index")
        .eq("appointment_date", dateQuery)
        .order("order_index", { ascending: true });
      if (error) throw error;
      if (!rows || rows.length === 0) {
        return NextResponse.json({ error: "Bu tarih için kayıt bulunamadı." }, { status: 404 });
      }
      const entries = (rows || []).map((row) => ({
        id: row.id, time: row.time, name: row.name, fileNo: row.file_no || "", extra: row.extra || "",
      }));
      return NextResponse.json({ entries, date: formatDisplayDate(dateQuery), dateIso: dateQuery }, { headers: { "Cache-Control": "no-store" } });
    } else {
      const { entries, dateIso } = await fetchLatestFromSupabase();
      return NextResponse.json({ entries, date: formatDisplayDate(dateIso), dateIso }, { headers: { "Cache-Control": "no-store" } });
    }
  } catch (err) {
    console.error("pdf-import GET error", err);
    return NextResponse.json({ entries: [], date: null, dateIso: null }, { status: 500 });
  }
}

// ============================================
// POST
// ============================================
export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req);
  const rateLimit = checkRateLimit(clientIp, RATE_LIMITS.UPLOAD);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many uploads." }, { status: 429 });
  }

  try {
    const form = await req.formData();
    const file = form.get("pdf");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "PDF bulunamadı." }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!buffer.length) {
      return NextResponse.json({ error: "Boş dosya yüklendi." }, { status: 400 });
    }

    let parsedText = "";
    try {
      const parsed = await pdfParse(buffer);
      parsedText = parsed.text || "";
    } catch (err) {
      console.error("pdf-parse failed", err);
      return NextResponse.json({ error: "PDF okunamadı." }, { status: 400 });
    }

    const result = parsePdfText(parsedText);
    if (!result.entries.length) {
      return NextResponse.json({ error: "Geçerli kayıt bulunamadı." }, { status: 400 });
    }

    const url = new URL(req.url);
    const overrideDate = url.searchParams.get("overrideDate");
    const appointmentDateIso = overrideDate || parseDateLabelToIso(result.dateLabel) || new Date().toISOString().slice(0, 10);

    // LOCAL_MODE
    if (isLocalMode()) {
      const success = await writePdfByDate(appointmentDateIso, result.entries);
      if (!success) {
        return NextResponse.json({ error: "PDF kayıtları kaydedilemedi." }, { status: 500 });
      }
      return NextResponse.json({
        entries: result.entries,
        date: result.dateLabel || formatDisplayDate(appointmentDateIso),
        dateIso: appointmentDateIso,
      });
    }

    // SUPABASE MODE
    if (!SUPA_URL || !SUPA_SERVICE_KEY) {
      console.warn("Supabase env missing; skipping persistent storage.");
      return NextResponse.json({
        entries: result.entries,
        date: result.dateLabel || formatDisplayDate(appointmentDateIso),
        dateIso: appointmentDateIso,
      });
    }

    try {
      const admin = createClient(SUPA_URL, SUPA_SERVICE_KEY);
      await admin.from(TABLE_NAME).delete().eq("appointment_date", appointmentDateIso);
      const nowIso = new Date().toISOString();
      const rows = result.entries.map((entry, idx) => ({
        id: entry.id,
        appointment_date: appointmentDateIso,
        time: entry.time,
        name: entry.name,
        file_no: entry.fileNo,
        extra: entry.extra,
        order_index: idx,
        uploaded_at: nowIso,
      }));
      const { error } = await admin.from(TABLE_NAME).insert(rows);
      if (error) throw error;
    } catch (err) {
      console.error("Supabase insert failed", err);
      return NextResponse.json({
        entries: result.entries,
        date: result.dateLabel || formatDisplayDate(appointmentDateIso),
        dateIso: appointmentDateIso,
        warning: "Supabase kaydedilemedi.",
      });
    }

    return NextResponse.json({
      entries: result.entries,
      date: result.dateLabel || formatDisplayDate(appointmentDateIso),
      dateIso: appointmentDateIso,
    });
  } catch (err: any) {
    console.error("pdf-import error", err);
    return NextResponse.json({ error: err?.message || "PDF işlenemedi." }, { status: 500 });
  }
}

// ============================================
// DELETE
// ============================================
export async function DELETE(req: NextRequest) {
  const clientIp = getClientIp(req);
  const rateLimit = checkRateLimit(clientIp, RATE_LIMITS.MUTATION);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const url = new URL(req.url);
  const dateQuery = url.searchParams.get("date");
  const isAdmin = req.cookies.get("ram_admin")?.value === "1";

  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // LOCAL_MODE
  if (isLocalMode()) {
    try {
      if (dateQuery) {
        await deletePdfByDate(dateQuery);
        return NextResponse.json({ ok: true, deletedDate: dateQuery });
      } else {
        const latestDate = await getLatestPdfDate();
        if (latestDate) {
          await deletePdfByDate(latestDate);
          return NextResponse.json({ ok: true, deletedDate: latestDate });
        }
        return NextResponse.json({ ok: true, message: "Silinecek kayıt yok" });
      }
    } catch (err) {
      console.error("pdf-import DELETE error", err);
      return NextResponse.json({ error: "Kayıtlar silinemedi." }, { status: 500 });
    }
  }

  // SUPABASE MODE
  if (!SUPA_URL || !SUPA_SERVICE_KEY) {
    return NextResponse.json({ error: "Supabase yapılandırması eksik." }, { status: 500 });
  }

  try {
    const admin = createClient(SUPA_URL, SUPA_SERVICE_KEY);
    if (dateQuery) {
      const { error } = await admin.from(TABLE_NAME).delete().eq("appointment_date", dateQuery);
      if (error) throw error;
      return NextResponse.json({ ok: true, deletedDate: dateQuery });
    } else {
      const { data: latestDates } = await admin
        .from(TABLE_NAME)
        .select("appointment_date")
        .order("appointment_date", { ascending: false })
        .limit(1);
      const latestDate = latestDates?.[0]?.appointment_date;
      if (latestDate) {
        const { error } = await admin.from(TABLE_NAME).delete().eq("appointment_date", latestDate);
        if (error) throw error;
        return NextResponse.json({ ok: true, deletedDate: latestDate });
      }
      return NextResponse.json({ ok: true, message: "Silinecek kayıt yok" });
    }
  } catch (err) {
    console.error("pdf-import DELETE error", err);
    return NextResponse.json({ error: "Kayıtlar silinemedi." }, { status: 500 });
  }
}
