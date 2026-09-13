import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from './config';
import {
  loadRefreshToken,
  saveRefreshToken,
  clearRefreshToken,
  getDeviceId,
} from './storage';

/**
 * Access token: memory only, deliberately never written to disk.
 * Refresh token: device keychain (see storage.ts).
 *
 * React Native has no usable cookie jar, so this client identifies itself with
 * `X-Client-Type: native` and the server returns the refresh token in the response
 * body instead of a Set-Cookie header.
 */
let accessToken: string | null = null;
export const setAccessToken = (token: string | null) => { accessToken = token; };
export const getAccessToken = () => accessToken;

/** Cached so the header can be attached synchronously in the request interceptor. */
let deviceId: string | null = null;
export const primeDeviceId = async (): Promise<string> => {
  if (!deviceId) deviceId = await getDeviceId();
  return deviceId;
};

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'X-Client-Type': 'native' },
});

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  config.headers['X-Client-Type'] = 'native';
  if (deviceId) config.headers['X-Device-Id'] = deviceId;

  // Let axios set the multipart boundary for FormData uploads automatically.
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  } else if (!config.headers['Content-Type']) {
    config.headers['Content-Type'] = 'application/json';
  }
  return config;
});

/* ────────────────────────────────────────────────────────────────────────────
 * Session end notification
 * ────────────────────────────────────────────────────────────────────────── */
let onSessionExpired: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: (() => void) | null) => { onSessionExpired = fn; };

/**
 * "The server ended this session" vs "we couldn't reach the server".
 *
 * On mobile this distinction is the difference between a working app and one that
 * signs people out in a lift or on a train: a request with no response is a network
 * problem and must never clear the keychain (§37).
 */
export const isDefinitiveAuthFailure = (error: unknown): boolean => {
  const err = error as AxiosError | undefined;
  if (!err?.isAxiosError) return false;
  if (!err.response) return false;
  return err.response.status === 401 || err.response.status === 403;
};

/* ────────────────────────────────────────────────────────────────────────────
 * Refresh: single-flight
 * ────────────────────────────────────────────────────────────────────────── */

// One in-flight refresh shared by every waiter, so N concurrent 401s produce
// exactly one /auth/refresh call (§17).
let refreshPromise: Promise<string> | null = null;

const requestRefresh = async (): Promise<string> => {
  const stored = await loadRefreshToken();
  if (!stored) {
    // Shaped like a server rejection so callers treat "no credential" as a
    // definitive "not signed in" rather than a retryable network fault.
    throw Object.assign(new Error('No stored session'), {
      isAxiosError: true,
      response: { status: 401 },
    });
  }

  const id = await primeDeviceId();

  // Bare axios, never `api` — a refresh must not be able to re-enter the 401
  // interceptor and recurse (§18).
  const { data } = await axios.post(
    `${API_BASE_URL}/auth/refresh`,
    { refreshToken: stored },
    {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Type': 'native',
        'X-Device-Id': id,
      },
    }
  );

  if (!data?.accessToken) throw new Error('Refresh response had no access token');

  setAccessToken(data.accessToken);
  // Rotation: the server issued a NEW refresh token and retired the one just used,
  // so persisting it immediately is required — the old one is already dead.
  if (data.refreshToken) await saveRefreshToken(data.refreshToken);

  return data.accessToken as string;
};

export const refreshAccessToken = (): Promise<string> => {
  if (!refreshPromise) {
    refreshPromise = requestRefresh().finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
};

/** Clears every credential. Called only on a definitive auth failure or logout. */
export const clearSession = async (): Promise<void> => {
  setAccessToken(null);
  await clearRefreshToken();
};

const NO_REFRESH_PATHS = ['/auth/refresh', '/auth/login', '/auth/logout'];

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as RetryableConfig | undefined;

    if (!original || error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }
    if (NO_REFRESH_PATHS.some((p) => (original.url || '').includes(p))) {
      return Promise.reject(error);
    }

    original._retry = true;

    try {
      const token = await refreshAccessToken();
      original.headers.Authorization = `Bearer ${token}`;
      return await api(original);
    } catch (refreshError) {
      if (isDefinitiveAuthFailure(refreshError)) {
        await clearSession();
        onSessionExpired?.();
      }
      // Network failure: credentials survive, the request just fails. The next
      // successful call will refresh normally.
      return Promise.reject(refreshError);
    }
  }
);

export const getApiError = (error: unknown, fallback = 'Something went wrong'): string => {
  if (axios.isAxiosError(error)) {
    return (error.response?.data as { message?: string })?.message || fallback;
  }
  return fallback;
};

export default api;
