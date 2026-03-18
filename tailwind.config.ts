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
        canvas: "var(--canvas)",
        paper: "var(--paper)",
        surface: {
          DEFAULT: "var(--surface)",
          strong: "var(--surface-strong)",
          butter: "var(--surface-butter)",
          blush: "var(--surface-blush)",
        },
        line: {
          DEFAULT: "var(--line)",
          strong: "var(--line-strong)",
        },
        ink: {
          DEFAULT: "var(--ink)",
          soft: "var(--ink-soft)",
          muted: "var(--ink-muted)",
        },
        primary: {
          DEFAULT: "var(--color-primary)",
          hover: "var(--color-primary-hover)",
          active: "var(--color-primary-active)",
          soft: "var(--color-primary-soft)",
          line: "var(--color-primary-line)",
        },
        "secondary-blue": {
          DEFAULT: "var(--color-secondary-blue)",
          soft: "var(--color-secondary-blue-soft)",
          line: "var(--color-secondary-blue-line)",
        },
        "secondary-pink": {
          DEFAULT: "var(--color-secondary-pink)",
          soft: "var(--color-secondary-pink-soft)",
          line: "var(--color-secondary-pink-line)",
        },
        contrast: {
          DEFAULT: "var(--contrast)",
          soft: "var(--contrast-soft)",
          line: "var(--contrast-line)",
        },
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        lifted: "var(--shadow-lifted)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "Times New Roman", "serif"],
        body: ["var(--font-sans)", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      maxWidth: {
        editorial: "76rem",
      },
    },
  },
  plugins: [],
};

export default config;
