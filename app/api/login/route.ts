// app/api/login/route.ts
import { NextResponse, NextRequest } from "next/server";
import { verifyCredentials } from "@/lib/auth";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rateLimit";

const ENV_EMAIL = (process.env.ADMIN_EMAIL || "").toLowerCase();
const ENV_PASSWORD = process.env.ADMIN_PASSWORD || "";

// Production'da şifre zorunlu olmalı
if (process.env.NODE_ENV === "production" && (!ENV_EMAIL || !ENV_PASSWORD)) {
  throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in production");
}

export async function POST(req: NextRequest) {
  // Rate limiting - prevent brute force
  const clientIp = getClientIp(req);
  const rateLimit = checkRateLimit(`login:${clientIp}`, RATE_LIMITS.LOGIN);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many login attempts. Please try again later." },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(RATE_LIMITS.LOGIN.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rateLimit.resetTime),
          'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)),
        }
      }
    );
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "").trim();

  // Verify credentials (supports both plain text and bcrypt hashed passwords)
  const result = await verifyCredentials(email, password, ENV_EMAIL, ENV_PASSWORD);

  if (!result.success) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // If password needs migration (was plain text), log the new hash
  if (result.needsMigration && result.newHash) {
    console.warn(
      "\n⚠️  PASSWORD MIGRATION NEEDED ⚠️\n" +
      "Your admin password is stored in plain text. Please update your .env.local:\n" +
      `ADMIN_PASSWORD=${result.newHash}\n` +
      "This will be automatically used on next login.\n"
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("ram_admin", "1", {
    httpOnly: true,
    sameSite: "strict", // SECURITY FIX: Changed from 'lax' to 'strict' for better CSRF protection
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7, // SECURITY FIX: Reduced from 30 days to 7 days
  });
  return res;
}
