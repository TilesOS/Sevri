import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getRequiredUser } from "@/lib/auth/guard";

export async function AppHeader() {
  const user = await getRequiredUser();
  const supabase = await createServerSupabaseClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <header className="sticky top-0 z-20 border-b border-surface-border bg-surface-card/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-lg font-bold text-ink-900">
              Sevri
            </Link>
            <ThemeToggle />
          </div>
          <nav className="hidden gap-4 text-sm font-medium text-ink-700 md:flex">
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/onboarding">Onboarding</Link>
            <Link href="/recommendations">Recommendations</Link>
            <Link href="/billing">Billing</Link>
            <Link href="/settings">Settings</Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-ink-600 md:inline">{profile?.full_name ?? user.email}</span>
          <form action="/auth/sign-out" method="post">
            <Button variant="secondary" className="h-9 px-3" type="submit">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}

