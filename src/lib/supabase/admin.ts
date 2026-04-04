import { createClient } from "@supabase/supabase-js";
import { clientEnv, getSupabaseAdminEnv } from "@/lib/env";

export function createAdminSupabaseClient() {
  const env = getSupabaseAdminEnv();

  return createClient(clientEnv.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
