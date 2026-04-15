import { useEffect, useMemo, useState } from "react";

export type ThemeMode = "light" | "dark";
export type VisionMode = "normal" | "deuteranopia" | "protanopia" | "tritanopia" | "achromatopsia";

const THEME_STORAGE_KEY = "theme";
const VISION_STORAGE_KEY = "vision-mode";

const visionModeLabels: Record<VisionMode, string> = {
  normal: "Normal vision",
  deuteranopia: "Deuteranopia",
  protanopia: "Protanopia",
  tritanopia: "Tritanopia",
  achromatopsia: "Achromatopsia",
};

const isVisionMode = (value: string): value is VisionMode => {
  return Object.prototype.hasOwnProperty.call(visionModeLabels, value);
};

export function useUiPreferences() {
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [visionMode, setVisionMode] = useState<VisionMode>("normal");

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const nextThemeMode: ThemeMode = storedTheme === "dark" || (!storedTheme && prefersDark) ? "dark" : "light";
    setThemeMode(nextThemeMode);

    const storedVisionMode = window.localStorage.getItem(VISION_STORAGE_KEY);
    if (storedVisionMode && isVisionMode(storedVisionMode)) {
      setVisionMode(storedVisionMode);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", themeMode === "dark");
    root.style.colorScheme = themeMode;
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    document.documentElement.dataset.visionMode = visionMode;
    window.localStorage.setItem(VISION_STORAGE_KEY, visionMode);
  }, [visionMode]);

  const activeVisionLabel = useMemo(() => visionModeLabels[visionMode], [visionMode]);

  return {
    themeMode,
    setThemeMode,
    visionMode,
    setVisionMode,
    visionModeLabels,
    activeVisionLabel,
  };
}
