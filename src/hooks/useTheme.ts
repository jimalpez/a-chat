"use client";

import { useEffect, useCallback } from "react";
import { useChatStore, type ThemeMode } from "@/lib/store";

const STORAGE_KEY = "chat-app-theme";

function getSystemPreference(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === "dark") return true;
  if (mode === "light") return false;
  return getSystemPreference();
}

export function useTheme() {
  const themeMode = useChatStore((s) => s.themeMode);
  const setThemeMode = useChatStore((s) => s.setThemeMode);
  const isDark = useChatStore((s) => s.isDark);
  const setIsDark = useChatStore((s) => s.setIsDark);

  // On mount, load saved preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    if (saved && ["light", "dark", "system"].includes(saved)) {
      setThemeMode(saved);
      setIsDark(resolveIsDark(saved));
    } else {
      // Default to system
      setIsDark(resolveIsDark("system"));
    }
  }, [setThemeMode, setIsDark]);

  // Listen for system preference changes when in "system" mode
  useEffect(() => {
    if (themeMode !== "system") return;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      setIsDark(e.matches);
    };

    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [themeMode, setIsDark]);

  const setMode = useCallback(
    (mode: ThemeMode) => {
      setThemeMode(mode);
      setIsDark(resolveIsDark(mode));
      localStorage.setItem(STORAGE_KEY, mode);
    },
    [setThemeMode, setIsDark],
  );

  // Cycle through: light → dark → system → light
  const cycleTheme = useCallback(() => {
    const next: Record<ThemeMode, ThemeMode> = {
      light: "dark",
      dark: "system",
      system: "light",
    };
    setMode(next[themeMode]);
  }, [themeMode, setMode]);

  return { themeMode, isDark, setMode, cycleTheme };
}
