import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import { themeScript } from "@/components/theme/theme-utils";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Sevri",
  description: "Build an authentic project you can finish and showcase.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="app-shell min-h-screen">
        <Script id="theme-init" strategy="beforeInteractive">
          {themeScript}
        </Script>
        {children}
      </body>
    </html>
  );
}

