"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// Shader is client-only + lazy so the hero headline paints immediately over
// the CSS fallback, then the aurora hydrates in behind it.
const AuroraShader = dynamic(() => import("./aurora-shader"), { ssr: false });

interface AuroraBackgroundProps {
  className?: string;
  /** Dark veil strength for text legibility (0–1). */
  veil?: number;
}

export function AuroraBackground({ className, veil = 0.5 }: AuroraBackgroundProps) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const smallScreen = window.matchMedia("(max-width: 640px)").matches;
    // Skip the GPU shader on phones / reduced-motion — the CSS fallback carries.
    if (!reduceMotion && !smallScreen) setEnabled(true);
  }, []);

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      {/* Base + fallback aurora (always painted) */}
      <div className="absolute inset-0 bg-navy-deep" />
      <div className="aurora-fallback absolute inset-0 opacity-90" />

      {/* Live shader (desktop, motion-ok) */}
      {enabled ? (
        <div className="absolute inset-0 transition-opacity duration-700">
          <AuroraShader />
        </div>
      ) : null}

      {/* Legibility veil: darken toward edges/bottom so cream text stays AA */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(120% 90% at 50% 8%, transparent 30%, rgba(5,18,54,${veil}) 100%)`,
        }}
      />
    </div>
  );
}
