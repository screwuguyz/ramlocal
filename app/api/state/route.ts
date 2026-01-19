// app/api/state/route.ts (Supabase + LOCAL_MODE)
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isLocalMode, readState, writeState } from "@/lib/localStorage";

export const runtime = "nodejs";

import type {
  Teacher,
  CaseFile,
  Announcement,
  Settings,
  ThemeSettings,
  EArchiveEntry,
  AbsenceRecord,
  QueueTicket
} from "@/types";

type StateShape = {
  teachers: Teacher[];
  cases: CaseFile[];
  history: Record<string, CaseFile[]>;
  lastRollover: string;
  lastAbsencePenalty?: string;
  announcements?: Announcement[];
  settings?: Settings;
  themeSettings?: ThemeSettings;
  eArchive?: EArchiveEntry[];
  absenceRecords?: AbsenceRecord[];
  queue?: QueueTicket[];
  updatedAt?: string;
};

const DEFAULT_STATE: StateShape = {
  teachers: [],
  cases: [],
  history: {},
  lastRollover: "",
  lastAbsencePenalty: "",
  announcements: [],
  settings: undefined,
  eArchive: [],
  absenceRecords: [],
  queue: [],
  updatedAt: undefined,
};

// ============================================
// GET - Read state
// ============================================
export async function GET() {
  // LOCAL_MODE: Read from JSON file
  if (isLocalMode()) {
    try {
      const state = await readState<StateShape>();
      const s = state || DEFAULT_STATE;
      console.log("[api/state][GET][LOCAL] Success, teachers count:", s.teachers?.length || 0);
      return NextResponse.json(s, { headers: { "Cache-Control": "no-store" } });
    } catch (err: any) {
      console.error("[api/state][GET][LOCAL]", err?.message || err);
      return NextResponse.json({ ...DEFAULT_STATE, _error: err?.message }, { headers: { "Cache-Control": "no-store" } });
    }
  }

  // SUPABASE MODE
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
  if (!url || !anon) {
    console.error("[api/state][GET] Missing env vars: URL=", !!url, "ANON=", !!anon);
    return NextResponse.json({ ...DEFAULT_STATE, _error: "Missing Supabase env vars" }, { headers: { "Cache-Control": "no-store" } });
  }
  try {
    const client = createClient(url, anon);
    const { data, error } = await client
      .from("app_state")
      .select("state")
      .eq("id", "global")
      .maybeSingle();
    if (error) {
      console.error("[api/state][GET] Supabase error:", error);
      throw error;
    }
    const s = (data?.state as StateShape) || DEFAULT_STATE;
    console.log("[api/state][GET] Success, teachers count:", s.teachers?.length || 0);
    return NextResponse.json(s, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    console.error("[api/state][GET]", err?.message || err);
    return NextResponse.json({ ...DEFAULT_STATE, _error: err?.message }, { headers: { "Cache-Control": "no-store" } });
  }
}

// ============================================
// POST - Write state
// ============================================
export async function POST(req: NextRequest) {
  const isAdmin = true; // DEBUG: Admin check disabled

  let body: Partial<StateShape> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  // Basic shape guards
  const s: StateShape = {
    teachers: Array.isArray(body.teachers) ? (body.teachers as Teacher[]) : [],
    cases: Array.isArray(body.cases) ? (body.cases as CaseFile[]) : [],
    history: (body.history && typeof body.history === "object") ? (body.history as Record<string, CaseFile[]>) : {},
    lastRollover: String(body.lastRollover ?? ""),
    lastAbsencePenalty: body.lastAbsencePenalty ? String(body.lastAbsencePenalty) : undefined,
    announcements: Array.isArray(body.announcements) ? (body.announcements as Announcement[]) : [],
    settings: body.settings as Settings | undefined,
    themeSettings: body.themeSettings as ThemeSettings | undefined,
    eArchive: Array.isArray(body.eArchive) ? (body.eArchive as EArchiveEntry[]) : [],
    absenceRecords: Array.isArray(body.absenceRecords) ? (body.absenceRecords as AbsenceRecord[]) : [],
    queue: Array.isArray(body.queue) ? (body.queue as QueueTicket[]) : [],
    updatedAt: body.updatedAt ? String(body.updatedAt) : new Date().toISOString(),
  };

  // LOCAL_MODE: Write to JSON file
  if (isLocalMode()) {
    try {
      const success = await writeState(s);
      if (!success) {
        return NextResponse.json({ ok: false, error: "Failed to write state file" }, { status: 500 });
      }
      console.log("[api/state][POST][LOCAL] Success, teachers count:", s.teachers?.length || 0);
      return NextResponse.json({ ok: true });
    } catch (err: any) {
      console.error("[api/state][POST][LOCAL]", err?.message || err);
      return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
    }
  }

  // SUPABASE MODE
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  if (!url || !service) {
    console.error("[api/state][POST] Missing env vars: URL=", !!url, "SERVICE_KEY=", !!service);
    return NextResponse.json({ ok: false, error: "Missing Supabase envs (URL or SERVICE_ROLE_KEY)" }, { status: 500 });
  }
  try {
    const admin = createClient(url, service);
    const { error } = await admin
      .from("app_state")
      .upsert({ id: "global", state: s, updated_at: new Date().toISOString() })
      .single();
    if (error) {
      console.error("[api/state][POST] Supabase error:", error);
      throw error;
    }
    console.log("[api/state][POST] Success, teachers count:", s.teachers?.length || 0);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[api/state][POST]", err?.message || err);
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
