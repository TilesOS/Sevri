import type { ReactNode } from "react";
import { AppShell } from "@/components/shared/app-header";

export default async function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
