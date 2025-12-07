import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LocationAccessProps {
  onLocationUpdate: (location: { latitude: number; longitude: number }) => void;
}

export const LocationAccess = ({ onLocationUpdate }: LocationAccessProps) => {
  const [status, setStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const { toast } = useToast();

  const requestLocation = () => {
    setStatus('requesting');
    
    if (!navigator.geolocation) {
      toast({
        title: 'Location not supported',
        description: 'Your browser does not support geolocation',
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
          title: 'Location accessed',
          description: 'Successfully retrieved your location',
        });
      },
      (error) => {
        console.error('Location error:', error);
        setStatus('denied');
        toast({
          title: 'Location access denied',
          description: 'Please enable location access to use this feature',
          variant: 'destructive',
        });
      }
    );
  };

  useEffect(() => {
    // Auto-request location on mount
    requestLocation();
  }, []);

  return (
    <Card className="shadow-soft border-0">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Location Access
            </CardTitle>
            <CardDescription>
              Required to fetch weather and pollen data for your area
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
        {status === 'idle' || status === 'requesting' ? (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Requesting location access...</p>
            <Button 
              onClick={requestLocation}
              disabled={status === 'requesting'}
              className="bg-gradient-hero"
            >
              Enable Location
            </Button>
          </div>
        ) : status === 'granted' && location ? (
          <div className="space-y-2">
            <p className="text-sm text-success">Location enabled successfully</p>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>Latitude: {location.latitude.toFixed(4)}</span>
              <span>Longitude: {location.longitude.toFixed(4)}</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-destructive">Location access denied</p>
            <Button onClick={requestLocation} variant="outline">
              Try Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
