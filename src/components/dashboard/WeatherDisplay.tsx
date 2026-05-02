import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Cloud, Wind, Droplets, Thermometer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as externalApis from '@/lib/externalApis';

interface WeatherDisplayProps {
  location: { latitude: number; longitude: number };
  embedded?: boolean;
}

interface WeatherData {
  temperature: number;
  pressure: number;
  aqi: number;
  co: number;
  no: number;
  no2: number;
  o3: number;
  so2: number;
  pm2_5: number;
  pm10: number;
  nh3: number;
}

type SeverityTone = {
  label: string;
  className: string;
  badgeClassName: string;
};

type Datapoint = {
  label: string;
  value: string;
  numeric: number;
  safe: number;
  unit: string;
  icon: typeof Cloud;
  higherIsWorse: boolean;
  description: string;
  summary?: boolean;
  tone?: SeverityTone;
};

export const WeatherDisplay = ({ location, embedded = false }: WeatherDisplayProps) => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const panelStyle = useMemo<CSSProperties>(() => ({ contentVisibility: 'auto', contain: 'layout paint style' }), []);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        setLoading(true);

        const wp = await externalApis.fetchWeatherAndPollution(location.latitude, location.longitude);

        const toNumberOrZero = (value: unknown) => {
          const n = Number(value);
          return Number.isFinite(n) ? n : 0;
        };

        setWeather({
          temperature: toNumberOrZero(wp.temperature),
          pressure: toNumberOrZero(wp.pressure),
          aqi: toNumberOrZero(wp.aqi),
          co: toNumberOrZero(wp.components?.co),
          no: toNumberOrZero(wp.components?.no),
          no2: toNumberOrZero(wp.components?.no2),
          o3: toNumberOrZero(wp.components?.o3),
          so2: toNumberOrZero(wp.components?.so2),
          pm2_5: toNumberOrZero(wp.components?.pm2_5),
          pm10: toNumberOrZero(wp.components?.pm10),
          nh3: toNumberOrZero(wp.components?.nh3),
        });
      } catch (error) {
        console.error('Weather fetch error:', error);
        toast({
          title: 'Weather data unavailable',
          description: 'Could not fetch weather data',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
  }, [location, toast]);

  const getSeverityStyle = (value: number, safeValue: number, higherIsWorse = true): SeverityTone => {
    const ratio = higherIsWorse ? value / safeValue : safeValue / Math.max(value, 0.0001);
    if (ratio <= 1) return { label: 'Safe', className: 'text-success', badgeClassName: 'bg-success/10 text-success border-success/20' };
    if (ratio <= 1.5) return { label: 'Watch', className: 'text-warning', badgeClassName: 'bg-warning/10 text-warning border-warning/20' };
    return { label: 'High', className: 'text-destructive', badgeClassName: 'bg-destructive/10 text-destructive border-destructive/20' };
  };

  const getBackgroundFill = (value: number, safeValue: number, higherIsWorse = true) => {
    const percentage = higherIsWorse ? (value / safeValue) * 100 : (safeValue / Math.max(value, 0.0001)) * 100;
    return `${Math.min(100, Math.max(8, percentage))}%`;
  };

  const getAQICategory = (aqi: number): SeverityTone => {
    if (aqi <= 50) return { label: 'Good', className: 'text-success', badgeClassName: 'bg-success/10 text-success border-success/20' };
    if (aqi <= 100) return { label: 'Moderate', className: 'text-warning', badgeClassName: 'bg-warning/10 text-warning border-warning/20' };
    if (aqi <= 150) return { label: 'Unhealthy for Sensitive Groups', className: 'text-warning', badgeClassName: 'bg-warning/10 text-warning border-warning/20' };
    if (aqi <= 200) return { label: 'Unhealthy', className: 'text-destructive', badgeClassName: 'bg-destructive/10 text-destructive border-destructive/20' };
    if (aqi <= 300) return { label: 'Very Unhealthy', className: 'text-destructive', badgeClassName: 'bg-destructive/10 text-destructive border-destructive/20' };
    return { label: 'Hazardous', className: 'text-destructive', badgeClassName: 'bg-destructive/10 text-destructive border-destructive/20' };
  };

  const pollutantStandards = {
    pm2_5: { safe: 15, label: 'WHO AQG', window: '24h avg', unit: 'µg/m³' },
    pm10: { safe: 45, label: 'WHO AQG', window: '24h avg', unit: 'µg/m³' },
    o3: { safe: 100, label: 'WHO AQG', window: '8h avg', unit: 'µg/m³' },
    no2: { safe: 188, label: 'EPA NAAQS', window: '1h avg', unit: 'µg/m³' },
    so2: { safe: 196, label: 'EPA NAAQS', window: '1h avg', unit: 'µg/m³' },
    co: { safe: 10305, label: 'EPA NAAQS', window: '8h avg', unit: 'µg/m³' },
  } as const;

  const datapoints = useMemo<Datapoint[]>(() => {
    if (!weather) return [];

    const aqiTone = getAQICategory(weather.aqi);

    return [
      {
        label: 'AQI',
        value: `${weather.aqi}`,
        numeric: weather.aqi,
        safe: 100,
        unit: 'Air Quality Index',
        icon: Cloud,
        higherIsWorse: true,
        description: aqiTone.label,
        summary: true,
        tone: aqiTone,
      },
      {
        label: 'Temperature',
        value: `${weather.temperature}°C`,
        numeric: weather.temperature,
        safe: 26,
        unit: 'Safe: 18-26°C',
        icon: Thermometer,
        higherIsWorse: true,
        description: 'Comfort zone for most users',
      },
      {
        label: 'Pressure',
        value: `${weather.pressure} hPa`,
        numeric: weather.pressure,
        safe: 1013,
        unit: 'Safe: ~1013 hPa',
        icon: Wind,
        higherIsWorse: false,
        description: 'Stable atmospheric pressure reference',
      },
      {
        label: 'PM2.5',
        value: `${weather.pm2_5} µg/m³`,
        numeric: weather.pm2_5,
        safe: pollutantStandards.pm2_5.safe,
        unit: `Safe: ≤ ${pollutantStandards.pm2_5.safe} ${pollutantStandards.pm2_5.unit} (${pollutantStandards.pm2_5.label}, ${pollutantStandards.pm2_5.window})`,
        icon: Droplets,
        higherIsWorse: true,
        description: 'Fine particulate matter',
      },
      {
        label: 'PM10',
        value: `${weather.pm10} µg/m³`,
        numeric: weather.pm10,
        safe: pollutantStandards.pm10.safe,
        unit: `Safe: ≤ ${pollutantStandards.pm10.safe} ${pollutantStandards.pm10.unit} (${pollutantStandards.pm10.label}, ${pollutantStandards.pm10.window})`,
        icon: Droplets,
        higherIsWorse: true,
        description: 'Larger inhalable particles',
      },
      {
        label: 'O3',
        value: `${weather.o3} µg/m³`,
        numeric: weather.o3,
        safe: pollutantStandards.o3.safe,
        unit: `Safe: ≤ ${pollutantStandards.o3.safe} ${pollutantStandards.o3.unit} (${pollutantStandards.o3.label}, ${pollutantStandards.o3.window})`,
        icon: Cloud,
        higherIsWorse: true,
        description: 'Ground-level ozone',
      },
      {
        label: 'NO2',
        value: `${weather.no2} µg/m³`,
        numeric: weather.no2,
        safe: pollutantStandards.no2.safe,
        unit: `Safe: ≤ ${pollutantStandards.no2.safe} ${pollutantStandards.no2.unit} (${pollutantStandards.no2.label}, ${pollutantStandards.no2.window})`,
        icon: Cloud,
        higherIsWorse: true,
        description: 'Traffic-related pollutant',
      },
      {
        label: 'SO2',
        value: `${weather.so2} µg/m³`,
        numeric: weather.so2,
        safe: pollutantStandards.so2.safe,
        unit: `Safe: ≤ ${pollutantStandards.so2.safe} ${pollutantStandards.so2.unit} (${pollutantStandards.so2.label}, ${pollutantStandards.so2.window})`,
        icon: Cloud,
        higherIsWorse: true,
        description: 'Combustion-related pollutant',
      },
      {
        label: 'CO',
        value: `${weather.co} µg/m³`,
        numeric: weather.co,
        safe: pollutantStandards.co.safe,
        unit: `Safe: ≤ ${pollutantStandards.co.safe} ${pollutantStandards.co.unit} (${pollutantStandards.co.label}, ${pollutantStandards.co.window})`,
        icon: Cloud,
        higherIsWorse: true,
        description: 'Carbon monoxide concentration',
      },
    ];
  }, [weather]);

  const renderTiles = () => (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {datapoints.map((item) => {
        const Icon = item.icon;
        const severity = item.summary && item.tone ? item.tone : getSeverityStyle(item.numeric, item.safe, item.higherIsWorse);

        return (
          <div
            key={item.label}
            className={`rounded-2xl border border-border/70 bg-background/80 p-4 ${severity.badgeClassName}`}
            style={panelStyle}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[0.95rem] font-semibold uppercase tracking-wide text-foreground/85">{item.label}</p>
                <p className={`mt-1 text-2xl font-bold ${severity.className}`}>{item.value}</p>
              </div>
              <div className={`rounded-xl border p-2.5 ${severity.badgeClassName}`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>

            {!item.summary && (
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-background/80">
                <div
                  className="h-full rounded-full bg-gradient-hero"
                  style={{ width: getBackgroundFill(item.numeric, item.safe, item.higherIsWorse) }}
                />
              </div>
            )}

            <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="font-medium">{severity.label}</span>
              <span>{item.unit}</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
          </div>
        );
      })}
    </div>
  );

  if (loading) {
    return embedded ? (
      <div className="rounded-2xl border border-border/70 bg-background/75 p-4 text-sm text-muted-foreground" style={panelStyle}>
        Loading weather data...
      </div>
    ) : (
      <Card className="border-0 shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-primary" />
            Weather Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading weather data...</p>
        </CardContent>
      </Card>
    );
  }

  if (!weather) return null;

  if (embedded) {
    return renderTiles();
  }

  return (
    <Card className="border-0 shadow-soft content-visibility-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="h-5 w-5 text-primary" />
          Weather & Air Quality
        </CardTitle>
        <CardDescription>Current environmental conditions</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-4 rounded-2xl border border-border/70 bg-background/70 p-4" style={panelStyle}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <Cloud className="h-5 w-5 text-primary" />
                Weather & Air Quality
              </h3>
              <p className="text-sm text-muted-foreground">Current environmental conditions</p>
            </div>
            <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Severity-coded indicators
            </div>
          </div>
          {renderTiles()}
        </div>
      </CardContent>
    </Card>
  );
};