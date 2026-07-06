"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { motion, useMotionValue, useScroll, useSpring, useTransform } from "motion/react";
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

  // Scroll parallax — the aurora drifts up/sideways and grows as you scroll the hero away.
  const { scrollY } = useScroll();
  const y = useSpring(useTransform(scrollY, [0, 900], [0, -190]), { stiffness: 60, damping: 20 });
  const x = useSpring(useTransform(scrollY, [0, 900], [0, 110]), { stiffness: 60, damping: 20 });
  const scale = useSpring(useTransform(scrollY, [0, 900], [1, 1.22]), { stiffness: 60, damping: 20 });

  // Subtle pointer drift on top of the scroll motion.
  const mx = useSpring(useMotionValue(0), { stiffness: 40, damping: 18 });
  const my = useSpring(useMotionValue(0), { stiffness: 40, damping: 18 });

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const smallScreen = window.matchMedia("(max-width: 640px)").matches;
    // Skip the GPU shader + pointer tracking on phones / reduced-motion.
    if (reduceMotion || smallScreen) return;
    setEnabled(true);

    const onMove = (e: PointerEvent) => {
      mx.set((e.clientX / window.innerWidth - 0.5) * 46);
      my.set((e.clientY / window.innerHeight - 0.5) * 46);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [mx, my]);

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      {/* Scroll-parallax layer (overscanned so movement never reveals edges) */}
      <motion.div className="absolute -inset-[22%]" style={{ y, x, scale }}>
        <motion.div className="absolute inset-0" style={{ x: mx, y: my }}>
          <div className="absolute inset-0 bg-navy-deep" />
          <div className="aurora-fallback absolute inset-0 opacity-90" />
          {enabled ? <AuroraShader /> : null}
        </motion.div>
      </motion.div>

      {/* Legibility veil (stays put): darken toward edges/bottom so cream text stays AA */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(120% 90% at 50% 8%, transparent 30%, rgba(5,18,54,${veil}) 100%)`,
        }}
      />
    </div>
  );
}
