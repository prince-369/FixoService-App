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
          <TouchableOpacity onPress={() => router.back()} style={styles.back} activeOpacity={0.7}>
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
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.ticket}>
              {/* Left stub: discount */}
              <View style={styles.stub}>
                <Text style={styles.stubValue}>
                  {item.discountType === 'percentage' ? `${item.discountValue}%` : formatCurrency(item.discountValue)}
                </Text>
                <Text style={styles.stubOff}>OFF</Text>
              </View>

              {/* Perforation */}
              <View style={styles.perforation}>
                <View style={[styles.notch, styles.notchTop]} />
                <View style={styles.dashLine} />
                <View style={[styles.notch, styles.notchBottom]} />
              </View>

              {/* Body */}
              <View style={styles.body}>
                <Text style={styles.title}>{item.title}</Text>
                {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
                <Text style={styles.meta}>
                  Min order {formatCurrency(item.minOrderAmount)}{item.expiresAt ? ` · Expires ${formatDate(item.expiresAt)}` : ''}
                </Text>
                <View style={styles.codeRow}>
                  <View style={styles.codeBox}>
                    <Ionicons name="pricetag" size={12} color={Brand.success} />
                    <Text style={styles.code}>{item.code}</Text>
                  </View>
                </View>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}><Ionicons name="pricetags-outline" size={44} color={Brand.textLight} /></View>
              <Text style={styles.emptyTitle}>No coupons right now</Text>
              <Text style={styles.emptySub}>Check back soon for fresh offers and savings on your bookings.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const NOTCH = 18;

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
  list: { padding: 16, paddingBottom: 40, gap: 14, flexGrow: 1 },
  ticket: {
    flexDirection: 'row',
    backgroundColor: Brand.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Brand.border,
    overflow: 'hidden',
    shadowColor: '#0f1c3f',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  stub: { width: 96, backgroundColor: Brand.successBg, alignItems: 'center', justifyContent: 'center', paddingVertical: 20 },
  stubValue: { fontSize: 22, fontWeight: '900', color: Brand.success },
  stubOff: { fontSize: 11, fontWeight: '800', color: Brand.success, letterSpacing: 1, marginTop: 2 },
  perforation: { width: 1, alignItems: 'center', justifyContent: 'center' },
  dashLine: { flex: 1, width: 1, borderLeftWidth: 1, borderColor: Brand.border, borderStyle: 'dashed' },
  notch: { position: 'absolute', height: NOTCH, width: NOTCH, borderRadius: NOTCH / 2, backgroundColor: Brand.bg, borderWidth: 1, borderColor: Brand.border },
  notchTop: { top: -NOTCH / 2 },
  notchBottom: { bottom: -NOTCH / 2 },
  body: { flex: 1, padding: 16 },
  title: { fontSize: 15.5, fontWeight: '800', color: Brand.text },
  desc: { fontSize: 12.5, color: Brand.textMuted, marginTop: 3, lineHeight: 17 },
  meta: { fontSize: 11.5, color: Brand.textLight, marginTop: 8 },
  codeRow: { flexDirection: 'row', marginTop: 10 },
  codeBox: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#a7f3d0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: Brand.successBg },
  code: { fontSize: 13, fontWeight: '900', color: Brand.success, letterSpacing: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 70, paddingHorizontal: 40 },
  emptyIcon: { height: 84, width: 84, borderRadius: 42, backgroundColor: Brand.card, borderWidth: 1, borderColor: Brand.border, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: Brand.text },
  emptySub: { fontSize: 13, color: Brand.textMuted, marginTop: 6, textAlign: 'center', lineHeight: 19 },
});
