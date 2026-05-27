import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Archivo_Black, Caveat, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
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

const display = Archivo_Black({
  subsets: ["latin"],
  variable: "--font-display",
  weight: "400",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600", "700"],
});

const hand = Caveat({
  subsets: ["latin"],
  variable: "--font-hand",
  weight: ["400", "700"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} ${mono.variable} ${hand.variable}`}>
      <body className="app-shell min-h-screen">
        <MotionProvider>
          {children}
        </MotionProvider>
      </body>
    </html>
  );
}
