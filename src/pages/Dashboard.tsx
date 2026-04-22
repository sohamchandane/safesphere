import { Suspense, lazy, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, BrainCircuit, LogOut, MapPin, Sparkles, Wind } from 'lucide-react';
import { LocationAccess } from '@/components/dashboard/LocationAccess';
import { WeatherDisplay } from '../components/dashboard/WeatherDisplay';
import { PollenDisplay } from '@/components/dashboard/PollenDisplay';
import { HeartRateMonitor } from '@/components/dashboard/HeartRateMonitor';
import { RiskPrediction } from '@/components/dashboard/RiskPrediction';
import { GroundTruthFollowup } from '@/components/dashboard/GroundTruthFollowup';

const RiskMap = lazy(() => import('@/components/dashboard/RiskMap').then((mod) => ({ default: mod.RiskMap })));
const AttackHistory = lazy(() =>
  import('@/components/dashboard/AttackHistory').then((mod) => ({ default: mod.AttackHistory }))
);

const Dashboard = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [heartRate, setHeartRate] = useState<number | null>(null);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const username = user?.user_metadata?.username || user?.email?.split('@')[0] || 'User';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <div className="animate-pulse rounded-full bg-card/70 p-5 shadow-soft">
          <Activity className="h-12 w-12 text-primary" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="landing-grid-bg min-h-screen overflow-x-hidden bg-gradient-subtle">
      <div className="hero-orb hero-orb-teal" aria-hidden="true" />
      <div className="hero-orb hero-orb-cyan" aria-hidden="true" />

      <div className="container relative mx-auto px-4 pb-12 pt-6 sm:pt-8 lg:pb-16">
        <header className="mb-8 flex flex-col gap-4 rounded-3xl border border-border/70 bg-card/80 px-4 py-4 shadow-soft backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-gradient-hero p-3 shadow-medium">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">SafeSphere Dashboard</p>
              <h1 className="text-xl font-bold text-foreground">Welcome back, {username}</h1>
            </div>
          </div>

          <Button variant="outline" onClick={handleSignOut} className="self-start rounded-xl sm:self-auto">
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </header>

        {/* Combined Environmental Monitoring Card */}
        <section className="mb-8">
          <Card className="overflow-hidden border-border/70 bg-card/85 shadow-elevation backdrop-blur">
            <CardHeader className="space-y-4 border-b border-border/50 bg-gradient-to-br from-primary/8 via-transparent to-accent/8">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Environmental Monitoring
              </div>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <CardTitle className="text-2xl sm:text-3xl">Weather Data</CardTitle>
                  <CardDescription className="text-sm sm:text-base">
                    Location, weather conditions, and pollen levels for your area
                  </CardDescription>
                </div>

                <div className="rounded-xl border border-border/60 bg-background/70 px-4 py-3 lg:min-w-[320px]">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Location Details</p>
                  {location ? (
                    <div className="mt-2 grid gap-1 text-sm sm:text-base">
                      <p className="font-medium text-foreground">Latitude: {location.latitude.toFixed(6)}</p>
                      <p className="font-medium text-foreground">Longitude: {location.longitude.toFixed(6)}</p>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">Enable location to display coordinates.</p>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 p-6">
              {/* Location subsection */}
              <div className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <MapPin className="h-4 w-4 text-primary" />
                  Location
                </h3>
                <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-soft">
                  <LocationAccess onLocationUpdate={setLocation} embedded showCoordinates={false} />
                </div>
              </div>

              {/* Weather subsection */}
              {location && (
                <div className="space-y-3">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Wind className="h-4 w-4 text-primary" />
                    Weather Conditions
                  </h3>
                  <WeatherDisplay location={location} embedded />
                </div>
              )}

              {/* Pollen subsection */}
              {location && (
                <div className="space-y-3">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <BrainCircuit className="h-4 w-4 text-primary" />
                    Pollen Data
                  </h3>
                  <PollenDisplay location={location} embedded />
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Live Session Workflow Section */}
        <div id="dashboard-workflow" className="space-y-8">
          <section className="w-full">
            <HeartRateMonitor
              onHeartRateUpdate={(hr) => {
                setHeartRate(hr);
                setSessionComplete(false);
              }}
              onSessionEnd={(finalAvg) => {
                setHeartRate(finalAvg ?? null);
                setSessionComplete(true);
              }}
            />
          </section>

          {location && heartRate !== null && sessionComplete && (
            <RiskPrediction location={location} heartRate={heartRate} userId={user.id} />
          )}

          <GroundTruthFollowup
            userId={user.id}
            email={user.email ?? null}
            username={username}
            onAnswered={() => setHistoryRefreshKey((prev) => prev + 1)}
          />

          <Suspense
            fallback={
              <Card className="shadow-soft border-0">
                <CardHeader>
                  <CardTitle>Loading map insights...</CardTitle>
                </CardHeader>
              </Card>
            }
          >
            <RiskMap userId={user.id} refreshKey={historyRefreshKey} />
          </Suspense>

          <Suspense
            fallback={
              <Card className="shadow-soft border-0">
                <CardHeader>
                  <CardTitle>Loading attack history...</CardTitle>
                </CardHeader>
              </Card>
            }
          >
            <AttackHistory userId={user.id} refreshKey={historyRefreshKey} />
          </Suspense>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
