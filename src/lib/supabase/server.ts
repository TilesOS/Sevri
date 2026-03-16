import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isDynamicServerError } from "next/dist/client/components/hooks-server-context";
import { clientEnv } from "@/lib/env";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function createServerSupabaseClient() {
  try {
    const cookieStore = await cookies();

    return createServerClient(clientEnv.NEXT_PUBLIC_SUPABASE_URL, clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // No-op in contexts where cookies cannot be written.
          }
        },
      },
    });
  } catch (error) {
    if (isDynamicServerError(error)) {
      throw error;
    }

    throw new Error(`Failed to create server Supabase client: ${getErrorMessage(error)}`);
  }
}
