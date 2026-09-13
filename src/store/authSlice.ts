import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import api, {
  getApiError,
  setAccessToken,
  refreshAccessToken,
  clearSession,
  isDefinitiveAuthFailure,
  primeDeviceId,
} from '@/lib/api';
import { saveRefreshToken, takeLegacyAccessToken } from '@/lib/storage';

export interface CustomerUser {
  _id: string;
  fullName: string;
  email?: string;
  phone: string;
  profileImage?: string;
}

export interface BlockInfo {
  isBlocked: boolean;
  reason: string;
  blockedUntil: string | null;
  remainingMs: number;
}

interface AuthState {
  user: CustomerUser | null;
  token: string | null;
  block: BlockInfo | null;
  isLoading: boolean;
  error: string | null;
  /** True once a restore has been attempted — the app gate waits on this. */
  hydrated: boolean;
  /**
   * The restore failed because the server was unreachable, NOT because the session
   * is invalid. Credentials are kept and the UI can offer a retry (§37).
   */
  restoreNetworkError: boolean;
  sessionExpiredMessage: string | null;
}

const initialState: AuthState = {
  user: null,
  token: null,
  block: null,
  isLoading: false,
  error: null,
  hydrated: false,
  restoreNetworkError: false,
  sessionExpiredMessage: null,
};

/**
 * Log an auth failure without turning an expected one into a red box.
 *
 * A 4xx here is the server doing its job — "phone already registered", "invalid
 * number", "wrong password". The screen already shows that message to the user, so
 * `console.error` (which LogBox renders as a full-screen dev error) is just noise.
 * Real faults — network down, 5xx — still go to console.error.
 */
const logAuthFailure = (tag: string, err: any): void => {
  const status: number | undefined = err?.response?.status;
  const detail = {
    message: err?.message,
    code: err?.code,
    status,
    data: err?.response?.data,
    url: err?.config?.baseURL + err?.config?.url,
  };
  const expected = typeof status === 'number' && status >= 400 && status < 500;
  if (expected) console.log(`${tag} (validation)`, JSON.stringify(detail, null, 2));
  else console.error(tag, JSON.stringify(detail, null, 2));
};

// Re-fetch /auth/me to refresh the user + block status (used by the block screen
// to auto-unblock when the penalty timer ends).
export const refreshMe = createAsyncThunk('auth/refreshMe', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/auth/me');
    return { user: res.data.user, block: res.data.block as BlockInfo | undefined };
  } catch (err) {
    return rejectWithValue(getApiError(err, 'Could not refresh'));
  }
});

export const loginCustomer = createAsyncThunk(
  'auth/login',
  async (data: { emailOrPhone: string; password: string }, { rejectWithValue }) => {
    try {
      const res = await api.post('/auth/customer/login', {
        identifier: data.emailOrPhone,
        password: data.password,
      });
      return res.data;
    } catch (err: any) {
      // If Google OAuth account needs password setup, pass the full response data
      if (err?.response?.status === 403 && err?.response?.data?.needsPassword) {
        return rejectWithValue(err.response.data);
      }
      logAuthFailure('[LOGIN ERROR]', err);
      return rejectWithValue(getApiError(err, 'Login failed'));
    }
  }
);

export const registerCustomer = createAsyncThunk(
  'auth/register',
  async (data: { fullName: string; email: string; phone: string; password: string }, { rejectWithValue }) => {
    try {
      const res = await api.post('/auth/customer/register', data);
      return res.data;
    } catch (err: any) {
      logAuthFailure('[REGISTER ERROR]', err);
      return rejectWithValue(getApiError(err, 'Registration failed'));
    }
  }
);

