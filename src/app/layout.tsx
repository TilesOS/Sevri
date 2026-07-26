import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import { MotionProvider } from "@/components/theme/motion-provider";
import { clientEnv } from "@/lib/env";
import "@/app/globals.css";

const SITE_DESCRIPTION = "Build an authentic project you can finish and showcase.";

export const metadata: Metadata = {
  metadataBase: new URL(clientEnv.NEXT_PUBLIC_SITE_URL),
  // Routes set a bare title ("Pricing", "Step 4 · Photonics benchmark") and the
  // template brands it, so every tab, history entry, and screen-reader
  // announcement says where you are.
  title: {
    default: "Sevri — Build a project you'll actually finish",
    template: "%s — Sevri",
  },
  description: SITE_DESCRIPTION,
  applicationName: "Sevri",
  openGraph: {
    type: "website",
    siteName: "Sevri",
    title: "Sevri — Build a project you'll actually finish",
    description: SITE_DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sevri — Build a project you'll actually finish",
    description: SITE_DESCRIPTION,
  },
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

const sans = localFont({
  src: "../assets/fonts/schibsted-grotesk/SchibstedGrotesk[wght].ttf",
  weight: "400 900",
  style: "normal",
  variable: "--font-sans",
  display: "swap",
  adjustFontFallback: "Arial",
});

const display = localFont({
  src: "../assets/fonts/archivo/Archivo[wdth,wght].ttf",
  weight: "100 900",
  style: "normal",
  variable: "--font-display",
  display: "swap",
  adjustFontFallback: "Arial",
});

const serif = localFont({
  src: [
    {
      path: "../assets/fonts/instrument-serif/InstrumentSerif-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../assets/fonts/instrument-serif/InstrumentSerif-Italic.ttf",
      weight: "400",
      style: "italic",
    },
  ],
  variable: "--font-serif",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

const mono = localFont({
  src: "../assets/fonts/jetbrains-mono/JetBrainsMono[wght].ttf",
  weight: "400 700",
  style: "normal",
  variable: "--font-mono",
  display: "swap",
  adjustFontFallback: "Arial",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} ${serif.variable} ${mono.variable}`}>
      <body className="app-shell min-h-screen">
        <MotionProvider>
          {children}
        </MotionProvider>
      </body>
    </html>
  );
}
