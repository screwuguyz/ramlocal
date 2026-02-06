// lib/supabase.ts
// LOCAL_MODE: Supabase is optional - creates a mock client if credentials are missing
import { createClient, SupabaseClient, type SupabaseClientOptions } from "@supabase/supabase-js";

const LOCAL_MODE = process.env.NEXT_PUBLIC_LOCAL_MODE === "true";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Helper to create mock channel
function createMockChannel() {
  const mockChannel: any = {
    on: function () { return mockChannel; },
    subscribe: function () { return mockChannel; },
    unsubscribe: function () { return Promise.resolve("ok"); },
  };
  return mockChannel;
}

// Helper to create chainable query builder mock
function createMockQueryBuilder(): any {
  const builder: any = {
    select: () => Promise.resolve({ data: [], error: null }),
    insert: () => Promise.resolve({ data: null, error: null }),
    update: () => Promise.resolve({ data: null, error: null }),
    delete: () => Promise.resolve({ data: null, error: null }),
    upsert: () => Promise.resolve({ data: null, error: null }),
    eq: () => builder,
    neq: () => builder,
    gt: () => builder,
    gte: () => builder,
    lt: () => builder,
    lte: () => builder,
    like: () => builder,
    ilike: () => builder,
    is: () => builder,
    in: () => builder,
    contains: () => builder,
    containedBy: () => builder,
    single: () => Promise.resolve({ data: null, error: null }),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    order: () => builder,
    limit: () => builder,
    range: () => builder,
  };
  return builder;
}

let supabase: SupabaseClient;

// Only create real client if we have valid credentials AND not in LOCAL_MODE
if (url && key && url.includes("supabase") && !LOCAL_MODE) {
  try {
    supabase = createClient(url, key, {
      realtime: { params: { eventsPerSecond: 10 } },
    } satisfies SupabaseClientOptions<any>);
  } catch (e) {
    console.warn("[supabase] Failed to create client, using mock:", e);
    supabase = createMockClient();
  }
} else {
  // LOCAL_MODE or missing credentials - create mock
  if (!LOCAL_MODE && (!url || !key)) {
    console.warn("[supabase] Missing credentials, using mock client");
  }
  supabase = createMockClient();
}

function createMockClient(): SupabaseClient {
  return {
    channel: createMockChannel,
    removeChannel: () => Promise.resolve("ok"),
    getChannels: () => [],
    from: () => createMockQueryBuilder(),
    rpc: () => Promise.resolve({ data: null, error: null }),
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      signInWithPassword: () => Promise.resolve({ data: { user: null, session: null }, error: null }),
      signOut: () => Promise.resolve({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
    },
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ data: null, error: null }),
        download: () => Promise.resolve({ data: null, error: null }),
        remove: () => Promise.resolve({ data: null, error: null }),
        list: () => Promise.resolve({ data: [], error: null }),
        getPublicUrl: () => ({ data: { publicUrl: "" } }),
      }),
    },
    realtime: {
      channels: [],
      setAuth: () => { },
    },
  } as unknown as SupabaseClient;
}

export { supabase };
