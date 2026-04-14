const readEnvString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

export const getApiUrl = (): string => {
  return readEnvString(import.meta.env.VITE_PRED_API_URL) || '/api/predict';
};

export const getApiBaseUrl = (): string => {
  return getApiUrl().replace(/\/predict$/, '');
};

export const getApiKey = (): string | undefined => {
  return readEnvString(import.meta.env.VITE_PRED_API_KEY);
};

export const getOpenWeatherApiKey = (): string | undefined => {
  return readEnvString(import.meta.env.VITE_OPENWEATHER_API_KEY);
};
