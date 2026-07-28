import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Per-ticket "last seen" tracking for the support badge.
 *
 * We store, per ticket, the epoch-ms timestamp of the newest message the user has seen.
 * A ticket is "unread" only when its latest ADMIN/BOT message is NEWER than that marker.
 * This distinguishes an old admin reply the user already opened from a genuinely newer
 * one — including replies that arrived while the app was closed (fixed on the next
 * reconcile) — which a plain "seen this ticket" boolean could not.
 *
 * Purely local (AsyncStorage); no server schema. Migrates the old boolean-set format
 * once by treating those tickets as seen up to migration time.
 */

const KEY = 'fixo_ticket_seen_v2';       // { [ticketId]: lastSeenMessageEpochMs }
const LEGACY_KEY = 'fixo_seen_tickets';  // old format: string[] of "seen" ticket ids

let cache: Map<string, number> | null = null;

export interface TicketLike {
  _id: string;
  status: string;
  chatHistory?: { sender: string; timestamp?: string | Date }[];
}

/** Epoch-ms of the latest admin/bot message, or 0 when there is none / last is the user's. */
export const lastAdminMsgTs = (t: TicketLike): number => {
  const last = t.chatHistory?.[t.chatHistory.length - 1];
  if (!last || last.sender === 'user') return 0;
  const ts = last.timestamp ? new Date(last.timestamp).getTime() : 0;
  return Number.isFinite(ts) ? ts : 0;
};

const persist = async (map: Map<string, number>): Promise<void> => {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(Object.fromEntries(map)));
  } catch { /* non-fatal: badge self-heals on next reconcile */ }
};

export const getTicketSeenMap = async (): Promise<Map<string, number>> => {
  if (cache) return cache;
  const map = new Map<string, number>();
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const obj = JSON.parse(raw) as Record<string, unknown>;
      for (const [id, ts] of Object.entries(obj)) {
        const n = Number(ts);
        if (id && Number.isFinite(n)) map.set(id, n);
      }
    } else {
      // One-time migration: old boolean-set → mark those tickets seen up to now.
      const legacy = await AsyncStorage.getItem(LEGACY_KEY);
      if (legacy) {
        const now = Date.now();
        (JSON.parse(legacy) as string[]).forEach((id) => { if (id) map.set(id, now); });
        await persist(map);
      }
    }
  } catch { /* start empty */ }
  cache = map;
  return map;
};

/**
 * Synchronous read of the currently-cached seen map (empty until first loaded). Lets
 * event handlers read markers without an await, so a "mark seen" and a concurrent
 * "is unread?" settle within the same tick instead of racing across microtasks.
 */
export const peekTicketSeenMap = (): Map<string, number> => cache ?? new Map();

/**
 * Mark a ticket seen up to `msgTs` (defaults to now, which covers every current message).
 * Only ever advances the marker forward. When the map is already cached the in-memory
 * update is synchronous (persist is fire-and-forget).
 */
export const markTicketSeen = async (ticketId: string, msgTs?: number): Promise<void> => {
  if (!ticketId) return;
  const map = cache ?? (await getTicketSeenMap());
  const ts = typeof msgTs === 'number' && Number.isFinite(msgTs) ? msgTs : Date.now();
  if (ts > (map.get(ticketId) ?? 0)) {
    map.set(ticketId, ts);
    cache = map;
    void persist(map);
  }
};

/** True when the ticket has an admin/bot message newer than the user's last-seen marker. */
export const isTicketUnread = (t: TicketLike, seen: Map<string, number>): boolean => {
  if (t.status === 'resolved') return false;
  const lastTs = lastAdminMsgTs(t);
  if (lastTs === 0) return false;
  return lastTs > (seen.get(t._id) ?? 0);
};

/** IDs of all currently-unread tickets (used to reconcile the badge Set on a full fetch). */
export const unreadTicketIds = (tickets: TicketLike[], seen: Map<string, number>): string[] =>
  tickets.filter((t) => isTicketUnread(t, seen)).map((t) => t._id);
