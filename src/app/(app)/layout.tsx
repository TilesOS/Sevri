import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/shared/app-header";

/**
 * Nothing behind the workspace login belongs in a search index. Set once here so
 * a new authenticated route can't be added without it.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

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
