import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import api, { getApiError } from '@/lib/api';
import { Brand } from '@/lib/config';
import { formatDate } from '@/lib/format';

interface Ticket { _id: string; category: string; message: string; status: string; createdAt: string; }

const CATEGORIES = ['booking_help', 'payment_issue', 'worker_issue', 'refund', 'other'];

const FAQS: { q: string; a: string }[] = [
  { q: 'How do I book a service?', a: 'Pick a category from the home screen, describe your work, and nearby workers will send you bids. Accept the one you like and you\'re set.' },
  { q: 'How are payments handled?', a: 'You can pay online or in cash after the work is done. Online payments are secured through our payment partner.' },
  { q: 'Can I get a refund?', a: 'Yes. If something went wrong, raise a ticket below under "Refund" and our team will review your request.' },
  { q: 'What if I have an issue with a worker?', a: 'Raise a ticket under "Worker issue" with the details and we\'ll step in to help resolve it.' },
];

export default function HelpScreen() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('booking_help');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/customer/help-tickets');
      setTickets(res.data.tickets || res.data || []);
    } catch { /* keep */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!message.trim()) return Alert.alert('Required', 'Please describe your issue.');
    setSubmitting(true);
    try {
      await api.post('/customer/help-tickets', { category, message: message.trim() });
      setMessage('');
      Alert.alert('Submitted', 'Our team will get back to you soon.');
      load();
    } catch (e) {
      Alert.alert('Failed', getApiError(e, 'Could not submit'));
    } finally { setSubmitting(false); }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.topbar}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={Brand.white} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Help & Support</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Contact banner */}
          <View style={styles.contactCard}>
            <View style={styles.contactIcon}><Ionicons name="headset" size={22} color={Brand.white} /></View>
            <Text style={styles.contactText}>We&apos;re here to help. Browse the FAQs or raise a ticket and our team will respond.</Text>
          </View>

          {/* FAQ */}
          <Text style={styles.sectionLabel}>Frequently asked</Text>
          <View style={styles.faqCard}>
            {FAQS.map((f, i) => {
              const open = openFaq === i;
              return (
                <View key={f.q}>
                  {i > 0 ? <View style={styles.faqDivider} /> : null}
                  <TouchableOpacity style={styles.faqRow} onPress={() => setOpenFaq(open ? null : i)} activeOpacity={0.7}>
                    <Text style={styles.faqQ}>{f.q}</Text>
                    <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={Brand.textMuted} />
                  </TouchableOpacity>
                  {open ? <Text style={styles.faqA}>{f.a}</Text> : null}
                </View>
              );
            })}
          </View>

          {/* Raise a ticket */}
          <Text style={styles.sectionLabel}>Raise a ticket</Text>
          <View style={styles.formCard}>
            <Text style={styles.label}>Issue type</Text>
            <View style={styles.chipRow}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity key={c} style={[styles.chip, category === c && styles.chipActive]} onPress={() => setCategory(c)} activeOpacity={0.8}>
                  <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c.replace(/_/g, ' ')}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Describe your issue</Text>
            <TextInput style={[styles.input, styles.textarea]} value={message} onChangeText={setMessage} placeholder="Tell us what went wrong..." placeholderTextColor={Brand.textLight} multiline />

            <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.6 }]} onPress={submit} disabled={submitting} activeOpacity={0.85}>
              {submitting ? <ActivityIndicator color={Brand.white} /> : <Text style={styles.submitText}>Submit Ticket</Text>}
            </TouchableOpacity>
          </View>

          {/* Tickets */}
          <Text style={styles.sectionLabel}>Your tickets</Text>
          {loading ? (
            <ActivityIndicator color={Brand.orange} style={{ marginTop: 16 }} />
          ) : tickets.length === 0 ? (
            <View style={styles.noneCard}>
              <Ionicons name="chatbubbles-outline" size={32} color={Brand.textLight} />
              <Text style={styles.noneText}>No tickets yet.</Text>
            </View>
          ) : (
            tickets.map((t) => (
              <View key={t._id} style={styles.ticket}>
                <View style={styles.ticketIcon}><Ionicons name="document-text-outline" size={18} color={Brand.navy} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ticketCat}>{t.category.replace(/_/g, ' ')}</Text>
                  <Text style={styles.ticketMsg} numberOfLines={2}>{t.message}</Text>
                  <Text style={styles.ticketDate}>{formatDate(t.createdAt)}</Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: t.status === 'resolved' ? Brand.successBg : '#fef3c7' }]}>
                  <Text style={[styles.statusText, { color: t.status === 'resolved' ? Brand.success : '#b45309' }]}>{t.status}</Text>
                </View>
              </View>
            ))
          )}
          <View style={{ height: 30 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  topbar: {
    backgroundColor: Brand.navy,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: Brand.navy,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 16, paddingTop: 4 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)' },
  topTitle: { flex: 1, color: Brand.white, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  scroll: { padding: 16 },
  contactCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Brand.navy, borderRadius: 18, padding: 16 },
  contactIcon: { height: 44, width: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  contactText: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.92)', lineHeight: 19 },
  sectionLabel: { fontSize: 12, fontWeight: '800', color: Brand.textMuted, marginTop: 22, marginBottom: 10, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  faqCard: { backgroundColor: Brand.card, borderRadius: 18, borderWidth: 1, borderColor: Brand.border, paddingHorizontal: 16, shadowColor: '#0f1c3f', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  faqRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 15 },
  faqQ: { flex: 1, fontSize: 14, fontWeight: '700', color: Brand.text },
  faqA: { fontSize: 13, color: Brand.textMuted, lineHeight: 19, paddingBottom: 15 },
  faqDivider: { height: 1, backgroundColor: Brand.border },
  formCard: { backgroundColor: Brand.card, borderRadius: 18, borderWidth: 1, borderColor: Brand.border, padding: 16, shadowColor: '#0f1c3f', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  label: { fontSize: 12, fontWeight: '800', color: Brand.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { borderWidth: 1, borderColor: Brand.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: Brand.bg },
  chipActive: { backgroundColor: Brand.navy, borderColor: Brand.navy },
  chipText: { fontSize: 12.5, fontWeight: '600', color: Brand.textMuted, textTransform: 'capitalize' },
  chipTextActive: { color: Brand.white },
  input: { backgroundColor: Brand.bg, borderWidth: 1, borderColor: Brand.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: Brand.text, marginTop: 16 },
  textarea: { height: 110, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: Brand.orange, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 16, shadowColor: Brand.orange, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  submitText: { color: Brand.white, fontSize: 15, fontWeight: '800' },
  noneCard: { alignItems: 'center', gap: 8, backgroundColor: Brand.card, borderRadius: 16, borderWidth: 1, borderColor: Brand.border, paddingVertical: 28 },
  noneText: { fontSize: 13, color: Brand.textMuted },
  ticket: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: Brand.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Brand.border, marginBottom: 10 },
  ticketIcon: { height: 38, width: 38, borderRadius: 11, backgroundColor: Brand.navy50, alignItems: 'center', justifyContent: 'center' },
  ticketCat: { fontSize: 14, fontWeight: '700', color: Brand.text, textTransform: 'capitalize' },
  ticketMsg: { fontSize: 13, color: Brand.textMuted, marginTop: 3 },
  ticketDate: { fontSize: 11, color: Brand.textLight, marginTop: 6 },
  statusPill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
});
