import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Archivo, Caveat, Instrument_Serif, JetBrains_Mono, Schibsted_Grotesk } from "next/font/google";
import { MotionProvider } from "@/components/theme/motion-provider";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Sevri",
  description: "Build an authentic project you can finish and showcase.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon/favicon-48x48.png", sizes: "48x48", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
  },
};

const sans = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
});

const display = Archivo({
  subsets: ["latin"],
  variable: "--font-display",
});

const serif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: "400",
  style: ["normal", "italic"],
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
    <html lang="en" className={`${sans.variable} ${display.variable} ${serif.variable} ${mono.variable} ${hand.variable}`}>
      <body className="app-shell min-h-screen">
        <MotionProvider>
          {children}
        </MotionProvider>
      </body>
    </html>
  );
}
