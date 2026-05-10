const readEnvString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const isAbsoluteUrl = (value: string): boolean => /^https?:\/\//i.test(value);

const getAppProtocol = (): string => {
  if (typeof window === 'undefined') return 'https:';
  return window.location.protocol;
};

const enforceSecureTransport = (value: string): string => {
  if (!isAbsoluteUrl(value)) return value;

  const appProtocol = getAppProtocol();
  if (appProtocol === 'https:' && value.startsWith('http://')) {
    return value.replace(/^http:\/\//i, 'https://');
  }

  return value;
};

export const getApiUrl = (): string => {
  const configuredUrl = readEnvString(import.meta.env.VITE_PRED_API_URL) || '/api/predict';
  return enforceSecureTransport(configuredUrl);
};

export const getApiBaseUrl = (): string => {
  return getApiUrl().replace(/\/predict$/, '');
};
