import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import api from '@/lib/api';
import { Brand } from '@/lib/config';
import { formatCurrency, formatDate } from '@/lib/format';

interface Txn {
  _id: string;
  type: string;
  amount: number;
  paymentMethod?: string;
  status: string;
  createdAt: string;
  booking?: { category?: string | { name: string }; workDescription?: string };
}

export default function TransactionsScreen() {
  const router = useRouter();
  const [txns, setTxns] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/customer/transactions')
      .then((res) => setTxns(res.data.transactions || res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const catName = (t: Txn) => {
    const c = t.booking?.category;
    return typeof c === 'object' ? c?.name : c;
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.topbar}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color={Brand.white} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Payment History</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      {loading ? (
        <ActivityIndicator color={Brand.orange} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={txns}
          keyExtractor={(t) => t._id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.iconWrap}>
                <Ionicons name={item.paymentMethod === 'cash' ? 'cash' : 'card'} size={18} color={Brand.navy} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cat}>{catName(item) || item.type.replace(/_/g, ' ')}</Text>
                <Text style={styles.sub}>{formatDate(item.createdAt)} · {item.paymentMethod || 'online'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
                <Text style={[styles.status, { color: item.status === 'paid' || item.status === 'completed' ? Brand.success : Brand.textMuted }]}>{item.status}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={48} color={Brand.textLight} />
              <Text style={styles.emptyText}>No payments yet</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  topbar: { backgroundColor: Brand.navy },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 12, paddingTop: 4 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, color: Brand.white, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  list: { padding: 16, gap: 10 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Brand.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Brand.border },
  iconWrap: { height: 40, width: 40, borderRadius: 11, backgroundColor: Brand.navy50, alignItems: 'center', justifyContent: 'center' },
  cat: { fontSize: 14.5, fontWeight: '700', color: Brand.text, textTransform: 'capitalize' },
  sub: { fontSize: 12, color: Brand.textMuted, marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '800', color: Brand.text },
  status: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize', marginTop: 2 },
  empty: { alignItems: 'center', marginTop: 80, gap: 10 },
  emptyText: { fontSize: 15, color: Brand.textMuted },
});
