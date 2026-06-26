import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import api from '@/lib/api';
import { Brand } from '@/lib/config';
import { formatCurrency, formatDate, statusOf } from '@/lib/format';
import Pagination, { paginateItems, getTotalPages } from '@/components/Pagination';

interface Booking {
  _id: string;
  status: string;
  amount: number;
  paymentMethod?: string;
  createdAt: string;
  category?: { name: string };
  workDescription?: string;
}

// Pick a friendly icon based on the service category name.
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

export default function BookingsScreen() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/customer/bookings');
      setBookings(res.data.bookings || []);
      setPage(1);
    } catch {
      // keep existing
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const renderItem = ({ item }: { item: Booking }) => {
    const st = statusOf(item.status);
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => router.push(`/booking/${item._id}`)}>
        <View style={styles.cardTop}>
          <View style={styles.iconWrap}>
            <Ionicons name={categoryIcon(item.category?.name)} size={22} color={Brand.orange} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.category?.name || 'Service'}</Text>
            {item.workDescription ? (
              <Text style={styles.cardDesc} numberOfLines={1}>{item.workDescription}</Text>
            ) : null}
          </View>
          <View style={[styles.badge, { backgroundColor: st.bg }]}>
            <Text style={[styles.badgeText, { color: st.color }]}>{st.label}</Text>
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.cardBottom}>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={14} color={Brand.textLight} />
            <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
          </View>
          {item.amount > 0 ? (
            <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
          ) : (
            <View style={styles.viewRow}>
              <Text style={styles.viewText}>View details</Text>
              <Ionicons name="chevron-forward" size={14} color={Brand.orange} />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <Text style={styles.hi}>Your activity</Text>
        <View style={styles.headerRow}>
          <Text style={styles.heading}>My Bookings</Text>
          {bookings.length > 0 ? (
            <View style={styles.countChip}>
              <Text style={styles.countChipText}>{bookings.length}</Text>
            </View>
          ) : null}
        </View>
      </SafeAreaView>

      {loading ? (
        <ActivityIndicator color={Brand.orange} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={paginateItems(bookings, page, 7)}
          keyExtractor={(b) => b._id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Brand.orange} />}
          ListFooterComponent={bookings.length > 7 ? <Pagination currentPage={page} totalPages={getTotalPages(bookings, 7)} onPageChange={setPage} /> : null}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="calendar-outline" size={40} color={Brand.textLight} />
              </View>
              <Text style={styles.emptyTitle}>No bookings yet</Text>
              <Text style={styles.emptySub}>Book a service from the Home tab to get started.</Text>
              <TouchableOpacity style={styles.emptyBtn} activeOpacity={0.85} onPress={() => router.push('/(tabs)')}>
                <Ionicons name="add" size={18} color={Brand.white} />
                <Text style={styles.emptyBtnText}>Book a Service</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  headerSafe: { backgroundColor: Brand.navy, paddingHorizontal: 20, paddingBottom: 18, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  hi: { color: '#aab8d8', fontSize: 13, marginTop: 6 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  heading: { fontSize: 24, fontWeight: '800', color: Brand.white },
  countChip: { backgroundColor: Brand.orange, borderRadius: 12, minWidth: 24, height: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  countChipText: { color: Brand.white, fontSize: 12, fontWeight: '800' },
  list: { padding: 20, paddingTop: 16, gap: 12 },
  card: { backgroundColor: Brand.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: Brand.border, shadowColor: '#0f1c3f', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { height: 46, width: 46, borderRadius: 14, backgroundColor: Brand.orange50, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: Brand.text },
  cardDesc: { fontSize: 13, color: Brand.textMuted, marginTop: 2 },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 10.5, fontWeight: '800', textTransform: 'uppercase' },
  divider: { height: 1, backgroundColor: Brand.border, marginVertical: 12 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  date: { fontSize: 12.5, color: Brand.textMuted, fontWeight: '600' },
  amount: { fontSize: 16, fontWeight: '800', color: Brand.success },
  viewRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewText: { fontSize: 12.5, color: Brand.orange, fontWeight: '700' },
  empty: { alignItems: 'center', marginTop: 70, gap: 6, paddingHorizontal: 30 },
  emptyIcon: { height: 88, width: 88, borderRadius: 44, backgroundColor: Brand.navy50, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: Brand.text },
  emptySub: { fontSize: 13.5, color: Brand.textMuted, textAlign: 'center' },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Brand.orange, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12, marginTop: 16 },
  emptyBtnText: { color: Brand.white, fontSize: 14.5, fontWeight: '800' },
});
