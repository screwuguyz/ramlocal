import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Supabase client with service role for server-side operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: Request) {
    // Local kullanım için CRON_SECRET kontrolü opsiyonel
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // Sadece CRON_SECRET ayarlıysa ve eşleşmiyorsa reddet
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
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
        const now = new Date();
        const turkeyTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
        const dateStr = turkeyTime.toISOString().slice(0, 10);

        const backupPayload = {
            created_at: now.toISOString(),
            backup_type: "auto",
            description: `Otomatik Günlük Yedek - ${dateStr} 16:00`,
            state_snapshot: stateData,  // Fixed: was 'state', should be 'state_snapshot'
        };

        const { error: backupError } = await client
            .from("app_backups")
            .insert(backupPayload);

        if (backupError) {
            console.error("Failed to create backup:", backupError);
            return NextResponse.json({ error: "Failed to create backup" }, { status: 500 });
        }

        // 3. Delete backups older than 30 days (updated from 3)
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
            // Don't fail the whole operation, just log
        }

        console.log(`Cron backup completed: Created backup for ${dateStr}, deleted ${deletedCount} old backups`);

        return NextResponse.json({
            success: true,
            message: `Backup created for ${dateStr}`,
            deletedOldBackups: deletedCount,
            timestamp: now.toISOString(),
        });

    } catch (error) {
        console.error("Cron backup error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
