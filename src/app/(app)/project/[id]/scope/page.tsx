import { notFound, redirect } from "next/navigation";
import { getRequiredUser } from "@/lib/auth/guard";
import { getProjectWorkspaceView } from "@/lib/projects/workspace";
import { ProjectScopeView } from "@/components/project/project-scope-view";

export default async function ProjectScopePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getRequiredUser();
  const { id } = await params;

  try {
    const workspace = await getProjectWorkspaceView(id, user.id);

    if (!workspace.hasRoadmap) {
      redirect(`/project/${id}`);
    }

    return <ProjectScopeView workspace={workspace} />;
  } catch {
    notFound();
  }
}
