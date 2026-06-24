import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import api from '@/lib/api';
import { Brand } from '@/lib/config';
import { formatCurrency, formatDate } from '@/lib/format';

interface Coupon {
  _id: string;
  code: string;
  title: string;
  description?: string;
  discountType: 'percentage' | 'flat';
  discountValue: number;
  minOrderAmount: number;
  maxDiscount?: number | null;
  expiresAt?: string | null;
}

export default function CouponsScreen() {
  const router = useRouter();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/customer/coupons')
      .then((res) => setCoupons(res.data.coupons || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.topbar}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color={Brand.white} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Coupons</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      {loading ? (
        <ActivityIndicator color={Brand.orange} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={coupons}
          keyExtractor={(c) => c._id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.left}>
                <Ionicons name="pricetag" size={22} color={Brand.orange} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.title}</Text>
                {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
                <Text style={styles.meta}>Min order {formatCurrency(item.minOrderAmount)}{item.expiresAt ? ` · Expires ${formatDate(item.expiresAt)}` : ''}</Text>
                <View style={styles.codeBox}><Text style={styles.code}>{item.code}</Text></View>
              </View>
              <Text style={styles.discount}>
                {item.discountType === 'percentage' ? `${item.discountValue}%` : formatCurrency(item.discountValue)}
                {'\n'}<Text style={styles.off}>OFF</Text>
              </Text>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="pricetags-outline" size={48} color={Brand.textLight} />
              <Text style={styles.emptyText}>No coupons available right now</Text>
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
  list: { padding: 16, gap: 12 },
  card: { flexDirection: 'row', gap: 14, backgroundColor: Brand.card, borderRadius: 16, padding: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: '#fdba74' },
  left: { height: 44, width: 44, borderRadius: 12, backgroundColor: Brand.orange50, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '800', color: Brand.text },
  desc: { fontSize: 12.5, color: Brand.textMuted, marginTop: 2 },
  meta: { fontSize: 11.5, color: Brand.textLight, marginTop: 6 },
  codeBox: { alignSelf: 'flex-start', marginTop: 8, borderWidth: 1, borderColor: '#fdba74', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#fff7ed' },
  code: { fontSize: 13, fontWeight: '900', color: Brand.orangeDark, letterSpacing: 1 },
  discount: { fontSize: 18, fontWeight: '900', color: Brand.orange, textAlign: 'center' },
  off: { fontSize: 10, fontWeight: '800', color: Brand.orange },
  empty: { alignItems: 'center', marginTop: 80, gap: 10 },
  emptyText: { fontSize: 15, color: Brand.textMuted },
});
