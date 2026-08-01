import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import api, { getApiError } from '@/lib/api';
import { useAppSelector } from '@/store/hooks';
import { connectSocket } from '@/lib/socket';
import { markTicketSeen, getTicketSeenMap, peekTicketSeenMap, unreadTicketIds, lastAdminMsgTs } from '@/lib/ticketSeen';
import { badgeBus } from '@/lib/badgeBus';
import { useAppActive, useForegroundSync, useSocketReconnectSync, useSyncGuard } from '@/lib/appLifecycle';
import { useTheme, type ThemeColors } from '@/lib/theme';

const FAQS = [
  { q: 'How do I book a service?', a: 'Pick a category from the home screen, describe your work, and nearby workers will send bids. Accept the one you like.' },
  { q: 'How are payments handled?', a: 'You can pay online or in cash after the work is done. Online payments are secured through our payment partner.' },
  { q: 'Can I get a refund?', a: 'Yes. Raise a ticket under "Refund" category and our team will review your request.' },
  { q: 'What if I have an issue with a worker?', a: 'Raise a ticket under "Worker Issue" with details and we\'ll help resolve it.' },
];

const CATEGORIES = [
  { label: 'Booking Issue', value: 'bidding_issue' },
  { label: 'Payment Issue', value: 'payment_issue' },
  { label: 'Worker Issue', value: 'worker_related' },
  { label: 'Refund', value: 'refund' },
  { label: 'Account Issue', value: 'account_issue' },
  { label: 'Other', value: 'other' },
];

interface ChatMsg { _id?: string; sender: 'user' | 'bot' | 'admin'; message: string; timestamp: string; }
interface Ticket { _id: string; ticketNumber?: string; category: string; status: string; chatHistory: ChatMsg[]; createdAt: string; updatedAt?: string; }

type ViewMode = 'home' | 'tickets' | 'chat' | 'new';

// Normalize a server timestamp to epoch ms; invalid/missing → NaN. Server-generated only.
const toTs = (v?: string | number | null): number => {
  if (v == null) return NaN;
  const t = typeof v === 'number' ? v : new Date(v).getTime();
  return Number.isFinite(t) ? t : NaN;
};
// True when `incoming` is strictly older than `current` (same ticket) and must be ignored.
// Missing/invalid incoming updatedAt never overwrites a current with a valid one.
const isStaleTicket = (incoming?: Ticket, current?: Ticket): boolean => {
  if (!current) return false;
  const inTs = toTs(incoming?.updatedAt);
  const curTs = toTs(current.updatedAt);
  if (Number.isFinite(inTs) && Number.isFinite(curTs)) return inTs < curTs;
  if (!Number.isFinite(inTs) && Number.isFinite(curTs)) return true;
  return false;
};

