import * as SecureStore from 'expo-secure-store';

/**
 * Secure persistent storage for the auth token.
 * Uses the device keychain/keystore (encrypted) — not plain AsyncStorage.
 */
const TOKEN_KEY = 'fixo_access_token';

export const saveToken = async (token: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch {
    // ignore write failures
  }
};

export const loadToken = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const clearToken = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // ignore
  }
};
