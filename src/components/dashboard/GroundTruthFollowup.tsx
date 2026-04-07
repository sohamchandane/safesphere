import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

type MonitoringRecord = {
  id: string;
  user_id: string;
  timestamp: string | null;
  attack_prediction: boolean | null;
  prediction_confidence: number | null;
  ground_truth: boolean | null;
  reminder_sent_at: string | null;
  latitude: number | null;
  longitude: number | null;
};

interface GroundTruthFollowupProps {
  userId: string;
  email: string | null;
  username: string;
  onAnswered?: () => void;
}

const parseMinutesEnv = (value: string | undefined, fallbackMinutes: number): number => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    return fallbackMinutes;
  }
  return n;
};

const PROMPT_DELAY_MINUTES = parseMinutesEnv(import.meta.env.VITE_GROUND_TRUTH_PROMPT_DELAY_MINUTES, 10);
const REMINDER_DELAY_MINUTES = parseMinutesEnv(import.meta.env.VITE_GROUND_TRUTH_REMINDER_DELAY_MINUTES, 20);

const getApiBaseUrl = (): string => {
  const apiUrl = import.meta.env.VITE_PRED_API_URL || (window as any).REACT_APP_PRED_API_URL || '/api/predict';
  return apiUrl.replace(/\/predict$/, '');
};

const getApiKey = (): string | undefined => {
  return import.meta.env.VITE_PRED_API_KEY || (window as any).REACT_APP_PRED_API_KEY;
};

const getCurrentLocation = async (): Promise<{ latitude: number; longitude: number } | null> => {
  if (!navigator.geolocation) {
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      },
      () => {
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
};

export const GroundTruthFollowup = ({ userId, email, username, onAnswered }: GroundTruthFollowupProps) => {
  const { toast } = useToast();
  const [record, setRecord] = useState<MonitoringRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [answering, setAnswering] = useState(false);
  const [reminderBusy, setReminderBusy] = useState(false);

  const elapsedMs = useMemo(() => {
    if (!record?.timestamp) return 0;
    const ts = Date.parse(record.timestamp);
    if (Number.isNaN(ts)) return 0;
    return Date.now() - ts;
  }, [record?.timestamp]);

  const promptEligible = !!record && record.ground_truth === null && elapsedMs >= PROMPT_DELAY_MINUTES * 60 * 1000;
  const reminderEligible =
    !!record &&
    record.ground_truth === null &&
    !record.reminder_sent_at &&
    elapsedMs >= REMINDER_DELAY_MINUTES * 60 * 1000;

  useEffect(() => {
    const fetchLatest = async () => {
      try {
        setLoading(true);
        let { data, error } = await supabase
          .from('monitoring_data')
          .select('id, user_id, timestamp, attack_prediction, prediction_confidence, ground_truth, reminder_sent_at, latitude, longitude')
          .eq('user_id', userId)
          .order('timestamp', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Backward-compatible fallback if reminder_sent_at column is not yet migrated.
        if (error && String(error.message || '').toLowerCase().includes('reminder_sent_at')) {
          const fallback = await supabase
            .from('monitoring_data')
            .select('id, user_id, timestamp, attack_prediction, prediction_confidence, ground_truth, latitude, longitude')
            .eq('user_id', userId)
            .order('timestamp', { ascending: false })
            .limit(1)
            .maybeSingle();

          data = fallback.data
            ? ({ ...fallback.data, reminder_sent_at: null } as any)
            : null;
          error = fallback.error;
        }

        if (error) throw error;
        setRecord((data as MonitoringRecord) || null);
      } catch (error: any) {
        console.error('Ground truth fetch error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLatest();
  }, [userId]);

  useEffect(() => {
    const sendReminder = async () => {
      if (!record || !email || reminderBusy || !reminderEligible) {
        return;
      }

      try {
        setReminderBusy(true);
        const apiKey = getApiKey();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (apiKey) {
          headers['x-api-key'] = apiKey;
        }

        const response = await fetch(`${getApiBaseUrl()}/ground-truth/reminder`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            user_id: userId,
            record_id: record.id,
            email,
            username,
            prediction_prob: record.prediction_confidence || 0,
            predicted_attack: !!record.attack_prediction,
            recorded_at: record.timestamp,
          }),
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || `Reminder API failed (${response.status})`);
        }

        const nowIso = new Date().toISOString();
        setRecord((prev) => (prev ? { ...prev, reminder_sent_at: nowIso } : prev));
      } catch (error) {
        console.warn('Ground-truth reminder email failed', error);
      } finally {
        setReminderBusy(false);
      }
    };

    sendReminder();
  }, [email, reminderBusy, reminderEligible, record, userId, username]);

  const submitAnswer = async (attackTriggered: boolean) => {
    if (!record) return;

    try {
      setAnswering(true);
      const location = await getCurrentLocation();
      const updatePayload: Record<string, any> = {
        ground_truth: attackTriggered,
        ground_truth_updated_at: new Date().toISOString(),
      };

      if (location) {
        updatePayload.latitude = location.latitude;
        updatePayload.longitude = location.longitude;
      }

      const { error } = await supabase
        .from('monitoring_data')
        .update(updatePayload)
        .eq('id', record.id)
        .eq('user_id', userId)
        .is('ground_truth', null);

      if (error) throw error;

      setRecord((prev) => (prev ? { ...prev, ground_truth: attackTriggered } : prev));
      toast({
        title: 'Thanks for the feedback',
        description: 'Your latest prediction has been validated.',
      });
      onAnswered?.();
    } catch (error: any) {
      toast({
        title: 'Could not save your feedback',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setAnswering(false);
    }
  };

  if (loading || !record || record.ground_truth !== null || !promptEligible) {
    return null;
  }

  return (
    <Card className="shadow-soft border-0 border-l-4 border-l-warning">
      <CardHeader>
        <CardTitle>Validate Last Prediction</CardTitle>
        <CardDescription>
          Last session at {record.timestamp ? new Date(record.timestamp).toLocaleString() : 'N/A'} with predicted attack:{' '}
          {record.attack_prediction ? 'Yes' : 'No'} ({Math.round((record.prediction_confidence || 0) * 100)}% confidence)
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Button disabled={answering} onClick={() => submitAnswer(true)}>
          Yes, attack was triggered
        </Button>
        <Button disabled={answering} variant="outline" onClick={() => submitAnswer(false)}>
          No, attack was not triggered
        </Button>
      </CardContent>
    </Card>
  );
};