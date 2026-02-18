export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { isLocalMode, readState } from "@/lib/localStorage";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
    // LOCAL_MODE: Read from JSON file (lightweight read if possible, but reading full file is fast on disk)
    if (isLocalMode()) {
        try {
            const state = await readState<{ updatedAt?: string }>();
            return NextResponse.json({ updatedAt: state?.updatedAt || null }, { headers: { "Cache-Control": "no-store" } });
        } catch (err: any) {
            return NextResponse.json({ error: err.message }, { status: 500 });
        }
    }

    // SUPABASE MODE
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
    try {
        const client = createClient(url, anon);
        const { data, error } = await client
            .from("app_state")
            .select("state") // we still select state but we can optimize query if we stored updatedAt in a separate column. 
            // For now, let's assume 'state' jsonb column has updatedAt inside. 
            // To optimize, Supabase query should be: select state->>'updatedAt' ...
            // But 'state' is the column name.
            .eq("id", "global")
            .maybeSingle();

        if (error) throw error;

        // Efficiently extract only updatedAt if possible, or just return it from the blob
        // If the blob is huge, this is still heavy on DB but saves Network.
        // Ideally we should promote `updatedAt` to a real column, but for now this saves the HTTP bandwidth.
        const s = data?.state as any;
        return NextResponse.json({ updatedAt: s?.updatedAt || null }, { headers: { "Cache-Control": "no-store" } });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
