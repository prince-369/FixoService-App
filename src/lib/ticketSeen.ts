import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'fixo_seen_tickets';

let cache: Set<string> | null = null;

export const getSeenTickets = async (): Promise<Set<string>> => {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    cache = new Set();
  }
  return cache;
};

export const markTicketSeen = async (ticketId: string): Promise<void> => {
  const seen = await getSeenTickets();
  seen.add(ticketId);
  cache = seen;
  await AsyncStorage.setItem(KEY, JSON.stringify([...seen])).catch(() => {});
};

export const clearTicketSeen = async (ticketId: string): Promise<void> => {
  const seen = await getSeenTickets();
  seen.delete(ticketId);
  cache = seen;
  await AsyncStorage.setItem(KEY, JSON.stringify([...seen])).catch(() => {});
};

/** Count tickets that have unread admin messages (last msg from admin/bot and not in seen set) */
export const countUnreadTickets = (tickets: { _id: string; status: string; chatHistory?: { sender: string }[] }[], seen: Set<string>): number => {
  return tickets.filter((t) => {
    if (t.status === 'resolved') return false;
    if (seen.has(t._id)) return false;
    const last = t.chatHistory?.[t.chatHistory.length - 1];
    return last && last.sender !== 'user';
  }).length;
};
