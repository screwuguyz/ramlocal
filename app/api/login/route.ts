// app/api/login/route.ts
import { NextResponse, NextRequest } from "next/server";

const ENV_EMAIL = (process.env.ADMIN_EMAIL || "").toLowerCase();
const ENV_PASSWORD = process.env.ADMIN_PASSWORD || "";

// Production'da şifre zorunlu olmalı
if (process.env.NODE_ENV === "production" && (!ENV_EMAIL || !ENV_PASSWORD)) {
  throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in production");
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "").trim();

  const ok = email === ENV_EMAIL && password === ENV_PASSWORD;

  // (İsteğe bağlı debug - sorun varsa geçici açabilirsin)
  // console.log("LOGIN_ATTEMPT", { email, ok, hasEnv: Boolean(process.env.ADMIN_EMAIL) });

  if (!ok) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("ram_admin", "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30, // 30 gün
  });
  return res;
}
