import { Accessibility, Languages, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "react-i18next";
import type { LanguageCode, ThemeMode, VisionMode } from "@/hooks/use-ui-preferences";

type UiPreferencesControlsProps = {
  themeMode: ThemeMode;
  onToggleTheme: () => void;
  visionMode: VisionMode;
  onVisionModeChange: (value: VisionMode) => void;
  visionModeLabels: Record<VisionMode, string>;
  language: LanguageCode;
  onLanguageChange: (value: LanguageCode) => void;
  languageLabels: Record<LanguageCode, string>;
};

export const UiPreferencesControls = ({
  themeMode,
  onToggleTheme,
  visionMode,
  onVisionModeChange,
  visionModeLabels,
  language,
  onLanguageChange,
  languageLabels,
}: UiPreferencesControlsProps) => {
  const { t } = useTranslation();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 sm:flex-row sm:items-center">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full shadow-soft backdrop-blur supports-[backdrop-filter]:bg-background/80"
        onClick={onToggleTheme}
        aria-label={themeMode === "dark" ? t("controls.switchToLight") : t("controls.switchToDark")}
      >
        {themeMode === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
        {themeMode === "dark" ? t("controls.light") : t("controls.dark")}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full shadow-soft backdrop-blur supports-[backdrop-filter]:bg-background/80"
            aria-label={`${t("controls.language")}: ${languageLabels[language]}`}
          >
            <Languages className="mr-2 h-4 w-4" />
            {languageLabels[language]}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>{t("controls.language")}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={language} onValueChange={(value) => onLanguageChange(value as LanguageCode)}>
            <DropdownMenuRadioItem value="hi">{languageLabels.hi}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="mr">{languageLabels.mr}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="ta">{languageLabels.ta}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="te">{languageLabels.te}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="gu">{languageLabels.gu}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="kn">{languageLabels.kn}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="pa">{languageLabels.pa}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="bn">{languageLabels.bn}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="fr">{languageLabels.fr}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="es">{languageLabels.es}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="zh">{languageLabels.zh}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="hr">{languageLabels.hr}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="sw">{languageLabels.sw}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="my">{languageLabels.my}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="en">{languageLabels.en}</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full shadow-soft backdrop-blur supports-[backdrop-filter]:bg-background/80"
            aria-label={`${t("controls.colorVisionMode")}: ${visionModeLabels[visionMode]}`}
          >
            <Accessibility className="mr-2 h-4 w-4" />
            {visionMode === "normal" ? t("controls.vision") : visionModeLabels[visionMode]}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>{t("controls.colorVisionMode")}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={visionMode} onValueChange={(value) => onVisionModeChange(value as VisionMode)}>
            <DropdownMenuRadioItem value="normal">{t("controls.normalVision")}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="deuteranopia">{t("controls.deuteranopia")}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="protanopia">{t("controls.protanopia")}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="tritanopia">{t("controls.tritanopia")}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="achromatopsia">{t("controls.achromatopsia")}</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
