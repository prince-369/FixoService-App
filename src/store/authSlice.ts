import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import api, { getApiError, setAccessToken } from '@/lib/api';
import { saveToken, loadToken, clearToken } from '@/lib/storage';

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
  hydrated: boolean;
}

const initialState: AuthState = {
  user: null,
  token: null,
  block: null,
  isLoading: false,
  error: null,
  hydrated: false,
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
      console.error('[LOGIN ERROR]', JSON.stringify({
        message: err?.message,
        code: err?.code,
        status: err?.response?.status,
        data: err?.response?.data,
        url: err?.config?.baseURL + err?.config?.url,
      }, null, 2));
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
      console.error('[REGISTER ERROR]', JSON.stringify({
        message: err?.message,
        code: err?.code,
        status: err?.response?.status,
        data: err?.response?.data,
        url: err?.config?.baseURL + err?.config?.url,
      }, null, 2));
      return rejectWithValue(getApiError(err, 'Registration failed'));
    }
  }
);

// Google sign-in: sends the Google id_token to the server.
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

// On app launch: restore the saved token and validate it via /auth/me.
export const restoreSession = createAsyncThunk('auth/restore', async (_, { rejectWithValue }) => {
  const token = await loadToken();
  if (!token) return rejectWithValue('no_token');
  setAccessToken(token);
  try {
    const res = await api.get('/auth/me');
    return { user: res.data.user, token, block: res.data.block as BlockInfo | undefined };
  } catch {
    await clearToken();
    setAccessToken(null);
    return rejectWithValue('invalid_token');
  }
});

export const logout = createAsyncThunk('auth/logout', async () => {
  try { await api.post('/auth/logout'); } catch { /* ignore */ }
  setAccessToken(null);
  await clearToken();
});

const handleAuthSuccess = (state: AuthState, payload: any) => {
  const token = payload.accessToken || payload.token;
  state.user = payload.user || null;
  state.token = token || null;
  state.isLoading = false;
  state.error = null;
  if (token) {
    setAccessToken(token);
    void saveToken(token);
  }
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
      setAccessToken(null);
      void clearToken();
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginCustomer.pending, (s) => { s.isLoading = true; s.error = null; })
      .addCase(loginCustomer.fulfilled, (s, a) => handleAuthSuccess(s, a.payload))
      .addCase(loginCustomer.rejected, (s, a) => { s.isLoading = false; s.error = a.payload as string; })
      .addCase(registerCustomer.pending, (s) => { s.isLoading = true; s.error = null; })
      .addCase(registerCustomer.fulfilled, (s, a) => handleAuthSuccess(s, a.payload))
      .addCase(registerCustomer.rejected, (s, a) => { s.isLoading = false; s.error = a.payload as string; })
      .addCase(googleAuthCustomer.pending, (s) => { s.isLoading = true; s.error = null; })
      .addCase(googleAuthCustomer.fulfilled, (s, a) => {
        if (a.payload?.accessToken || a.payload?.token) {
          handleAuthSuccess(s, a.payload);
        } else {
          // New Google user needs to add a phone number (handled later) — keep on login for now.
          s.isLoading = false;
          s.error = 'Please sign up with your phone number first.';
        }
      })
      .addCase(googleAuthCustomer.rejected, (s, a) => { s.isLoading = false; s.error = a.payload as string; })
      .addCase(restoreSession.pending, (s) => { s.isLoading = true; })
      .addCase(restoreSession.fulfilled, (s, a) => {
        s.user = a.payload.user;
        s.token = a.payload.token;
        s.block = a.payload.block?.isBlocked ? a.payload.block : null;
        s.isLoading = false;
        s.hydrated = true;
      })
      .addCase(restoreSession.rejected, (s) => { s.isLoading = false; s.hydrated = true; })
      .addCase(refreshMe.fulfilled, (s, a) => {
        if (a.payload.user) s.user = a.payload.user;
        s.block = a.payload.block?.isBlocked ? a.payload.block : null;
      })
      .addCase(logout.fulfilled, (s) => { s.user = null; s.token = null; s.block = null; });
  },
});

export const { clearError, setUser, setBlock, forceLogout } = authSlice.actions;
export default authSlice.reducer;
