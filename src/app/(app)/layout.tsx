import type { ReactNode } from "react";
import { AppHeader } from "@/components/shared/app-header";
import { Container } from "@/components/shared/container";

export default async function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppHeader />
      <main className="pb-14 pt-8 sm:pb-20 sm:pt-10">
        <Container>{children}</Container>
      </main>
    </>
  );
}
