// app/api/state/route.ts (Supabase-backed)
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// Optional: allow insecure TLS for local corporate proxies (development only)
if (process.env.ALLOW_INSECURE_TLS === "1") {
  console.warn("[api/state] ALLOW_INSECURE_TLS=1 → Disabling TLS verification for local dev");
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

type Teacher = {
  id: string;
  name: string;
  isAbsent: boolean;
  yearlyLoad: number;
  monthly?: Record<string, number>;
  active: boolean;
  pushoverKey?: string;
  isTester: boolean;
  backupDay?: string;
};
type CaseFile = {
  id: string;
  student: string;
  fileNo?: string;
  score: number;
  createdAt: string;
  assignedTo?: string;
  type: "YONLENDIRME" | "DESTEK" | "IKISI";
  isNew: boolean;
  diagCount: number;
  isTest: boolean;
  assignReason?: string;
  absencePenalty?: boolean;
};
type Announcement = { id: string; text: string; createdAt: string };
type Settings = {
  dailyLimit: number;
  scoreTest: number;
  scoreNewBonus: number;
  scoreTypeY: number;
  scoreTypeD: number;
  scoreTypeI: number;
};

type StateShape = {
  teachers: Teacher[];
  cases: CaseFile[];
  history: Record<string, CaseFile[]>;
  lastRollover: string;
  lastAbsencePenalty?: string;
  announcements?: Announcement[];
  settings?: Settings;
  updatedAt?: string;
};

// Table: public.app_state(id text PK, state jsonb, updated_at timestamptz)
const DEFAULT_STATE: StateShape = {
  teachers: [],
  cases: [],
  history: {},
  lastRollover: "",
  lastAbsencePenalty: "",
  announcements: [],
  settings: undefined,
  updatedAt: undefined,
};

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
  if (!url || !anon) {
    return NextResponse.json(DEFAULT_STATE, { headers: { "Cache-Control": "no-store" } });
  }
  try {
    const client = createClient(url, anon);
    const { data, error } = await client
      .from("app_state")
      .select("state")
      .eq("id", "global")
      .maybeSingle();
    if (error) throw error;
    const s = (data?.state as StateShape) || DEFAULT_STATE;
    return NextResponse.json(s, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    console.error("[api/state][GET]", err?.message || err);
    return NextResponse.json(DEFAULT_STATE, { headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(req: NextRequest) {
  const isAdmin = req.cookies.get("ram_admin")?.value === "1";
  if (!isAdmin) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
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
    updatedAt: body.updatedAt ? String(body.updatedAt) : new Date().toISOString(),
  };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  if (!url || !service) {
    return NextResponse.json({ ok: false, error: "Missing Supabase envs" }, { status: 500 });
  }
  try {
    const admin = createClient(url, service);
    const { error } = await admin
      .from("app_state")
      .upsert({ id: "global", state: s, updated_at: new Date().toISOString() })
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[api/state][POST]", err?.message || err);
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
