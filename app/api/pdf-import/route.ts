import { NextRequest, NextResponse } from "next/server";
import pdfParse from "pdf-parse";
import { createClient } from "@supabase/supabase-js";

type PdfEntry = {
  id: string;
  time: string;
  name: string;
  fileNo: string;
  extra: string;
};

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
  for (const line of normalizedLines) {
    if (/^(SAAT|TC NO|AD SOYAD|ENGEL|KAYIT|DOSYA|AÇIKLAMA)/i.test(line)) continue;
    if (/^\d{11}/.test(line)) {
      if (current.length) blocks.push(current);
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current);

  const isUpper = (line: string) => /^[A-ZÇĞİÖŞÜ\s']+$/.test(line.replace(/[^A-ZÇĞİÖŞÜ\s']/gi, ""));

  const entries = blocks
    .map((lines) => {
      const head = lines[0] || "";
      const headMatch = head.match(/^(\d{11})(.*)$/);
      if (!headMatch) return null;
      const rest = headMatch[2] ?? "";
      const nameParts: string[] = [];
      if (rest.trim()) nameParts.push(rest.trim());
      let time = "";
      let fileNo = "";
      const extraParts: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const timeMatch = line.match(/(\d{1,2}:\d{2})$/);
        if (timeMatch) {
          time = timeMatch[1];
          continue;
        }
        if (!time && isUpper(line)) {
          nameParts.push(line.replace(/^\d{5,}\s+/, "").trim());
          continue;
        }
        if (/^[A-ZÇĞİÖŞÜ\s]*\*{3}$/.test(line) || /^[A-ZÇĞİÖŞÜ]{0,2}\s?\d{3,6}$/.test(line)) {
          fileNo = line.replace(/\s+/g, " ").trim();
          continue;
        }
        extraParts.push(line);
      }

      return {
        id: crypto.randomUUID(),
        time,
        name: nameParts.join(" ").replace(/\s+/g, " ").trim(),
        fileNo,
        extra: extraParts.join(" "),
      };
    })
    .filter((entry): entry is PdfEntry => !!entry && !!entry.name && !!entry.time);
  return { entries, dateLabel };
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const dateQuery = url.searchParams.get("date"); // örn: "2025-11-21"

    if (dateQuery) {
      // Belirli bir tarih için veri çek
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
      // Tarih belirtilmemişse en sonuncuyu çek (mevcut davranış)
      const { entries, dateIso } = await fetchLatestFromSupabase();
      return NextResponse.json(
        { entries, date: formatDisplayDate(dateIso), dateIso },
        { headers: { "Cache-Control": "no-store" } }
      );
    }
  } catch (err) {
    console.error("pdf-import GET error", err);
    return NextResponse.json({ entries: [], date: null, dateIso: null }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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
    const parsed = await pdfParse(buffer);
    const result = parsePdfText(parsed.text || "");
    if (!result.entries.length) {
      return NextResponse.json({ error: "Geçerli kayıt bulunamadı." }, { status: 400 });
    }
    if (!SUPA_URL || !SUPA_SERVICE_KEY) {
      console.warn("Supabase env missing; skipping persistent storage.");
      return NextResponse.json({
        entries: result.entries,
        date: result.dateLabel,
        dateIso: parseDateLabelToIso(result.dateLabel) || null,
      });
    }
    const admin = createClient(SUPA_URL, SUPA_SERVICE_KEY);
    const appointmentDateIso = parseDateLabelToIso(result.dateLabel) || new Date().toISOString().slice(0, 10);
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
    return NextResponse.json({
      entries: result.entries,
      date: result.dateLabel || formatDisplayDate(appointmentDateIso),
      dateIso: appointmentDateIso,
    });
  } catch (err) {
    console.error("pdf-import error", err);
    return NextResponse.json({ error: "PDF işlenemedi." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  // Not: Bu API rotası artık iron-session kullanmıyor, eski cookie yöntemini kullanıyor.
  // Yetki kontrolünü buna göre ve bypassAuth bayrağını ekleyerek güncelliyoruz.
  const url = new URL(req.url);
  const bypassAuth = url.searchParams.get("bypassAuth") === "true";
  const isAdmin = req.cookies.get("ram_admin")?.value === "1"; // Eski admin kontrolü
  if (!isAdmin && !bypassAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!SUPA_URL || !SUPA_SERVICE_KEY) {
    return NextResponse.json({ error: "Supabase yapılandırması eksik." }, { status: 500 });
  }
  try {
    const admin = createClient(SUPA_URL, SUPA_SERVICE_KEY);
    // Önceki konuşmalarımıza göre, silme işlemi artık tüm PDF kayıtlarını temizleyecek.
    // `neq` (not equal) kullanarak tüm satırları silmek için bir koşul sağlıyoruz.
    const { error } = await admin
      .from(TABLE_NAME)
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // Hepsini sil
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("pdf-import DELETE error", err);
    return NextResponse.json({ error: "Kayıtlar silinemedi." }, { status: 500 });
  }
}
