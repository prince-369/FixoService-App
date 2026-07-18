import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import api from '@/lib/api';
import { Brand } from '@/lib/config';
import { formatCurrency, statusOf } from '@/lib/format';
import { useAppSelector } from '@/store/hooks';
import { connectSocket, getSocket } from '@/lib/socket';

interface ActiveBooking {
  _id: string;
  status: string;
  amount: number;
  workDescription?: string;
  scheduledAt?: string | null;
  category?: { name?: string };
  createdAt: string;
  updatedAt?: string;
}

const categoryIcon = (name?: string): keyof typeof Ionicons.glyphMap => {
  const n = (name || '').toLowerCase();
  if (n.includes('electric') || n.includes('light') || n.includes('fan')) return 'flash';
  if (n.includes('plumb') || n.includes('water') || n.includes('tap')) return 'water';
  if (n.includes('clean')) return 'sparkles';
  if (n.includes('paint')) return 'color-palette';
  if (n.includes('carpent') || n.includes('wood')) return 'hammer';
  if (n.includes('ac') || n.includes('cool') || n.includes('fridge')) return 'snow';
  return 'construct';
};

const STAGES = ['finding_workers', 'bids_received', 'worker_accepted', 'worker_approved', 'payment_done', 'in_progress'];

const STATUS_HINT: Record<string, string> = {
  finding_workers: 'Finding nearby workers for you…',
  bids_received: 'Workers are bidding — review offers',
  worker_accepted: 'Worker accepted — confirm to proceed',
  worker_approved: 'Approved — complete your payment',
  payment_done: 'Paid — your worker will start soon',
  in_progress: 'Work is in progress right now',
};

const progressPercent = (status: string): number => {
  const idx = STAGES.indexOf(status);
  if (idx < 0) return 100;
  return Math.round(((idx + 1) / STAGES.length) * 100);
};

const formatSchedule = (iso?: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
};

export default function ActiveBookingsHome() {
  const router = useRouter();
  const { user } = useAppSelector((s) => s.auth);
  const [items, setItems] = useState<ActiveBooking[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/customer/bookings');
      setItems(res.data.bookings || []);
    } catch { /* keep */ }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Live refresh on any booking/bid/status event.
  useEffect(() => {
    if (!user?._id) return;
    connectSocket(user._id);
    const socket = getSocket();
    if (!socket) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => { clearTimeout(t); t = setTimeout(() => load(), 500); };
    const events = ['booking:new-bid', 'booking_status_updated', 'booking_accepted', 'booking_confirmed', 'booking:schedule-reached'];
    events.forEach((e) => socket.on(e, refresh));
    return () => { clearTimeout(t); events.forEach((e) => socket.off(e, refresh)); };
  }, [user?._id, load]);

  const active = items
    .filter((b) => !['completed', 'cancelled'].includes(b.status))
    .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());

  if (active.length === 0) return null;

  const visible = active.slice(0, 5);

  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <View style={styles.headLeft}>
          <View style={styles.livePulse}><View style={styles.livePulseDot} /></View>
          <Text style={styles.headTitle}>Your active {active.length === 1 ? 'booking' : 'bookings'}</Text>
          <View style={styles.countPill}><Text style={styles.countPillT}>{active.length}</Text></View>
        </View>
        {active.length > visible.length ? (
          <TouchableOpacity onPress={() => router.push('/(tabs)/bookings')} style={styles.viewAll}>
            <Text style={styles.viewAllT}>View all</Text>
            <Ionicons name="chevron-forward" size={13} color={Brand.orange} />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        snapToInterval={280}
        decelerationRate="fast"
      >
        {visible.map((b) => {
          const st = statusOf(b.status);
          const hint = STATUS_HINT[b.status] || 'Booking in progress';
          const percent = progressPercent(b.status);
          const schedule = formatSchedule(b.scheduledAt);
          const isLive = b.status === 'in_progress';
          return (
            <TouchableOpacity key={b._id} style={styles.card} activeOpacity={0.9} onPress={() => router.push(`/booking/${b._id}`)}>
              <View style={styles.cardTop}>
                <View style={styles.catIcon}><Ionicons name={categoryIcon(b.category?.name)} size={20} color={Brand.orange} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.catName} numberOfLines={1}>{b.category?.name || 'Service'}</Text>
                  <Text style={styles.desc} numberOfLines={1}>{b.workDescription}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Brand.textLight} />
              </View>

              <View style={styles.statusRow}>
                <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
                  <Text style={[styles.statusPillT, { color: st.color }]}>{st.label}</Text>
                </View>
                {isLive ? (
                  <View style={styles.liveTag}>
                    <Ionicons name="navigate" size={10} color={Brand.success} />
                    <Text style={styles.liveTagT}>Live</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.hint} numberOfLines={1}>{hint}</Text>

              <View style={styles.track}>
                <View style={[styles.trackFill, { width: `${percent}%`, backgroundColor: isLive ? Brand.success : Brand.orange }]} />
              </View>

              <View style={styles.footer}>
                {schedule ? (
                  <View style={styles.footItem}>
                    <Ionicons name="calendar-clear-outline" size={12} color="#2563eb" />
                    <Text style={styles.schedT} numberOfLines={1}>{schedule}</Text>
                  </View>
                ) : (
                  <View style={styles.footItem}>
                    <Ionicons name="time-outline" size={12} color={Brand.textLight} />
                    <Text style={styles.tapT}>Tap to track</Text>
                  </View>
                )}
                {b.amount > 0 ? <Text style={styles.amount}>{formatCurrency(b.amount)}</Text> : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 16 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  headLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  livePulse: { height: 10, width: 10, borderRadius: 5, backgroundColor: '#a7f3d0', alignItems: 'center', justifyContent: 'center' },
  livePulseDot: { height: 6, width: 6, borderRadius: 3, backgroundColor: Brand.success },
  headTitle: { fontSize: 16, fontWeight: '800', color: Brand.text },
  countPill: { backgroundColor: Brand.orange50, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1 },
  countPillT: { fontSize: 12, fontWeight: '800', color: Brand.orangeDark },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllT: { fontSize: 13, fontWeight: '800', color: Brand.orange },
  scroll: { gap: 12, paddingRight: 4 },
  card: { width: 268, backgroundColor: Brand.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: Brand.border, shadowColor: '#0f1c3f', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catIcon: { height: 42, width: 42, borderRadius: 12, backgroundColor: Brand.orange50, alignItems: 'center', justifyContent: 'center' },
  catName: { fontSize: 14.5, fontWeight: '800', color: Brand.text },
  desc: { fontSize: 12.5, color: Brand.textMuted, marginTop: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  statusPill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusPillT: { fontSize: 11, fontWeight: '800' },
  liveTag: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Brand.successBg, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  liveTagT: { fontSize: 10, fontWeight: '800', color: Brand.success, textTransform: 'uppercase' },
  hint: { fontSize: 12, color: Brand.textMuted, marginTop: 8 },
  track: { height: 6, borderRadius: 3, backgroundColor: Brand.bg, marginTop: 10, overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: 3 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  footItem: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  schedT: { fontSize: 11, fontWeight: '700', color: '#2563eb', flex: 1 },
  tapT: { fontSize: 11, fontWeight: '600', color: Brand.textLight },
  amount: { fontSize: 14, fontWeight: '900', color: Brand.success },
});
