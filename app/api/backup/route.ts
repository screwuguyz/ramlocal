// app/api/backup/route.ts - Yedekleme API
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPA_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const TABLE_NAME = "app_backups";

type BackupEntry = {
  id: string;
  created_at: string;
  backup_type: "manual" | "auto";
  state_snapshot: any;
  description?: string;
};

// Yedekleri listele
export async function GET(req: NextRequest) {
  const isAdmin = req.cookies.get("ram_admin")?.value === "1";
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!SUPA_URL || !SUPA_SERVICE_KEY) {
    return NextResponse.json({ error: "Supabase config missing" }, { status: 500 });
  }

  try {
    const client = createClient(SUPA_URL, SUPA_SERVICE_KEY);

    // Önce tablo var mı kontrol et, yoksa oluştur
    const { error: tableCheckError } = await client
      .from(TABLE_NAME)
      .select("id")
      .limit(1);

    if (tableCheckError?.code === "42P01") {
      // Tablo yok, oluştur
      // Not: Bu sadece bilgi amaçlı, Supabase'de tablo manuel oluşturulmalı
      return NextResponse.json({
        backups: [],
        warning: "Yedekleme tablosu henüz oluşturulmamış. Supabase dashboard'dan 'app_backups' tablosu oluşturun.",
        tableSchema: `
          CREATE TABLE app_backups (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            backup_type TEXT DEFAULT 'manual',
            state_snapshot JSONB,
            description TEXT
          );
        `
      });
    }

    const { data, error } = await client
      .from(TABLE_NAME)
      .select("id, created_at, backup_type, description")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    return NextResponse.json({ backups: data || [] });
  } catch (err: any) {
    console.error("backup GET error", err);
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}

// Yeni yedek oluştur
export async function POST(req: NextRequest) {
  const isAdmin = req.cookies.get("ram_admin")?.value === "1";
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!SUPA_URL || !SUPA_SERVICE_KEY) {
    return NextResponse.json({ error: "Supabase config missing" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { state, description, backupType = "manual" } = body;

    if (!state) {
      return NextResponse.json({ error: "State verisi gerekli" }, { status: 400 });
    }

    const client = createClient(SUPA_URL, SUPA_SERVICE_KEY);

    // Eski yedekleri temizle (3 günden eski olanları sil) - Kullanıcı isteği: 3 gün
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    await client
      .from(TABLE_NAME)
      .delete()
      .lt("created_at", threeDaysAgo.toISOString());

    // Yeni yedek oluştur
    const { data, error } = await client
      .from(TABLE_NAME)
      .insert({
        backup_type: backupType,
        state_snapshot: state,
        description: description || `${backupType === "auto" ? "Otomatik" : "Manuel"} yedek - ${new Date().toLocaleString("tr-TR")}`,
      })
      .select("id, created_at")
      .single();

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      backup: data,
      message: "Yedek başarıyla oluşturuldu"
    });
  } catch (err: any) {
    console.error("backup POST error", err);
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}

// Yedekten geri yükle
export async function PUT(req: NextRequest) {
  const isAdmin = req.cookies.get("ram_admin")?.value === "1";
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!SUPA_URL || !SUPA_SERVICE_KEY) {
    return NextResponse.json({ error: "Supabase config missing" }, { status: 500 });
  }

  try {
    const { backupId } = await req.json();

    if (!backupId) {
      return NextResponse.json({ error: "Yedek ID gerekli" }, { status: 400 });
    }

    const client = createClient(SUPA_URL, SUPA_SERVICE_KEY);

    // Yedeği bul
    const { data: backup, error: fetchError } = await client
      .from(TABLE_NAME)
      .select("state_snapshot")
      .eq("id", backupId)
      .single();

    if (fetchError || !backup) {
      return NextResponse.json({ error: "Yedek bulunamadı" }, { status: 404 });
    }

    // app_state tablosunu güncelle
    const { error: updateError } = await client
      .from("app_state")
      .upsert({
        id: "global",
        state: backup.state_snapshot,
        updated_at: new Date().toISOString(),
      });

    if (updateError) throw updateError;

    return NextResponse.json({
      ok: true,
      state: backup.state_snapshot,
      message: "Yedek başarıyla geri yüklendi"
    });
  } catch (err: any) {
    console.error("backup PUT error", err);
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}

// Yedek sil
export async function DELETE(req: NextRequest) {
  const isAdmin = req.cookies.get("ram_admin")?.value === "1";
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!SUPA_URL || !SUPA_SERVICE_KEY) {
    return NextResponse.json({ error: "Supabase config missing" }, { status: 500 });
  }

  try {
    const url = new URL(req.url);
    const backupId = url.searchParams.get("id");

    if (!backupId) {
      return NextResponse.json({ error: "Yedek ID gerekli" }, { status: 400 });
    }

    const client = createClient(SUPA_URL, SUPA_SERVICE_KEY);

    const { error } = await client
      .from(TABLE_NAME)
      .delete()
      .eq("id", backupId);

    if (error) throw error;

    return NextResponse.json({ ok: true, message: "Yedek silindi" });
  } catch (err: any) {
    console.error("backup DELETE error", err);
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}









