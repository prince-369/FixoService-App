import { NativeModules, TurboModuleRegistry } from 'react-native';

/**
 * Google Sign-In wrapper.
 *
 * `@react-native-google-signin/google-signin` calls
 * `TurboModuleRegistry.getEnforcing('RNGoogleSignin')` at module scope, which THROWS
 * when the native module isn't in the binary (Expo Go). A top-level import therefore
 * took down login.tsx, register.tsx and the whole router on boot.
 *
 * Wrapping `require()` in try/catch isn't enough on its own: Metro reports a failed
 * module initialisation to the global error handler, so the red box still appears even
 * though the throw is caught. The fix is to never enter that code path — probe for the
 * native module with the NON-enforcing lookups first (they return null instead of
 * throwing) and only `require()` the package when it's genuinely present.
 */

export const GOOGLE_WEB_CLIENT_ID =
  '593015456740-uc0a38sdfui55eujguskuca3p5rqe6g0.apps.googleusercontent.com';

/** Thrown when the native module isn't in this binary (i.e. running in Expo Go). */
export const GOOGLE_UNAVAILABLE = 'GOOGLE_SIGNIN_UNAVAILABLE';

type GoogleModule = typeof import('@react-native-google-signin/google-signin');

/** Non-throwing probe: TurboModuleRegistry.get (new arch) + NativeModules (old arch). */
function hasNativeModule(): boolean {
  try {
    if (TurboModuleRegistry?.get?.('RNGoogleSignin')) return true;
  } catch { /* fall through to the legacy lookup */ }
  try {
    return NativeModules?.RNGoogleSignin != null;
  } catch {
    return false;
  }
}

let mod: GoogleModule | null = null;
let loadAttempted = false;

function loadModule(): GoogleModule | null {
  if (loadAttempted) return mod;
  loadAttempted = true;
  // Probe BEFORE requiring — importing without the native module is what red-boxes.
  if (!hasNativeModule()) return (mod = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('@react-native-google-signin/google-signin') as GoogleModule;
  } catch {
    mod = null;
  }
  return mod;
}

/** True only when the native Google Sign-In module is present in this build. */
export function isGoogleSignInAvailable(): boolean {
  return loadModule() !== null;
}

let configured = false;
function ensureConfigured(m: GoogleModule) {
  if (configured) return;
  m.GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    offlineAccess: false,
  });
  configured = true;
}

/**
 * Sign in with Google natively. Returns the idToken directly.
 * Throws on cancel/error, or with GOOGLE_UNAVAILABLE outside a native build.
 */
export async function signInWithGoogle(): Promise<string> {
  const m = loadModule();
  if (!m) {
    const err: any = new Error(
      'Google Sign-In needs a development build — it is not available in Expo Go.',
    );
    err.code = GOOGLE_UNAVAILABLE;
    throw err;
  }

  ensureConfigured(m);
  await m.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  try { await m.GoogleSignin.signOut(); } catch { /* ignore */ }

  const result: any = await m.GoogleSignin.signIn();
  const idToken: string | undefined = result?.data?.idToken ?? result?.idToken;

  if (!idToken) throw new Error('No idToken returned from Google');
  return idToken;
}

/**
 * Lazy mirror of the library's `statusCodes`. Call sites compare against these, so
 * they must stay readable even when the native module never loaded — the getters
 * fall back to the library's own string constants.
 */
export const statusCodes = {
  get SIGN_IN_CANCELLED(): string {
    return loadModule()?.statusCodes?.SIGN_IN_CANCELLED ?? 'SIGN_IN_CANCELLED';
  },
  get IN_PROGRESS(): string {
    return loadModule()?.statusCodes?.IN_PROGRESS ?? 'IN_PROGRESS';
  },
  get PLAY_SERVICES_NOT_AVAILABLE(): string {
    return loadModule()?.statusCodes?.PLAY_SERVICES_NOT_AVAILABLE ?? 'PLAY_SERVICES_NOT_AVAILABLE';
  },
};
