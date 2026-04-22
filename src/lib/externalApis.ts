import { getOpenWeatherApiKey } from '@/lib/runtimeConfig';

export type WeatherPollution = {
  temperature: number | null;
  pressure: number | null;
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

// Fetch weather (temperature, pressure) and air pollution components from OpenWeatherMap
export async function fetchWeatherAndPollution(lat: number, lon: number): Promise<WeatherPollution> {
  const cacheKey = toCacheKey(lat, lon);
  const cached = fromTtlCache(weatherCache, cacheKey, WEATHER_CACHE_TTL_MS);
  if (cached) return cached;

  const inFlight = weatherInFlight.get(cacheKey);
  if (inFlight) return inFlight;

  const apiKey = getOpenWeatherApiKey();
  if (!apiKey) throw new Error('OpenWeather API key not configured (VITE_OPENWEATHER_API_KEY)');

  const reqPromise = (async () => {
    const [weatherRes, pollRes] = await Promise.all([
      fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`),
      fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`),
    ]);

    if (!weatherRes.ok) throw new Error('Failed to fetch weather');
    const weatherJson = await weatherRes.json();
    const temperature = (weatherJson?.main?.temp ?? null) as number | null;
    const pressure = (weatherJson?.main?.pressure ?? null) as number | null;

    let components = null;
    if (pollRes.ok) {
      const pollJson = await pollRes.json();
      const comps = pollJson?.list?.[0]?.components;
      if (comps) {
        components = {
          co: comps.co ?? null,
          no: comps.no ?? null,
          no2: comps.no2 ?? null,
          o3: comps.o3 ?? null,
          so2: comps.so2 ?? null,
          pm2_5: comps.pm2_5 ?? null,
          pm10: comps.pm10 ?? null,
          nh3: comps.nh3 ?? null,
        };
      }
    }

    const value = { temperature, pressure, components };
    weatherCache.set(cacheKey, { ts: Date.now(), value });
    return value;
  })();

  weatherInFlight.set(cacheKey, reqPromise);
  try {
    return await reqPromise;
  } finally {
    weatherInFlight.delete(cacheKey);
  }
}

// Fetch pollen estimates using Open-Meteo pollen endpoint (best-effort, free)
export async function fetchPollen(lat: number, lon: number): Promise<{
  grass?: number | null;
  tree?: number | null;
  weed?: number | null;
} | null> {
  const cacheKey = toCacheKey(lat, lon);
  const cached = fromTtlCache(pollenCache, cacheKey, POLLEN_CACHE_TTL_MS);
  if (cached) return cached;

  const inFlight = pollenInFlight.get(cacheKey);
  if (inFlight) return inFlight;

  // Try with retries and exponential backoff for transient upstream errors
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=grass_pollen,tree_pollen,weed_pollen&timezone=UTC`;

  const maxAttempts = 3;
  const baseDelay = 500; // ms

  const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

  const reqPromise = (async () => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await fetch(url);
        if (!res.ok) {
          console.warn(`fetchPollen: Open-Meteo HTTP ${res.status} (attempt ${attempt})`, url);
          if (res.status >= 500 && attempt < maxAttempts) {
            await sleep(baseDelay * Math.pow(2, attempt - 1));
            continue;
          }
          const fallback = { grass: 0, tree: 0, weed: 0 };
          pollenCache.set(cacheKey, { ts: Date.now(), value: fallback });
          return fallback;
        }

        const j = await res.json();
        if (j && (j.error || j.reason || j.detail)) {
          const reason = j.reason || j.detail || j.error;
          console.warn(`fetchPollen: Open-Meteo error (attempt ${attempt}):`, reason);
          if (attempt < maxAttempts) {
            await sleep(baseDelay * Math.pow(2, attempt - 1));
            continue;
          }
          const fallback = { grass: 0, tree: 0, weed: 0 };
          pollenCache.set(cacheKey, { ts: Date.now(), value: fallback });
          return fallback;
        }

        const hourly = j?.hourly;
        if (!hourly) {
          const fallback = { grass: 0, tree: 0, weed: 0 };
          pollenCache.set(cacheKey, { ts: Date.now(), value: fallback });
          return fallback;
        }

        const times: string[] = Array.isArray(hourly.time) ? hourly.time : [];
        let idx = 0;
        if (times.length > 0) {
          const now = new Date();
          const nowTs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours());
          let best = 0;
          let bestDiff = Infinity;
          for (let i = 0; i < times.length; i++) {
            const t = times[i];
            const d = Date.parse(t);
            if (!isNaN(d)) {
              const diff = Math.abs(d - nowTs);
              if (diff < bestDiff) {
                bestDiff = diff;
                best = i;
              }
            }
          }
          idx = best;
        }

        const value = {
          grass: Array.isArray(hourly?.grass_pollen) ? hourly.grass_pollen[idx] ?? null : null,
          tree: Array.isArray(hourly?.tree_pollen) ? hourly.tree_pollen[idx] ?? null : null,
          weed: Array.isArray(hourly?.weed_pollen) ? hourly.weed_pollen[idx] ?? null : null,
        };
        pollenCache.set(cacheKey, { ts: Date.now(), value });
        return value;
      } catch (e) {
        console.warn(`fetchPollen: unexpected error (attempt ${attempt})`, e);
        if (attempt < maxAttempts) {
          await sleep(baseDelay * Math.pow(2, attempt - 1));
          continue;
        }
        const fallback = { grass: 0, tree: 0, weed: 0 };
        pollenCache.set(cacheKey, { ts: Date.now(), value: fallback });
        return fallback;
      }
    }
    const fallback = { grass: 0, tree: 0, weed: 0 };
    pollenCache.set(cacheKey, { ts: Date.now(), value: fallback });
    return fallback;
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