export default function HelpScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { user } = useAppSelector((s) => s.auth);
  const appActive = useAppActive();

  const [view, setView] = useState<ViewMode>('home');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Tickets
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  // Chat
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [chatMsg, setChatMsg] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const chatListRef = useRef<FlatList>(null);

  // New ticket
  const [category, setCategory] = useState(CATEGORIES[0].value);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Bumped whenever the local seen-marker changes, to recompute the derived unread count.
  const [seenVer, setSeenVer] = useState(0);
  const viewingRef = useRef<{ view: ViewMode; id?: string }>({ view: 'home' });
  viewingRef.current = { view, id: activeTicket?._id };
  const reconcileInFlight = useRef(false);
  const sendInFlight = useRef(false);

  // Single guarded reducer for BOTH socket events and API responses: monotonic by
  // server `updatedAt`, keeps the active detail and the list card in sync, and inserts a
  // brand-new ticket once. A strictly older same-ticket payload is ignored; equal
  // timestamps re-apply the same authoritative full ticket (idempotent — full replace,
  // never an append, so duplicate deliveries can't duplicate messages).
  const applyIncomingTicket = useCallback((incoming?: Ticket | null) => {
    if (!incoming?._id) return;
    const id = incoming._id;
    setTickets((prev) => {
      const idx = prev.findIndex((x) => x._id === id);
      if (idx === -1) return [incoming, ...prev];
      if (isStaleTicket(incoming, prev[idx])) return prev;
      const next = prev.slice();
      next[idx] = incoming;
      return next;
    });
    setActiveTicket((prev) => {
      if (!prev || prev._id !== id) return prev;
      if (isStaleTicket(incoming, prev)) return prev;
      return incoming;
    });
  }, []);

  // Real-time updates. The global badge is owned by the tabs layout; here we only keep
  // the local list fresh and, if the user is actively viewing a ticket, mark it seen so
  // it never lights up. No manual "re-arm" is needed — the timestamp marker handles it.
  useEffect(() => {
    if (!user?._id) return;
    const socket = connectSocket(user._id);
    if (!socket) return;
    const onUpdate = (payload: { ticket?: Ticket }) => {
      const t = payload?.ticket;
      if (!t?._id) return;
      applyIncomingTicket(t);
      const v = viewingRef.current;
      if (v.view === 'chat' && v.id === t._id) {
        // User is reading this ticket → treat everything up to the newest message as seen.
        const ts = lastAdminMsgTs(t) || Date.now();
        markTicketSeen(t._id, ts);
        badgeBus.clearTicketUnread(t._id);
        setSeenVer((n) => n + 1);
      }
    };
    socket.on('help_ticket_updated', onUpdate);
    return () => { socket.off('help_ticket_updated', onUpdate); };
  }, [user?._id, applyIncomingTicket]);

  // Reconciliation fallback: refetch the open ticket, guarded by an in-flight ref and the
  // 2.5s cooldown so entry/foreground/reconnect/interval bursts collapse into one request.
  const reconcileActive = useCallback(async () => {
    const v = viewingRef.current;
    if (v.view !== 'chat' || !v.id || reconcileInFlight.current) return;
    reconcileInFlight.current = true;
    try {
      const res = await api.get(`/customer/help-tickets/${v.id}`);
      if (res.data?.ticket) applyIncomingTicket(res.data.ticket);
    } catch { /* ignore transient errors */ } finally { reconcileInFlight.current = false; }
  }, [applyIncomingTicket]);

  const { syncNow } = useSyncGuard(reconcileActive);

  // 75s fallback — only while the chat is open AND the app is in the foreground. A
  // backgrounded app clears the interval → zero fallback requests.
  useEffect(() => {
    if (view !== 'chat' || !activeTicket?._id || !appActive) return;
    const poll = setInterval(syncNow, 75000);
    return () => clearInterval(poll);
  }, [view, activeTicket?._id, appActive, syncNow]);

  // One guarded reconcile on foreground / socket reconnect, only while a chat is open.
  useForegroundSync(() => { const v = viewingRef.current; if (v.view === 'chat' && v.id) syncNow(); });
  useSocketReconnectSync(() => { const v = viewingRef.current; if (v.view === 'chat' && v.id) syncNow(); });

  const fetchTickets = async () => {
    setLoadingTickets(true);
    try {
      const res = await api.get('/customer/help-tickets');
      const list = res.data.tickets || [];
      setTickets(list);
      // A full list fetch is authoritative — reconcile the shared badge Set from it.
      await getTicketSeenMap();
      badgeBus.reconcileTickets(unreadTicketIds(list, peekTicketSeenMap()));
    } catch { /* */ } finally { setLoadingTickets(false); }
  };

  const fetchTicketDetail = async (id: string) => {
    try {
      const res = await api.get(`/customer/help-tickets/${id}`);
      if (res.data?.ticket) applyIncomingTicket(res.data.ticket);
    } catch { Alert.alert('Error', 'Could not load ticket'); }
  };

  // Load the seen markers once so the derived count is correct on first render.
  useEffect(() => { getTicketSeenMap().then(() => setSeenVer((n) => n + 1)); }, []);

  // Unread count for the "My Tickets" card — derived from the current list + seen markers.
  const unreadIds = useMemo(
    () => unreadTicketIds(tickets, peekTicketSeenMap()),
    // seenVer forces recompute when markers change (open/mark-seen).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tickets, seenVer],
  );

  const openTicket = (t: Ticket) => {
    setActiveTicket(t);
    setView('chat');
    fetchTicketDetail(t._id);
    // Mark seen up to the newest message → badge clears immediately (local + shared).
    markTicketSeen(t._id, lastAdminMsgTs(t) || Date.now());
    badgeBus.clearTicketUnread(t._id);
    setSeenVer((n) => n + 1);
  };

  const sendMessage = async () => {
    const text = chatMsg.trim();
    // Synchronous in-flight ref blocks a second submit before React updates sendingMsg.
    if (!text || !activeTicket || sendInFlight.current) return;
    sendInFlight.current = true;
    setSendingMsg(true);
    try {
      const res = await api.post(`/customer/help-tickets/${activeTicket._id}/message`, { message: text });
      if (res.data?.ticket) applyIncomingTicket(res.data.ticket);
      setChatMsg('');
      setTimeout(() => chatListRef.current?.scrollToEnd({ animated: true }), 200);
    } catch (e) { Alert.alert('Failed', getApiError(e, 'Could not send')); } finally { sendInFlight.current = false; setSendingMsg(false); }
  };

  const submitNewTicket = async () => {
    if (!message.trim()) { Alert.alert('Required', 'Please describe your issue.'); return; }
    setSending(true);
    try {
      const res = await api.post('/customer/help-tickets', { category, message: message.trim() });
      Alert.alert('Ticket created', res.data?.ticket?.ticketNumber ? `Ticket ${res.data.ticket.ticketNumber} created!` : 'Our team will respond soon.');
      setMessage('');
      setView('tickets');
      fetchTickets();
    } catch (e) { Alert.alert('Failed', getApiError(e, 'Could not create ticket')); } finally { setSending(false); }
  };

  useFocusEffect(useCallback(() => { fetchTickets(); }, []));

  const ticketNumber = (t: Ticket) => t.ticketNumber || `#${t._id.slice(-6).toUpperCase()}`;
  const statusColor = (s: string) => s === 'resolved' ? colors.success : s === 'escalated' ? colors.danger : '#f59e0b';

  // ─── Chat View ───
  if (view === 'chat' && activeTicket) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.topbar}>
          <TouchableOpacity onPress={() => setView('tickets')}><Ionicons name="arrow-back" size={22} color={colors.text} /></TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.title} numberOfLines={1}>{ticketNumber(activeTicket)}</Text>
            <Text style={{ fontSize: 11, color: statusColor(activeTicket.status), fontWeight: '700', textTransform: 'capitalize' }}>{activeTicket.status}</Text>
          </View>
        </View>
        {/* Android uses softwareKeyboardLayoutMode:"pan" (app.json) — the OS already pans the
            focused input above the keyboard, so a "height" behavior double-lifts it (input
            jumps too high until a re-render settles it). Leave Android to native pan. */}
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
          <FlatList
            ref={chatListRef}
            data={activeTicket.chatHistory || []}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
            onContentSizeChange={() => chatListRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => {
              const isUser = item.sender === 'user';
              return (
                <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAdmin]}>
                  <Text style={[styles.bubbleT, isUser ? styles.bubbleTUser : styles.bubbleTAdmin]}>{item.message}</Text>
                  <Text style={styles.bubbleTime}>{new Date(item.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
              );
            }}
            ListEmptyComponent={<Text style={{ textAlign: 'center', color: colors.textMuted, marginTop: 40 }}>No messages yet</Text>}
          />
          {activeTicket.status !== 'resolved' && (
            <View style={styles.chatInput}>
              <TextInput style={styles.chatTextInput} value={chatMsg} onChangeText={setChatMsg} placeholder="Type a message..." placeholderTextColor={colors.textLight} multiline />
              <TouchableOpacity style={styles.sendBtn} onPress={sendMessage} disabled={sendingMsg || !chatMsg.trim()}>
                {sendingMsg ? <ActivityIndicator size="small" color={colors.white} /> : <Ionicons name="send" size={18} color={colors.white} />}
              </TouchableOpacity>
            </View>
          )}
          {activeTicket.status === 'resolved' && (
            <View style={styles.resolvedBar}><Ionicons name="checkmark-circle" size={16} color={colors.success} /><Text style={styles.resolvedT}>This ticket is resolved</Text></View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ─── Tickets List ───
  if (view === 'tickets') {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.topbar}>
          <TouchableOpacity onPress={() => setView('home')}><Ionicons name="arrow-back" size={22} color={colors.text} /></TouchableOpacity>
          <Text style={styles.title}>My Tickets</Text>
          <TouchableOpacity onPress={() => setView('new')}><Ionicons name="add-circle" size={24} color={colors.orange} /></TouchableOpacity>
        </View>
        {loadingTickets ? <ActivityIndicator color={colors.orange} style={{ marginTop: 40 }} /> : (
          <FlatList
            data={tickets}
            keyExtractor={(t) => t._id}
            contentContainerStyle={{ padding: 16 }}
            ListEmptyComponent={<Text style={{ textAlign: 'center', color: colors.textMuted, marginTop: 40 }}>No tickets yet. Raise one!</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.ticketCard} onPress={() => openTicket(item)} activeOpacity={0.8}>
                <View style={styles.ticketHead}>
                  <Text style={styles.ticketNum}>{ticketNumber(item)}</Text>
                  <View style={[styles.statusPill, { backgroundColor: statusColor(item.status) + '20' }]}>
                    <Text style={[styles.statusT, { color: statusColor(item.status) }]}>{item.status}</Text>
                  </View>
                </View>
                <Text style={styles.ticketCat}>{item.category.replace(/_/g, ' ')}</Text>
                {item.chatHistory?.length > 0 && (
                  <Text style={styles.ticketLast} numberOfLines={1}>{item.chatHistory[item.chatHistory.length - 1].message}</Text>
                )}
                <Text style={styles.ticketDate}>{new Date(item.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>
    );
  }

  // ─── New Ticket ───
  if (view === 'new') {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.topbar}>
          <TouchableOpacity onPress={() => setView('home')}><Ionicons name="arrow-back" size={22} color={colors.text} /></TouchableOpacity>
          <Text style={styles.title}>New Ticket</Text>
          <View style={{ width: 22 }} />
        </View>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.section}>Category</Text>
          <View style={styles.chipsRow}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity key={c.value} style={[styles.chip, category === c.value && styles.chipActive]} onPress={() => setCategory(c.value)}>
                <Text style={[styles.chipT, category === c.value && styles.chipTActive]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.section}>Describe your issue</Text>
          <TextInput style={styles.msgInput} value={message} onChangeText={setMessage} placeholder="Apni problem yahan likhein…" placeholderTextColor={colors.textLight} multiline />
          <TouchableOpacity style={[styles.submitBtn, sending && styles.disabled]} onPress={submitNewTicket} disabled={sending}>
            {sending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitT}>Submit Ticket</Text>}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Home View ───
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={22} color={colors.text} /></TouchableOpacity>
        <Text style={styles.title}>Help & Support</Text>
        <View style={{ width: 22 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Action Cards */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionCard} onPress={() => { setView('tickets'); fetchTickets(); }}>
            <View style={[styles.actionIcon, { backgroundColor: colors.infoBg }]}><Ionicons name="chatbubbles" size={22} color={colors.info} /></View>
            <Text style={styles.actionLabel}>My Tickets</Text>
            <Text style={styles.actionSub}>View & chat on tickets</Text>
            {unreadIds.length > 0 && (
              <View style={styles.actionBadge}><Text style={styles.actionBadgeT}>{unreadIds.length}</Text></View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} onPress={() => setView('new')}>
            <View style={[styles.actionIcon, { backgroundColor: colors.warnBg }]}><Ionicons name="add-circle" size={22} color={colors.warn} /></View>
            <Text style={styles.actionLabel}>Raise Ticket</Text>
            <Text style={styles.actionSub}>Report an issue</Text>
          </TouchableOpacity>
        </View>

        {/* FAQ */}
        <Text style={styles.section}>Frequently Asked</Text>
        {FAQS.map((f, i) => (
          <TouchableOpacity key={i} style={styles.faq} activeOpacity={0.8} onPress={() => setOpenFaq(openFaq === i ? null : i)}>
            <View style={styles.faqHead}>
              <Text style={styles.faqQ}>{f.q}</Text>
              <Ionicons name={openFaq === i ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
            </View>
            {openFaq === i && <Text style={styles.faqA}>{f.a}</Text>}
          </TouchableOpacity>
        ))}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: c.card, borderBottomWidth: 1, borderBottomColor: c.border },
  title: { fontSize: 16, fontWeight: '800', color: c.text },
  scroll: { padding: 16 },
  actions: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  actionCard: { flex: 1, backgroundColor: c.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: c.border, alignItems: 'center', gap: 6 },
  actionIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 13.5, fontWeight: '800', color: c.text },
  actionSub: { fontSize: 11, color: c.textMuted, textAlign: 'center' },
  actionBadge: { position: 'absolute', top: 8, right: 8, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: c.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  actionBadgeT: { color: '#fff', fontSize: 10, fontWeight: '800' },
  section: { fontSize: 15, fontWeight: '800', color: c.text, marginTop: 8, marginBottom: 10 },
  faq: { backgroundColor: c.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: c.border, marginBottom: 8 },
  faqHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  faqQ: { flex: 1, fontSize: 13.5, fontWeight: '700', color: c.text },
  faqA: { fontSize: 12.5, color: c.textMuted, marginTop: 8, lineHeight: 18 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  chipActive: { backgroundColor: c.navy, borderColor: c.navy },
  chipT: { fontSize: 12, fontWeight: '700', color: c.textMuted },
  chipTActive: { color: c.white },
  msgInput: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 14, fontSize: 14, color: c.text, height: 100, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: c.orange, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 12 },
  submitT: { color: c.white, fontSize: 14.5, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  // Tickets
  ticketCard: { backgroundColor: c.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: c.border, marginBottom: 10 },
  ticketHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ticketNum: { fontSize: 14, fontWeight: '800', color: c.text },
  statusPill: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  statusT: { fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  ticketCat: { fontSize: 12, color: c.textMuted, marginTop: 4, textTransform: 'capitalize' },
  ticketLast: { fontSize: 12.5, color: c.textLight, marginTop: 4 },
  ticketDate: { fontSize: 11, color: c.textLight, marginTop: 6 },
  // Chat
  bubble: { maxWidth: '80%', borderRadius: 14, padding: 12, marginBottom: 8 },
  bubbleUser: { alignSelf: 'flex-end', backgroundColor: c.navy },
  bubbleAdmin: { alignSelf: 'flex-start', backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
  bubbleT: { fontSize: 13.5, lineHeight: 19 },
  bubbleTUser: { color: c.white },
  bubbleTAdmin: { color: c.text },
  bubbleTime: { fontSize: 10, color: c.textLight, marginTop: 4, alignSelf: 'flex-end' },
  chatInput: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.card },
  chatTextInput: { flex: 1, backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: c.text, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.orange, alignItems: 'center', justifyContent: 'center' },
  resolvedBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, backgroundColor: c.successBg },
  resolvedT: { fontSize: 13, fontWeight: '700', color: c.success },
});
