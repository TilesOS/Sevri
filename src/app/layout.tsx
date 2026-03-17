import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import { MotionProvider } from "@/components/theme/motion-provider";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Sevri",
  description: "Build an authentic project you can finish and showcase.",
};

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="app-shell min-h-screen">
        <MotionProvider>
          {children}
        </MotionProvider>
      </body>
    </html>
  );
}
