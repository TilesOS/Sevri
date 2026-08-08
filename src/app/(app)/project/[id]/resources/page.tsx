import type { Metadata } from "next";
import { notFound, redirect, unstable_rethrow } from "next/navigation";
import { ProjectLearningResourcesView } from "@/components/project/project-learning-resources-view";
import { getRequiredUser } from "@/lib/auth/guard";
import { PROJECT_SECTION_LABELS } from "@/lib/copy/glossary";
import { buildProjectMetadata } from "@/lib/projects/metadata";
import { getProjectWorkspaceView } from "@/lib/projects/workspace";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return buildProjectMetadata(id, PROJECT_SECTION_LABELS.resources);
}

export default async function ProjectLearningResourcesPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getRequiredUser();
  const { id } = await params;

  try {
    const workspace = await getProjectWorkspaceView(id, user.id);
    if (!workspace.hasRoadmap) redirect(`/project/${id}`);
    return <ProjectLearningResourcesView workspace={workspace} />;
  } catch (error) {
    unstable_rethrow(error);
    notFound();
  }
}
