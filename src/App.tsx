import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { UiPreferencesControls } from "@/components/app/UiPreferencesControls";
import { useUiPreferences } from "@/hooks/use-ui-preferences";

const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Register = lazy(() => import("./pages/Register"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => {
  const { themeMode, setThemeMode, visionMode, setVisionMode, visionModeLabels } = useUiPreferences();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <UiPreferencesControls
              themeMode={themeMode}
              onToggleTheme={() => setThemeMode((current) => (current === "dark" ? "light" : "dark"))}
              visionMode={visionMode}
              onVisionModeChange={setVisionMode}
              visionModeLabels={visionModeLabels}
            />
            <Suspense
              fallback={
                <div className="min-h-screen flex items-center justify-center bg-gradient-subtle text-muted-foreground">
                  Loading...
                </div>
              }
            >
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/register" element={<Register />} />
                <Route path="/dashboard" element={<Dashboard />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
