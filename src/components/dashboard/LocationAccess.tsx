import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

interface LocationAccessProps {
  onLocationUpdate: (location: { latitude: number; longitude: number }) => void;
  embedded?: boolean;
  showCoordinates?: boolean;
}

export const LocationAccess = ({ onLocationUpdate, embedded = false, showCoordinates = true }: LocationAccessProps) => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const { toast } = useToast();

  const requestLocation = () => {
    setStatus('requesting');
    
    if (!navigator.geolocation) {
      toast({
        title: t('location.notSupported'),
        description: t('location.notSupportedDesc'),
        variant: 'destructive',
      });
      setStatus('denied');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setLocation(loc);
        setStatus('granted');
        onLocationUpdate(loc);
        toast({
          title: t('location.success'),
          description: t('location.successDesc'),
        });
      },
      (error) => {
        console.error('Location error:', error);
        setStatus('denied');
        toast({
          title: t('location.denied'),
          description: t('location.deniedDesc'),
          variant: 'destructive',
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  };

  useEffect(() => {
    requestLocation();
  }, []);

  const content = (
    <>
      <div className="flex items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            {t('location.title')}
          </CardTitle>
          <CardDescription>
            {t('location.description')}
          </CardDescription>
        </div>
        {status === 'granted' && (
          <CheckCircle className="h-6 w-6 text-success" />
        )}
        {status === 'denied' && (
          <AlertCircle className="h-6 w-6 text-destructive" />
        )}
      </div>

      <div className="mt-4">
        {status === 'idle' || status === 'requesting' ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">{t('location.requesting')}</p>
            <Button 
              onClick={requestLocation}
              disabled={status === 'requesting'}
              className="bg-gradient-hero"
            >
              {t('location.enable')}
            </Button>
          </div>
        ) : status === 'granted' && location ? (
          <div className="space-y-2">
            <p className="text-sm text-success">{t('location.enabled')}</p>
            {showCoordinates && (
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span>{t('dashboard.latitude')}: {location.latitude.toFixed(6)}</span>
                <span>{t('dashboard.longitude')}: {location.longitude.toFixed(6)}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-destructive">{t('location.denied')}</p>
            <Button onClick={requestLocation} variant="outline">
              {t('location.tryAgain')}
            </Button>
          </div>
        )}
      </div>
    </>
  );

  if (embedded) {
    return <div>{content}</div>;
  }

  return (
    <Card className="shadow-soft border-0">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              {t('location.title')}
            </CardTitle>
            <CardDescription>
              {t('location.description')}
            </CardDescription>
          </div>
          {status === 'granted' && (
            <CheckCircle className="h-6 w-6 text-success" />
          )}
          {status === 'denied' && (
            <AlertCircle className="h-6 w-6 text-destructive" />
          )}
        </div>
      </CardHeader>
      <CardContent>
        {content}
      </CardContent>
    </Card>
  );
};
