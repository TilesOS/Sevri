"use client";

import { MeshGradient } from "@paper-design/shaders-react";

/**
 * Raw WebGL aurora. Loaded only on the client (via next/dynamic in
 * aurora-background.tsx) so it never blocks the hero's LCP.
 *
 * Navy is listed several times so the field stays predominantly deep-navy
 * with teal + coral blooms — the fromanother.love "soft aurora" read.
 */
export default function AuroraShader() {
  return (
    <MeshGradient
      className="absolute inset-0"
      colors={["#051236", "#0B1E4D", "#0B1E4D", "#5BD0D6", "#46D3C0", "#FF6B4C"]}
      distortion={0.92}
      swirl={0.16}
      speed={0.42}
      grainOverlay={0.045}
      maxPixelCount={1_600_000}
      style={{ width: "100%", height: "100%" }}
    />
  );
}
