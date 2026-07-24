import { getRequiredUser } from "@/lib/auth/guard";
import { getGoogleCalendarSyncSettings } from "@/lib/db/queries/google-calendar";
import { getUserIntegrationPublic } from "@/lib/db/queries/github";
import { PageHeader } from "@/components/ui/page-header";
import { GoogleCalendarIntegrationCard } from "@/components/settings/google-calendar-integration-card";
import { GithubIntegrationCard } from "@/components/settings/github-integration-card";
import { SettingsNav } from "@/components/settings/settings-nav";

interface IntegrationsPageProps {
  searchParams?: Promise<{ connected?: string; error?: string }>;
}

export default async function IntegrationsPage({ searchParams }: IntegrationsPageProps) {
  const user = await getRequiredUser();
  const sp = (await searchParams) ?? {};
  const [githubIntegration, googleCalendarIntegration, googleCalendarSettings] = await Promise.all([
    getUserIntegrationPublic(user.id, "github"),
    getUserIntegrationPublic(user.id, "google_calendar"),
    getGoogleCalendarSyncSettings(user.id),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Integrations"
        title="Connect external services."
        description="Link Sevri to the tools you already use."
      />
      <SettingsNav />
      <GoogleCalendarIntegrationCard
        integration={googleCalendarIntegration}
        settings={googleCalendarSettings}
        connectedFlag={sp.connected === "google_calendar"}
        errorFlag={sp.error ?? null}
      />
      <GithubIntegrationCard
        integration={githubIntegration}
        connectedFlag={sp.connected === "github"}
        errorFlag={sp.error ?? null}
      />
    </div>
  );
}
