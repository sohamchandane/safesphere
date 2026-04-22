import { useEffect, useState } from 'react';
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

export const WeatherDisplay = ({ location, embedded = false }: WeatherDisplayProps) => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        setLoading(true);

        const wp = await externalApis.fetchWeatherAndPollution(location.latitude, location.longitude);

        // sanitize numeric values to avoid nulls in UI
        const toNumberOrZero = (v: any) => {
          if (v === null || v === undefined) return 0;
          const n = Number(v);
          return Number.isFinite(n) ? n : 0;
        };

        const sanitized: WeatherData = {
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
        };

        setWeather(sanitized);
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
  }, [location]);

  const getSeverityStyle = (value: number, safeValue: number, higherIsWorse = true) => {
    const ratio = higherIsWorse ? value / safeValue : safeValue / Math.max(value, 0.0001);
    if (ratio <= 1) return { label: 'Safe', className: 'text-success', badgeClassName: 'bg-success/10 text-success border-success/20' };
    if (ratio <= 1.5) return { label: 'Watch', className: 'text-warning', badgeClassName: 'bg-warning/10 text-warning border-warning/20' };
    return { label: 'High', className: 'text-destructive', badgeClassName: 'bg-destructive/10 text-destructive border-destructive/20' };
  };

  const getBackgroundFill = (value: number, safeValue: number, higherIsWorse = true) => {
    const percentage = higherIsWorse ? (value / safeValue) * 100 : (safeValue / Math.max(value, 0.0001)) * 100;
    return `${Math.min(100, Math.max(8, percentage))}%`;
  };

  // Get AQI category label and color based on EPA AQI value
  const getAQICategory = (aqi: number) => {
    if (aqi <= 50) {
      return { label: 'Good', color: 'text-success' };
    } else if (aqi <= 100) {
      return { label: 'Moderate', color: 'text-warning' };
    } else if (aqi <= 150) {
      return { label: 'Unhealthy for Sensitive Groups', color: 'text-warning' };
    } else if (aqi <= 200) {
      return { label: 'Unhealthy', color: 'text-destructive' };
    } else if (aqi <= 300) {
      return { label: 'Very Unhealthy', color: 'text-destructive' };
    } else {
      return { label: 'Hazardous', color: 'text-destructive' };
    }
  };

  const datapoints = [
    {
      label: 'AQI',
      value: `${weather?.aqi ?? 0}`,
      numeric: weather?.aqi ?? 0,
      safe: 100,
      unit: 'Air Quality Index',
      icon: Cloud,
      higherIsWorse: true,
      description: getAQICategory(weather?.aqi ?? 0).label,
      isAQI: true,
    },
    {
      label: 'Temperature',
      value: `${weather?.temperature ?? 0}°C`,
      numeric: weather?.temperature ?? 0,
      safe: 26,
      unit: 'Safe: 18-26°C',
      icon: Thermometer,
      higherIsWorse: true,
      description: 'Comfort zone for most users',
    },
    {
      label: 'Pressure',
      value: `${weather?.pressure ?? 0} hPa`,
      numeric: weather?.pressure ?? 0,
      safe: 1013,
      unit: 'Safe: ~1013 hPa',
      icon: Wind,
      higherIsWorse: false,
      description: 'Stable atmospheric pressure reference',
    },
    {
      label: 'PM2.5',
      value: `${weather?.pm2_5 ?? 0} µg/m³`,
      numeric: weather?.pm2_5 ?? 0,
      safe: 15,
      unit: 'Safe: ≤ 15',
      icon: Droplets,
      higherIsWorse: true,
      description: 'Fine particulate matter',
    },
    {
      label: 'PM10',
      value: `${weather?.pm10 ?? 0} µg/m³`,
      numeric: weather?.pm10 ?? 0,
      safe: 45,
      unit: 'Safe: ≤ 45',
      icon: Droplets,
      higherIsWorse: true,
      description: 'Larger inhalable particles',
    },
    {
      label: 'O3',
      value: `${weather?.o3 ?? 0} µg/m³`,
      numeric: weather?.o3 ?? 0,
      safe: 100,
      unit: 'Safe: ≤ 100',
      icon: Cloud,
      higherIsWorse: true,
      description: 'Ground-level ozone',
    },
    {
      label: 'NO2',
      value: `${weather?.no2 ?? 0} µg/m³`,
      numeric: weather?.no2 ?? 0,
      safe: 40,
      unit: 'Safe: ≤ 40',
      icon: Cloud,
      higherIsWorse: true,
      description: 'Traffic-related pollutant',
    },
    {
      label: 'SO2',
      value: `${weather?.so2 ?? 0} µg/m³`,
      numeric: weather?.so2 ?? 0,
      safe: 20,
      unit: 'Safe: ≤ 20',
      icon: Cloud,
      higherIsWorse: true,
      description: 'Combustion-related pollutant',
    },
    {
      label: 'CO',
      value: `${weather?.co ?? 0} mg/m³`,
      numeric: weather?.co ?? 0,
      safe: 4,
      unit: 'Safe: ≤ 4',
      icon: Cloud,
      higherIsWorse: true,
      description: 'Carbon monoxide concentration',
    },
  ];

  const renderWeatherContent = () => (
    <div className="space-y-5">
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {datapoints.map((item) => {
          const isAQI = (item as any).isAQI;
          const severity = isAQI 
            ? (() => {
                const category = getAQICategory(item.numeric);
                return {
                  label: category.label,
                  className: category.color,
                  badgeClassName: category.color === 'text-success' 
                    ? 'bg-success/10 text-success border-success/20'
                    : category.color === 'text-warning'
                    ? 'bg-warning/10 text-warning border-warning/20'
                    : 'bg-destructive/10 text-destructive border-destructive/20'
                };
              })()
            : getSeverityStyle(item.numeric, item.safe, item.higherIsWorse);
          const Icon = item.icon;
          
          return (
            <div key={item.label} className={`rounded-2xl border p-5 shadow-soft ${severity.badgeClassName} transition-all duration-200`}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold uppercase tracking-wide opacity-85 mb-1">{item.label}</p>
                  <p className={`text-2xl font-bold ${severity.className}`}>{item.value}</p>
                </div>
                <div className={`rounded-xl border p-2.5 flex-shrink-0 ${severity.badgeClassName}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              {!isAQI && (
                <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-background/70">
                  <div className="h-full rounded-full bg-gradient-hero transition-all duration-300" style={{ width: getBackgroundFill(item.numeric, item.safe, item.higherIsWorse) }} />
                </div>
              )}
              <div className={`mt-3 flex items-center justify-between text-xs text-muted-foreground`}>
                <span className="font-medium">{severity.label}</span>
                <span>{item.unit}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{item.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );

  const content = () => {
    if (loading) {
      return (
        <div className="rounded-2xl border border-border/70 bg-background/70 p-4 shadow-soft">
          <div className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Weather & Air Quality</h3>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Loading weather data...</p>
        </div>
      );
    }

    if (!weather) return null;

    return (
      <div className="space-y-5 rounded-2xl border border-border/70 bg-background/70 p-4 shadow-soft">
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

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {datapoints.map((item) => {
          const isAQI = (item as any).isAQI;
          const severity = isAQI 
            ? (() => {
                const category = getAQICategory(item.numeric);
                return {
                  label: category.label,
                  className: category.color,
                  badgeClassName: category.color === 'text-success' 
                    ? 'bg-success/10 text-success border-success/20'
                    : category.color === 'text-warning'
                    ? 'bg-warning/10 text-warning border-warning/20'
                    : 'bg-destructive/10 text-destructive border-destructive/20'
                };
              })()
            : getSeverityStyle(item.numeric, item.safe, item.higherIsWorse);
          const Icon = item.icon;
          
          return (
            <div key={item.label} className={`rounded-2xl border p-5 shadow-soft ${severity.badgeClassName} transition-all duration-200`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <p className="text-sm font-semibold uppercase tracking-wide opacity-85 mb-1">{item.label}</p>
                    <p className={`text-2xl font-bold ${severity.className}`}>{item.value}</p>
                  </div>
                  <div className={`rounded-xl border p-2.5 flex-shrink-0 ${severity.badgeClassName}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                {!isAQI && (
                  <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-background/70">
                    <div className="h-full rounded-full bg-gradient-hero transition-all duration-300" style={{ width: getBackgroundFill(item.numeric, item.safe, item.higherIsWorse) }} />
                  </div>
                )}
                <div className={`mt-3 flex items-center justify-between text-xs text-muted-foreground`}>
                  <span className="font-medium">{severity.label}</span>
                  <span>{item.unit}</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{item.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    if (embedded) {
      return (
        <div className="rounded-2xl border border-border/70 bg-background/70 p-4 shadow-soft">
          <div className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Weather & Air Quality</h3>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Loading weather data...</p>
        </div>
      );
    }

    return (
      <Card className="shadow-soft border-0">
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
    return content();
  }

  return (
    <Card className="shadow-soft border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="h-5 w-5 text-primary" />
          Weather & Air Quality
        </CardTitle>
        <CardDescription>Current environmental conditions</CardDescription>
      </CardHeader>
      <CardContent>
        {content()}
      </CardContent>
    </Card>
  );
};
