import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import {
    isLocalMode,
    readState,
    createBackup,
    LocalBackup
} from "@/lib/localStorage";

// Supabase client with service role for server-side operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(request: Request) {
    // Local kullanım için CRON_SECRET kontrolü opsiyonel
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // Sadece CRON_SECRET ayarlıysa ve eşleşmiyorsa reddet
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const now = new Date();
        const turkeyTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
        const dateStr = turkeyTime.toISOString().slice(0, 10);
        const description = `Otomatik Günlük Yedek - ${dateStr} 16:00`;

        // ==========================================
        // LOCAL MODE
        // ==========================================
        if (isLocalMode()) {
            console.log("[Cron] Starting Local Backup...");

            // 1. Read current state from disk
            const currentState = await readState();
            if (!currentState) {
                console.error("[Cron] Failed to read local state");
                return NextResponse.json({ error: "Failed to read local state" }, { status: 500 });
            }

            // 2. Create backup object
            const backup: LocalBackup = {
                id: randomUUID(),
                created_at: now.toISOString(),
                backup_type: "auto",
                description: description,
                state_snapshot: currentState,
            };

            // 3. Save backup
            const success = await createBackup(backup);

            if (!success) {
                console.error("[Cron] Failed to save local backup");
                return NextResponse.json({ error: "Failed to save local backup" }, { status: 500 });
            }

            console.log("[Cron] Local Backup Success");
            return NextResponse.json({
                success: true,
                message: `Local backup created for ${dateStr}`,
                mode: "LOCAL"
            });
        }

        // ==========================================
        // SUPABASE MODE
        // ==========================================
        if (!supabaseUrl || !supabaseServiceKey) {
            console.error("[Cron] Supabase config missing");
            return NextResponse.json({ error: "Supabase config missing" }, { status: 500 });
        }

        const client = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Get current state from app_state table
        const { data: stateData, error: stateError } = await client
            .from("app_state")
            .select("*")
            .eq("id", "global")
            .single();

        if (stateError) {
            console.error("Failed to fetch state:", stateError);
            return NextResponse.json({ error: "Failed to fetch state" }, { status: 500 });
        }

        // 2. Create backup
        const backupPayload = {
            created_at: now.toISOString(),
            backup_type: "auto",
            description: description,
            state_snapshot: stateData.state,
        };

        const { error: backupError } = await client
            .from("app_backups")
            .insert(backupPayload);

        if (backupError) {
            console.error("Failed to create backup:", backupError);
            return NextResponse.json({ error: "Failed to create backup" }, { status: 500 });
        }

        // 3. Delete backups older than 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: deletedData, error: deleteError } = await client
            .from("app_backups")
            .delete()
            .lt("created_at", thirtyDaysAgo.toISOString())
            .select();

        const deletedCount = deletedData?.length || 0;

        if (deleteError) {
            console.error("Failed to delete old backups:", deleteError);
        }

        console.log(`Cron backup completed: Created backup for ${dateStr}, deleted ${deletedCount} old backups`);

        return NextResponse.json({
            success: true,
            message: `Backup created for ${dateStr}`,
            deletedOldBackups: deletedCount,
            timestamp: now.toISOString(),
            mode: "SUPABASE"
        });

    } catch (error: any) {
        console.error("Cron backup error:", error);
        return NextResponse.json({ error: "Internal server error", message: error.message }, { status: 500 });
    }
}
