import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Heart, Bluetooth, Activity, Fingerprint, Watch, Calculator, HeartPulse } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from 'react-i18next';

interface HeartRateMonitorProps {
  onHeartRateUpdate: (heartRate: number) => void;
  // Called when the streaming session is explicitly ended (returns final avg and values)
  onSessionEnd?: (finalAvg: number | null, values: number[]) => void;
}

export const HeartRateMonitor = ({ onHeartRateUpdate, onSessionEnd }: HeartRateMonitorProps) => {
  const { t } = useTranslation();
  const [isConnected, setIsConnected] = useState(false);
  const [currentHeartRate, setCurrentHeartRate] = useState<number | null>(null);
  const [hrValues, setHrValues] = useState<number[]>([]);
  const [manualHeartRate, setManualHeartRate] = useState('');
  const { toast } = useToast();
  const hrCharRef = useRef<any>(null);
  const serverRef = useRef<any>(null);
  const formatHeartRate = (value: number) => value.toFixed(1);
  const normalizeHeartRate = (value: number) => Number(value.toFixed(1));

  const connectSmartwatch = async () => {
    try {
      // Check if Web Bluetooth API is available
      if (!navigator.bluetooth) {
        toast({
          title: t('heartRateMonitor.bluetoothNotSupported', { defaultValue: 'Bluetooth not supported' }),
          description: t('heartRateMonitor.bluetoothNotSupportedDesc', { defaultValue: 'Your browser does not support Web Bluetooth API' }),
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
        title: t('heartRateMonitor.deviceSelected', { defaultValue: 'Device selected' }),
        description: t('heartRateMonitor.connectingToDevice', { defaultValue: `Connecting to ${device.name || 'device'}...` }),
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
          const next = [...prev, normalizeHeartRate(rate)].slice(-120);
          // update moving average as the displayed current heart rate
          const avg = normalizeHeartRate(next.reduce((a, b) => a + b, 0) / next.length);
          setCurrentHeartRate(avg);
          onHeartRateUpdate(avg);
          return next;
        });
      });

      await hrChar.startNotifications();

      setIsConnected(true);
      toast({
        title: t('heartRateMonitor.connectedStatus'),
        description: t('heartRateMonitor.notificationsStarted', { defaultValue: 'Heart rate notifications started' }),
      });
    } catch (error: any) {
      console.error('Bluetooth connection error:', error);
      toast({
        title: t('heartRateMonitor.connectionFailed', { defaultValue: 'Connection failed' }),
        description: error.message || t('heartRateMonitor.connectionFailedDesc', { defaultValue: 'Could not connect to smartwatch' }),
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
    const finalAvg = hrValues.length ? normalizeHeartRate(hrValues.reduce((a, b) => a + b, 0) / hrValues.length) : null;
    if (onSessionEnd) onSessionEnd(finalAvg, hrValues);
  };

  const handleManualInput = () => {
    const hr = normalizeHeartRate(Number.parseFloat(manualHeartRate));
    if (isNaN(hr) || hr < 40 || hr > 200) {
      toast({
        title: t('heartRateMonitor.invalidHeartRate'),
        description: t('heartRateMonitor.invalidHeartRateDesc'),
        variant: 'destructive',
      });
      return;
    }

    setCurrentHeartRate(hr);
    setHrValues(prev => [...prev, hr].slice(-120));
    onHeartRateUpdate(hr);
    toast({
      title: t('heartRateMonitor.updatedTitle'),
      description: t('heartRateMonitor.updatedDesc', { hr }),
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

  const renderManualStepDiagram = (step: 1 | 2 | 3) => {
    if (step === 1) {
      return (
        <svg viewBox="0 0 240 130" className="h-28 w-full rounded-lg bg-gradient-to-br from-background to-primary/5">
          <defs>
            <linearGradient id="step1-gradient" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="hsl(var(--primary))" />
              <stop offset="100%" stopColor="hsl(var(--success))" />
            </linearGradient>
          </defs>
          <rect x="28" y="72" width="184" height="28" rx="14" fill="hsl(var(--muted))" opacity="0.78" />
          <rect x="58" y="40" width="22" height="60" rx="11" fill="hsl(var(--foreground))" opacity="0.16" transform="rotate(-16 58 40)" />
          <rect x="92" y="34" width="22" height="66" rx="11" fill="hsl(var(--foreground))" opacity="0.16" transform="rotate(-10 92 34)" />
          <path d="M42 86 C66 86, 86 86, 104 86 C118 86, 128 76, 138 74 C150 72, 160 78, 170 74" stroke="url(#step1-gradient)" strokeWidth="4" fill="none" strokeLinecap="round" />
          <circle cx="104" cy="86" r="7" fill="hsl(var(--primary))" />
          <circle cx="138" cy="74" r="7" fill="hsl(var(--success))" />
          <path d="M96 26 C112 18, 128 20, 140 30" stroke="hsl(var(--primary))" strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray="3 5" opacity="0.75" />
          <text x="120" y="118" textAnchor="middle" fontSize="12" fill="hsl(var(--foreground))">{t('heartRateMonitor.diagramFinger')}</text>
        </svg>
      );
    }

    if (step === 2) {
      return (
        <svg viewBox="0 0 240 130" className="h-28 w-full rounded-lg bg-gradient-to-br from-background to-success/5">
          <circle cx="120" cy="58" r="34" fill="hsl(var(--primary))" opacity="0.12" />
          <circle cx="120" cy="58" r="26" fill="none" stroke="hsl(var(--success))" strokeWidth="4" strokeDasharray="110 18" />
          <path d="M120 58 L120 40" stroke="hsl(var(--primary))" strokeWidth="4" strokeLinecap="round" />
          <path d="M120 58 L135 66" stroke="hsl(var(--warning))" strokeWidth="4" strokeLinecap="round" />
          <circle cx="120" cy="58" r="5" fill="hsl(var(--foreground))" />
          <text x="120" y="112" textAnchor="middle" fontSize="13" fill="hsl(var(--foreground))">15s</text>
        </svg>
      );
    }

    return (
      <svg viewBox="0 0 240 130" className="h-28 w-full rounded-lg bg-gradient-to-br from-background to-warning/5">
        <rect x="34" y="30" width="78" height="68" rx="14" fill="hsl(var(--background))" stroke="hsl(var(--border))" />
        <rect x="50" y="46" width="16" height="10" rx="3" fill="hsl(var(--primary))" />
        <rect x="72" y="46" width="16" height="10" rx="3" fill="hsl(var(--primary))" />
        <rect x="50" y="62" width="16" height="10" rx="3" fill="hsl(var(--muted-foreground))" opacity="0.7" />
        <rect x="72" y="62" width="16" height="10" rx="3" fill="hsl(var(--muted-foreground))" opacity="0.7" />
        <path d="M136 62 L168 62" stroke="hsl(var(--primary))" strokeWidth="5" strokeLinecap="round" />
        <path d="M168 62 L184 46" stroke="hsl(var(--success))" strokeWidth="5" strokeLinecap="round" />
        <text x="184" y="50" textAnchor="start" fontSize="20" fontWeight="700" fill="hsl(var(--primary))">x4</text>
        <text x="136" y="92" textAnchor="start" fontSize="14" fill="hsl(var(--foreground))">={t('heartRateMonitor.currentBpm')}</text>
      </svg>
    );
  };

  return (
    <Card className="shadow-soft border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-primary" />
          {t('heartRateMonitor.title')}
        </CardTitle>
        <CardDescription>{t('heartRateMonitor.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="smartwatch" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="smartwatch">{t('heartRateMonitor.smartwatchTab')}</TabsTrigger>
            <TabsTrigger value="manual">{t('heartRateMonitor.manualTab')}</TabsTrigger>
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
                  {t('heartRateMonitor.connectHint')}
                </p>
                <Button onClick={connectSmartwatch} className="bg-gradient-hero">
                  {t('heartRateMonitor.connectButton')}
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
                    <p className="text-5xl font-bold text-primary">{formatHeartRate(currentHeartRate)}</p>
                    <p className="text-sm text-muted-foreground mt-2">{t('heartRateMonitor.liveReading')}</p>
                  </div>
                )}
                {hrValues.length > 0 && (
                  <div className="pt-4">
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>{t('heartRateMonitor.recentReadings')}: {hrValues.slice(-10).map((value) => value.toFixed(1)).join(', ')}</div>
                      <div>
                        {t('heartRateMonitor.summary')}: {formatHeartRate(normalizeHeartRate(hrValues.reduce((a, b) => a + b, 0) / hrValues.length))} bpm • {t('heartRateMonitor.min')}: {formatHeartRate(Math.min(...hrValues))} • {t('heartRateMonitor.max')}: {formatHeartRate(Math.max(...hrValues))}
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
                    {t('heartRateMonitor.endSession')}
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="manual" className="space-y-4">
            <div className="space-y-4 py-4">
              <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-primary/5 p-4 shadow-soft">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/10 p-3 text-primary">
                    <HeartPulse className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-foreground">{t('heartRateMonitor.howToMeasureTitle')}</h4>
                    <p className="text-sm text-muted-foreground">{t('heartRateMonitor.howToMeasureIntro')}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-border/60 bg-card/80 p-3 shadow-sm">
                    <div className="mb-3 overflow-hidden rounded-lg border border-border/50 bg-background/80">
                      {renderManualStepDiagram(1)}
                    </div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Fingerprint className="h-4 w-4 text-primary" />
                      {t('heartRateMonitor.stepOneTitle')}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{t('heartRateMonitor.stepOneText')}</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-card/80 p-3 shadow-sm">
                    <div className="mb-3 overflow-hidden rounded-lg border border-border/50 bg-background/80">
                      {renderManualStepDiagram(2)}
                    </div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Watch className="h-4 w-4 text-primary" />
                      {t('heartRateMonitor.stepTwoTitle')}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{t('heartRateMonitor.stepTwoText')}</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-card/80 p-3 shadow-sm">
                    <div className="mb-3 overflow-hidden rounded-lg border border-border/50 bg-background/80">
                      {renderManualStepDiagram(3)}
                    </div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Calculator className="h-4 w-4 text-primary" />
                      {t('heartRateMonitor.stepThreeTitle')}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{t('heartRateMonitor.stepThreeText')}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="heart-rate">{t('heartRateMonitor.manualLabel')}</Label>
                <Input
                  id="heart-rate"
                  type="text"
                  inputMode="decimal"
                  pattern="^\d{1,3}(?:\.\d)?$"
                  placeholder={t('heartRateMonitor.manualPlaceholder')}
                  value={manualHeartRate}
                  onChange={(e) => setManualHeartRate(e.target.value)}
                />
              </div>

              <Button onClick={handleManualInput} className="w-full bg-gradient-hero">
                {t('heartRateMonitor.setButton')}
              </Button>

              <Button
                onClick={() => {
                  const hr = normalizeHeartRate(Number.parseFloat(manualHeartRate));
                  if (!isNaN(hr)) {
                    const finalAvg = hr;
                    if (onSessionEnd) onSessionEnd(finalAvg, [hr]);
                    toast({ title: t('heartRateMonitor.submittedTitle'), description: t('heartRateMonitor.submittedDesc', { hr }) });
                  }
                }}
                className="w-full mt-2"
              >
                {t('heartRateMonitor.submitButton')}
              </Button>

              {currentHeartRate && (
                <div className="text-center pt-4">
                  <p className="text-3xl font-bold text-primary">{formatHeartRate(currentHeartRate)}</p>
                  <p className="text-sm text-muted-foreground mt-1">{t('heartRateMonitor.currentBpm')}</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
