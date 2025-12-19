import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const AI_PROVIDER = (process.env.AI_PROVIDER || "openai").toLowerCase();
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"; // OpenAI-compatible
const MODEL = process.env.OPENAI_MODEL || (AI_PROVIDER === "groq" ? "llama-3.1-8b-instant" : "gpt-3.5-turbo");

export async function POST(req: NextRequest) {
  let body: any = null;
  try {
    // Sağlayıcı ve anahtar seçimi
    let apiBase = OPENAI_API_URL;
    let apiKey = process.env.OPENAI_API_KEY;
    if (AI_PROVIDER === "groq") {
      apiBase = GROQ_API_URL;
      apiKey = process.env.GROQ_API_KEY;
    }
    if (!apiKey) {
      const res = NextResponse.json(
        { error: "API anahtarı eksik", details: AI_PROVIDER === "groq" ? "GROQ_API_KEY tanımlı değil." : "OPENAI_API_KEY tanımlı değil." },
        { status: 500 }
      );
      addCors(res);
      return res;
    }

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Geçersiz istek gövdesi", details: "JSON parse edilemedi." },
        { status: 400 }
      );
    }

    const { question, caseFile, selectedTeacher, rules, context, messages } = body || {};

    const safeQuestion = String(question || "Bu dosyayı neden bu öğretmen aldı?");

    const systemPrompt = [
      "Türkçe konuşan, samimi ve anlaşılır bir dille açıklama yapan bir asistansın.",
      "Görev: Verilen KURALLAR ve BAĞLAM içindeki VERİYE dayanarak, dosyanın neden ilgili öğretmene atandığını günlük konuşma dilinde, teknik terimler kullanmadan açıkla.",
      "",
      "ÖNEMLİ KURALLAR:",
      "- SADECE SAĞLANAN VERİYE DAYAN. Varsayım yapma. Bilgi verilmemişse 'Bu bilgi verilmedi.' de.",
      "- Manuel atama varsa ilk maddede açıkça belirt: 'Bu dosya manuel olarak bu öğretmene atanmıştır.'",
      "- Test dosyası ise: 'Bu bir test dosyasıdır ve test dosyaları sadece testör öğretmenlere verilir.' şeklinde açıkla.",
      "- Teknik terimler kullanma! Örnekler:",
      "  ❌ 'aktif, günlük sınır aşılmamış, devamsız değil'",
      "  ✅ 'çalışıyor, bugün yeterince dosya almamış, işbaşında'",
      "  ❌ 'isTester: true, isAbsent: false'",
      "  ✅ 'testör öğretmen, devamsız değil'",
      "  ❌ 'yearlyLoad: 45, todayCount: 2'",
      "  ✅ 'yıllık yükü düşük, bugün 2 dosya almış'",
      "- Her açıklamayı doğal bir cümle olarak yaz. Kısa ve öz ol, ama anlaşılır ol.",
      "- Sayıları ve limitleri sadece sağlanan metinde geçtiği şekilde kullan.",
      "",
      "AÇIKLAMA FORMATI:",
      "1) İlk satır: 'Atanan Öğretmen: [Öğretmen Adı]'",
      "2) Sonra 3-5 madde ile neden bu öğretmenin seçildiğini açıkla (• ile başla):",
      "   • Her madde doğal bir cümle olsun",
      "   • Örnek: '• Bu bir test dosyasıdır ve [öğretmen] testör öğretmendir.'",
      "   • Örnek: '• [Öğretmen] bugün sadece 2 dosya almış, günlük limiti dolmamış.'",
      "   • ÖNEMLİ: En önemli neden (genellikle yıllık yük veya bugünkü dosya sayısı) **kalın** yapılmalı!",
      "   • Örnek: '• [Öğretmen] bugün sadece 2 dosya almış, günlük limiti dolmamış. **Ancak asıl neden: [Öğretmen]'in yıllık yükü diğer öğretmenlere göre daha düşük.**'",
      "   • Veya: '• **[Öğretmen]'in yıllık yükü diğer öğretmenlere göre daha düşük, bu yüzden bu dosya ona atandı.**'",
      "   • Kalın yapmak için **metin** formatını kullan (çift yıldız).",
      "3) Sonra başlık: 'Diğer Öğretmenlere Neden Atanmadı?'",
      "4) Her öğretmen için tek satırlık, anlaşılır açıklama:",
      "   • [Öğretmen Adı]: [Neden atanmadığı - doğal dilde]",
      "   • Örnek: '• Ayşe Yılmaz: Bugün zaten 5 dosya almış, günlük limiti dolmuş.'",
      "   • Örnek: '• Mehmet Demir: Devamsız, bugün işbaşında değil.'",
      "   • Örnek: '• Fatma Kaya: Testör değil, bu yüzden test dosyası alamaz.'",
      "5) Veri yoksa: '[Öğretmen Adı]: Bu öğretmen hakkında yeterli bilgi bulunamadı.'",
      "",
      "GENEL TAVSİYELER:",
      "- Kullanıcıya sanki bir arkadaşına anlatıyormuş gibi yaz.",
      "- Teknik kod adları (isTester, isAbsent, active vb.) kullanma, bunları doğal Türkçe'ye çevir.",
      "- Sayıları ve durumları açıklarken bağlam ver: 'bugün', 'bu ay', 'yıllık' gibi.",
      "- Gereksiz tekrar yapma. Her öğretmen için farklı bir açıklama bul.",
    ].join("\n");

    const ruleText = `Kurallar:\n${(rules || []).map((r: string, i: number) => `${i + 1}. ${r}`).join("\n")}`;

    const ctxText = `\nBağlam (özet):\n- Dosya: ${JSON.stringify(caseFile)}\n- Atanan Öğretmen: ${JSON.stringify(selectedTeacher)}\n- Öğretmen Özeti (listelenebilir): ${JSON.stringify(body?.otherTeachers || [])}\n- Ek Bağlam: ${JSON.stringify(context)}`;

    const userPrompt = `${safeQuestion}\n\n${ruleText}\n${ctxText}`;

    // TLS ayarı (son çare): Kurumsal self-signed CA nedeniyle TLS hatası alınıyorsa,
    // .env.local içine OPENAI_INSECURE_TLS=1 ekleyin. Bu global bir ayardır ve güvensizdir.
    if (process.env.OPENAI_INSECURE_TLS === "1") {
      // eslint-disable-next-line no-process-env
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }

    // Mesaj geçmişi (opsiyonel) desteği: varsa kullanıcı/assistant mesajlarını ekle
    const chatMessages: Array<{ role: "system"|"user"|"assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
    ];
    if (Array.isArray(messages) && messages.length) {
      for (const m of messages) {
        const role = m?.role === 'assistant' ? 'assistant' : 'user';
        const content = String(m?.content || "");
        if (content) chatMessages.push({ role, content });
      }
      // Son kullanıcı sorusu yoksa güvenli soru ekleyelim
      chatMessages.push({ role: "user", content: userPrompt });
    } else {
      chatMessages.push({ role: "user", content: userPrompt });
    }

    const resp = await fetch(apiBase, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: chatMessages,
        temperature: 0.0,
        // max_tokens: 300, // sağlayıcı destekliyorsa açılabilir
      }),
    });

    const text = await resp.text();
    if (!resp.ok) {
      console.error(`/api/explain ${AI_PROVIDER} error`, resp.status, text);
      const r = NextResponse.json(
        { error: `${AI_PROVIDER.toUpperCase()} API hatası`, details: text },
        { status: 502 }
      );
      addCors(r);
      return r;
    }

    let data: any = null;
    try { data = JSON.parse(text); } catch {}
    const answer = data?.choices?.[0]?.message?.content?.trim() || "(Yanıt alınamadı)";

    const ok = NextResponse.json({ answer });
    addCors(ok);
    return ok;
  } catch (e: any) {
    console.error("/api/explain server error", e);
    const r = NextResponse.json(
      { error: "Sunucu hatası", details: String(e?.message || e) },
      { status: 500 }
    );
    addCors(r);
    return r;
  }
}

export async function GET() {
  const provider = (process.env.AI_PROVIDER || "openai").toLowerCase();
  const hasKey = provider === "groq" ? !!process.env.GROQ_API_KEY : !!process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || (provider === "groq" ? "llama-3.1-8b-instant" : "gpt-3.5-turbo");
  const res = NextResponse.json({ ok: true, provider, hasKey, model });
  addCors(res);
  return res;
}

export async function OPTIONS() {
  const res = new NextResponse(null, { status: 204 });
  addCors(res);
  return res;
}

function addCors(res: NextResponse) {
  // İzinli origin: herkese açık (local → vercel testi için)
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  // Bazı tarayıcılar preflight'ta farklı header'lar ister; '*' daha toleranslıdır
  res.headers.set("Access-Control-Allow-Headers", "*");
  res.headers.set("Vary", "Origin");
}
