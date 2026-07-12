"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";

interface PageTransitionProps {
  children: ReactNode;
  transitionKey?: string;
  className?: string;
}

export function PageTransition({ children, transitionKey, className }: PageTransitionProps) {
  return (
    <motion.div
      key={transitionKey}
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.16, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
