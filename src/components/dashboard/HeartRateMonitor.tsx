import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Heart, Bluetooth, Activity } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface HeartRateMonitorProps {
  onHeartRateUpdate: (heartRate: number) => void;
  // Called when the streaming session is explicitly ended (returns final avg and values)
  onSessionEnd?: (finalAvg: number | null, values: number[]) => void;
}

export const HeartRateMonitor = ({ onHeartRateUpdate, onSessionEnd }: HeartRateMonitorProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [currentHeartRate, setCurrentHeartRate] = useState<number | null>(null);
  const [hrValues, setHrValues] = useState<number[]>([]);
  const [manualHeartRate, setManualHeartRate] = useState('');
  const { toast } = useToast();
  const hrCharRef = useRef<any>(null);
  const serverRef = useRef<any>(null);

  const connectSmartwatch = async () => {
    try {
      // Check if Web Bluetooth API is available
      if (!navigator.bluetooth) {
        toast({
          title: 'Bluetooth not supported',
          description: 'Your browser does not support Web Bluetooth API',
          variant: 'destructive',
        });
        return;
      }

      // Request Bluetooth device (JS-style flow similar to the provided index.html)
      const device: any = await (navigator.bluetooth as any).requestDevice({
        acceptAllDevices: true,
        optionalServices: [0x180D, 'heart_rate']
      });

      toast({
        title: 'Device selected',
        description: `Connecting to ${device.name || 'device'}...`,
      });

      const server: any = await device.gatt.connect();
      serverRef.current = server;

      // Heart Rate service and characteristic (0x180D service, 0x2A37 measurement)
      const hrService: any = await server.getPrimaryService('heart_rate');
      const hrChar: any = await hrService.getCharacteristic(0x2A37);
      hrCharRef.current = hrChar;

      hrChar.addEventListener('characteristicvaluechanged', (e: any) => {
        const value = e.target.value;
        const rate = value.getUint8(1);

        // maintain a rolling list of recent values (limit to 120 samples)
        setHrValues(prev => {
          const next = [...prev, rate].slice(-120);
          // update moving average as the displayed current heart rate
          const avg = Math.round(next.reduce((a, b) => a + b, 0) / next.length);
          setCurrentHeartRate(avg);
          onHeartRateUpdate(avg);
          return next;
        });
      });

      await hrChar.startNotifications();

      setIsConnected(true);
      toast({
        title: 'Smartwatch connected',
        description: 'Heart rate notifications started',
      });
    } catch (error: any) {
      console.error('Bluetooth connection error:', error);
      toast({
        title: 'Connection failed',
        description: error.message || 'Could not connect to smartwatch',
        variant: 'destructive',
      });
    }
  };

  const endSession = async () => {
    // stop notifications and disconnect
    const hrChar = hrCharRef.current;
    const server = serverRef.current;
    try {
      if (hrChar && hrChar.stopNotifications) await hrChar.stopNotifications();
    } catch (e) {
      // ignore
    }
    try {
      if (server && server.disconnect) server.disconnect();
    } catch (e) {
      // ignore
    }
    setIsConnected(false);

    // compute final average
    const finalAvg = hrValues.length ? Math.round(hrValues.reduce((a, b) => a + b, 0) / hrValues.length) : null;
    if (onSessionEnd) onSessionEnd(finalAvg, hrValues);
  };

  const handleManualInput = () => {
    const hr = parseInt(manualHeartRate);
    if (isNaN(hr) || hr < 40 || hr > 200) {
      toast({
        title: 'Invalid heart rate',
        description: 'Please enter a valid heart rate between 40-200 BPM',
        variant: 'destructive',
      });
      return;
    }

    setCurrentHeartRate(hr);
    setHrValues(prev => [...prev, hr].slice(-120));
    onHeartRateUpdate(hr);
    toast({
      title: 'Heart rate updated',
      description: `Heart rate set to ${hr} BPM`,
    });
  };

  // Cleanup on unmount: stop notifications and disconnect
  useEffect(() => {
    return () => {
      const hrChar = hrCharRef.current;
      const server = serverRef.current;
      if (hrChar && hrChar.stopNotifications) {
        try {
          hrChar.stopNotifications();
        } catch (e) {
          // ignore
        }
      }
      if (server && server.disconnect) {
        try {
          server.disconnect();
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  const movingAverage = (data: number[], windowSize = 5) => {
    if (!data.length) return [] as number[];
    const res: number[] = [];
    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - windowSize + 1);
      const subset = data.slice(start, i + 1);
      res.push(subset.reduce((a, b) => a + b, 0) / subset.length);
    }
    return res;
  };

  const sparklinePath = (values: number[], width = 240, height = 60) => {
    if (!values.length) return '';
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;
    return values.map((v, i) => {
      const x = (i / (values.length - 1 || 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(' ');
  };

  return (
    <Card className="shadow-soft border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-primary" />
          Heart Rate Monitoring
        </CardTitle>
        <CardDescription>Connect smartwatch or enter manually</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="smartwatch" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="smartwatch">Smartwatch</TabsTrigger>
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
          </TabsList>

          <TabsContent value="smartwatch" className="space-y-4">
            {!isConnected ? (
              <div className="text-center space-y-4 py-6">
                <div className="flex justify-center">
                  <div className="bg-primary/10 p-4 rounded-full">
                    <Bluetooth className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Connect your smartwatch to track heart rate in real-time
                </p>
                <Button onClick={connectSmartwatch} className="bg-gradient-hero">
                  Connect Smartwatch
                </Button>
              </div>
            ) : (
              <div className="text-center space-y-4 py-6">
                <div className="flex justify-center">
                  <div className="bg-success/10 p-4 rounded-full">
                    <Activity className="h-8 w-8 text-success animate-pulse" />
                  </div>
                </div>
                {currentHeartRate && (
                  <div>
                    <p className="text-5xl font-bold text-primary">{currentHeartRate}</p>
                    <p className="text-sm text-muted-foreground mt-2">BPM (Live)</p>
                  </div>
                )}
                {hrValues.length > 0 && (
                  <div className="pt-4">
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>Recent: {hrValues.slice(-10).join(', ')}</div>
                      <div>
                        Avg: {Math.round(hrValues.reduce((a, b) => a + b, 0) / hrValues.length)} bpm • Min: {Math.min(...hrValues)} • Max: {Math.max(...hrValues)}
                      </div>
                    </div>

                    <div className="mt-3 flex justify-center">
                      <svg width="240" height="60" viewBox={`0 0 240 60`}>
                        <path d={sparklinePath(hrValues.slice(-60), 240, 60)} stroke="#2563eb" strokeWidth={2} fill="none" strokeLinecap="round" />
                      </svg>
                    </div>
                  </div>
                )}
                <div className="pt-4">
                  <Button onClick={endSession} variant="destructive" className="w-full">
                    End Session & Predict
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="manual" className="space-y-4">
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="heart-rate">Heart Rate (BPM)</Label>
                <Input
                  id="heart-rate"
                  type="number"
                  placeholder="Enter your heart rate"
                  value={manualHeartRate}
                  onChange={(e) => setManualHeartRate(e.target.value)}
                  min="40"
                  max="200"
                />
              </div>
              
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <h4 className="text-sm font-semibold">How to measure manually:</h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Place two fingers on your wrist pulse</li>
                  <li>Count beats for 15 seconds</li>
                  <li>Multiply by 4 to get BPM</li>
                </ol>
              </div>

              <Button onClick={handleManualInput} className="w-full bg-gradient-hero">
                Set Heart Rate
              </Button>

              <Button
                onClick={() => {
                  const hr = parseInt(manualHeartRate);
                  if (!isNaN(hr)) {
                    const finalAvg = hr;
                    if (onSessionEnd) onSessionEnd(finalAvg, [hr]);
                    toast({ title: 'Submitted', description: `Submitted heart rate ${hr} BPM` });
                  }
                }}
                className="w-full mt-2"
              >
                Submit & Predict
              </Button>

              {currentHeartRate && (
                <div className="text-center pt-4">
                  <p className="text-3xl font-bold text-primary">{currentHeartRate}</p>
                  <p className="text-sm text-muted-foreground mt-1">Current BPM</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
