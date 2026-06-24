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

export default function HelpScreen() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('booking_help');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color={Brand.white} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Help & Support</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.contactCard}>
            <Ionicons name="headset" size={22} color={Brand.navy} />
            <Text style={styles.contactText}>We&apos;re here to help. Raise a ticket and our team will respond.</Text>
          </View>

          <Text style={styles.label}>Issue type</Text>
          <View style={styles.chipRow}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity key={c} style={[styles.chip, category === c && styles.chipActive]} onPress={() => setCategory(c)}>
                <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c.replace(/_/g, ' ')}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Describe your issue</Text>
          <TextInput style={[styles.input, styles.textarea]} value={message} onChangeText={setMessage} placeholder="Tell us what went wrong..." placeholderTextColor={Brand.textLight} multiline />

          <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.6 }]} onPress={submit} disabled={submitting}>
            {submitting ? <ActivityIndicator color={Brand.white} /> : <Text style={styles.submitText}>Submit Ticket</Text>}
          </TouchableOpacity>

          <Text style={[styles.label, { marginTop: 26 }]}>Your Tickets</Text>
          {loading ? (
            <ActivityIndicator color={Brand.orange} style={{ marginTop: 16 }} />
          ) : tickets.length === 0 ? (
            <Text style={styles.noneText}>No tickets yet.</Text>
          ) : (
            tickets.map((t) => (
              <View key={t._id} style={styles.ticket}>
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
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  topbar: { backgroundColor: Brand.navy },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 12, paddingTop: 4 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, color: Brand.white, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  scroll: { padding: 20 },
  contactCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Brand.navy50, borderRadius: 14, padding: 16 },
  contactText: { flex: 1, fontSize: 13, color: Brand.navy, lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '800', color: Brand.textMuted, marginTop: 18, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: Brand.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: Brand.card },
  chipActive: { backgroundColor: Brand.navy, borderColor: Brand.navy },
  chipText: { fontSize: 12.5, fontWeight: '600', color: Brand.textMuted, textTransform: 'capitalize' },
  chipTextActive: { color: Brand.white },
  input: { backgroundColor: Brand.card, borderWidth: 1, borderColor: Brand.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: Brand.text },
  textarea: { height: 110, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: Brand.orange, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  submitText: { color: Brand.white, fontSize: 15, fontWeight: '800' },
  noneText: { fontSize: 13, color: Brand.textMuted, marginTop: 8 },
  ticket: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: Brand.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Brand.border, marginTop: 10 },
  ticketCat: { fontSize: 14, fontWeight: '700', color: Brand.text, textTransform: 'capitalize' },
  ticketMsg: { fontSize: 13, color: Brand.textMuted, marginTop: 3 },
  ticketDate: { fontSize: 11, color: Brand.textLight, marginTop: 6 },
  statusPill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
});
