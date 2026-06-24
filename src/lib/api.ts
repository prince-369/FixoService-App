import axios from 'axios';
import { API_BASE_URL } from './config';
import { clearToken } from './storage';

// In-memory access token, attached to every request as a Bearer header.
let accessToken: string | null = null;
export const setAccessToken = (token: string | null) => { accessToken = token; };
export const getAccessToken = () => accessToken;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  // Let axios set the multipart boundary for FormData uploads automatically.
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  } else if (!config.headers['Content-Type']) {
    config.headers['Content-Type'] = 'application/json';
  }
  return config;
});

// On an unrecoverable 401 the session is cleared; the auth gate then routes to login.
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error?.response?.status === 401) {
      setAccessToken(null);
      await clearToken();
      onUnauthorized?.();
    }
    return Promise.reject(error);
  }
);

export const getApiError = (error: unknown, fallback = 'Something went wrong'): string => {
  if (axios.isAxiosError(error)) {
    return (error.response?.data as { message?: string })?.message || fallback;
  }
  return fallback;
};

export default api;
