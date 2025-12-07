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

// Fetch weather (temperature, pressure) and air pollution components from OpenWeatherMap
export async function fetchWeatherAndPollution(lat: number, lon: number): Promise<WeatherPollution> {
  const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY || (window as any).REACT_APP_OPENWEATHER_API_KEY;
  if (!apiKey) throw new Error('OpenWeather API key not configured (VITE_OPENWEATHER_API_KEY)');

  // Current weather
  const weatherRes = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`
  );
  if (!weatherRes.ok) throw new Error('Failed to fetch weather');
  const weatherJson = await weatherRes.json();
  const temperature = (weatherJson?.main?.temp ?? null) as number | null;
  const pressure = (weatherJson?.main?.pressure ?? null) as number | null;

  // Air pollution
  const pollRes = await fetch(
    `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`
  );
  let components = null;
  if (pollRes.ok) {
    const pollJson = await pollRes.json();
    const comps = pollJson?.list?.[0]?.components;
    if (comps) {
      // OpenWeather returns components in μg/m3
      components = {
        co: comps.co ?? null,
        no: comps.no ?? null,
        no2: comps.no2 ?? null,
        o3: comps.o3 ?? null,
        so2: comps.so2 ?? null,
        pm2_5: comps.pm2_5 ?? comps.pm2_5 ?? comps.pm2_5 ?? comps.pm2_5 ?? null,
        pm10: comps.pm10 ?? null,
        nh3: comps.nh3 ?? null,
      };
    }
  }

  return { temperature, pressure, components };
}

// Fetch pollen estimates using Open-Meteo pollen endpoint (best-effort, free)
export async function fetchPollen(lat: number, lon: number): Promise<{
  grass?: number | null;
  tree?: number | null;
  weed?: number | null;
} | null> {
  // Try with retries and exponential backoff for transient upstream errors
  // const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=grass_pollen,tree_pollen,weed_pollen&timezone=UTC`;
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=grass_pollen,tree_pollen,weed_pollen&timezone=UTC`;

  const maxAttempts = 3;
  const baseDelay = 500; // ms

  const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`fetchPollen: Open-Meteo HTTP ${res.status} (attempt ${attempt})`, url);
        // retry for 5xx, otherwise give up
        if (res.status >= 500 && attempt < maxAttempts) {
          await sleep(baseDelay * Math.pow(2, attempt - 1));
          continue;
        }
        return { grass: 0, tree: 0, weed: 0 };
      }

      const j = await res.json();

      // Open-Meteo may return an error object with `error`/`reason` — handle that gracefully
      if (j && (j.error || j.reason || j.detail)) {
        const reason = j.reason || j.detail || j.error;
        console.warn(`fetchPollen: Open-Meteo error (attempt ${attempt}):`, reason);
        if (attempt < maxAttempts) {
          await sleep(baseDelay * Math.pow(2, attempt - 1));
          continue;
        }
        return { grass: 0, tree: 0, weed: 0 };
      }

      // pick the hourly value closest to now (UTC) if available
      const hourly = j?.hourly;
      if (!hourly) return { grass: 0, tree: 0, weed: 0 };

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

      const grass = Array.isArray(hourly?.grass_pollen) ? hourly.grass_pollen[idx] ?? null : null;
      const tree = Array.isArray(hourly?.tree_pollen) ? hourly.tree_pollen[idx] ?? null : null;
      const weed = Array.isArray(hourly?.weed_pollen) ? hourly.weed_pollen[idx] ?? null : null;
      return { grass, tree, weed };
    } catch (e) {
      console.warn(`fetchPollen: unexpected error (attempt ${attempt})`, e);
      if (attempt < maxAttempts) {
        await sleep(baseDelay * Math.pow(2, attempt - 1));
        continue;
      }
      return { grass: 0, tree: 0, weed: 0 };
    }
  }
  return { grass: 0, tree: 0, weed: 0 };
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
