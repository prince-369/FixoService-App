/**
 * App configuration.
 *
 * USE_LOCAL_BACKEND:
 *  • true  → connects to your computer's local server over WiFi (for development).
 *            Phone and computer MUST be on the same WiFi.
 *  • false → connects to the live production server.
 *
 * LOCAL_IP: your computer's WiFi IPv4 address (find with `ipconfig` → IPv4 Address).
 *           Currently set to 192.168.1.7 — update this if your IP changes.
 */
const USE_LOCAL_BACKEND = true;

const LOCAL_IP = '192.168.1.3';
const LOCAL_PORT = 5000;

const PRODUCTION_HOST = 'https://fixo-server.onrender.com';

const LOCAL_HOST = `http://${LOCAL_IP}:${LOCAL_PORT}`;
const HOST = USE_LOCAL_BACKEND ? LOCAL_HOST : PRODUCTION_HOST;

export const API_BASE_URL = `${HOST}/api`;
export const SOCKET_URL = HOST;

// Razorpay public key (same account as the web app). Safe to ship in the client.
export const RAZORPAY_KEY = 'rzp_live_SZj0o7zTWX3XK4';

// Fixo brand palette (kept in sync with the web apps)
export const Brand = {
  navy: '#0f1c3f',
  navyLight: '#1a2d5a',
  navy50: '#eef1f8',
  orange: '#f97316',
  orangeDark: '#ea580c',
  orange50: '#fff7ed',
  amber: '#f59e0b',
  bg: '#f6f7fb',
  card: '#ffffff',
  border: '#e8eaf0',
  text: '#0f1c3f',
  textMuted: '#6b7280',
  textLight: '#9ca3af',
  success: '#10b981',
  successBg: '#ecfdf5',
  danger: '#ef4444',
  dangerBg: '#fef2f2',
  white: '#ffffff',
} as const;
