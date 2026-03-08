export const THEME_STORAGE_KEY = "projectforge-theme";

export type ThemePreference = "light" | "dark";

export const themeScript = `(() => {
  const key = "${THEME_STORAGE_KEY}";
  const root = document.documentElement;

  const apply = (theme) => {
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  };

  try {
    const stored = localStorage.getItem(key);
    if (stored === "light" || stored === "dark") {
      apply(stored);
      return;
    }
  } catch {}

  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  apply(systemDark ? "dark" : "light");
})();`;

export function getSystemTheme(): ThemePreference {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
