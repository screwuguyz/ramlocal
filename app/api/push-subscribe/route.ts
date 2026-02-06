// ============================================
// Push Subscribe API - PWA Web Push Subscriptions
// LOCAL_MODE: Push notifications are disabled
// ============================================

import { NextRequest, NextResponse } from "next/server";

const LOCAL_MODE = process.env.LOCAL_MODE === "true";

export async function POST(request: NextRequest) {
    // LOCAL_MODE: Push notifications require Supabase
    if (LOCAL_MODE) {
        return NextResponse.json(
            { error: "Push notifications disabled in local mode" },
            { status: 503 }
        );
    }

    try {
        const { supabaseAdmin } = await import("@/lib/supabase-admin");

        if (!supabaseAdmin) {
            return NextResponse.json(
                { error: "Supabase not configured" },
                { status: 503 }
            );
        }

        const body = await request.json();
        const { teacherId, subscription } = body;

        if (!teacherId || !subscription || !subscription.endpoint) {
            return NextResponse.json(
                { error: "Missing teacherId or subscription" },
                { status: 400 }
            );
        }

        // Store subscription in Supabase
        const { error } = await supabaseAdmin
            .from("push_subscriptions")
            .upsert(
                {
                    teacher_id: teacherId,
                    endpoint: subscription.endpoint,
                    keys: subscription.keys,
                    user_agent: request.headers.get("user-agent") || null,
                },
                { onConflict: "endpoint" }
            );

        if (error) {
            console.error("[push-subscribe] Supabase error:", error);
            return NextResponse.json(
                { error: `Database error: ${error.message}` },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[push-subscribe] Error:", err);
        return NextResponse.json(
            { error: `Server error: ${message}` },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    if (LOCAL_MODE) {
        return NextResponse.json({ success: true });
    }

    try {
        const { supabaseAdmin } = await import("@/lib/supabase-admin");

        if (!supabaseAdmin) {
            return NextResponse.json({ success: true });
        }

        const { searchParams } = new URL(request.url);
        const endpoint = searchParams.get("endpoint");

        if (!endpoint) {
            return NextResponse.json(
                { error: "Missing endpoint" },
                { status: 400 }
            );
        }

        const { error } = await supabaseAdmin
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", endpoint);

        if (error) {
            console.error("[push-subscribe] Delete error:", error);
            return NextResponse.json(
                { error: "Failed to delete subscription" },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("[push-subscribe] Error:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

// Get subscriptions for a teacher
export async function GET(request: NextRequest) {
    if (LOCAL_MODE) {
        return NextResponse.json({ subscriptions: [] });
    }

    try {
        const { supabaseAdmin } = await import("@/lib/supabase-admin");

        if (!supabaseAdmin) {
            return NextResponse.json({ subscriptions: [] });
        }

        const { searchParams } = new URL(request.url);
        const teacherId = searchParams.get("teacherId");

        if (!teacherId) {
            return NextResponse.json(
                { error: "Missing teacherId" },
                { status: 400 }
            );
        }

        const { data, error } = await supabaseAdmin
            .from("push_subscriptions")
            .select("*")
            .eq("teacher_id", teacherId);

        if (error) {
            console.error("[push-subscribe] Get error:", error);
            return NextResponse.json(
                { error: "Failed to get subscriptions" },
                { status: 500 }
            );
        }

        return NextResponse.json({ subscriptions: data || [] });
    } catch (err) {
        console.error("[push-subscribe] Error:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
