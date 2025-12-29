import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// Allow insecure TLS for local dev
if (process.env.ALLOW_INSECURE_TLS === "1") {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { action, name } = body;

        if (action !== "add") {
            return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
        }

        const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

        if (!url || !serviceKey) {
            console.error("[api/queue] Missing env vars: URL=", !!url, "SERVICE_KEY=", !!serviceKey);
            return NextResponse.json({ ok: false, error: "Server config error" }, { status: 500 });
        }

        const adminClient = createClient(url, serviceKey);

        // 1. Mevcut state'i oku - maybeSingle kullan (row yoksa null döner)
        const { data: currentData, error: fetchError } = await adminClient
            .from("app_state")
            .select("state")
            .eq("id", "global")
            .maybeSingle();

        if (fetchError) {
            console.error("[api/queue] Fetch error:", fetchError);
            throw fetchError;
        }

        const state = currentData?.state || {};
        const queue = Array.isArray(state.queue) ? state.queue : [];

        console.log("[api/queue] Current queue length:", queue.length);

        // 2. Yeni bilet oluştur
        const maxNo = queue.length > 0 ? Math.max(...queue.map((t: any) => t.no || 0)) : 0;
        const newTicket = {
            id: Math.random().toString(36).slice(2, 9),
            no: maxNo + 1,
            name: name ? String(name).slice(0, 50) : "Misafir",
            status: "waiting",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const newQueue = [...queue, newTicket];

        // 3. State'i güncelle - .eq() kaldırıldı, upsert id ile çalışır
        const { error: updateError } = await adminClient
            .from("app_state")
            .upsert({
                id: "global",
                state: {
                    ...state,
                    queue: newQueue,
                    updatedAt: new Date().toISOString()
                },
                updated_at: new Date().toISOString()
            });

        if (updateError) {
            console.error("[api/queue] Update error:", updateError);
            throw updateError;
        }

        console.log("[api/queue] New ticket added:", newTicket.no, "Total queue length:", newQueue.length);

        return NextResponse.json({ ok: true, ticket: newTicket });

    } catch (err: any) {
        console.error("[api/queue] Error:", err);
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}
