import type { ReactNode } from "react";
import { MarketingNav } from "@/components/marketing/marketing-nav";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <MarketingNav />
      <main className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-4xl items-center px-6 py-16">
        <div className="w-full">{children}</div>
      </main>
    </>
  );
}
