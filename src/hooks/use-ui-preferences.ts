import { useEffect, useMemo, useState } from "react";
import i18n from "@/i18n";

export type ThemeMode = "light" | "dark";
export type VisionMode = "normal" | "deuteranopia" | "protanopia" | "tritanopia" | "achromatopsia";
export type LanguageCode = "en" | "hi" | "mr" | "ta" | "te" | "gu" | "kn" | "pa" | "fr" | "es" | "zh" | "hr" | "bn" | "sw" | "my";

const THEME_STORAGE_KEY = "theme";
const VISION_STORAGE_KEY = "vision-mode";
const LANGUAGE_STORAGE_KEY = "app-language";

const visionModeLabels: Record<VisionMode, string> = {
  normal: "Normal vision",
  deuteranopia: "Deuteranopia",
  protanopia: "Protanopia",
  tritanopia: "Tritanopia",
  achromatopsia: "Achromatopsia",
};

const languageLabels: Record<LanguageCode, string> = {
  en: "English",
  hi: "हिन्दी",
  mr: "मराठी",
  ta: "தமிழ்",
  te: "తెలుగు",
  gu: "ગુજરાતી",
  kn: "ಕನ್ನಡ",
  pa: "ਪੰਜਾਬੀ",
  bn: "বাংলা",
  fr: "Français",
  es: "Español",
  zh: "中文",
  hr: "Hrvatski",
  sw: "Kiswahili",
  my: "မြန်မာ",
};

const isVisionMode = (value: string): value is VisionMode => {
  return Object.prototype.hasOwnProperty.call(visionModeLabels, value);
};

const isLanguageCode = (value: string): value is LanguageCode => {
  return Object.prototype.hasOwnProperty.call(languageLabels, value);
};

const detectInitialLanguage = (): LanguageCode => {
  const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (storedLanguage && isLanguageCode(storedLanguage)) {
    return storedLanguage;
  }

  const browserLanguage = (window.navigator.language || "en").toLowerCase();
  if (browserLanguage.startsWith("hi")) return "hi";
  if (browserLanguage.startsWith("mr")) return "mr";
  if (browserLanguage.startsWith("ta")) return "ta";
  if (browserLanguage.startsWith("te")) return "te";
  if (browserLanguage.startsWith("gu")) return "gu";
  if (browserLanguage.startsWith("kn")) return "kn";
  if (browserLanguage.startsWith("pa")) return "pa";
  if (browserLanguage.startsWith("fr")) return "fr";
  if (browserLanguage.startsWith("es")) return "es";
  if (browserLanguage.startsWith("zh")) return "zh";
  if (browserLanguage.startsWith("hr")) return "hr";
  if (browserLanguage.startsWith("bn")) return "bn";
  if (browserLanguage.startsWith("sw")) return "sw";
  if (browserLanguage.startsWith("my")) return "my";
  return "en";
};

export function useUiPreferences() {
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [visionMode, setVisionMode] = useState<VisionMode>("normal");
  const [language, setLanguage] = useState<LanguageCode>("en");

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const nextThemeMode: ThemeMode = storedTheme === "dark" || (!storedTheme && prefersDark) ? "dark" : "light";
    setThemeMode(nextThemeMode);

    const storedVisionMode = window.localStorage.getItem(VISION_STORAGE_KEY);
    if (storedVisionMode && isVisionMode(storedVisionMode)) {
      setVisionMode(storedVisionMode);
    }

    setLanguage(detectInitialLanguage());
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

  useEffect(() => {
    void i18n.changeLanguage(language);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  const activeVisionLabel = useMemo(() => visionModeLabels[visionMode], [visionMode]);

  return {
    themeMode,
    setThemeMode,
    visionMode,
    setVisionMode,
    language,
    setLanguage,
    languageLabels,
    visionModeLabels,
    activeVisionLabel,
  };
}
