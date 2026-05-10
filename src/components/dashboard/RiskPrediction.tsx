import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import * as externalApis from '@/lib/externalApis';
import { getApiUrl } from '@/lib/runtimeConfig';
import { useTranslation } from 'react-i18next';

interface RiskPredictionProps {
  location: { latitude: number; longitude: number };
  heartRate: number;
  userId: string;
}

export const RiskPrediction = ({ location, heartRate, userId }: RiskPredictionProps) => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const lastRunRef = useRef<{ key: string; ts: number } | null>(null);
  const PREDICTION_CACHE_PREFIX = 'risk-prediction-cache:';
  const PREDICTION_CACHE_TTL_MS = 10 * 60 * 1000;
  const [prediction, setPrediction] = useState<{
    risk: boolean;
    confidence: number;
    riskLevel: 'low' | 'moderate' | 'high';
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const getPredictionFromCache = (cacheKey: string) => {
    try {
      const cachedData = window.localStorage.getItem(`${PREDICTION_CACHE_PREFIX}${cacheKey}`);
      if (!cachedData) return null;
      
      const cachedEntry = JSON.parse(cachedData) as { ts?: number; value?: typeof prediction };
      const isExpired = !cachedEntry?.ts || Date.now() - cachedEntry.ts > PREDICTION_CACHE_TTL_MS;
      
      return isExpired ? null : (cachedEntry.value ?? null);
    } catch (error) {
      console.warn('Failed to read cached prediction', error);
      return null;
    }
  };

  const savePredictionToCache = (cacheKey: string, predictionData: typeof prediction) => {
    try {
      const cacheEntry = { ts: Date.now(), value: predictionData };
      window.localStorage.setItem(`${PREDICTION_CACHE_PREFIX}${cacheKey}`, JSON.stringify(cacheEntry));
    } catch (error) {
      console.warn('Failed to persist cached prediction', error);
    }
  };

  useEffect(() => {
    const normalizedHeartRate = Number(heartRate.toFixed(1));
    const runKey = `${userId}:${location.latitude.toFixed(4)}:${location.longitude.toFixed(4)}:${normalizedHeartRate.toFixed(1)}`;
    const now = Date.now();

    if (lastRunRef.current && lastRunRef.current.key === runKey && now - lastRunRef.current.ts < 30_000) {
      return;
    }
    lastRunRef.current = { key: runKey, ts: now };

    const cachedPrediction = getPredictionFromCache(runKey);
    if (cachedPrediction) {
      setPrediction(cachedPrediction);
      return;
    }

    const makePrediction = async () => {
      try {
        setLoading(true);

        const [wpResult, pollenResult] = await Promise.allSettled([
          externalApis.fetchWeatherAndPollution(location.latitude, location.longitude),
          externalApis.fetchPollen(location.latitude, location.longitude),
        ]);

        if (wpResult.status === 'rejected') {
          throw new Error(`Weather fetch failed: ${wpResult.reason?.message || String(wpResult.reason)}`);
        }
        const weatherData = wpResult.value as any;

        let pollenData: { grass?: number | null; tree?: number | null; weed?: number | null } | null = null;
        if (pollenResult.status === 'fulfilled') {
          pollenData = pollenResult.value as any;
        } else {
          console.warn('Pollen fetch failed, using fallback zeros', pollenResult.reason);
          pollenData = { grass: 0, tree: 0, weed: 0 };
        }

        // One-hot encode pollen into the exact features expected by model
        const grassPollenEncoded = externalApis.oneHotPollen(pollenData?.grass ?? null, 'grass');
        const treePollenEncoded = externalApis.oneHotPollen(pollenData?.tree ?? null, 'tree');
        const weedPollenEncoded = externalApis.oneHotPollen(pollenData?.weed ?? null, 'weed');

        const hashStringToInteger = (value: string | number | undefined): number => {
          if (value === undefined || value === null) return 447;
          
          const numValue = Number(value);
          if (Number.isFinite(numValue)) return numValue;
          
          // FNV-1a hash for non-numeric strings
          const stringValue = String(value);
          let hash = 2166136261 >>> 0;
          for (let i = 0; i < stringValue.length; i++) {
            hash ^= stringValue.charCodeAt(i);
            hash = Math.imul(hash, 16777619) >>> 0;
          }
          return (hash >>> 0) % 1000000000;
        };

        const userKey = hashStringToInteger(userId ?? undefined);

        const coerceToNumber = (value: any): number => {
          if (value === null || value === undefined) return 0;
          const numValue = Number(value);
          return Number.isFinite(numValue) ? numValue : 0;
        };

        const sanitizedPayload = {
          user_key: userKey,
          temperature: coerceToNumber(weatherData.temperature),
          pressure: coerceToNumber(weatherData.pressure),
          co: coerceToNumber(weatherData.components?.co),
          no: coerceToNumber(weatherData.components?.no),
          no2: coerceToNumber(weatherData.components?.no2),
          o3: coerceToNumber(weatherData.components?.o3),
          so2: coerceToNumber(weatherData.components?.so2),
          pm2_5: coerceToNumber(weatherData.components?.pm2_5),
          pm10: coerceToNumber(weatherData.components?.pm10),
          nh3: coerceToNumber(weatherData.components?.nh3),
          heart_rate: coerceToNumber(normalizedHeartRate),
          grass_pollen_High: coerceToNumber(grassPollenEncoded.high),
          grass_pollen_Low: coerceToNumber(grassPollenEncoded.low),
          grass_pollen_Moderate: coerceToNumber(grassPollenEncoded.moderate),
          tree_pollen_High: coerceToNumber(treePollenEncoded.high),
          tree_pollen_Low: coerceToNumber(treePollenEncoded.low),
          tree_pollen_Moderate: coerceToNumber(treePollenEncoded.moderate),
          weed_pollen_High: coerceToNumber(weedPollenEncoded.high),
          weed_pollen_Low: coerceToNumber(weedPollenEncoded.low),
          weed_pollen_Moderate: coerceToNumber(weedPollenEncoded.moderate),
          weed_pollen_Very_High: coerceToNumber(weedPollenEncoded.very_high),
          latitude: location.latitude,
          longitude: location.longitude,
        };

        const apiUrl = getApiUrl();

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.access_token) {
          headers['Authorization'] = `Bearer ${sessionData.session.access_token}`;
        }

        const resp = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ 
            features: sanitizedPayload,
            email: user?.email,
            username: user?.user_metadata?.username || user?.email?.split('@')[0] || 'User',
          }),
        });

        if (!resp.ok) {
          let errText = '';
          try {
            const t = await resp.text();
            try {
              const j = JSON.parse(t);
              errText = j.detail || j.error || JSON.stringify(j);
            } catch (_) {
              errText = t;
            }
          } catch (_) {
            errText = `Status ${resp.status}`;
          }
          throw new Error(`Prediction API failed (${resp.status}): ${errText}`);
        }

        const result = await resp.json();

        const predictionResult = {
          risk: result.risk_class === 1 || (result.probability ?? 0) >= 0.5,
          confidence: typeof result.probability === 'number' ? result.probability : 0,
          riskLevel: ('risk_level' in result && result.risk_level) || 
                     ((result.probability ?? 0) >= 0.75 ? 'high' : (result.probability ?? 0) >= 0.5 ? 'moderate' : 'low') as 'low' | 'moderate' | 'high',
        };
        
        setPrediction(predictionResult);
        savePredictionToCache(runKey, predictionResult);

        try {
          const hasSupabase = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
          if (!hasSupabase) {
            console.info('Supabase not configured — skipping persistence of monitoring data');
          } else {
            const monitoringRecord = {
              user_id: userId,
              latitude: location.latitude,
              longitude: location.longitude,
              temperature: sanitizedPayload.temperature,
              pressure: sanitizedPayload.pressure,
              co: sanitizedPayload.co,
              no: sanitizedPayload.no,
              no2: sanitizedPayload.no2,
              o3: sanitizedPayload.o3,
              so2: sanitizedPayload.so2,
              pm2_5: sanitizedPayload.pm2_5,
              pm10: sanitizedPayload.pm10,
              nh3: sanitizedPayload.nh3,
              grass_pollen: null,
              tree_pollen: null,
              weed_pollen: null,
              heart_rate: sanitizedPayload.heart_rate,
              attack_prediction: predictionResult.risk,
              prediction_confidence: predictionResult.confidence,
              raw_payload: sanitizedPayload,
              raw_response: result,
            };

            const { error } = await supabase.from('monitoring_data').insert(monitoringRecord);
            if (error) {
              console.warn('Supabase insert failed, continuing without persistence', error);
            }
          }
        } catch (e) {
          console.warn('Unexpected error while saving monitoring data, continuing', e);
        }

        if (predictionResult.risk) {
          toast({
            title: t('riskPrediction.alertTitle', { defaultValue: 'Risk Alert' }),
            description: t('riskPrediction.alertDescription', {
              defaultValue: '{{riskLevel}} risk of asthma attack detected',
              riskLevel: predictionResult.riskLevel.toUpperCase(),
            }),
            variant: 'destructive',
          });
        }
      } catch (error: any) {
        console.error('Prediction error:', error);
        toast({
          title: t('riskPrediction.failedTitle', { defaultValue: 'Prediction failed' }),
          description: error.message || t('riskPrediction.failedDescription', { defaultValue: 'Could not generate risk prediction' }),
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    makePrediction();
  }, [location, heartRate, userId]);

  if (loading || !prediction) {
    return (
      <Card className="shadow-soft border-0">
        <CardHeader>
          <CardTitle>{t('riskPrediction.title', { defaultValue: 'Risk Prediction' })}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('riskPrediction.analyzing', { defaultValue: 'Analyzing data...' })}</p>
        </CardContent>
      </Card>
    );
  }

  const getRiskConfig = () => {
    switch (prediction.riskLevel) {
      case 'low':
        return {
          icon: CheckCircle,
          color: 'text-success',
          bgColor: 'bg-success/10',
          message: t('riskPrediction.low.message', { defaultValue: 'Low risk detected' }),
          description: t('riskPrediction.low.description', { defaultValue: 'Environmental conditions are favorable' }),
        };
      case 'moderate':
        return {
          icon: AlertCircle,
          color: 'text-warning',
          bgColor: 'bg-warning/10',
          message: t('riskPrediction.moderate.message', { defaultValue: 'Moderate risk detected' }),
          description: t('riskPrediction.moderate.description', { defaultValue: 'Be cautious and monitor symptoms' }),
        };
      case 'high':
        return {
          icon: AlertTriangle,
          color: 'text-destructive',
          bgColor: 'bg-destructive/10',
          message: t('riskPrediction.high.message', { defaultValue: 'High risk detected' }),
          description: t('riskPrediction.high.description', { defaultValue: 'Take precautions and have medication ready' }),
        };
    }
  };

  const config = getRiskConfig();
  const Icon = config.icon;

  return (
    <Card className={`shadow-soft border-0 ${config.bgColor}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${config.color}`} />
          {t('riskPrediction.heading', { defaultValue: 'Asthma Attack Risk Prediction' })}
        </CardTitle>
        <CardDescription>{t('riskPrediction.subheading', { defaultValue: 'Based on current environmental and health data' })}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-2xl font-bold ${config.color}`}>
              {prediction.riskLevel.toUpperCase()}
            </p>
            <p className="text-sm text-muted-foreground mt-1">{config.message}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">{Math.round(prediction.confidence * 100)}%</p>
            <p className="text-xs text-muted-foreground">{t('riskPrediction.confidence', { defaultValue: 'Confidence' })}</p>
          </div>
        </div>

        <div className="p-4 bg-card rounded-lg">
          <p className="text-sm">{config.description}</p>
        </div>

        <div className="text-xs text-muted-foreground">
          {t('riskPrediction.updatedAt', {
            defaultValue: 'Prediction updated at {{time}}',
            time: new Date().toLocaleTimeString(i18n.language),
          })}
        </div>
      </CardContent>
    </Card>
  );
};
