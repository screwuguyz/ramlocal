// app/api/login/route.ts
import { NextResponse, NextRequest } from "next/server";
import { verifyCredentials } from "@/lib/auth";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rateLimit";

const ENV_EMAIL = (process.env.ADMIN_EMAIL || "").toLowerCase();
const ENV_PASSWORD = (process.env.ADMIN_PASSWORD || "").trim();

// Production'da şifre zorunlu olmalı
// Production'da şifre zorunlu olmalı (Check moved to handler)


export async function POST(req: NextRequest) {
  // Rate limiting disabled for easier access
  // TODO: Re-enable rate limiting in production if needed

  // Check env vars in production
  if (process.env.NODE_ENV === "production" && (!ENV_EMAIL || !ENV_PASSWORD)) {
    console.error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in production");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  // const clientIp = getClientIp(req);
  // const rateLimit = checkRateLimit(`login:${clientIp}`, RATE_LIMITS.LOGIN);

  const body = await req.json().catch(() => ({}));
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "").trim();

  // Verify credentials (supports both plain text and bcrypt hashed passwords)
  const result = await verifyCredentials(email, password, ENV_EMAIL, ENV_PASSWORD);

  if (!result.success) {
    // Return more detailed error for debugging
    const isHash = ENV_PASSWORD.startsWith("$2");

    return NextResponse.json({
      ok: false,
      debug: {
        emailMatch: email === ENV_EMAIL,
        inputLen: password.length,
        storeLen: ENV_PASSWORD.length,
        isStoredAsHash: isHash,
        storedStart: ENV_PASSWORD.substring(0, 2),
        matchPlain: password === ENV_PASSWORD,
      }
    }, { status: 401 });
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
    sameSite: "lax", // Keep 'lax' for compatibility
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
