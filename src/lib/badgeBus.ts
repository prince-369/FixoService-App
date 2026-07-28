import { useSyncExternalStore } from 'react';

/**
 * Single source of truth for the customer app's badge counts.
 *
 * - Notifications: an authoritative integer. The server pushes `badge:notif-count`
 *   with the real unread count; we replace (never increment) so it can't drift.
 * - Support tickets: an idempotent Set of *unread ticket IDs*. The count is the Set
 *   size. IDs are added/removed on events and reconciled from the 3-minute fallback
 *   fetch, so duplicate socket events stay harmless.
 *
 * Screens read via the hooks and write via `badgeBus.*`; nothing keeps a parallel copy.
 */

type Listener = () => void;

const listeners = new Set<Listener>();
let notifsUnread = 0;
const supportIds = new Set<string>();

const emit = () => listeners.forEach((l) => l());
const subscribe = (l: Listener): (() => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};

const clampCount = (n: number): number => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

const applyTicketUnread = (id: string, unread: boolean): void => {
  if (!id) return;
  const had = supportIds.has(id);
  if (unread && !had) { supportIds.add(id); emit(); }
  else if (!unread && had) { supportIds.delete(id); emit(); }
};

export const badgeBus = {
  subscribe,
  getNotifs: () => notifsUnread,
  getSupport: () => supportIds.size,

  /** Authoritative notification count (replace, never increment). */
  setNotifs(n: number) {
    const next = clampCount(n);
    if (next !== notifsUnread) { notifsUnread = next; emit(); }
  },

  /** Add or remove one ticket from the unread Set (idempotent). */
  applyTicketUnread,
  /** Immediately drop a ticket from the unread Set (e.g. user opened it). */
  clearTicketUnread(id: string) { applyTicketUnread(id, false); },
  /** Replace the whole unread Set from a full fetch (fallback reconciliation). */
  reconcileTickets(ids: string[]) {
    const next = new Set(ids.filter(Boolean));
    const changed =
      next.size !== supportIds.size ||
      [...next].some((x) => !supportIds.has(x)) ||
      [...supportIds].some((x) => !next.has(x));
    if (changed) {
      supportIds.clear();
      next.forEach((x) => supportIds.add(x));
      emit();
    }
  },
};

/** Unread notification count (home bell + shared). */
export const useNotifsUnread = (): number =>
  useSyncExternalStore(badgeBus.subscribe, badgeBus.getNotifs, badgeBus.getNotifs);

/** Unread support-ticket count (Profile → Help & Support item). */
export const useSupportUnread = (): number =>
  useSyncExternalStore(badgeBus.subscribe, badgeBus.getSupport, badgeBus.getSupport);

/** Combined unread for the Profile tab (notifications + support). */
export const useProfileBadge = (): number => {
  const notifs = useSyncExternalStore(badgeBus.subscribe, badgeBus.getNotifs, badgeBus.getNotifs);
  const support = useSyncExternalStore(badgeBus.subscribe, badgeBus.getSupport, badgeBus.getSupport);
  return notifs + support;
};
