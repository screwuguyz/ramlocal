// ============================================
// Push Send API - Send PWA Web Push Notifications
// ============================================

import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Configure web-push with VAPID keys
// Configure web-push with VAPID keys
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

// VAPID details will be set inside the handler or lazy-loaded


export async function POST(request: NextRequest) {
    try {
        // Check VAPID configuration
        if (!vapidPublicKey || !vapidPrivateKey) {
            console.warn("[push-send] VAPID keys not configured");
            return NextResponse.json(
                { error: "Push notifications not configured" },
                { status: 503 }
            );
        }

        try {
            webpush.setVapidDetails(
                "mailto:ataafurkan@gmail.com",
                vapidPublicKey,
                vapidPrivateKey
            );
        } catch (err) {
            console.error("[push-send] Invalid VAPID keys:", err);
            return NextResponse.json(
                { error: "Invalid VAPID configuration" },
                { status: 500 }
            );
        }

        const body = await request.json();
        const { teacherId, title, message, url } = body;

        if (!teacherId) {
            return NextResponse.json(
                { error: "Missing teacherId" },
                { status: 400 }
            );
        }

        // Get all subscriptions for this teacher
        const { data: subscriptions, error } = await supabaseAdmin
            .from("push_subscriptions")
            .select("*")
            .eq("teacher_id", teacherId);

        if (error) {
            console.error("[push-send] Supabase error:", error);
            return NextResponse.json(
                { error: "Failed to get subscriptions" },
                { status: 500 }
            );
        }

        if (!subscriptions || subscriptions.length === 0) {
            return NextResponse.json({ sent: 0, message: "No subscriptions found" });
        }

        // Send push to all subscriptions
        const payload = JSON.stringify({
            title: title || "RAM Atama",
            body: message || "Yeni bildirim",
            url: url || "/",
        });

        const results = await Promise.allSettled(
            subscriptions.map(async (sub) => {
                try {
                    await webpush.sendNotification(
                        {
                            endpoint: sub.endpoint,
                            keys: sub.keys,
                        },
                        payload
                    );
                    return { success: true, endpoint: sub.endpoint };
                } catch (err: any) {
                    // If subscription expired or invalid, remove it
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        await supabaseAdmin
                            .from("push_subscriptions")
                            .delete()
                            .eq("endpoint", sub.endpoint);
                        console.log("[push-send] Removed expired subscription:", sub.endpoint);
                    }
                    return { success: false, endpoint: sub.endpoint, error: err.message };
                }
            })
        );

        const successful = results.filter(
            (r) => r.status === "fulfilled" && r.value.success
        ).length;
        const failed = results.length - successful;

        return NextResponse.json({
            sent: successful,
            failed,
            total: results.length,
        });
    } catch (err) {
        console.error("[push-send] Error:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
