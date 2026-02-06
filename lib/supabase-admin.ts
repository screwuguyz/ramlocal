import { createClient, SupabaseClient } from "@supabase/supabase-js";

const LOCAL_MODE = process.env.LOCAL_MODE === "true";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// LOCAL_MODE: Create a dummy client or real client based on configuration
let supabaseAdmin: SupabaseClient | null = null;

if (!LOCAL_MODE && url && serviceRoleKey) {
    supabaseAdmin = createClient(url, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
} else if (!LOCAL_MODE && (!url || !serviceRoleKey)) {
    console.warn("[supabase-admin] Missing Supabase credentials - some features may not work");
}

export { supabaseAdmin };
