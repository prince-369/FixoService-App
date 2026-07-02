import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';

export const GOOGLE_WEB_CLIENT_ID =
  '593015456740-uc0a38sdfui55eujguskuca3p5rqe6g0.apps.googleusercontent.com';

let configured = false;
function ensureConfigured() {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    offlineAccess: false,
  });
  configured = true;
}

/**
 * Sign in with Google natively. Returns the idToken directly.
 * Throws on cancel/error.
 */
export async function signInWithGoogle(): Promise<string> {
  ensureConfigured();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  try { await GoogleSignin.signOut(); } catch { /* ignore */ }

  const result: any = await GoogleSignin.signIn();
  const idToken: string | undefined = result?.data?.idToken ?? result?.idToken;

  if (!idToken) throw new Error('No idToken returned from Google');
  return idToken;
}

export { statusCodes };
