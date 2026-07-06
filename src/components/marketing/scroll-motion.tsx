"use client";

import { useRef, type ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

/**
 * Scroll-linked vertical parallax. Positive `distance` = element drifts up as
 * it moves through the viewport (moves slower than scroll → depth).
 */
export function Parallax({
  children,
  className,
  distance = 60,
}: {
  children: ReactNode;
  className?: string;
  distance?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const yRaw = useTransform(scrollYProgress, [0, 1], [distance, -distance]);
  const y = useSpring(yRaw, { stiffness: 90, damping: 24, restDelta: 0.001 });

  return (
    <motion.div ref={ref} style={reduce ? undefined : { y }} className={className}>
      {children}
    </motion.div>
  );
}

/**
 * Hero content drifts up and fades as the page scrolls — ties the hero to the
 * rest of the scroll so it doesn't feel like a static banner.
 */
export function HeroScrollFade({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 600], [0, -70]);
  const opacity = useTransform(scrollY, [0, 480], [1, 0]);

  return (
    <motion.div className={className} style={reduce ? undefined : { y, opacity }}>
      {children}
    </motion.div>
  );
}

/**
 * Cohesive entrance: fades/rises in the first time it enters the viewport.
 */
export function FadeIn({
  children,
  className,
  delay = 0,
  y = 28,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}
