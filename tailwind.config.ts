import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f6f8fb",
          100: "#edf1f8",
          200: "#d7dfee",
          300: "#b4c3df",
          400: "#89a1cb",
          500: "#617db4",
          600: "#4a6395",
          700: "#3a4f76",
          800: "#2f405f",
          900: "#29374f",
        },
        mint: {
          100: "#daf7ee",
          300: "#7de0be",
          500: "#2cb48a",
          700: "#1d7e61",
        },
      },
      boxShadow: {
        soft: "0 8px 30px -12px rgba(20, 32, 56, 0.25)",
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