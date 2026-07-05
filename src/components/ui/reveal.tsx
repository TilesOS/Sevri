"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";

interface RevealProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

export function Reveal({ children, delay = 0, className }: RevealProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 44 }}
      whileInView={{ opacity: 1, y: 0 }}
      // Trigger later (element ~22% up from the bottom) and animate slower, so the
      // reveal actually plays in view instead of finishing at the screen edge.
      viewport={{ once: true, margin: "0px 0px -22% 0px" }}
      transition={{ duration: 0.95, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}
