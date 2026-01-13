import { NextRequest, NextResponse } from "next/server";
import pdfParse from "pdf-parse";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rateLimit";

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
    // Fallback: 8 haneli rastgele
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

  // DEBUG: Tüm satırları logla
  console.log("=== PDF SATIRLARI ===");
  normalizedLines.forEach((line, i) => console.log(`[${i}] ${line}`));
  console.log("=== PDF SATIRLARI SONU ===");

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

  // DEBUG: Blokları logla
  console.log(`=== ${blocks.length} BLOK BULUNDU ===`);
  blocks.forEach((b, i) => console.log(`Blok ${i}: ${JSON.stringify(b)}`));

  const isUpper = (line: string) => /^[A-ZÇĞİÖŞÜ\s']+$/.test(line.replace(/[^A-ZÇĞİÖŞÜ\s']/gi, ""));

  // Bilinen engel türleri (birleşik satırları ayırmak için)
  const engelTurleri = [
    "Bedensel Yetersizlik",
    "Hafif Düzeyde Otizm",
    "Hafif Düzeyde Zihinsel",
    "Orta Düzeyde Zihinsel",
    "Özel Öğrenme",
    "Özel Yetenekli",
    "Dil ve Konuşma",
    "İşitme Yetersizliği",
    "Görme Yetersizliği",
    "Normal"
  ];

  const entries = blocks
    .map((lines) => {
      const head = lines[0] || "";
      const headMatch = head.match(/^(\d{11})(.*)$/);
      if (!headMatch) return null;
      let rest = headMatch[2] ?? "";
      const nameParts: string[] = [];
      let time = "";
      let fileNo = "";
      const extraParts: string[] = [];

      // Birleşik satırı parse et (örn: "URAZ DİNÇBedensel Yetersizlik752589810:00")
      if (rest.trim()) {
        // Önce saat bul (XX:XX formatında, satırın herhangi bir yerinde)
        const timeInRest = rest.match(/(\d{1,2}:\d{2})/);
        if (timeInRest) {
          time = timeInRest[1];
          rest = rest.replace(timeInRest[1], " ");
        }

        // Engel türünü bul ve ayır
        let foundEngel = "";
        for (const engel of engelTurleri) {
          if (rest.includes(engel)) {
            foundEngel = engel;
            rest = rest.replace(engel, " ");
            break;
          }
        }
        if (foundEngel) extraParts.push(foundEngel);

        // Kayıt numarasını bul (7 haneli sayı)
        const kayitMatch = rest.match(/(\d{7})/);
        if (kayitMatch) {
          rest = rest.replace(kayitMatch[1], " ");
        }

        // Geri kalan büyük harfli kısım isim
        const nameMatch = rest.match(/([A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ\s']+)/);
        if (nameMatch) {
          nameParts.push(nameMatch[1].trim());
        }
      }

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Satırda saat var mı (birleşik olabilir: "406554109:30")
        const timeMatch = line.match(/(\d{1,2}:\d{2})/);
        if (timeMatch && !time) {
          time = timeMatch[1];
          // Saatin öncesinde kayıt no olabilir
          continue;
        }

        // Saat satır sonunda (örn: "Normal09:30")
        const timeEndMatch = line.match(/(\d{1,2}:\d{2})$/);
        if (timeEndMatch && !time) {
          time = timeEndMatch[1];
          const beforeTime = line.slice(0, -5).trim();
          if (beforeTime && !beforeTime.match(/^\d+$/)) {
            extraParts.push(beforeTime);
          }
          continue;
        }

        if (!time && isUpper(line)) {
          nameParts.push(line.replace(/^\d{5,}\s+/, "").trim());
          continue;
        }
        // Dosya numarası: "***" veya 2-7 haneli numara (opsiyonel 1-2 harf prefix)
        if (/^[A-ZÇĞİÖŞÜ\s]*\*{3}$/.test(line) || /^[A-ZÇĞİÖŞÜ]{0,2}\s?\d{2,7}$/.test(line)) {
          fileNo = line.replace(/\s+/g, " ").trim();
          continue;
        }
        // Sadece sayı (dosya no olabilir)
        if (/^\d{2,7}$/.test(line) && !fileNo) {
          fileNo = line;
          continue;
        }
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

export async function GET(req: NextRequest) {
  // Rate limiting
  const clientIp = getClientIp(req);
  const rateLimit = checkRateLimit(clientIp, RATE_LIMITS.API);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(RATE_LIMITS.API.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rateLimit.resetTime),
        }
      }
    );
  }

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
  // Rate limiting for uploads
  const clientIp = getClientIp(req);
  const rateLimit = checkRateLimit(clientIp, RATE_LIMITS.UPLOAD);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many uploads. Please try again later." },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(RATE_LIMITS.UPLOAD.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rateLimit.resetTime),
        }
      }
    );
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
      return NextResponse.json({ error: "PDF okunamadı. Dosya bozuk olabilir." }, { status: 400 });
    }

    const result = parsePdfText(parsedText);
    if (!result.entries.length) {
      return NextResponse.json({ error: "Geçerli kayıt bulunamadı." }, { status: 400 });
    }

    // Eğer overrideDate query parametresi varsa, PDF'deki tarih yerine onu kullan
    const url = new URL(req.url);
    const overrideDate = url.searchParams.get("overrideDate"); // örn: "2025-12-31"
    const appointmentDateIso = overrideDate || parseDateLabelToIso(result.dateLabel) || new Date().toISOString().slice(0, 10);

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
      console.error("Supabase insert failed; returning parsed data only", err);
      return NextResponse.json({
        entries: result.entries,
        date: result.dateLabel || formatDisplayDate(appointmentDateIso),
        dateIso: appointmentDateIso,
        warning: "Supabase kaydedilemedi, ancak veriler işlendi.",
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

export async function DELETE(req: NextRequest) {
  // Rate limiting
  const clientIp = getClientIp(req);
  const rateLimit = checkRateLimit(clientIp, RATE_LIMITS.MUTATION);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  const url = new URL(req.url);
  const dateQuery = url.searchParams.get("date"); // Silinecek tarih (opsiyonel)
  const isAdmin = req.cookies.get("ram_admin")?.value === "1";

  // SECURITY FIX: Removed bypassAuth vulnerability
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!SUPA_URL || !SUPA_SERVICE_KEY) {
    return NextResponse.json({ error: "Supabase yapılandırması eksik." }, { status: 500 });
  }
  try {
    const admin = createClient(SUPA_URL, SUPA_SERVICE_KEY);

    if (dateQuery) {
      // Sadece belirtilen tarihin kayıtlarını sil
      const { error } = await admin
        .from(TABLE_NAME)
        .delete()
        .eq("appointment_date", dateQuery);
      if (error) throw error;
      return NextResponse.json({ ok: true, deletedDate: dateQuery });
    } else {
      // Tarih belirtilmemişse sadece bugünün (veya en son yüklenen tarihin) kayıtlarını sil
      // Önce en son tarihi bul
      const { data: latestDates } = await admin
        .from(TABLE_NAME)
        .select("appointment_date")
        .order("appointment_date", { ascending: false })
        .limit(1);

      const latestDate = latestDates?.[0]?.appointment_date;
      if (latestDate) {
        const { error } = await admin
          .from(TABLE_NAME)
          .delete()
          .eq("appointment_date", latestDate);
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
