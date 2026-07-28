import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { getSocket } from './socket';

/**
 * Centralized app-lifecycle awareness for polling control.
 *
 * ONE AppState listener for the whole app (installed at module load, re-installed
 * safely on Fast Refresh) drives a tiny external store — screens read it with
 * useAppActive() and never attach their own AppState listeners.
 *
 * Also exposes:
 *   - useForegroundSync(cb): fire `cb` once each time the app returns to foreground.
 *   - useSocketReconnectSync(cb): fire `cb` after a debounced socket reconnect.
 *   - usePollOwner(name, active): dev-only diagnostic that counts active polling loops.
 *
 * Dev diagnostics print only when __DEV__ and never include user/secret data.
 */

// ─── active/background store ───
let active = AppState.currentState === 'active';
const listeners = new Set<() => void>();
const foregroundCbs = new Set<() => void>();
let subscription: { remove: () => void } | null = null;

const diag = (msg: string) => {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(`[lifecycle] ${msg}`);
  }
};

const emit = () => listeners.forEach((l) => l());

const handleChange = (next: AppStateStatus) => {
  const nowActive = next === 'active';
  const wasActive = active;
  if (nowActive !== active) {
    active = nowActive;
    diag(`app ${nowActive ? 'ACTIVE' : 'BACKGROUND'} (${next})`);
    emit();
  }
  // background/inactive → active transition: one synchronization pass.
  if (!wasActive && nowActive) {
    diag(`foreground sync → ${foregroundCbs.size} listener(s)`);
    foregroundCbs.forEach((cb) => { try { cb(); } catch { /* isolate */ } });
  }
};

const install = () => {
  // Remove any prior subscription first so Fast Refresh / re-import can't stack listeners.
  if (subscription) subscription.remove();
  subscription = AppState.addEventListener('change', handleChange);
};
install();

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const getSnapshot = () => active;

/** True while the app is in the foreground/active state. */
export const useAppActive = (): boolean =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

/** Non-hook read (for callbacks that fire outside render). */
export const isAppActive = (): boolean => active;

/**
 * Run `cb` once every time the app comes back to the foreground. The latest `cb`
 * closure is always used, so it sees current props/state.
 */
export const useForegroundSync = (cb: () => void): void => {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    const fn = () => ref.current();
    foregroundCbs.add(fn);
    return () => { foregroundCbs.delete(fn); };
  }, []);
};

/**
 * Run `cb` after the realtime socket reconnects (debounced to collapse reconnect
 * storms into a single sync). Reuses the socket singleton — never opens a new one.
 */
export const useSocketReconnectSync = (cb: () => void, enabled = true): void => {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    if (!enabled) return;
    const socket = getSocket();
    if (!socket) return;
    let last = 0;
    const onReconnect = () => {
      const now = Date.now();
      if (now - last < 3000) return; // debounce bursty reconnects
      last = now;
      diag('socket reconnect sync');
      ref.current();
    };
    socket.io.on('reconnect', onReconnect);
    return () => { socket.io.off('reconnect', onReconnect); };
  }, [enabled]);
};

/**
 * Collapses bursty refetch triggers into a single call.
 *
 * Returns two runners that SHARE one "last ran" timestamp:
 *   - runNow(): always runs `run` immediately (use for genuine real-time events, e.g.
 *     a socket "new job" message) and stamps the timestamp.
 *   - syncNow(): runs `run` only if nothing has run within `cooldownMs` (use for
 *     lifecycle/recovery triggers — screen focus, offline→online, app foreground,
 *     socket reconnect, fallback interval). Near-simultaneous triggers collapse to one.
 *
 * The consumer's own in-flight guard (inside `run`) still prevents overlapping requests;
 * this adds a short *time* window so distinct-but-close triggers don't each fetch.
 */
export const useSyncGuard = (
  run: () => unknown,
  cooldownMs = 2500,
): { runNow: () => void; syncNow: () => void } => {
  const runRef = useRef(run);
  runRef.current = run;
  const lastRef = useRef(0);

  const runNow = useCallback(() => {
    lastRef.current = Date.now();
    runRef.current();
  }, []);

  const syncNow = useCallback(() => {
    const now = Date.now();
    if (now - lastRef.current < cooldownMs) {
      diag('sync suppressed (within cooldown)');
      return;
    }
    lastRef.current = now;
    runRef.current();
  }, [cooldownMs]);

  return { runNow, syncNow };
};

// ─── dev-only poll-owner registry (diagnostics) ───
const owners = new Map<string, number>();

/**
 * Dev diagnostic: mark a named polling loop as active while `active` is true. Logs
 * start/stop transitions and how many owners a given poll currently has — used to
 * confirm e.g. that "available-jobs" only ever has ONE active owner.
 */
export const usePollOwner = (name: string, active: boolean): void => {
  useEffect(() => {
    if (!active) return;
    const n = (owners.get(name) || 0) + 1;
    owners.set(name, n);
    diag(`poll START "${name}" — owners of ${name}: ${n}`);
    return () => {
      const left = (owners.get(name) || 1) - 1;
      if (left <= 0) owners.delete(name); else owners.set(name, left);
      diag(`poll STOP  "${name}" — owners of ${name}: ${Math.max(0, left)}`);
    };
  }, [name, active]);
};
