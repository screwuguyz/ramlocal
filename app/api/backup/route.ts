// app/api/backup/route.ts - Yedekleme API (Supabase + LOCAL_MODE)
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import {
  isLocalMode,
  listBackups,
  createBackup,
  getBackupById,
  deleteBackupById,
  writeState,
  LocalBackup
} from "@/lib/localStorage";

export const runtime = "nodejs";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPA_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const TABLE_NAME = "app_backups";

// ============================================
// GET - List backups
// ============================================
export async function GET(req: NextRequest) {
  const isAdmin = req.cookies.get("ram_admin")?.value === "1";
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // LOCAL_MODE
  if (isLocalMode()) {
    try {
      const backups = await listBackups();
      return NextResponse.json({ backups });
    } catch (err: any) {
      console.error("[backup][GET][LOCAL]", err);
      return NextResponse.json({ error: err?.message }, { status: 500 });
    }
  }

  // SUPABASE MODE
  if (!SUPA_URL || !SUPA_SERVICE_KEY) {
    return NextResponse.json({ error: "Supabase config missing" }, { status: 500 });
  }

  try {
    const client = createClient(SUPA_URL, SUPA_SERVICE_KEY);
    const { error: tableCheckError } = await client
      .from(TABLE_NAME)
      .select("id")
      .limit(1);

    if (tableCheckError?.code === "42P01") {
      return NextResponse.json({
        backups: [],
        warning: "Yedekleme tablosu henüz oluşturulmamış."
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

// ============================================
// POST - Create backup
// ============================================
export async function POST(req: NextRequest) {
  const isAdmin = req.cookies.get("ram_admin")?.value === "1";
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { state, description, backupType = "manual" } = body;

    if (!state) {
      return NextResponse.json({ error: "State verisi gerekli" }, { status: 400 });
    }

    // LOCAL_MODE
    if (isLocalMode()) {
      const backup: LocalBackup = {
        id: randomUUID(),
        created_at: new Date().toISOString(),
        backup_type: backupType,
        description: description || `${backupType === "auto" ? "Otomatik" : "Manuel"} yedek - ${new Date().toLocaleString("tr-TR")}`,
        state_snapshot: state,
      };

      const success = await createBackup(backup);
      if (!success) {
        return NextResponse.json({ error: "Yedek oluşturulamadı" }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        backup: { id: backup.id, created_at: backup.created_at },
        message: "Yedek başarıyla oluşturuldu"
      });
    }

    // SUPABASE MODE
    if (!SUPA_URL || !SUPA_SERVICE_KEY) {
      return NextResponse.json({ error: "Supabase config missing" }, { status: 500 });
    }

    const client = createClient(SUPA_URL, SUPA_SERVICE_KEY);

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

    // YENİ: Yeni yedek alındıktan sonra, bu yedek HARİÇ diğer hepsini sil.
    if (data && data.id) {
      await client.from(TABLE_NAME).delete().neq("id", data.id);
    }

    if (error) throw error;
    return NextResponse.json({ ok: true, backup: data, message: "Yedek başarıyla oluşturuldu" });
  } catch (err: any) {
    console.error("backup POST error", err);
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}

// ============================================
// PUT - Restore from backup
// ============================================
export async function PUT(req: NextRequest) {
  const isAdmin = req.cookies.get("ram_admin")?.value === "1";
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { backupId } = await req.json();
    if (!backupId) {
      return NextResponse.json({ error: "Yedek ID gerekli" }, { status: 400 });
    }

    // LOCAL_MODE
    if (isLocalMode()) {
      const backup = await getBackupById(backupId);
      if (!backup || !backup.state_snapshot) {
        return NextResponse.json({ error: "Yedek bulunamadı" }, { status: 404 });
      }

      const success = await writeState(backup.state_snapshot);
      if (!success) {
        return NextResponse.json({ error: "Geri yükleme başarısız" }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        state: backup.state_snapshot,
        message: "Yedek başarıyla geri yüklendi"
      });
    }

    // SUPABASE MODE
    if (!SUPA_URL || !SUPA_SERVICE_KEY) {
      return NextResponse.json({ error: "Supabase config missing" }, { status: 500 });
    }

    const client = createClient(SUPA_URL, SUPA_SERVICE_KEY);
    const { data: backup, error: fetchError } = await client
      .from(TABLE_NAME)
      .select("state_snapshot")
      .eq("id", backupId)
      .single();

    if (fetchError || !backup) {
      return NextResponse.json({ error: "Yedek bulunamadı" }, { status: 404 });
    }

    const { error: updateError } = await client
      .from("app_state")
      .upsert({ id: "global", state: backup.state_snapshot, updated_at: new Date().toISOString() });

    if (updateError) throw updateError;
    return NextResponse.json({ ok: true, state: backup.state_snapshot, message: "Yedek başarıyla geri yüklendi" });
  } catch (err: any) {
    console.error("backup PUT error", err);
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}

// ============================================
// DELETE - Delete backup
// ============================================
export async function DELETE(req: NextRequest) {
  const isAdmin = req.cookies.get("ram_admin")?.value === "1";
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const backupId = url.searchParams.get("id");

    if (!backupId) {
      return NextResponse.json({ error: "Yedek ID gerekli" }, { status: 400 });
    }

    // LOCAL_MODE
    if (isLocalMode()) {
      const success = await deleteBackupById(backupId);
      return NextResponse.json({ ok: success, message: success ? "Yedek silindi" : "Yedek bulunamadı" });
    }

    // SUPABASE MODE
    if (!SUPA_URL || !SUPA_SERVICE_KEY) {
      return NextResponse.json({ error: "Supabase config missing" }, { status: 500 });
    }

    const client = createClient(SUPA_URL, SUPA_SERVICE_KEY);
    const { error } = await client.from(TABLE_NAME).delete().eq("id", backupId);

    if (error) throw error;
    return NextResponse.json({ ok: true, message: "Yedek silindi" });
  } catch (err: any) {
    console.error("backup DELETE error", err);
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
