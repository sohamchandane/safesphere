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

  const renderContent = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Grass Pollen</span>
          <span className={`text-sm font-bold ${getPollenLevel(pollen?.grass_pollen ?? 0).color}`}>
            {getPollenLevel(pollen?.grass_pollen ?? 0).label}
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-hero transition-all"
            style={{ width: `${Math.min(100, ((pollen?.grass_pollen ?? 0) / 5) * 100)}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">{pollen?.grass_pollen ?? 0} grains/m³</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Tree Pollen</span>
          <span className={`text-sm font-bold ${getPollenLevel(pollen?.tree_pollen ?? 0).color}`}>
            {getPollenLevel(pollen?.tree_pollen ?? 0).label}
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-hero transition-all"
            style={{ width: `${Math.min(100, ((pollen?.tree_pollen ?? 0) / 5) * 100)}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">{pollen?.tree_pollen ?? 0} grains/m³</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Weed Pollen</span>
          <span className={`text-sm font-bold ${getPollenLevel(pollen?.weed_pollen ?? 0).color}`}>
            {getPollenLevel(pollen?.weed_pollen ?? 0).label}
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-hero transition-all"
            style={{ width: `${Math.min(100, ((pollen?.weed_pollen ?? 0) / 5) * 100)}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">{pollen?.weed_pollen ?? 0} grains/m³</p>
      </div>
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
      <div className="space-y-3 rounded-2xl border border-border/70 bg-background/70 p-4 shadow-soft">
        <div className="flex items-center justify-between gap-2">
          <h4 className="flex items-center gap-2 font-semibold text-foreground">
            <Flower2 className="h-4 w-4 text-primary" />
            Pollen Data
          </h4>
          <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            Level-coded
          </span>
        </div>
        {renderContent()}
      </div>
    );
  }

  return (
    <Card className="shadow-soft border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flower2 className="h-5 w-5 text-primary" />
          Pollen Levels
        </CardTitle>
        <CardDescription>Current pollen count in your area</CardDescription>
      </CardHeader>
      <CardContent>
        {renderContent()}
      </CardContent>
    </Card>
  );
};
