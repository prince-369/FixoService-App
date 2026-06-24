import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import api from '@/lib/api';
import { Brand } from '@/lib/config';
import { formatCurrency, formatDate, statusOf } from '@/lib/format';

interface Booking {
  _id: string;
  status: string;
  amount: number;
  cashSurcharge?: number;
  paymentMethod?: string;
  createdAt: string;
  category?: { name: string };
  workDescription?: string;
}

export default function BookingsScreen() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/customer/bookings');
      setBookings(res.data.bookings || []);
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
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{item.category?.name || 'Service'}</Text>
            <Text style={styles.cardDesc} numberOfLines={1}>{item.workDescription}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: st.bg }]}>
            <Text style={[styles.badgeText, { color: st.color }]}>{st.label}</Text>
          </View>
        </View>
        <View style={styles.cardBottom}>
          <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
          {item.amount > 0 ? (
            <Text style={styles.amount}>{formatCurrency(item.amount + (item.cashSurcharge || 0))}</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.heading}>My Bookings</Text>
      {loading ? (
        <ActivityIndicator color={Brand.orange} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(b) => b._id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Brand.orange} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="calendar-outline" size={48} color={Brand.textLight} />
              <Text style={styles.emptyTitle}>No bookings yet</Text>
              <Text style={styles.emptySub}>Book a service from the Home tab to get started.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.bg },
  heading: { fontSize: 22, fontWeight: '800', color: Brand.text, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  list: { padding: 20, paddingTop: 12, gap: 12 },
  card: { backgroundColor: Brand.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Brand.border },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: Brand.text },
  cardDesc: { fontSize: 13, color: Brand.textMuted, marginTop: 2 },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 10.5, fontWeight: '800', textTransform: 'uppercase' },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  date: { fontSize: 12, color: Brand.textLight },
  amount: { fontSize: 15, fontWeight: '800', color: Brand.text },
  empty: { alignItems: 'center', marginTop: 80, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Brand.text, marginTop: 6 },
  emptySub: { fontSize: 13, color: Brand.textMuted, textAlign: 'center', paddingHorizontal: 40 },
});
