import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { History, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface AttackHistoryProps {
  userId: string;
  refreshKey?: number;
}

interface MonitoringRecord {
  id: string;
  timestamp: string;
  attack_prediction: boolean;
  ground_truth: boolean | null;
  heart_rate: number;
  prediction_confidence: number;
}

export const AttackHistory = ({ userId, refreshKey = 0 }: AttackHistoryProps) => {
  const [records, setRecords] = useState<MonitoringRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('monitoring_data')
          .select('id, timestamp, attack_prediction, ground_truth, heart_rate, prediction_confidence')
          .eq('user_id', userId)
          .order('timestamp', { ascending: false })
          .limit(10);

        if (error) throw error;

        setRecords(data || []);
      } catch (error: any) {
        console.error('History fetch error:', error);
        toast({
          title: 'Failed to load history',
          description: error.message,
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();

    // Set up realtime subscription
    const subscription = supabase
      .channel('monitoring_data_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'monitoring_data',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as MonitoringRecord;
          setRecords((prev) => {
            if (payload.eventType === 'INSERT') {
              return [row, ...prev.filter((r) => r.id !== row.id)].slice(0, 10);
            }
            if (payload.eventType === 'UPDATE') {
              return prev.map((r) => (r.id === row.id ? { ...r, ...row } : r));
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [userId, refreshKey]);

  if (loading) {
    return (
      <Card className="shadow-soft border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Attack History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading history...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-soft border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          Recent Monitoring History
        </CardTitle>
        <CardDescription>Your last 10 monitoring sessions</CardDescription>
      </CardHeader>
      <CardContent>
        {records.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No monitoring data yet</p>
            <p className="text-sm mt-1">Start monitoring to see your history</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4">Recorded At</th>
                  <th className="text-left py-2 pr-4">Predicted Attack</th>
                  <th className="text-left py-2 pr-4">Confidence</th>
                  <th className="text-left py-2">Ground Truth</th>
                </tr>
              </thead>
              <tbody>
                {records.map((rec) => (
                  <tr key={rec.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-4">{rec.timestamp ? new Date(rec.timestamp).toLocaleString() : 'N/A'}</td>
                    <td className="py-2 pr-4">{rec.attack_prediction === null ? 'N/A' : rec.attack_prediction ? 'Yes' : 'No'}</td>
                    <td className="py-2 pr-4">
                      {typeof rec.prediction_confidence === 'number'
                        ? `${Math.round(rec.prediction_confidence * 100)}%`
                        : 'N/A'}
                    </td>
                    <td className="py-2">{rec.ground_truth === null ? 'NA' : rec.ground_truth ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
