import { useCallback, useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface RiskMapProps {
  userId: string;
  refreshKey?: number;
}

type RawHistoryRecord = {
  id: string;
  timestamp: string | null;
  prediction_confidence: number | null;
  attack_prediction: boolean | null;
  ground_truth: boolean | null;
  latitude: number | null;
  longitude: number | null;
  heart_rate: number | null;
  temperature: number | null;
  pressure: number | null;
  co: number | null;
  no: number | null;
  no2: number | null;
  o3: number | null;
  so2: number | null;
  pm2_5: number | null;
  pm10: number | null;
  nh3: number | null;
  grass_pollen: number | null;
  tree_pollen: number | null;
  weed_pollen: number | null;
};

type RiskLevel = 'low' | 'moderate' | 'high';
type DatePreset = '7d' | '30d' | '90d' | 'custom';
type EventLayer = 'predicted' | 'confirmed' | 'both';
type TimeFilter = {
  morning: boolean;
  evening: boolean;
  night: boolean;
};

type RiskBandFilter = {
  low: boolean;
  moderate: boolean;
  high: boolean;
};

type EventPoint = {
  id: string;
  lat: number;
  lng: number;
  timestamp: string;
  probability: number;
  riskLevel: RiskLevel;
  predictedAttack: boolean;
  confirmedAttack: boolean;
  factors: {
    heartRate: number | null;
    temperature: number | null;
    pressure: number | null;
    co: number | null;
    no: number | null;
    no2: number | null;
    o3: number | null;
    so2: number | null;
    pm2_5: number | null;
    pm10: number | null;
    nh3: number | null;
    grassPollen: number | null;
    treePollen: number | null;
    weedPollen: number | null;
  };
};

type Hotspot = {
  key: string;
  centerLat: number;
  centerLng: number;
  count: number;
  confirmedCount: number;
  avgProbability: number;
  maxProbability: number;
  latestTimestamp: string;
};

const PAGE_SIZE = 500;
const INDIA_CENTER: [number, number] = [20.5937, 78.9629];

const getRiskLevel = (probability: number): RiskLevel => {
  if (probability >= 0.75) return 'high';
  if (probability >= 0.5) return 'moderate';
  return 'low';
};

const normalizeProbability = (value: number | null): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

const probabilityToColor = (probability: number): string => {
  const normalized = normalizeProbability(probability);
  const hue = 120 - normalized * 120;
  return `hsl(${hue} 85% 45%)`;
};

const parseTimestamp = (value: string): number => {
  const t = Date.parse(value);
  return Number.isNaN(t) ? 0 : t;
};

const isWithinSelectedTime = (ts: string, filter: TimeFilter): boolean => {
  const hour = new Date(ts).getHours();
  const morning = hour >= 5 && hour < 12;
  const evening = hour >= 12 && hour < 21;
  const night = hour >= 21 || hour < 5;

  return (filter.morning && morning) || (filter.evening && evening) || (filter.night && night);
};

const toLocationKey = (lat: number, lng: number): string => {
  return `${lat.toFixed(3)}:${lng.toFixed(3)}`;
};

const markerIcon = (level: RiskLevel, confirmed: boolean): L.DivIcon => {
  return L.divIcon({
    className: 'risk-marker-wrapper',
    html: `<span class="risk-marker risk-${level}${confirmed ? ' risk-confirmed' : ''}"></span>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

const markerDotIcon = (probability: number, confirmed: boolean): L.DivIcon => {
  return L.divIcon({
    className: 'risk-marker-wrapper risk-marker-dot-wrapper',
    html: `<span class="risk-marker risk-marker-dot${confirmed ? ' risk-confirmed' : ''}" style="background-color: ${probabilityToColor(probability)}"></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
};

const formatValue = (value: number | null): string => {
  return typeof value === 'number' ? String(Math.round(value * 100) / 100) : 'N/A';
};

const ZoomTracker = ({ onZoom }: { onZoom: (zoom: number) => void }) => {
  const map = useMapEvents({
    zoomend: () => onZoom(map.getZoom()),
  });

  useEffect(() => {
    onZoom(map.getZoom());
  }, [map, onZoom]);

  return null;
};

export const RiskMap = ({ userId, refreshKey = 0 }: RiskMapProps) => {
  const { toast } = useToast();
  const [records, setRecords] = useState<RawHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [zoom, setZoom] = useState(11);

  const [datePreset, setDatePreset] = useState<DatePreset>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [eventLayer, setEventLayer] = useState<EventLayer>('both');
  const [riskBands, setRiskBands] = useState<RiskBandFilter>({ low: true, moderate: true, high: true });
  const [timeFilter, setTimeFilter] = useState<TimeFilter>({ morning: true, evening: true, night: true });

  const [selectedEvent, setSelectedEvent] = useState<EventPoint | null>(null);
  const [selectedLocationKey, setSelectedLocationKey] = useState<string | null>(null);
  const [showLocationEvents, setShowLocationEvents] = useState(false);

  const fetchAllHistory = useCallback(async () => {
    setLoading(true);
    setErrorText(null);
    try {
      let from = 0;
      const acc: RawHistoryRecord[] = [];

      while (true) {
        const { data, error } = await supabase
          .from('monitoring_data')
          .select(
            'id,timestamp,prediction_confidence,attack_prediction,ground_truth,latitude,longitude,heart_rate,temperature,pressure,co,no,no2,o3,so2,pm2_5,pm10,nh3,grass_pollen,tree_pollen,weed_pollen'
          )
          .eq('user_id', userId)
          .not('latitude', 'is', null)
          .not('longitude', 'is', null)
          .order('timestamp', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;

        const batch = data || [];
        acc.push(...batch);

        if (batch.length < PAGE_SIZE) {
          break;
        }

        from += PAGE_SIZE;
      }

      setRecords(acc);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load map history';
      setErrorText(message);
      toast({
        title: 'Could not load map history',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast, userId]);

  useEffect(() => {
    fetchAllHistory();
  }, [fetchAllHistory, refreshKey]);

  const points = useMemo(() => {
    return records
      .map((rec): EventPoint | null => {
        if (typeof rec.latitude !== 'number' || typeof rec.longitude !== 'number') return null;
        if (!rec.timestamp) return null;

        const probability = normalizeProbability(rec.prediction_confidence);
        return {
          id: rec.id,
          lat: rec.latitude,
          lng: rec.longitude,
          timestamp: rec.timestamp,
          probability,
          riskLevel: getRiskLevel(probability),
          predictedAttack: Boolean(rec.attack_prediction),
          confirmedAttack: rec.ground_truth === true,
          factors: {
            heartRate: rec.heart_rate,
            temperature: rec.temperature,
            pressure: rec.pressure,
            co: rec.co,
            no: rec.no,
            no2: rec.no2,
            o3: rec.o3,
            so2: rec.so2,
            pm2_5: rec.pm2_5,
            pm10: rec.pm10,
            nh3: rec.nh3,
            grassPollen: rec.grass_pollen,
            treePollen: rec.tree_pollen,
            weedPollen: rec.weed_pollen,
          },
        };
      })
      .filter((item): item is EventPoint => item !== null);
  }, [records]);

  const filteredPoints = useMemo(() => {
    const now = Date.now();
    let startTs = 0;
    let endTs = now;

    if (datePreset === '7d') startTs = now - 7 * 24 * 60 * 60 * 1000;
    if (datePreset === '30d') startTs = now - 30 * 24 * 60 * 60 * 1000;
    if (datePreset === '90d') startTs = now - 90 * 24 * 60 * 60 * 1000;
    if (datePreset === 'custom') {
      startTs = customFrom ? Date.parse(`${customFrom}T00:00:00`) : 0;
      endTs = customTo ? Date.parse(`${customTo}T23:59:59`) : now;
    }

    return points.filter((point) => {
      const ts = parseTimestamp(point.timestamp);
      if (ts < startTs || ts > endTs) return false;

      if (!riskBands[point.riskLevel]) return false;
      if (!isWithinSelectedTime(point.timestamp, timeFilter)) return false;

      if (eventLayer === 'confirmed') {
        return point.confirmedAttack;
      }

      return true;
    });
  }, [customFrom, customTo, datePreset, eventLayer, points, riskBands, timeFilter]);

  const predictedLayer = useMemo(() => {
    if (eventLayer === 'confirmed') return [];
    return filteredPoints;
  }, [eventLayer, filteredPoints]);

  const confirmedLayer = useMemo(() => {
    if (eventLayer === 'predicted') return [];
    return filteredPoints.filter((point) => point.confirmedAttack);
  }, [eventLayer, filteredPoints]);

  const groupedByLocation = useMemo(() => {
    const map = new Map<string, EventPoint[]>();
    for (const point of filteredPoints) {
      const key = toLocationKey(point.lat, point.lng);
      const list = map.get(key) || [];
      list.push(point);
      map.set(key, list);
    }

    for (const [, list] of map) {
      list.sort((a, b) => parseTimestamp(b.timestamp) - parseTimestamp(a.timestamp));
    }

    return map;
  }, [filteredPoints]);

  const hotspotData = useMemo(() => {
    const meters = 150;
    const aggregates = new Map<string, { sumLat: number; sumLng: number; count: number; probSum: number; maxProb: number; confirmedCount: number; latestTs: string }>();

    for (const point of filteredPoints) {
      const latStep = meters / 111_320;
      const lngStep = meters / (111_320 * Math.max(Math.cos((point.lat * Math.PI) / 180), 0.2));
      const latBucket = Math.floor(point.lat / latStep);
      const lngBucket = Math.floor(point.lng / lngStep);
      const key = `${latBucket}:${lngBucket}`;

      const existing = aggregates.get(key);
      if (!existing) {
        aggregates.set(key, {
          sumLat: point.lat,
          sumLng: point.lng,
          count: 1,
          probSum: point.probability,
          maxProb: point.probability,
          confirmedCount: point.confirmedAttack ? 1 : 0,
          latestTs: point.timestamp,
        });
        continue;
      }

      existing.sumLat += point.lat;
      existing.sumLng += point.lng;
      existing.count += 1;
      existing.probSum += point.probability;
      existing.maxProb = Math.max(existing.maxProb, point.probability);
      existing.confirmedCount += point.confirmedAttack ? 1 : 0;
      if (parseTimestamp(point.timestamp) > parseTimestamp(existing.latestTs)) {
        existing.latestTs = point.timestamp;
      }
    }

    const hotspots: Hotspot[] = [];
    for (const [key, agg] of aggregates) {
      hotspots.push({
        key,
        centerLat: agg.sumLat / agg.count,
        centerLng: agg.sumLng / agg.count,
        count: agg.count,
        confirmedCount: agg.confirmedCount,
        avgProbability: agg.probSum / agg.count,
        maxProbability: agg.maxProb,
        latestTimestamp: agg.latestTs,
      });
    }

    hotspots.sort((a, b) => b.avgProbability - a.avgProbability);
    return hotspots;
  }, [filteredPoints]);

  const topRiskyZones = useMemo(() => hotspotData.slice(0, 5), [hotspotData]);

  const locationEvents = useMemo(() => {
    if (!selectedLocationKey) return [];
    return groupedByLocation.get(selectedLocationKey) || [];
  }, [groupedByLocation, selectedLocationKey]);

  const mapCenter = useMemo<[number, number]>(() => {
    if (filteredPoints.length > 0) {
      return [filteredPoints[0].lat, filteredPoints[0].lng];
    }
    return INDIA_CENTER;
  }, [filteredPoints]);

  if (loading) {
    return (
      <Card className="shadow-soft border-0">
        <CardHeader>
          <CardTitle>Risk Map</CardTitle>
          <CardDescription>Loading your map history...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="shadow-soft border-0">
      <CardHeader>
        <CardTitle>Risk Map</CardTitle>
        <CardDescription>
          View prediction history by location with separate predicted and confirmed attack layers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid lg:grid-cols-2 gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant={datePreset === '7d' ? 'default' : 'outline'} size="sm" onClick={() => setDatePreset('7d')}>7d</Button>
            <Button variant={datePreset === '30d' ? 'default' : 'outline'} size="sm" onClick={() => setDatePreset('30d')}>30d</Button>
            <Button variant={datePreset === '90d' ? 'default' : 'outline'} size="sm" onClick={() => setDatePreset('90d')}>90d</Button>
            <Button variant={datePreset === 'custom' ? 'default' : 'outline'} size="sm" onClick={() => setDatePreset('custom')}>Custom</Button>
            {datePreset === 'custom' && (
              <>
                <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-[150px]" />
                <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-[150px]" />
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Button variant={eventLayer === 'predicted' ? 'default' : 'outline'} size="sm" onClick={() => setEventLayer('predicted')}>Predicted</Button>
            <Button variant={eventLayer === 'confirmed' ? 'default' : 'outline'} size="sm" onClick={() => setEventLayer('confirmed')}>Confirmed</Button>
            <Button variant={eventLayer === 'both' ? 'default' : 'outline'} size="sm" onClick={() => setEventLayer('both')}>Both</Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant={riskBands.low ? 'default' : 'outline'} size="sm" onClick={() => setRiskBands((prev) => ({ ...prev, low: !prev.low }))}>Low</Button>
            <Button variant={riskBands.moderate ? 'default' : 'outline'} size="sm" onClick={() => setRiskBands((prev) => ({ ...prev, moderate: !prev.moderate }))}>Moderate</Button>
            <Button variant={riskBands.high ? 'default' : 'outline'} size="sm" onClick={() => setRiskBands((prev) => ({ ...prev, high: !prev.high }))}>High</Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Button variant={timeFilter.morning ? 'default' : 'outline'} size="sm" onClick={() => setTimeFilter((prev) => ({ ...prev, morning: !prev.morning }))}>Morning</Button>
            <Button variant={timeFilter.evening ? 'default' : 'outline'} size="sm" onClick={() => setTimeFilter((prev) => ({ ...prev, evening: !prev.evening }))}>Evening</Button>
            <Button variant={timeFilter.night ? 'default' : 'outline'} size="sm" onClick={() => setTimeFilter((prev) => ({ ...prev, night: !prev.night }))}>Night</Button>
          </div>
        </div>

        <div className="rounded-lg border border-border p-3 bg-muted/30 text-sm flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-2"><span className="legend-dot legend-low" /> Low</span>
          <span className="flex items-center gap-2"><span className="legend-dot legend-moderate" /> Moderate</span>
          <span className="flex items-center gap-2"><span className="legend-dot legend-high" /> High</span>
          <span className="flex items-center gap-2"><span className="legend-dot legend-confirmed" /> Confirmed attack</span>
        </div>

        {errorText && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorText}
          </div>
        )}

        {filteredPoints.length === 0 ? (
          <div className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
            No map events for current filters. Try widening date range or enabling more filter options.
          </div>
        ) : (
          <div className="grid xl:grid-cols-[2fr_1fr] gap-4">
            <div className="rounded-xl overflow-hidden border border-border">
              <MapContainer center={mapCenter} zoom={11} scrollWheelZoom className="risk-map-canvas">
                <ZoomTracker onZoom={setZoom} />
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {zoom < 10 && hotspotData.map((zone) => {
                  const level = getRiskLevel(zone.avgProbability);
                  return (
                    <Marker
                      key={`hotspot-${zone.key}`}
                      position={[zone.centerLat, zone.centerLng]}
                      icon={markerIcon(level, zone.confirmedCount > 0)}
                      eventHandlers={{
                        click: () => {
                          setSelectedEvent(null);
                          setSelectedLocationKey(null);
                          setShowLocationEvents(false);
                        },
                      }}
                    >
                      <Popup>
                        <div className="text-sm space-y-1">
                          <p><strong>Hotspot events:</strong> {zone.count}</p>
                          <p><strong>Average probability:</strong> {Math.round(zone.avgProbability * 100)}%</p>
                          <p><strong>Confirmed attacks:</strong> {zone.confirmedCount}</p>
                          <p><strong>Latest event:</strong> {new Date(zone.latestTimestamp).toLocaleString()}</p>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}

                {zoom >= 10 && zoom < 14 && (
                  <MarkerClusterGroup chunkedLoading>
                    {predictedLayer.map((point) => (
                      <Marker
                        key={`pred-${point.id}`}
                        position={[point.lat, point.lng]}
                        icon={markerIcon(point.riskLevel, point.confirmedAttack)}
                        eventHandlers={{
                          click: () => {
                            setSelectedEvent(point);
                            setSelectedLocationKey(toLocationKey(point.lat, point.lng));
                            setShowLocationEvents(false);
                          },
                        }}
                      >
                        <Popup>
                          <div className="text-sm">
                            <p><strong>Probability:</strong> {Math.round(point.probability * 100)}%</p>
                            <p><strong>Date:</strong> {new Date(point.timestamp).toLocaleString()}</p>
                            <p><strong>Confirmed:</strong> {point.confirmedAttack ? 'Yes' : 'No'}</p>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </MarkerClusterGroup>
                )}

                {zoom >= 14 && predictedLayer.map((point) => (
                  <Marker
                    key={`single-${point.id}`}
                    position={[point.lat, point.lng]}
                    icon={markerDotIcon(point.probability, point.confirmedAttack)}
                    eventHandlers={{
                      click: () => {
                        setSelectedEvent(point);
                        setSelectedLocationKey(toLocationKey(point.lat, point.lng));
                        setShowLocationEvents(false);
                      },
                    }}
                  >
                    <Popup>
                      <div className="text-sm">
                        <p><strong>Probability:</strong> {Math.round(point.probability * 100)}%</p>
                        <p><strong>Date:</strong> {new Date(point.timestamp).toLocaleString()}</p>
                        <p><strong>Predicted attack:</strong> {point.predictedAttack ? 'Yes' : 'No'}</p>
                        <p><strong>Confirmed attack:</strong> {point.confirmedAttack ? 'Yes' : 'No'}</p>
                      </div>
                    </Popup>
                  </Marker>
                ))}

                {eventLayer !== 'predicted' && confirmedLayer.map((point) => (
                  <Marker
                    key={`confirmed-${point.id}`}
                    position={[point.lat, point.lng]}
                    icon={markerIcon(point.riskLevel, true)}
                    eventHandlers={{
                      click: () => {
                        setSelectedEvent(point);
                        setSelectedLocationKey(toLocationKey(point.lat, point.lng));
                        setShowLocationEvents(false);
                      },
                    }}
                  />
                ))}
              </MapContainer>
            </div>

            <div className="space-y-4">
              <Card className="border border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Patient Insights</CardTitle>
                  <CardDescription>Top risky zones in selected filters</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {topRiskyZones.length === 0 ? (
                    <p className="text-muted-foreground">No hotspot insight available.</p>
                  ) : (
                    topRiskyZones.map((zone, index) => (
                      <div key={zone.key} className="rounded-md border border-border p-2">
                        <p className="font-medium">Zone {index + 1}</p>
                        <p>Center: {zone.centerLat.toFixed(4)}, {zone.centerLng.toFixed(4)}</p>
                        <p>Events: {zone.count}</p>
                        <p>Confirmed: {zone.confirmedCount}</p>
                        <p>Avg probability: {Math.round(zone.avgProbability * 100)}%</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="border border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Prediction Details</CardTitle>
                  <CardDescription>Click a marker to inspect event details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {!selectedEvent ? (
                    <p className="text-muted-foreground">No marker selected.</p>
                  ) : (
                    <>
                      <p><strong>Date:</strong> {new Date(selectedEvent.timestamp).toLocaleString()}</p>
                      <p><strong>Latitude:</strong> {selectedEvent.lat.toFixed(6)}</p>
                      <p><strong>Longitude:</strong> {selectedEvent.lng.toFixed(6)}</p>
                      <p><strong>Probability:</strong> {Math.round(selectedEvent.probability * 100)}%</p>
                      <p><strong>Predicted attack:</strong> {selectedEvent.predictedAttack ? 'Yes' : 'No'}</p>
                      <p><strong>Confirmed attack:</strong> {selectedEvent.confirmedAttack ? 'Yes' : 'No'}</p>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-2">
                        <span>Heart rate: {formatValue(selectedEvent.factors.heartRate)}</span>
                        <span>Temperature: {formatValue(selectedEvent.factors.temperature)}</span>
                        <span>Pressure: {formatValue(selectedEvent.factors.pressure)}</span>
                        <span>PM2.5: {formatValue(selectedEvent.factors.pm2_5)}</span>
                        <span>PM10: {formatValue(selectedEvent.factors.pm10)}</span>
                        <span>O3: {formatValue(selectedEvent.factors.o3)}</span>
                        <span>NO2: {formatValue(selectedEvent.factors.no2)}</span>
                        <span>SO2: {formatValue(selectedEvent.factors.so2)}</span>
                        <span>CO: {formatValue(selectedEvent.factors.co)}</span>
                        <span>NH3: {formatValue(selectedEvent.factors.nh3)}</span>
                        <span>Grass pollen: {formatValue(selectedEvent.factors.grassPollen)}</span>
                        <span>Tree pollen: {formatValue(selectedEvent.factors.treePollen)}</span>
                        <span>Weed pollen: {formatValue(selectedEvent.factors.weedPollen)}</span>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowLocationEvents((prev) => !prev)}
                        disabled={!selectedLocationKey}
                      >
                        Show all events at this location
                      </Button>

                      {showLocationEvents && locationEvents.length > 0 && (
                        <div className="space-y-1 border-t border-border pt-2">
                          {locationEvents.slice(0, 20).map((event) => (
                            <div key={event.id} className="rounded-md bg-muted/50 px-2 py-1">
                              <p>{new Date(event.timestamp).toLocaleString()}</p>
                              <p>Probability: {Math.round(event.probability * 100)}%, Confirmed: {event.confirmedAttack ? 'Yes' : 'No'}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
