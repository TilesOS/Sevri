import type { Metadata } from "next";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { Container } from "@/components/shared/container";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getInvitationContextByToken } from "@/lib/db/queries/invitations";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AcceptInvitationActions } from "@/components/reviewer/accept-invitation-actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reviewer invitation",
  robots: { index: false, follow: false },
};

interface AcceptInvitationPageProps {
  params: Promise<{ token: string }>;
}

function AcceptChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingNav />
      <main className="flex-1 py-10 sm:py-16">
        <Container className="max-w-2xl">{children}</Container>
      </main>
      <MarketingFooter />
    </div>
  );
}

function ErrorCard() {
  return (
    <Card className="space-y-5" padding="lg">
      <Badge tone="neutral">Invitation</Badge>
      <div className="space-y-2">
        <h1 className="font-display text-3xl leading-tight text-ink">This invitation is no longer valid.</h1>
        <p className="text-sm leading-6 text-ink-soft">
          Ask the student to send you a new one. Invitations expire after 14 days and can only be used once.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button href="/">Go to Sevri</Button>
        <Button variant="outline" href="/support">
          Contact support
        </Button>
      </div>
    </Card>
  );
}

export default async function AcceptInvitationPage({ params }: AcceptInvitationPageProps) {
  const { token } = await params;

  const context = await getInvitationContextByToken(token);

  if (!context) {
    return (
      <AcceptChrome>
        <ErrorCard />
      </AcceptChrome>
    );
  }

  const { invitation, project_title, inviter_display_name } = context;

  const invalid =
    invitation.status !== "pending" || new Date(invitation.expires_at) < new Date();

  if (invalid) {
    return (
      <AcceptChrome>
        <ErrorCard />
      </AcceptChrome>
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let signedInRole: "student" | "reviewer" | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profile) {
      signedInRole = profile.user_role === "reviewer" ? "reviewer" : "student";
    }
  }

  const emailMismatch =
    !!user && user.email?.toLowerCase() !== invitation.reviewer_email_lower;

  return (
    <AcceptChrome>
      <Card className="space-y-6" padding="lg">
        <Badge tone="accent">Reviewer invitation</Badge>
        <div className="space-y-2">
          <h1 className="font-display text-3xl leading-tight text-ink sm:text-4xl">
            {inviter_display_name} invited you to review {project_title}.
          </h1>
          <p className="text-sm leading-6 text-ink-soft">
            Sevri helps students pick and finish realistic portfolio projects. As a reviewer, you&rsquo;ll see
            their progress and leave structured feedback on each milestone. You won&rsquo;t edit their work
            or be billed &mdash; reviewer accounts are free.
          </p>
        </div>

        {invitation.personal_note ? (
          <div className="rounded-xl border border-line bg-paper-soft/60 p-4">
            <p className="whitespace-pre-wrap text-sm leading-6 text-ink">&ldquo;{invitation.personal_note}&rdquo;</p>
            <p className="mt-2 text-xs uppercase tracking-wide text-ink-soft">&mdash; {inviter_display_name}</p>
          </div>
        ) : null}

        <AcceptInvitationActions
          token={token}
          reviewerEmail={invitation.reviewer_email}
          isSignedIn={!!user}
          signedInEmail={user?.email ?? null}
          signedInRole={signedInRole}
          emailMismatch={emailMismatch}
          projectTitle={project_title}
        />
      </Card>
    </AcceptChrome>
  );
}
