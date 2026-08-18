"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

export type Theme = "light" | "dark";

export type Palette = {
  ground: string;
  surface: string;
  surface2: string;
  ink: string;
  inkSoft: string;
  muted: string;
  line: string;
  lineStrong: string;
  gold: string;
  teal: string;
  good: string;
  warn: string;
  bad: string;
};

export const PALETTES: Record<Theme, Palette> = {
  light: {
    ground: "#FBF8F2", surface: "#FFFFFF", surface2: "#F4EFE6", ink: "#1B1712",
    inkSoft: "#4A433B", muted: "#8A8178", line: "#E8E0D2", lineStrong: "#D9CFBC",
    gold: "#B07B1E", teal: "#1C6E68", good: "#2E7D57", warn: "#D08A2C", bad: "#C0453B",
  },
  dark: {
    ground: "#14110C", surface: "#1E1A14", surface2: "#262019", ink: "#F2EDE4",
    inkSoft: "#C4BBAC", muted: "#8F8578", line: "#302A21", lineStrong: "#3B342A",
    gold: "#D9A544", teal: "#4FB3AB", good: "#4FB07E", warn: "#E0A54D", bad: "#D96B62",
  },
};

const ThemeCtx = createContext<{ theme: Theme; palette: Palette; toggle: () => void }>({
  theme: "light",
  palette: PALETTES.light,
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = localStorage.getItem("wpc-theme") as Theme | null;
    const initial =
      stored ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(initial);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("wpc-theme", theme);
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === "light" ? "dark" : "light")), []);

  return (
    <ThemeCtx.Provider value={{ theme, palette: PALETTES[theme], toggle }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export const useTheme = () => useContext(ThemeCtx);