// Google sign-in: sends the Google id_token to the server. For a NEW user the server
// replies { needsPhone: true, googleData } instead of a token — the screen then
// collects a phone number and calls completeGoogleCustomer below.
export const googleAuthCustomer = createAsyncThunk(
  'auth/google',
  async (data: { credential: string }, { rejectWithValue }) => {
    try {
      const res = await api.post('/auth/customer/google', data);
      return res.data;
    } catch (err) {
      return rejectWithValue(getApiError(err, 'Google sign-in failed'));
    }
  }
);

// Finish a Google sign-up by attaching a phone number (creates the account).
export const completeGoogleCustomer = createAsyncThunk(
  'auth/googleComplete',
  async (
    data: { phone: string; email: string; fullName: string; googleId: string; profileImage?: string },
    { rejectWithValue },
  ) => {
    try {
      const res = await api.post('/auth/customer/google/complete', data);
      return res.data;
    } catch (err) {
      return rejectWithValue(getApiError(err, 'Could not complete sign up'));
    }
  }
);

/**
 * Restores the session when the app launches (including a cold start after the app
 * was killed).
 *
 * This is the fix for "log in again after every restart": previously the app stored
 * the ACCESS token and gave up the moment it expired, because there was no refresh
 * step at all. Now the long-lived refresh token comes out of the keychain and is
 * exchanged for a fresh access token.
 */
export const restoreSession = createAsyncThunk('auth/restore', async (_, { rejectWithValue }) => {
  await primeDeviceId();

  try {
    // One-time migration for installs upgraded from the previous version, which
    // persisted an access token instead of a refresh token. If it is still valid it
    // buys a proper rotating session; if not, the user signs in once and never again.
    const legacyAccessToken = await takeLegacyAccessToken();
    if (legacyAccessToken) {
      setAccessToken(legacyAccessToken);
      try {
        const me = await api.get('/auth/me');
        // Trade the still-valid legacy access token for a real rotating session.
        // The refresh token comes back in the body (native transport) and the api
        // client's response handling is bypassed here deliberately: a failure just
        // means the user signs in once more, never a crash.
        const upgraded = await api.post('/auth/session').catch(() => null);
        if (upgraded?.data?.refreshToken) await saveRefreshToken(upgraded.data.refreshToken);
        return {
          user: me.data.user,
          token: legacyAccessToken,
          block: me.data.block as BlockInfo | undefined,
        };
      } catch {
        setAccessToken(null);
        // Fall through to the normal refresh path.
      }
    }

    const token = await refreshAccessToken();
    const res = await api.get('/auth/me');
    return { user: res.data.user, token, block: res.data.block as BlockInfo | undefined };
  } catch (err: unknown) {
    const definitive = isDefinitiveAuthFailure(err);
    if (definitive) await clearSession();
    return rejectWithValue({
      message: definitive
        ? 'Your session has expired. Please sign in again.'
        : 'Could not reach the server. Check your connection.',
      networkError: !definitive,
    });
  }
});

/**
 * Logout revokes the AuthSession server-side, so the stored refresh token cannot
 * restore anything afterwards. Local credentials are cleared either way, so a
 * failed network call can never leave the user stuck signed in.
 */
export const logout = createAsyncThunk('auth/logout', async () => {
  try { await api.post('/auth/logout'); } catch { /* best effort */ }
  await clearSession();
});

/** Signs out every device for this account (§21). */
export const logoutAllDevices = createAsyncThunk('auth/logoutAll', async (_, { rejectWithValue }) => {
  try {
    await api.post('/auth/logout-all');
    await clearSession();
    return true;
  } catch (err: unknown) {
    return rejectWithValue(getApiError(err, 'Could not sign out other devices'));
  }
});

