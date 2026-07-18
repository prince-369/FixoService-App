import { useCallback, useEffect, useRef, useState } from 'react';
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
import { Brand } from '@/lib/config';
import { markTicketSeen, getSeenTickets, clearTicketSeen, countUnreadTickets } from '@/lib/ticketSeen';
import { badgeBus } from '@/lib/badgeBus';

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

interface ChatMsg { sender: 'user' | 'bot' | 'admin'; message: string; timestamp: string; }
interface Ticket { _id: string; ticketNumber?: string; category: string; status: string; chatHistory: ChatMsg[]; createdAt: string; }

type ViewMode = 'home' | 'tickets' | 'chat' | 'new';

export default function HelpScreen() {
  const router = useRouter();
  const { user } = useAppSelector((s) => s.auth);

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

  // Real-time updates
  useEffect(() => {
    if (!user?._id) return;
    const socket = connectSocket(user._id);
    if (!socket) return;
    const onUpdate = (payload: { ticket?: Ticket }) => {
      if (!payload?.ticket) return;
      const t = payload.ticket;
      setTickets((prev) => prev.map((x) => x._id === t._id ? t : x));
      setActiveTicket((prev) => prev?._id === t._id ? t : prev);
      // If new admin message arrives and user is NOT currently viewing this ticket, mark unseen
      const last = t.chatHistory?.[t.chatHistory.length - 1];
      if (last && last.sender !== 'user') {
        setSeenTickets((prev) => {
          const next = new Set(prev);
          if (activeTicket?._id !== t._id) { next.delete(t._id); clearTicketSeen(t._id); }
          return next;
        });
      }
    };
    socket.on('help_ticket_updated', onUpdate);
    return () => { socket.off('help_ticket_updated', onUpdate); };
  }, [user?._id]);

  const fetchTickets = async () => {
    setLoadingTickets(true);
    try {
      const res = await api.get('/customer/help-tickets');
      setTickets(res.data.tickets || []);
    } catch { /* */ } finally { setLoadingTickets(false); }
  };

  const fetchTicketDetail = async (id: string) => {
    try {
      const res = await api.get(`/customer/help-tickets/${id}`);
      setActiveTicket(res.data.ticket);
    } catch { Alert.alert('Error', 'Could not load ticket'); }
  };

  // Track which tickets user has "seen" (read the latest messages)
  const [seenTickets, setSeenTickets] = useState<Set<string>>(new Set());

  useEffect(() => { getSeenTickets().then(setSeenTickets); }, []);

  // Keep the shared support-badge (Profile tab) in sync as tickets are seen/updated,
  // so opening a ticket clears the badge instantly instead of on the next poll.
  useEffect(() => {
    badgeBus.setSupport(countUnreadTickets(tickets, seenTickets));
  }, [tickets, seenTickets]);

  const openTicket = (t: Ticket) => {
    setActiveTicket(t);
    setView('chat');
    fetchTicketDetail(t._id);
    // Mark as seen locally — badge will disappear
    markTicketSeen(t._id);
    setSeenTickets((prev) => new Set(prev).add(t._id));
  };

  const sendMessage = async () => {
    if (!chatMsg.trim() || !activeTicket) return;
    setSendingMsg(true);
    try {
      const res = await api.post(`/customer/help-tickets/${activeTicket._id}/message`, { message: chatMsg.trim() });
      setActiveTicket(res.data.ticket);
      setChatMsg('');
      setTimeout(() => chatListRef.current?.scrollToEnd({ animated: true }), 200);
    } catch (e) { Alert.alert('Failed', getApiError(e, 'Could not send')); } finally { setSendingMsg(false); }
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
  const statusColor = (s: string) => s === 'resolved' ? Brand.success : s === 'escalated' ? Brand.danger : '#f59e0b';

  // ─── Chat View ───
  if (view === 'chat' && activeTicket) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.topbar}>
          <TouchableOpacity onPress={() => setView('tickets')}><Ionicons name="arrow-back" size={22} color={Brand.text} /></TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.title} numberOfLines={1}>{ticketNumber(activeTicket)}</Text>
            <Text style={{ fontSize: 11, color: statusColor(activeTicket.status), fontWeight: '700', textTransform: 'capitalize' }}>{activeTicket.status}</Text>
          </View>
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
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
            ListEmptyComponent={<Text style={{ textAlign: 'center', color: Brand.textMuted, marginTop: 40 }}>No messages yet</Text>}
          />
          {activeTicket.status !== 'resolved' && (
            <View style={styles.chatInput}>
              <TextInput style={styles.chatTextInput} value={chatMsg} onChangeText={setChatMsg} placeholder="Type a message..." placeholderTextColor={Brand.textLight} multiline />
              <TouchableOpacity style={styles.sendBtn} onPress={sendMessage} disabled={sendingMsg || !chatMsg.trim()}>
                {sendingMsg ? <ActivityIndicator size="small" color={Brand.white} /> : <Ionicons name="send" size={18} color={Brand.white} />}
              </TouchableOpacity>
            </View>
          )}
          {activeTicket.status === 'resolved' && (
            <View style={styles.resolvedBar}><Ionicons name="checkmark-circle" size={16} color={Brand.success} /><Text style={styles.resolvedT}>This ticket is resolved</Text></View>
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
          <TouchableOpacity onPress={() => setView('home')}><Ionicons name="arrow-back" size={22} color={Brand.text} /></TouchableOpacity>
          <Text style={styles.title}>My Tickets</Text>
          <TouchableOpacity onPress={() => setView('new')}><Ionicons name="add-circle" size={24} color={Brand.orange} /></TouchableOpacity>
        </View>
        {loadingTickets ? <ActivityIndicator color={Brand.orange} style={{ marginTop: 40 }} /> : (
          <FlatList
            data={tickets}
            keyExtractor={(t) => t._id}
            contentContainerStyle={{ padding: 16 }}
            ListEmptyComponent={<Text style={{ textAlign: 'center', color: Brand.textMuted, marginTop: 40 }}>No tickets yet. Raise one!</Text>}
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
          <TouchableOpacity onPress={() => setView('home')}><Ionicons name="arrow-back" size={22} color={Brand.text} /></TouchableOpacity>
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
          <TextInput style={styles.msgInput} value={message} onChangeText={setMessage} placeholder="Apni problem yahan likhein…" placeholderTextColor={Brand.textLight} multiline />
          <TouchableOpacity style={[styles.submitBtn, sending && styles.disabled]} onPress={submitNewTicket} disabled={sending}>
            {sending ? <ActivityIndicator color={Brand.white} /> : <Text style={styles.submitT}>Submit Ticket</Text>}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Home View ───
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={22} color={Brand.text} /></TouchableOpacity>
        <Text style={styles.title}>Help & Support</Text>
        <View style={{ width: 22 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Action Cards */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionCard} onPress={() => { setView('tickets'); fetchTickets(); }}>
            <View style={[styles.actionIcon, { backgroundColor: '#dbeafe' }]}><Ionicons name="chatbubbles" size={22} color="#2563eb" /></View>
            <Text style={styles.actionLabel}>My Tickets</Text>
            <Text style={styles.actionSub}>View & chat on tickets</Text>
            {tickets.filter((t) => { if (seenTickets.has(t._id)) return false; const last = t.chatHistory?.[t.chatHistory.length - 1]; return t.status !== 'resolved' && last && last.sender !== 'user'; }).length > 0 && (
              <View style={styles.actionBadge}><Text style={styles.actionBadgeT}>{tickets.filter((t) => { if (seenTickets.has(t._id)) return false; const last = t.chatHistory?.[t.chatHistory.length - 1]; return t.status !== 'resolved' && last && last.sender !== 'user'; }).length}</Text></View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} onPress={() => setView('new')}>
            <View style={[styles.actionIcon, { backgroundColor: '#fef3c7' }]}><Ionicons name="add-circle" size={22} color="#d97706" /></View>
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
              <Ionicons name={openFaq === i ? 'chevron-up' : 'chevron-down'} size={16} color={Brand.textMuted} />
            </View>
            {openFaq === i && <Text style={styles.faqA}>{f.a}</Text>}
          </TouchableOpacity>
        ))}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Brand.card, borderBottomWidth: 1, borderBottomColor: Brand.border },
  title: { fontSize: 16, fontWeight: '800', color: Brand.text },
  scroll: { padding: 16 },
  actions: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  actionCard: { flex: 1, backgroundColor: Brand.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Brand.border, alignItems: 'center', gap: 6 },
  actionIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 13.5, fontWeight: '800', color: Brand.text },
  actionSub: { fontSize: 11, color: Brand.textMuted, textAlign: 'center' },
  actionBadge: { position: 'absolute', top: 8, right: 8, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: Brand.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  actionBadgeT: { color: '#fff', fontSize: 10, fontWeight: '800' },
  section: { fontSize: 15, fontWeight: '800', color: Brand.text, marginTop: 8, marginBottom: 10 },
  faq: { backgroundColor: Brand.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Brand.border, marginBottom: 8 },
  faqHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  faqQ: { flex: 1, fontSize: 13.5, fontWeight: '700', color: Brand.text },
  faqA: { fontSize: 12.5, color: Brand.textMuted, marginTop: 8, lineHeight: 18 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { backgroundColor: Brand.card, borderWidth: 1, borderColor: Brand.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  chipActive: { backgroundColor: Brand.navy, borderColor: Brand.navy },
  chipT: { fontSize: 12, fontWeight: '700', color: Brand.textMuted },
  chipTActive: { color: Brand.white },
  msgInput: { backgroundColor: Brand.card, borderWidth: 1, borderColor: Brand.border, borderRadius: 12, padding: 14, fontSize: 14, color: Brand.text, height: 100, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: Brand.orange, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 12 },
  submitT: { color: Brand.white, fontSize: 14.5, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  // Tickets
  ticketCard: { backgroundColor: Brand.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Brand.border, marginBottom: 10 },
  ticketHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ticketNum: { fontSize: 14, fontWeight: '800', color: Brand.text },
  statusPill: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  statusT: { fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  ticketCat: { fontSize: 12, color: Brand.textMuted, marginTop: 4, textTransform: 'capitalize' },
  ticketLast: { fontSize: 12.5, color: Brand.textLight, marginTop: 4 },
  ticketDate: { fontSize: 11, color: Brand.textLight, marginTop: 6 },
  // Chat
  bubble: { maxWidth: '80%', borderRadius: 14, padding: 12, marginBottom: 8 },
  bubbleUser: { alignSelf: 'flex-end', backgroundColor: Brand.navy },
  bubbleAdmin: { alignSelf: 'flex-start', backgroundColor: Brand.card, borderWidth: 1, borderColor: Brand.border },
  bubbleT: { fontSize: 13.5, lineHeight: 19 },
  bubbleTUser: { color: Brand.white },
  bubbleTAdmin: { color: Brand.text },
  bubbleTime: { fontSize: 10, color: Brand.textLight, marginTop: 4, alignSelf: 'flex-end' },
  chatInput: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: Brand.border, backgroundColor: Brand.card },
  chatTextInput: { flex: 1, backgroundColor: Brand.bg, borderWidth: 1, borderColor: Brand.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: Brand.text, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Brand.orange, alignItems: 'center', justifyContent: 'center' },
  resolvedBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, backgroundColor: Brand.successBg },
  resolvedT: { fontSize: 13, fontWeight: '700', color: Brand.success },
});
