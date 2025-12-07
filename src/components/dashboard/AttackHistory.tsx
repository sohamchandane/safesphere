import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { History, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface AttackHistoryProps {
  userId: string;
}

interface MonitoringRecord {
  id: string;
  timestamp: string;
  attack_prediction: boolean;
  ground_truth: boolean | null;
  heart_rate: number;
  prediction_confidence: number;
}

export const AttackHistory = ({ userId }: AttackHistoryProps) => {
  const [records, setRecords] = useState<MonitoringRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('monitoring_data')
          .select('*')
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
          event: 'INSERT',
          schema: 'public',
          table: 'monitoring_data',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setRecords((prev) => [payload.new as MonitoringRecord, ...prev.slice(0, 9)]);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [userId]);

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
          <div className="space-y-3">
          </div>
        )}
      </CardContent>
    </Card>
  );
};
