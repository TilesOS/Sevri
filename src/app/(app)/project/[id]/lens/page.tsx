import type { Metadata } from "next";
import { notFound, redirect, unstable_rethrow } from "next/navigation";
import { getRequiredUser } from "@/lib/auth/guard";
import { PROJECT_SECTION_LABELS } from "@/lib/copy/glossary";
import { buildProjectMetadata } from "@/lib/projects/metadata";
import { getProjectWorkspaceView } from "@/lib/projects/workspace";
import { ProjectLensView } from "@/components/project/project-lens-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return buildProjectMetadata(id, PROJECT_SECTION_LABELS.lens);
}

export default async function ProjectLensPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getRequiredUser();
  const { id } = await params;

  try {
    const workspace = await getProjectWorkspaceView(id, user.id);

    if (!workspace.hasRoadmap) {
      redirect(`/project/${id}`);
    }

    return <ProjectLensView workspace={workspace} />;
  } catch (error) {
    // redirect() and notFound() signal by throwing. Without this rethrow the
    // catch would swallow them and render a 404 — a roadmap-less project would
    // read as "not found" instead of going to its overview.
    unstable_rethrow(error);
    notFound();
  }
}
