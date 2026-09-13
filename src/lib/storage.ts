import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

/**
 * Persistent auth credentials, held in the device keychain / Android Keystore via
 * expo-secure-store — never plain AsyncStorage.
 *
 * Only the REFRESH token is persisted. The access token is short-lived and lives in
 * memory only (see lib/api.ts): writing it to disk would add a second long-lived
 * credential to steal without buying any persistence the refresh token doesn't
 * already provide.
 */
const REFRESH_TOKEN_KEY = 'fixo_refresh_token';
const DEVICE_ID_KEY = 'fixo_device_id';

/**
 * Key used by the previous implementation, which persisted the ACCESS token and
 * treated it as the session. Read once during migration, then deleted.
 */
const LEGACY_ACCESS_TOKEN_KEY = 'fixo_access_token';

export const saveRefreshToken = async (token: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
  } catch {
    // A write failure only costs persistence across restarts, not the current
    // session — the in-memory token keeps working until the app is killed.
  }
};

export const loadRefreshToken = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
};

export const clearRefreshToken = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    // ignore
  }
};

/**
 * Reads and destroys the legacy stored access token.
 *
 * Existing installs have a long-lived access token here. It cannot become a real
 * session (the server issues refresh tokens, not access tokens, as credentials), but
 * while it is still valid it is enough to authenticate one /auth/refresh-equivalent
 * call — so it is used once to bootstrap a proper session, then removed.
 */
export const takeLegacyAccessToken = async (): Promise<string | null> => {
  try {
    const token = await SecureStore.getItemAsync(LEGACY_ACCESS_TOKEN_KEY);
    if (token) await SecureStore.deleteItemAsync(LEGACY_ACCESS_TOKEN_KEY);
    return token;
  } catch {
    return null;
  }
};

/**
 * Stable per-install identifier, so the backend can keep one AuthSession per device
 * rather than accumulating a new row on every login, and can label sessions in a
 * "your devices" list. Random and app-scoped — not a hardware identifier.
 */
export const getDeviceId = async (): Promise<string> => {
  try {
    const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (existing) return existing;

    const generated = Crypto.randomUUID();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, generated);
    return generated;
  } catch {
    // Non-persistent fallback: the session still works, it just looks like a new
    // device on each launch.
    return Crypto.randomUUID();
  }
};

/* Legacy aliases — kept so any straggling import keeps compiling. */
/** @deprecated Access tokens are no longer persisted. */
export const saveToken = saveRefreshToken;
/** @deprecated Use `loadRefreshToken`. */
export const loadToken = loadRefreshToken;
/** @deprecated Use `clearRefreshToken`. */
export const clearToken = clearRefreshToken;