const handleAuthSuccess = (state: AuthState, payload: any) => {
  const token = payload.accessToken || payload.token;
  state.user = payload.user || null;
  state.token = token || null;
  state.isLoading = false;
  state.error = null;
  if (token) {
    setAccessToken(token);
  }
  // Native logins receive the refresh token in the body (no cookie jar). It is the
  // ONLY credential persisted — the access token stays in memory.
  if (payload.refreshToken) {
    void saveRefreshToken(payload.refreshToken);
  }
  state.restoreNetworkError = false;
  state.sessionExpiredMessage = null;
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => { state.error = null; },
    setUser: (state, action: PayloadAction<CustomerUser>) => { state.user = action.payload; },
    setBlock: (state, action: PayloadAction<BlockInfo | null>) => { state.block = action.payload; },
    forceLogout: (state) => {
      state.user = null;
      state.token = null;
      state.block = null;
      state.restoreNetworkError = false;
      state.sessionExpiredMessage = 'Your session has expired. Please sign in again.';
      void clearSession();
    },
    clearSessionExpired: (state) => { state.sessionExpiredMessage = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginCustomer.pending, (s) => { s.isLoading = true; s.error = null; })
      .addCase(loginCustomer.fulfilled, (s, a) => handleAuthSuccess(s, a.payload))
      .addCase(loginCustomer.rejected, (s, a) => { s.isLoading = false; const p = a.payload as any; if (!p?.needsPassword) s.error = typeof p === 'string' ? p : (p?.message || 'Login failed'); })
      .addCase(registerCustomer.pending, (s) => { s.isLoading = true; s.error = null; })
      .addCase(registerCustomer.fulfilled, (s, a) => handleAuthSuccess(s, a.payload))
      .addCase(registerCustomer.rejected, (s, a) => { s.isLoading = false; s.error = a.payload as string; })
      .addCase(googleAuthCustomer.pending, (s) => { s.isLoading = true; s.error = null; })
      .addCase(googleAuthCustomer.fulfilled, (s, a) => {
        if (a.payload?.accessToken || a.payload?.token) {
          handleAuthSuccess(s, a.payload);
        } else {
          // New Google user → server asked for a phone number. Not an error: the
          // screen reads `needsPhone` from the payload and collects the phone, then
          // calls completeGoogleCustomer.
          s.isLoading = false;
        }
      })
      .addCase(googleAuthCustomer.rejected, (s, a) => { s.isLoading = false; s.error = a.payload as string; })
      .addCase(completeGoogleCustomer.pending, (s) => { s.isLoading = true; s.error = null; })
      .addCase(completeGoogleCustomer.fulfilled, (s, a) => handleAuthSuccess(s, a.payload))
      .addCase(completeGoogleCustomer.rejected, (s, a) => { s.isLoading = false; s.error = a.payload as string; })
      .addCase(restoreSession.pending, (s) => { s.isLoading = true; s.restoreNetworkError = false; })
      .addCase(restoreSession.fulfilled, (s, a) => {
        s.user = a.payload.user;
        s.token = a.payload.token;
        s.block = a.payload.block?.isBlocked ? a.payload.block : null;
        s.isLoading = false;
        s.hydrated = true;
        s.restoreNetworkError = false;
        s.sessionExpiredMessage = null;
      })
      .addCase(restoreSession.rejected, (s, a) => {
        const payload = a.payload as { networkError?: boolean } | undefined;
        s.isLoading = false;
        s.hydrated = true;
        // On a network failure the stored refresh token is intentionally kept, so
        // the next launch (or a retry) can still restore the session.
        s.restoreNetworkError = !!payload?.networkError;
      })
      .addCase(refreshMe.fulfilled, (s, a) => {
        if (a.payload.user) s.user = a.payload.user;
        s.block = a.payload.block?.isBlocked ? a.payload.block : null;
      })
      .addCase(logout.fulfilled, (s) => {
        s.user = null; s.token = null; s.block = null; s.sessionExpiredMessage = null;
      })
      .addCase(logoutAllDevices.fulfilled, (s) => {
        s.user = null; s.token = null; s.block = null; s.sessionExpiredMessage = null;
      });
  },
});

export const { clearError, setUser, setBlock, forceLogout, clearSessionExpired } = authSlice.actions;
export default authSlice.reducer;
