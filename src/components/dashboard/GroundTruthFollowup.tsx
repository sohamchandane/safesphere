import { useCallback, useEffect, useMemo, useState } from 'react';
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
  const [records, setRecords] = useState<MonitoringRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [answeringRecordId, setAnsweringRecordId] = useState<string | null>(null);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const fetchPending = useCallback(async (showLoader = false) => {
    try {
      if (showLoader) setLoading(true);
      let { data, error } = await supabase
        .from('monitoring_data')
        .select('id, user_id, timestamp, attack_prediction, prediction_confidence, ground_truth, reminder_sent_at, latitude, longitude')
        .eq('user_id', userId)
        .is('ground_truth', null)
        .order('timestamp', { ascending: false })
        .limit(20);

      // Backward-compatible fallback if reminder_sent_at column is not yet migrated.
      if (error && String(error.message || '').toLowerCase().includes('reminder_sent_at')) {
        const fallback = await supabase
          .from('monitoring_data')
          .select('id, user_id, timestamp, attack_prediction, prediction_confidence, ground_truth, latitude, longitude')
          .eq('user_id', userId)
          .is('ground_truth', null)
          .order('timestamp', { ascending: false })
          .limit(20);

        data = (fallback.data || []).map((row: any) => ({ ...row, reminder_sent_at: null })) as any;
        error = fallback.error;
      }

      if (error) throw error;
      setRecords((data as MonitoringRecord[]) || []);
    } catch (error: any) {
      console.error('Ground truth fetch error:', error);
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [userId]);

  const getElapsedMs = (timestamp: string | null): number => {
    if (!timestamp) return 0;
    const ts = Date.parse(timestamp);
    if (Number.isNaN(ts)) return 0;
    return nowMs - ts;
  };

  const promptEligibleRecords = useMemo(
    () => records.filter((r) => r.ground_truth === null && getElapsedMs(r.timestamp) >= PROMPT_DELAY_MINUTES * 60 * 1000),
    [records, nowMs]
  );

  const latestPendingRecord = useMemo(() => records[0] || null, [records]);
  const reminderEligible = useMemo(() => {
    if (!latestPendingRecord) return false;
    return (
      latestPendingRecord.ground_truth === null &&
      !latestPendingRecord.reminder_sent_at &&
      getElapsedMs(latestPendingRecord.timestamp) >= REMINDER_DELAY_MINUTES * 60 * 1000
    );
  }, [latestPendingRecord, nowMs]);

  useEffect(() => {
    fetchPending(true);

    // Keep pending records fresh while user stays logged in.
    const refreshId = window.setInterval(() => {
      fetchPending(false);
    }, 60_000);

    return () => window.clearInterval(refreshId);
  }, [fetchPending]);

  useEffect(() => {
    // Re-evaluate prompt/reminder timing without requiring relogin or reload.
    const tickId = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(tickId);
  }, []);

  useEffect(() => {
    const sendReminder = async () => {
      if (!latestPendingRecord || !email || reminderBusy || !reminderEligible) {
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
            record_id: latestPendingRecord.id,
            email,
            username,
            prediction_prob: latestPendingRecord.prediction_confidence || 0,
            predicted_attack: !!latestPendingRecord.attack_prediction,
            recorded_at: latestPendingRecord.timestamp,
          }),
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || `Reminder API failed (${response.status})`);
        }

        const nowIso = new Date().toISOString();
        setRecords((prev) =>
          prev.map((item) => (item.id === latestPendingRecord.id ? { ...item, reminder_sent_at: nowIso } : item))
        );
      } catch (error) {
        console.warn('Ground-truth reminder email failed', error);
      } finally {
        setReminderBusy(false);
      }
    };

    sendReminder();
  }, [email, latestPendingRecord, reminderBusy, reminderEligible, userId, username]);

  const submitAnswer = async (record: MonitoringRecord, attackTriggered: boolean) => {
    if (!record) return;

    try {
      setAnsweringRecordId(record.id);
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

      setRecords((prev) => prev.filter((item) => item.id !== record.id));
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
      setAnsweringRecordId(null);
    }
  };

  if (loading || promptEligibleRecords.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {promptEligibleRecords.map((record, index) => {
        const isAnswering = answeringRecordId === record.id;
        return (
          <Card key={record.id} className="shadow-soft border-0 border-l-4 border-l-warning">
            <CardHeader>
              <CardTitle>
                {index === 0 ? 'Validate Last Prediction' : 'Pending Follow-up'}
              </CardTitle>
              <CardDescription>
                Session at {record.timestamp ? new Date(record.timestamp).toLocaleString() : 'N/A'} with predicted attack:{' '}
                {record.attack_prediction ? 'Yes' : 'No'} ({Math.round((record.prediction_confidence || 0) * 100)}% confidence)
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button disabled={isAnswering} onClick={() => submitAnswer(record, true)}>
                Yes, attack was triggered
              </Button>
              <Button disabled={isAnswering} variant="outline" onClick={() => submitAnswer(record, false)}>
                No, attack was not triggered
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};