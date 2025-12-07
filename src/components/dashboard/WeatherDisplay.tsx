import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Cloud, Wind, Droplets, Thermometer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as externalApis from '@/lib/externalApis';

interface WeatherDisplayProps {
  location: { latitude: number; longitude: number };
}

interface WeatherData {
  temperature: number;
  pressure: number;
  co: number;
  no: number;
  no2: number;
  o3: number;
  so2: number;
  pm2_5: number;
  pm10: number;
  nh3: number;
}

export const WeatherDisplay = ({ location }: WeatherDisplayProps) => {
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

  if (loading) {
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
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Thermometer className="h-4 w-4" />
              <span>Temperature</span>
            </div>
            <p className="text-2xl font-bold">{weather.temperature}°C</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wind className="h-4 w-4" />
              <span>Pressure</span>
            </div>
            <p className="text-2xl font-bold">{weather.pressure} hPa</p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <h4 className="text-sm font-semibold">Air Quality Index</h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">PM2.5:</span>
              <span className="font-medium">{weather.pm2_5} µg/m³</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">PM10:</span>
              <span className="font-medium">{weather.pm10} µg/m³</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">O3:</span>
              <span className="font-medium">{weather.o3} µg/m³</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">NO2:</span>
              <span className="font-medium">{weather.no2} µg/m³</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">SO2:</span>
              <span className="font-medium">{weather.so2} µg/m³</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">CO:</span>
              <span className="font-medium">{weather.co} mg/m³</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
