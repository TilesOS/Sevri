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
        ink: {
          50: "var(--ink-50)",
          100: "var(--ink-100)",
          200: "var(--ink-200)",
          300: "var(--ink-300)",
          400: "var(--ink-400)",
          500: "var(--ink-500)",
          600: "var(--ink-600)",
          700: "var(--ink-700)",
          800: "var(--ink-800)",
          900: "var(--ink-900)",
        },
        mint: {
          100: "var(--mint-100)",
          300: "var(--mint-300)",
          500: "var(--mint-500)",
          700: "var(--mint-700)",
        },
        surface: {
          base: "var(--surface-base)",
          card: "var(--surface-card)",
          subtle: "var(--surface-subtle)",
          border: "var(--surface-border)",
        },
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
      },
      fontFamily: {
        sans: ["Sora", "Avenir Next", "Segoe UI", "sans-serif"],
        body: ["Manrope", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
