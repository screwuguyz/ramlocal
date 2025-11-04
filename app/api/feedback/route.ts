import { NextResponse } from "next/server";
export const runtime = 'nodejs';
import { z } from "zod";

// Lazy import to avoid bundling issues when not used in certain environments
let nodemailer: typeof import("nodemailer") | null = null;

const FeedbackSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(200),
  type: z.enum(["oneri", "sikayet"]).default("oneri"),
  message: z.string().min(10).max(5000),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = FeedbackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Geçersiz veri", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, email, type, message } = parsed.data;

    const SMTP_HOST = process.env.SMTP_HOST;
    const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
    const SMTP_USER = process.env.SMTP_USER;
    const SMTP_PASS = process.env.SMTP_PASS;
    const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;
    const FEEDBACK_TO_EMAIL = process.env.FEEDBACK_TO_EMAIL || "ataafurkan@gmail.com";

    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
      return NextResponse.json(
        {
          error:
            "Sunucu e-posta ayarları eksik. Lütfen SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM ve FEEDBACK_TO_EMAIL değişkenlerini ayarlayın.",
        },
        { status: 500 }
      );
    }

    if (!nodemailer) {
      // Dynamically import nodemailer only when needed
      const mod = await import("nodemailer");
      nodemailer = ((mod as any).default ?? mod) as typeof import("nodemailer");
    }

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465, // true for 465, false for others
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    const typeLabel = type === "sikayet" ? "Şikayet" : "Öneri";
    const subject = `[${typeLabel}] Yeni geri bildirim`;
    const senderName = name?.trim() || "Bilinmeyen";
    const senderEmail = email?.trim();

    const text = [
      `Tür: ${typeLabel}`,
      `Gönderen: ${senderName}${senderEmail ? ` <${senderEmail}>` : ""}`,
      "",
      "Mesaj:",
      message,
    ].join("\n");

    const html = `
      <div>
        <p><strong>Tür:</strong> ${typeLabel}</p>
        <p><strong>Gönderen:</strong> ${senderName}${senderEmail ? ` &lt;${senderEmail}&gt;` : ""}</p>
        <hr />
        <pre style="white-space:pre-wrap;font-family:ui-monospace,Menlo,Consolas,monospace">${escapeHtml(
          message
        )}</pre>
      </div>
    `;

    await transporter.sendMail({
      from: SMTP_FROM,
      to: FEEDBACK_TO_EMAIL,
      subject,
      text,
      html,
      ...(senderEmail ? { replyTo: senderEmail } : {}),
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("/api/feedback error", err);
    return NextResponse.json({ error: "Gönderim sırasında hata oluştu." }, { status: 500 });
  }
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

