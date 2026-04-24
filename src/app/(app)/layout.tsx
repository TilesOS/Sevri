import type { ReactNode } from "react";
import { AppShell } from "@/components/shared/app-header";

export default async function AppLayout({
  children,
  projectNav: _projectNav,
}: {
  children: ReactNode;
  projectNav: ReactNode;
}) {
  void _projectNav;
  return <AppShell>{children}</AppShell>;
}
