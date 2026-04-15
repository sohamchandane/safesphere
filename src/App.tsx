import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { Accessibility, Moon, Sun } from "lucide-react";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();
type ThemeMode = "light" | "dark";
type VisionMode = "normal" | "deuteranopia" | "protanopia" | "tritanopia" | "achromatopsia";

const visionModeLabels: Record<VisionMode, string> = {
  normal: "Normal vision",
  deuteranopia: "Deuteranopia",
  protanopia: "Protanopia",
  tritanopia: "Tritanopia",
  achromatopsia: "Achromatopsia",
};

const App = () => {
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [visionMode, setVisionMode] = useState<VisionMode>("normal");

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldUseDark = storedTheme ? storedTheme === "dark" : prefersDark;
    setThemeMode(shouldUseDark ? "dark" : "light");

    const storedVisionMode = window.localStorage.getItem("vision-mode") as VisionMode | null;
    if (storedVisionMode && visionModeLabels[storedVisionMode]) {
      setVisionMode(storedVisionMode);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", themeMode === "dark");
    root.style.colorScheme = themeMode === "dark" ? "dark" : "light";
    window.localStorage.setItem("theme", themeMode);
  }, [themeMode]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.visionMode = visionMode;
    window.localStorage.setItem("vision-mode", visionMode);
  }, [visionMode]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <div className="fixed right-4 top-4 z-50 flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full shadow-soft backdrop-blur supports-[backdrop-filter]:bg-background/80"
                onClick={() => setThemeMode((current) => (current === "dark" ? "light" : "dark"))}
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
                  <DropdownMenuRadioGroup value={visionMode} onValueChange={(value) => setVisionMode(value as VisionMode)}>
                    <DropdownMenuRadioItem value="normal">Normal vision</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="deuteranopia">Deuteranopia</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="protanopia">Protanopia</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="tritanopia">Tritanopia</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="achromatopsia">Achromatopsia</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/register" element={<Register />} />
              <Route path="/dashboard" element={<Dashboard />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
