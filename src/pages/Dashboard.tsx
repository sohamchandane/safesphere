import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogOut, Activity } from 'lucide-react';
import { LocationAccess } from '@/components/dashboard/LocationAccess';
import { WeatherDisplay } from '@/components/dashboard/WeatherDisplay';
import { PollenDisplay } from '@/components/dashboard/PollenDisplay';
import { HeartRateMonitor } from '@/components/dashboard/HeartRateMonitor';
import { RiskPrediction } from '@/components/dashboard/RiskPrediction';
import { AttackHistory } from '@/components/dashboard/AttackHistory';
import { GroundTruthFollowup } from '@/components/dashboard/GroundTruthFollowup';
import { RiskMap } from '@/components/dashboard/RiskMap';

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <div className="animate-pulse">
          <Activity className="h-12 w-12 text-primary" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <div className="bg-card border-b border-border shadow-soft">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-hero p-2 rounded-xl">
                <Activity className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Asthma Monitor</h1>
                <p className="text-sm text-muted-foreground">Welcome back!</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Location Access */}
          <LocationAccess onLocationUpdate={setLocation} />

          {/* Environmental Data Grid */}
          {location && (
            <div className="grid md:grid-cols-2 gap-6">
              <WeatherDisplay location={location} />
              <PollenDisplay location={location} />
            </div>
          )}

          {/* Heart Rate Monitor */}
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

          {/* Risk Prediction: only run once the session is complete (streaming stopped) */}
          {location && heartRate !== null && sessionComplete && (
            <RiskPrediction
              location={location}
              heartRate={heartRate}
              userId={user.id}
            />
          )}

          <GroundTruthFollowup
            userId={user.id}
            email={user.email ?? null}
            username={user.user_metadata?.username || user.email?.split('@')[0] || 'User'}
            onAnswered={() => setHistoryRefreshKey((prev) => prev + 1)}
          />

          <RiskMap userId={user.id} refreshKey={historyRefreshKey} />

          {/* Attack History */}
          <AttackHistory userId={user.id} refreshKey={historyRefreshKey} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
