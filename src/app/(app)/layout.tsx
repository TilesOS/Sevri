import type { ReactNode } from "react";
import { AppShell } from "@/components/shared/app-header";

export default async function AppLayout({
  children,
  projectNav,
}: {
  children: ReactNode;
  projectNav?: ReactNode;
}) {
  return <AppShell secondaryNavigation={projectNav}>{children}</AppShell>;
}
