import { useEffect, useState } from 'react';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';

/**
 * Google Sign-In using the NATIVE Google SDK (@react-native-google-signin).
 *
 * Why native (not expo-auth-session):
 *  - expo-auth-session's id_token flow needs the Web client + a web redirect
 *    (auth.expo.io proxy) which is deprecated, so standalone APKs got
 *    "Access blocked / custom scheme not allowed" errors.
 *  - The native SDK authorizes the app via its Android OAuth client
 *    (package name + SHA-1 registered in Google Cloud) and returns an
 *    idToken whose audience is the WEB client — exactly what the server expects.
 *
 * Setup (already done in Google Cloud Console):
 *  - Web OAuth client  → used as webClientId below (server validates against it)
 *  - Android OAuth client → package com.fixo.service + SHA-1 from `eas credentials`
 */
export const GOOGLE_WEB_CLIENT_ID =
  '76224661304-pp7nolkvi6m7067vstpoqjpmgk2lujk3.apps.googleusercontent.com';

let configured = false;
function ensureConfigured() {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    offlineAccess: false,
  });
  configured = true;
}

type GoogleResponse =
  | { type: 'success'; params: { id_token: string } }
  | { type: 'cancel' }
  | { type: 'error'; error?: string }
  | null;

/**
 * Drop-in replacement for the old expo-auth-session hook.
 * Returns [request, response, promptGoogle] so existing screens keep working:
 *   - response.type === 'success' && response.params.id_token
 */
export function useGoogleAuth() {
  const [response, setResponse] = useState<GoogleResponse>(null);

  useEffect(() => { ensureConfigured(); }, []);

  const promptGoogle = async () => {
    try {
      ensureConfigured();
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      // Sign out first so the account picker always shows (avoids stale sessions).
      try { await GoogleSignin.signOut(); } catch { /* ignore */ }

      const result: any = await GoogleSignin.signIn();
      // Support both new ({ data: { idToken }}) and old ({ idToken }) shapes.
      const idToken: string | undefined = result?.data?.idToken ?? result?.idToken;

      if (idToken) {
        setResponse({ type: 'success', params: { id_token: idToken } });
      } else {
        setResponse({ type: 'error', error: 'No idToken returned' });
      }
    } catch (e: any) {
      if (e?.code === statusCodes.SIGN_IN_CANCELLED) {
        setResponse({ type: 'cancel' });
      } else {
        console.log('[GoogleSignin] error', e?.code, e?.message);
        setResponse({ type: 'error', error: e?.message });
      }
    }
  };

  return [{ redirectUri: '' }, response, promptGoogle] as const;
}
