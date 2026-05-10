import { getApiBaseUrl } from '@/lib/runtimeConfig';

export type WeatherPollution = {
  temperature: number | null;
  pressure: number | null;
  aqi: number | null;
  components: {
    co?: number;
    no?: number;
    no2?: number;
    o3?: number;
    so2?: number;
    pm2_5?: number;
    pm10?: number;
    nh3?: number;
  } | null;
};

const WEATHER_CACHE_TTL_MS = 2 * 60 * 1000;
const POLLEN_CACHE_TTL_MS = 30 * 60 * 1000;
const PERSISTED_CACHE_PREFIX = 'external-api-cache:';

const weatherCache = new Map<string, { ts: number; value: WeatherPollution }>();
const pollenCache = new Map<string, { ts: number; value: { grass?: number | null; tree?: number | null; weed?: number | null } | null }>();
const weatherInFlight = new Map<string, Promise<WeatherPollution>>();
const pollenInFlight = new Map<string, Promise<{ grass?: number | null; tree?: number | null; weed?: number | null } | null>>();

const toCacheKey = (lat: number, lon: number) => `${lat.toFixed(3)},${lon.toFixed(3)}`;

const fromTtlCache = <T>(store: Map<string, { ts: number; value: T }>, key: string, ttlMs: number): T | null => {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > ttlMs) {
    store.delete(key);
    return null;
  }
  return hit.value;
};

const isBrowser = (): boolean => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const isOnline = (): boolean => {
  if (!isBrowser()) return true;
  return window.navigator.onLine;
};

const readPersistedCache = <T>(cacheName: string, key: string, ttlMs: number): T | null => {
  if (!isBrowser()) return null;

  try {
    const raw = window.localStorage.getItem(`${PERSISTED_CACHE_PREFIX}${cacheName}:${key}`);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { ts?: number; value?: T };
    if (!parsed || typeof parsed.ts !== 'number') return null;
    if (Date.now() - parsed.ts > ttlMs) return null;

    return parsed.value ?? null;
  } catch (error) {
    console.warn(`Failed to read ${cacheName} cache`, error);
    return null;
  }
};

const writePersistedCache = <T>(cacheName: string, key: string, value: T): void => {
  if (!isBrowser()) return;

  try {
    window.localStorage.setItem(`${PERSISTED_CACHE_PREFIX}${cacheName}:${key}`, JSON.stringify({ ts: Date.now(), value }));
  } catch (error) {
    console.warn(`Failed to persist ${cacheName} cache`, error);
  }
};

export async function fetchWeatherAndPollution(lat: number, lon: number): Promise<WeatherPollution> {
  const cacheKey = toCacheKey(lat, lon);
  const cached = fromTtlCache(weatherCache, cacheKey, WEATHER_CACHE_TTL_MS);
  if (cached) return cached;

  const persisted = readPersistedCache<WeatherPollution>('weather', cacheKey, 24 * 60 * 60 * 1000);
  if (!isOnline() && persisted) return persisted;

  const inFlight = weatherInFlight.get(cacheKey);
  if (inFlight) return inFlight;

  // Call backend proxy endpoint - backend keeps API keys secure
  const apiBaseUrl = getApiBaseUrl();
  const reqPromise = (async () => {
    const response = await fetch(`${apiBaseUrl}/weather-pollution?lat=${lat}&lon=${lon}`);
    
    if (!response.ok) {
      throw new Error(`Backend weather API failed (${response.status})`);
    }

    const value = await response.json() as WeatherPollution;
    weatherCache.set(cacheKey, { ts: Date.now(), value });
    writePersistedCache('weather', cacheKey, value);
    return value;
  })();

  weatherInFlight.set(cacheKey, reqPromise);
  try {
    return await reqPromise;
  } finally {
    weatherInFlight.delete(cacheKey);
  }
}

export async function fetchPollen(lat: number, lon: number): Promise<{
  grass?: number | null;
  tree?: number | null;
  weed?: number | null;
} | null> {
  const cacheKey = toCacheKey(lat, lon);
  const cached = fromTtlCache(pollenCache, cacheKey, POLLEN_CACHE_TTL_MS);
  if (cached) return cached;

  const persisted = readPersistedCache<{ grass?: number | null; tree?: number | null; weed?: number | null } | null>(
    'pollen',
    cacheKey,
    24 * 60 * 60 * 1000
  );
  if (!isOnline() && persisted) return persisted;

  const inFlight = pollenInFlight.get(cacheKey);
  if (inFlight) return inFlight;

  // Call backend proxy endpoint - backend keeps API keys secure
  const apiBaseUrl = getApiBaseUrl();
  const reqPromise = (async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/pollen?lat=${lat}&lon=${lon}`);
      
      if (!response.ok) {
        throw new Error(`Backend pollen API failed (${response.status})`);
      }

      const value = await response.json() as { grass?: number | null; tree?: number | null; weed?: number | null } | null;
      pollenCache.set(cacheKey, { ts: Date.now(), value: value ?? { grass: 0, tree: 0, weed: 0 } });
      writePersistedCache('pollen', cacheKey, value ?? { grass: 0, tree: 0, weed: 0 });
      return value;
    } catch (error) {
      // Return fallback on error
      const fallback = { grass: 0, tree: 0, weed: 0 };
      pollenCache.set(cacheKey, { ts: Date.now(), value: fallback });
      writePersistedCache('pollen', cacheKey, fallback);
      return fallback;
    }
  })();

  pollenInFlight.set(cacheKey, reqPromise);
  try {
    return await reqPromise;
  } finally {
    pollenInFlight.delete(cacheKey);
  }
}

// One-hot encode pollen based on provided ranges in particles/m3
export function oneHotPollen(value: number | null, type: 'grass' | 'tree' | 'weed') {
  // Ranges from the spec
  if (value === null || value === undefined) return { low: 0, moderate: 0, high: 0, very_high: 0 };

  if (type === 'grass') {
    if (value <= 29) return { low: 1, moderate: 0, high: 0, very_high: 0 };
    if (value <= 60) return { low: 0, moderate: 1, high: 0, very_high: 0 };
    if (value <= 341) return { low: 0, moderate: 0, high: 1, very_high: 0 };
    return { low: 0, moderate: 0, high: 0, very_high: 1 };
  }

  if (type === 'tree') {
    if (value <= 95) return { low: 1, moderate: 0, high: 0, very_high: 0 };
    if (value <= 207) return { low: 0, moderate: 1, high: 0, very_high: 0 };
    if (value <= 703) return { low: 0, moderate: 0, high: 1, very_high: 0 };
    return { low: 0, moderate: 0, high: 0, very_high: 1 };
  }

  // weed
  if (value <= 20) return { low: 1, moderate: 0, high: 0, very_high: 0 };
  if (value <= 77) return { low: 0, moderate: 1, high: 0, very_high: 0 };
  if (value <= 266) return { low: 0, moderate: 0, high: 1, very_high: 0 };
  return { low: 0, moderate: 0, high: 0, very_high: 1 };
}
