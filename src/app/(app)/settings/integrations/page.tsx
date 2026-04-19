import { getRequiredUser } from "@/lib/auth/guard";
import { getUserIntegrationPublic } from "@/lib/db/queries/github";
import { PageHeader } from "@/components/ui/page-header";
import { GithubIntegrationCard } from "@/components/settings/github-integration-card";

interface IntegrationsPageProps {
  searchParams?: Promise<{ connected?: string; error?: string }>;
}

export default async function IntegrationsPage({ searchParams }: IntegrationsPageProps) {
  const user = await getRequiredUser();
  const sp = (await searchParams) ?? {};
  const integration = await getUserIntegrationPublic(user.id, "github");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Integrations"
        title="Connect external services."
        description="Link Sevri to the tools you already use."
      />
      <GithubIntegrationCard
        integration={integration}
        connectedFlag={sp.connected === "github"}
        errorFlag={sp.error ?? null}
      />
    </div>
  );
}
