// app/api/notify/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";        // Edge değil Node runtime'ı kullan
export const dynamic = "force-dynamic"; // olası cache/ISR etkilerini sıfırla

export async function POST(req: NextRequest) {
  try {
    // Sadece admin kullanıcılar bildirim gönderebilsin
    const isAdmin = req.cookies.get("ram_admin")?.value === "1";
    if (!isAdmin) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const { userKey, title, message, priority, imageUrl } = await req.json();
    const token = process.env.PUSHOVER_TOKEN;

    if (!token) {
      return NextResponse.json({ error: "No PUSHOVER_TOKEN" }, { status: 500 });
    }
    if (!userKey) {
      return NextResponse.json({ error: "No userKey" }, { status: 400 });
    }

    const effectivePriority = String(priority ?? "0");

    // FormData kullan (resim desteği için)
    const formData = new FormData();
    formData.append("token", token);
    formData.append("user", String(userKey));
    formData.append("title", String(title ?? "Yeni Dosya Atandı"));
    formData.append("message", String(message ?? ""));
    formData.append("priority", effectivePriority);

    // Emergency modunda (priority 2) tekrar/retry parametreleri gerekir
    if (effectivePriority === "2") {
      formData.append("retry", "60");
      formData.append("expire", "3600");
      formData.append("sound", "siren");
    }

    // Resim varsa indir ve ekle
    if (imageUrl) {
      try {
        const imgRes = await fetch(imageUrl);
        if (imgRes.ok) {
          const imgBuffer = await imgRes.arrayBuffer();
          const blob = new Blob([imgBuffer], { type: imgRes.headers.get("content-type") || "image/gif" });
          formData.append("attachment", blob, "image.gif");
        }
      } catch (imgErr) {
        console.error("Resim indirilemedi:", imgErr);
      }
    }

    // Timeout: network sorunlarında beklemeyi sınırlamak için
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000); // 12 saniye (resim için daha uzun)
    let res: Response;
    try {
      // SECURITY FIX: Removed NODE_TLS_REJECT_UNAUTHORIZED option
      res = await fetch("https://api.pushover.net/1/messages.json", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    // Pushover’ın döndürdüğü ham cevabı ilet (hata ise status ile)
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { pushover: json, status: res.status },
        { status: res.status }
      );
    }
    return NextResponse.json({ ok: true, pushover: json });
  } catch (e: any) {
    // Hata mesajını da göster ki sebebi görülsün
    return NextResponse.json(
      {
        error: "notify_failed",
        message: String(e?.message || e),
        code: e?.code,
        cause: e?.cause && (typeof e.cause === "object" ? (e.cause.code || String(e.cause)) : String(e.cause)),
        name: e?.name,
      },
      { status: 502 }
    );
  }
}
