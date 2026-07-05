import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "rgb(var(--canvas-rgb) / <alpha-value>)",
        paper: "rgb(var(--paper-rgb) / <alpha-value>)",
        surface: {
          DEFAULT: "rgb(var(--surface-rgb) / <alpha-value>)",
          strong: "rgb(var(--surface-strong-rgb) / <alpha-value>)",
          mint: "var(--surface-mint)",
          butter: "var(--surface-butter)",
        },
        line: {
          DEFAULT: "rgb(var(--line-rgb) / <alpha-value>)",
          strong: "rgb(var(--line-strong-rgb) / <alpha-value>)",
        },
        ink: {
          DEFAULT: "rgb(var(--ink-rgb) / <alpha-value>)",
          soft: "rgb(var(--ink-soft-rgb) / <alpha-value>)",
          muted: "rgb(var(--ink-muted-rgb) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "rgb(var(--color-primary-rgb) / <alpha-value>)",
          hover: "rgb(var(--color-primary-hover-rgb) / <alpha-value>)",
          active: "var(--color-primary-active)",
          soft: "var(--color-primary-soft)",
          line: "var(--color-primary-line)",
        },
        contrast: {
          DEFAULT: "rgb(var(--contrast-rgb) / <alpha-value>)",
          soft: "rgb(var(--contrast-soft-rgb) / <alpha-value>)",
          line: "var(--contrast-line)",
        },
        coral: "rgb(var(--coral-rgb) / <alpha-value>)",
        teal: {
          DEFAULT: "rgb(var(--teal-rgb) / <alpha-value>)",
          deep: "rgb(var(--teal-deep-rgb) / <alpha-value>)",
        },
        navy: {
          DEFAULT: "rgb(var(--navy-rgb) / <alpha-value>)",
          deep: "rgb(var(--navy-deep-rgb) / <alpha-value>)",
        },
        cream: "rgb(var(--cream-rgb) / <alpha-value>)",
        "pale-blue": "rgb(var(--pale-blue-rgb) / <alpha-value>)",
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        lifted: "var(--shadow-lifted)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ["var(--font-display)", "Archivo", "Arial Black", "sans-serif"],
        serif: ["var(--font-serif)", "Instrument Serif", "Georgia", "serif"],
        body: ["var(--font-sans)", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
        hand: ["var(--font-hand)", "Caveat", "cursive"],
      },
      maxWidth: {
        editorial: "92rem",
      },
    },
  },
  plugins: [],
};

export default config;
