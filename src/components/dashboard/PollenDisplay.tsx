import { useEffect, useMemo, useState } from 'react';
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
};

export const PollenDisplay = ({ location, embedded = false }: PollenDisplayProps) => {
  const [pollen, setPollen] = useState<PollenData | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const panelStyle = useMemo(() => ({ contentVisibility: 'auto', contain: 'layout paint style', containIntrinsicSize: '1px 520px' }), []);

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

  const pollenEntries = useMemo<PollenEntry[]>(
    () => [
      { key: 'grass', label: 'Grass', value: pollen?.grass_pollen ?? 0 },
      { key: 'tree', label: 'Tree', value: pollen?.tree_pollen ?? 0 },
      { key: 'weed', label: 'Weed', value: pollen?.weed_pollen ?? 0 },
    ],
    [pollen]
  );

  const dominantEntry = useMemo(
    () => pollenEntries.reduce((best, entry) => (entry.value > best.value ? entry : best), pollenEntries[0]),
    [pollenEntries]
  );

  const dominantLevel = getPollenLevel(dominantEntry.value);

  const overallExposure = useMemo(
    () => Math.max(...pollenEntries.map((entry) => entry.value)),
    [pollenEntries]
  );

  const renderPollenTile = (entry: PollenEntry) => {
    const level = getPollenLevel(entry.value);

    return (
      <div key={entry.key} className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm transition-shadow hover:shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-success" />
            <div>
              <p className="text-sm font-semibold text-foreground">{entry.label}</p>
              <p className="text-xs text-muted-foreground">{entry.value} grains/m³</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-success">{entry.value}</p>
            <p className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700">{entry.label}</p>
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-gradient-to-r from-background via-background to-primary/5 px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Current exposure</p>
          <p className="text-sm font-medium text-foreground">Dominant: {dominantEntry.label}</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-success">{dominantLevel.label}</p>
          <p className="text-xs text-muted-foreground">Peak {overallExposure} grains/m³</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">{pollenEntries.map(renderPollenTile)}</div>
    </div>
  );

  if (loading) {
    return embedded ? (
      <div className="text-sm text-muted-foreground" style={panelStyle}>Loading pollen data...</div>
    ) : (
      <Card className="border-0 shadow-soft content-visibility-auto" style={panelStyle as any}>
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
      <div className="space-y-3 rounded-2xl border border-border/70 bg-background/80 p-4 shadow-soft" style={panelStyle}>
        <div className="flex items-center justify-between gap-2">
          <h4 className="flex items-center gap-2 font-semibold text-foreground">
            <Flower2 className="h-4 w-4 text-primary" />
            Pollen Data
          </h4>
          <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            Snapshot view
          </span>
        </div>
        {renderContent()}
      </div>
    );
  }

  return (
    <Card className="overflow-hidden border-0 shadow-soft content-visibility-auto" style={panelStyle as any}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flower2 className="h-5 w-5 text-primary" />
          Pollen Levels
        </CardTitle>
        <CardDescription>Current airborne exposure in your area</CardDescription>
      </CardHeader>
      <CardContent className="pb-6">
        {renderContent()}
      </CardContent>
    </Card>
  );
};
