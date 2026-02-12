import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import * as externalApis from '@/lib/externalApis';

interface RiskPredictionProps {
  location: { latitude: number; longitude: number };
  heartRate: number;
  userId: string;
}

export const RiskPrediction = ({ location, heartRate, userId }: RiskPredictionProps) => {
  const { user } = useAuth();
  const [prediction, setPrediction] = useState<{
    risk: boolean;
    confidence: number;
    riskLevel: 'low' | 'moderate' | 'high';
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const makePrediction = async () => {
      try {
        setLoading(true);

        // Fetch weather and pollen in parallel. Isolate pollen failures so they
        // cannot block weather or the prediction flow.
        const [wpResult, pollenResult] = await Promise.allSettled([
          externalApis.fetchWeatherAndPollution(location.latitude, location.longitude),
          externalApis.fetchPollen(location.latitude, location.longitude),
        ]);

        if (wpResult.status === 'rejected') {
          // Weather is essential for the model — surface a clear error
          throw new Error(`Weather fetch failed: ${wpResult.reason?.message || String(wpResult.reason)}`);
        }
        const wp = wpResult.value as any;

        // pollen may fail; use fallback zeros when it does
        let pollen: { grass?: number | null; tree?: number | null; weed?: number | null } | null = null;
        if (pollenResult.status === 'fulfilled') {
          pollen = pollenResult.value as any;
        } else {
          console.warn('Pollen fetch failed, using fallback zeros', pollenResult.reason);
          pollen = { grass: 0, tree: 0, weed: 0 };
        }

        // One-hot encode pollen into the exact features expected by model
        const grassOH = externalApis.oneHotPollen(pollen?.grass ?? null, 'grass');
        const treeOH = externalApis.oneHotPollen(pollen?.tree ?? null, 'tree');
        const weedOH = externalApis.oneHotPollen(pollen?.weed ?? null, 'weed');

        // Build features payload: ensure `user_key` is numeric.
        // If the authenticated user id is numeric, use it. Otherwise compute a deterministic
        // numeric id from the UUID/string so each user maps to a stable integer.
        const toDeterministicInt = (s: string | number | undefined) => {
          if (s === undefined || s === null) return 447;
          // if already numeric string or number, use it
          const n = Number(s);
          if (Number.isFinite(n)) return n;
          const str = String(s);
          // FNV-1a 32-bit hash
          let h = 2166136261 >>> 0;
          for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 16777619) >>> 0;
          }
          // keep positive and restrict range
          return (h >>> 0) % 1000000000;
        };

        const userKeyValue = toDeterministicInt(userId ?? undefined);

        const payload: any = {
          user_key: userKeyValue,
          // may be null from upstream - sanitize below
          temperature: wp.temperature,
          pressure: wp.pressure,
          co: wp.components?.co ?? null,
          no: wp.components?.no ?? null,
          no2: wp.components?.no2 ?? null,
          o3: wp.components?.o3 ?? null,
          so2: wp.components?.so2 ?? null,
          pm2_5: wp.components?.pm2_5 ?? null,
          pm10: wp.components?.pm10 ?? null,
          nh3: wp.components?.nh3 ?? null,
          heart_rate: heartRate,
          grass_pollen_High: grassOH.high,
          grass_pollen_Low: grassOH.low,
          grass_pollen_Moderate: grassOH.moderate,
          tree_pollen_High: treeOH.high,
          tree_pollen_Low: treeOH.low,
          tree_pollen_Moderate: treeOH.moderate,
          weed_pollen_High: weedOH.high,
          weed_pollen_Low: weedOH.low,
          weed_pollen_Moderate: weedOH.moderate,
          weed_pollen_Very_High: weedOH.very_high,
        };

        // Sanitize numeric fields so the model and DB never receive nulls.
        const toNumberOrZero = (v: any) => {
          if (v === null || v === undefined) return 0;
          const n = Number(v);
          return Number.isFinite(n) ? n : 0;
        };

        const sanitizedPayload = {
          ...payload,
          temperature: toNumberOrZero(payload.temperature),
          pressure: toNumberOrZero(payload.pressure),
          co: toNumberOrZero(payload.co),
          no: toNumberOrZero(payload.no),
          no2: toNumberOrZero(payload.no2),
          o3: toNumberOrZero(payload.o3),
          so2: toNumberOrZero(payload.so2),
          pm2_5: toNumberOrZero(payload.pm2_5),
          pm10: toNumberOrZero(payload.pm10),
          nh3: toNumberOrZero(payload.nh3),
          heart_rate: toNumberOrZero(payload.heart_rate),
          grass_pollen_High: toNumberOrZero(payload.grass_pollen_High),
          grass_pollen_Low: toNumberOrZero(payload.grass_pollen_Low),
          grass_pollen_Moderate: toNumberOrZero(payload.grass_pollen_Moderate),
          tree_pollen_High: toNumberOrZero(payload.tree_pollen_High),
          tree_pollen_Low: toNumberOrZero(payload.tree_pollen_Low),
          tree_pollen_Moderate: toNumberOrZero(payload.tree_pollen_Moderate),
          weed_pollen_High: toNumberOrZero(payload.weed_pollen_High),
          weed_pollen_Low: toNumberOrZero(payload.weed_pollen_Low),
          weed_pollen_Moderate: toNumberOrZero(payload.weed_pollen_Moderate),
          weed_pollen_Very_High: toNumberOrZero(payload.weed_pollen_Very_High),
          // Add location data for display in email if needed (even if not used by model pipeline)
          latitude: location.latitude,
          longitude: location.longitude,
        };

        // Call backend prediction API (assumes /api/predict exists and uses API key)
        const apiUrl = import.meta.env.VITE_PRED_API_URL || (window as any).REACT_APP_PRED_API_URL || '/api/predict';
        const apiKey = import.meta.env.VITE_PRED_API_KEY || (window as any).REACT_APP_PRED_API_KEY;

        const resp = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { 'x-api-key': apiKey } : {}),
            // Ask the API to echo back the received payload/headers for debugging so
            // you can inspect the full packet in the browser Network panel.
            'x-echo-payload': '1',
          },
          body: JSON.stringify({ 
            features: sanitizedPayload,
            email: user?.email,
            username: user?.user_metadata?.username || user?.email?.split('@')[0] || 'User',
          }),
        });

        if (!resp.ok) {
          // try to extract a helpful error message from the response
          let errText = '';
          try {
            const t = await resp.text();
            // try parse json if possible
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

        // result is expected to be { probability: number, risk_class: 0|1 }
        const risk = result.risk_class === 1 || (result.probability ?? 0) >= 0.5;
        const confidence = typeof result.probability === 'number' ? result.probability : 0;
        const riskLevel = confidence >= 0.75 ? 'high' : confidence >= 0.5 ? 'moderate' : 'low';

        const finalPred = { risk, confidence, riskLevel } as any;
        setPrediction(finalPred);

        // Save to monitoring_data table (fail-soft)
        try {
          const hasSupabase = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
          if (!hasSupabase) {
            console.info('Supabase not configured — skipping persistence of monitoring data');
          } else {
            // Extract individual fields from sanitizedPayload to store in separate columns
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
              // Pollen: reverse-engineer from one-hot encoding (low=1 means low level, etc)
              // For simplicity, store the one-hot values; alternatively could denormalize to raw counts
              grass_pollen: null, // Could store count if available
              tree_pollen: null,
              weed_pollen: null,
              heart_rate: sanitizedPayload.heart_rate,
              attack_prediction: finalPred.risk,
              prediction_confidence: finalPred.confidence,
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

        if (finalPred.risk) {
          toast({
            title: 'Risk Alert',
            description: `${finalPred.riskLevel.toUpperCase()} risk of asthma attack detected`,
            variant: 'destructive',
          });
        }
      } catch (error: any) {
        console.error('Prediction error:', error);
        toast({
          title: 'Prediction failed',
          description: error.message || 'Could not generate risk prediction',
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
          <CardTitle>Risk Prediction</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Analyzing data...</p>
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
          message: 'Low risk detected',
          description: 'Environmental conditions are favorable',
        };
      case 'moderate':
        return {
          icon: AlertCircle,
          color: 'text-warning',
          bgColor: 'bg-warning/10',
          message: 'Moderate risk detected',
          description: 'Be cautious and monitor symptoms',
        };
      case 'high':
        return {
          icon: AlertTriangle,
          color: 'text-destructive',
          bgColor: 'bg-destructive/10',
          message: 'High risk detected',
          description: 'Take precautions and have medication ready',
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
          Asthma Attack Risk Prediction
        </CardTitle>
        <CardDescription>Based on current environmental and health data</CardDescription>
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
            <p className="text-xs text-muted-foreground">Confidence</p>
          </div>
        </div>

        <div className="p-4 bg-card rounded-lg">
          <p className="text-sm">{config.description}</p>
        </div>

        <div className="text-xs text-muted-foreground">
          Prediction updated at {new Date().toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  );
};
