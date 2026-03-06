import type { ReactNode } from "react";
import { AppHeader } from "@/components/shared/app-header";

export default async function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl px-6 py-8">{children}</main>
    </>
  );
}