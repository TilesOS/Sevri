"use client";

import { Fragment } from "react";
import { motion } from "motion/react";

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

/**
 * Heading that reveals word-by-word on scroll (midu.design style) — each word
 * rises + fades in, staggered.
 */
export function WordReveal({ text, className }: { text: string; className?: string }) {
  const words = text.split(" ");
  return (
    <h2 className={className} aria-label={text}>
      {words.map((word, i) => (
        <Fragment key={`${word}-${i}`}>
          <motion.span
            className="inline-block"
            initial={{ opacity: 0, y: "0.5em" }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "0px 0px -12% 0px" }}
            transition={{ duration: 0.55, delay: i * 0.06, ease: EASE }}
          >
            {word}
          </motion.span>
          {i < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </h2>
  );
}
