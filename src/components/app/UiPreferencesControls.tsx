import { Accessibility, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ThemeMode, VisionMode } from "@/hooks/use-ui-preferences";

type UiPreferencesControlsProps = {
  themeMode: ThemeMode;
  onToggleTheme: () => void;
  visionMode: VisionMode;
  onVisionModeChange: (value: VisionMode) => void;
  visionModeLabels: Record<VisionMode, string>;
};

export const UiPreferencesControls = ({
  themeMode,
  onToggleTheme,
  visionMode,
  onVisionModeChange,
  visionModeLabels,
}: UiPreferencesControlsProps) => {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 sm:flex-row sm:items-center">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full shadow-soft backdrop-blur supports-[backdrop-filter]:bg-background/80"
        onClick={onToggleTheme}
        aria-label={themeMode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      >
        {themeMode === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
        {themeMode === "dark" ? "Light" : "Dark"}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full shadow-soft backdrop-blur supports-[backdrop-filter]:bg-background/80"
            aria-label={`Color vision mode: ${visionModeLabels[visionMode]}`}
          >
            <Accessibility className="mr-2 h-4 w-4" />
            {visionMode === "normal" ? "Vision" : visionModeLabels[visionMode]}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Color vision mode</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={visionMode} onValueChange={(value) => onVisionModeChange(value as VisionMode)}>
            <DropdownMenuRadioItem value="normal">Normal vision</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="deuteranopia">Deuteranopia</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="protanopia">Protanopia</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="tritanopia">Tritanopia</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="achromatopsia">Achromatopsia</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
