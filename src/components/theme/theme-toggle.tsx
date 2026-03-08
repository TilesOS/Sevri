"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { THEME_STORAGE_KEY, getSystemTheme, type ThemePreference } from "@/components/theme/theme-utils";

function applyTheme(theme: ThemePreference) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemePreference>("light");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let nextTheme = getSystemTheme();

    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === "light" || stored === "dark") {
        nextTheme = stored;
      }
    } catch {
      // Ignore storage access issues.
    }

    applyTheme(nextTheme);
    setTheme(nextTheme);
    setIsReady(true);
  }, []);

  function toggleTheme() {
    const nextTheme: ThemePreference = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);

    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Ignore storage access issues.
    }
  }

  return (
    <Button
      type="button"
      variant="secondary"
      className="h-9 min-w-24 px-3"
      onClick={toggleTheme}
      aria-label={isReady ? `Switch to ${theme === "dark" ? "light" : "dark"} mode` : "Toggle theme"}
      aria-pressed={theme === "dark"}
    >
      {isReady ? (theme === "dark" ? "Light mode" : "Dark mode") : "Theme"}
    </Button>
  );
}
