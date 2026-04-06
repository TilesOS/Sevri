import { notFound, redirect } from "next/navigation";
import { getRequiredUser } from "@/lib/auth/guard";
import { getProjectWorkspaceView } from "@/lib/projects/workspace";
import { ProjectPitchKitView } from "@/components/project/project-pitch-kit-view";

export default async function ProjectPitchKitPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getRequiredUser();
  const { id } = await params;

  try {
    const workspace = await getProjectWorkspaceView(id, user.id);

    if (!workspace.hasRoadmap) {
      redirect(`/project/${id}`);
    }

    return <ProjectPitchKitView workspace={workspace} />;
  } catch {
    notFound();
  }
}
