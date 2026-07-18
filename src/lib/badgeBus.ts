import { useSyncExternalStore } from 'react';

// Tiny shared store for unread badge counts (notifications + support tickets).
// Screens write to it (on fetch, on read, on delete) and the home bell + profile
// tab both read from it, so a badge clears the instant the user views the items —
// no waiting for the next poll.

type Listener = () => void;

const listeners = new Set<Listener>();
let notifsUnread = 0;
let supportUnread = 0;

const emit = () => listeners.forEach((l) => l());
const subscribe = (l: Listener): (() => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};

export const badgeBus = {
  subscribe,
  getNotifs: () => notifsUnread,
  getSupport: () => supportUnread,
  setNotifs(n: number) {
    const next = Math.max(0, n);
    if (next !== notifsUnread) { notifsUnread = next; emit(); }
  },
  setSupport(n: number) {
    const next = Math.max(0, n);
    if (next !== supportUnread) { supportUnread = next; emit(); }
  },
  incNotifs() { notifsUnread += 1; emit(); },
  incSupport() { supportUnread += 1; emit(); },
};

/** Unread notification count (home bell + shared). */
export const useNotifsUnread = (): number =>
  useSyncExternalStore(badgeBus.subscribe, badgeBus.getNotifs, badgeBus.getNotifs);

/** Combined unread for the Profile tab (notifications + support). */
export const useProfileBadge = (): number => {
  const notifs = useSyncExternalStore(badgeBus.subscribe, badgeBus.getNotifs, badgeBus.getNotifs);
  const support = useSyncExternalStore(badgeBus.subscribe, badgeBus.getSupport, badgeBus.getSupport);
  return notifs + support;
};
