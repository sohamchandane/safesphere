import { useEffect, useState } from 'react';
import { fetchPollen } from '@/lib/externalApis';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Flower2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PollenDisplayProps {
  location: { latitude: number; longitude: number };
  embedded?: boolean;
}

interface PollenData {
  grass_pollen: number;
  tree_pollen: number;
  weed_pollen: number;
}

type PollenType = 'grass' | 'tree' | 'weed';

type PollenEntry = {
  key: PollenType;
  label: string;
  value: number;
  accent: string;
  softAccent: string;
};

export const PollenDisplay = ({ location, embedded = false }: PollenDisplayProps) => {
  const [pollen, setPollen] = useState<PollenData | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const loadPollen = async () => {
      try {
        setLoading(true);
        const res = await fetchPollen(location.latitude, location.longitude);
        const data: PollenData = {
          grass_pollen: res?.grass ?? 0,
          tree_pollen: res?.tree ?? 0,
          weed_pollen: res?.weed ?? 0,
        };
        setPollen(data);
      } catch (error) {
        console.error('Pollen fetch error:', error);
        toast({
          title: 'Pollen data unavailable',
          description: 'Could not fetch pollen data',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadPollen();
  }, [location]);

  const getPollenLevel = (value: number): { label: string; color: string } => {
    if (value < 2) return { label: 'Low', color: 'text-success' };
    if (value < 4) return { label: 'Moderate', color: 'text-warning' };
    return { label: 'High', color: 'text-destructive' };
  };

  const pollenEntries: PollenEntry[] = [
    {
      key: 'grass',
      label: 'Grass',
      value: pollen?.grass_pollen ?? 0,
      accent: 'hsl(var(--risk-low))',
      softAccent: 'bg-emerald-500/10',
    },
    {
      key: 'tree',
      label: 'Tree',
      value: pollen?.tree_pollen ?? 0,
      accent: 'hsl(var(--risk-moderate))',
      softAccent: 'bg-amber-500/10',
    },
    {
      key: 'weed',
      label: 'Weed',
      value: pollen?.weed_pollen ?? 0,
      accent: 'hsl(var(--risk-high))',
      softAccent: 'bg-rose-500/10',
    },
  ];

  const dominantEntry = pollenEntries.reduce((best, entry) => (entry.value > best.value ? entry : best), pollenEntries[0]);
  const dominantLevel = getPollenLevel(dominantEntry.value);
  const overallExposure = Math.max(...pollenEntries.map((entry) => entry.value));

  const renderPollenBar = (entry: PollenEntry) => {
    const level = getPollenLevel(entry.value);
    const width = Math.min(100, (entry.value / 5) * 100);

    return (
      <div key={entry.key} className={`rounded-2xl border border-border/70 ${entry.softAccent} p-3 shadow-sm`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">{entry.label} Pollen</p>
            <p className="text-xs text-muted-foreground">Current airborne count</p>
          </div>
          <div className="text-right">
            <p className={`text-sm font-bold ${level.color}`}>{level.label}</p>
            <p className="text-xs text-muted-foreground">{entry.value} grains/m³</p>
          </div>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-background/80">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${width}%`, backgroundColor: entry.accent }}
          />
        </div>

        <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Low exposure</span>
          <span>High exposure</span>
        </div>
      </div>
    );
  };

  const renderContent = () => (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-3xl border border-border/70 bg-gradient-to-br from-background via-background to-primary/5 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Exposure summary</p>
          <div className="mt-3 flex items-end justify-between gap-4">
            <div>
              <p className={`text-3xl font-black ${dominantLevel.color}`}>{dominantLevel.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">Dominant: {dominantEntry.label}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-foreground">{overallExposure}</p>
              <p className="text-xs text-muted-foreground">Peak grains/m³</p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-border/60 bg-card/80 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">Current risk profile</span>
              <span className={`font-semibold ${dominantLevel.color}`}>{dominantLevel.label}</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {pollenEntries.map((entry) => (
                <div key={entry.key} className="rounded-xl border border-border/60 bg-background/80 px-3 py-2 text-center">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{entry.label}</p>
                  <p className="mt-1 text-lg font-bold text-foreground">{entry.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-border/70 bg-card/80 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Visual breakdown</p>
          <div className="mt-4 flex items-center justify-center">
            <div
              className="relative flex h-36 w-36 items-center justify-center rounded-full border border-border/70 bg-background shadow-inner"
              style={{
                background: `conic-gradient(${pollenEntries[0].accent} 0% ${Math.min(100, (pollenEntries[0].value / 5) * 100)}%, ${pollenEntries[1].accent} 0% ${Math.min(100, (pollenEntries[1].value / 5) * 100)}%, ${pollenEntries[2].accent} 0% ${Math.min(100, (pollenEntries[2].value / 5) * 100)}%)`,
              }}
            >
              <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full border border-border/70 bg-card text-center shadow-soft">
                <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Peak</span>
                <span className={`text-lg font-black ${dominantLevel.color}`}>{dominantLevel.label}</span>
                <span className="text-xs text-muted-foreground">{dominantEntry.label}</span>
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            {pollenEntries.map((entry) => (
              <div key={entry.key} className="rounded-xl border border-border/60 bg-background/80 px-2 py-2">
                <div className="mx-auto mb-2 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.accent }} />
                <div className="font-medium text-foreground">{entry.label}</div>
                <div className="text-muted-foreground">{Math.round((entry.value / 5) * 100)}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3">{pollenEntries.map(renderPollenBar)}</div>
    </div>
  );

  if (loading) {
    return embedded ? (
      <div className="text-sm text-muted-foreground">Loading pollen data...</div>
    ) : (
      <Card className="shadow-soft border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flower2 className="h-5 w-5 text-primary" />
            Pollen Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading pollen data...</p>
        </CardContent>
      </Card>
    );
  }

  if (!pollen) return null;

  if (embedded) {
    return (
      <div className="space-y-3 rounded-3xl border border-border/70 bg-background/80 p-4 shadow-soft backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <h4 className="flex items-center gap-2 font-semibold text-foreground">
            <Flower2 className="h-4 w-4 text-primary" />
            Pollen Data
          </h4>
          <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            Dynamic exposure view
          </span>
        </div>
        {renderContent()}
      </div>
    );
  }

  return (
    <Card className="border-0 shadow-elevation overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flower2 className="h-5 w-5 text-primary" />
          Pollen Levels
        </CardTitle>
        <CardDescription>Current airborne exposure in your area, summarized by type and intensity</CardDescription>
      </CardHeader>
      <CardContent className="pb-6">
        {renderContent()}
      </CardContent>
    </Card>
  );
};
