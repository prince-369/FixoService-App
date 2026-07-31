import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useSegments } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import api from '@/lib/api';
import { useTheme, type ThemeColors } from '@/lib/theme';
import { formatCurrency, formatDate } from '@/lib/format';
import Pagination, { paginateItems, getTotalPages } from '@/components/Pagination';

interface Txn {
  _id: string;
  type: string;
  amount: number;
  paymentMethod?: string;
  status: string;
  createdAt: string;
  booking?: { category?: string | { name: string }; workDescription?: string };
}

// Visual-only helper: treat refunds/credits/cashback as positive money in.
const isCredit = (type: string) =>
  /refund|credit|cashback|reward|bonus/i.test(type);

export default function TransactionsScreen() {
  const router = useRouter();
  const segments = useSegments();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [txns, setTxns] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Reached both as a pushed route (`/transactions`) and as the Wallet tab, which re-exports
  // this screen. A tab is a root — there is nothing to go back to — so the back button is
  // only rendered for the pushed route.
  const insideTabs = segments[0] === '(tabs)';

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
          {insideTabs ? (
            <View style={styles.backSpacer} />
          ) : (
            <TouchableOpacity onPress={() => router.back()} style={styles.back} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </TouchableOpacity>
          )}
          <Text style={styles.topTitle}>Payment History</Text>
          <View style={styles.backSpacer} />
        </View>
      </SafeAreaView>

      {loading ? (
        <ActivityIndicator color={colors.orange} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={paginateItems(txns, page, 7)}
          keyExtractor={(t) => t._id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={txns.length > 7 ? <Pagination currentPage={page} totalPages={getTotalPages(txns, 7)} onPageChange={setPage} /> : null}
          renderItem={({ item }) => {
            const credit = isCredit(item.type);
            const paid = item.status === 'paid' || item.status === 'completed';
            return (
              <View style={styles.card}>
                <View style={[styles.iconWrap, { backgroundColor: credit ? colors.successBg : colors.surface }]}>
                  <Ionicons
                    name={credit ? 'arrow-down' : item.paymentMethod === 'cash' ? 'cash' : 'card'}
                    size={18}
                    color={credit ? colors.success : colors.text}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cat} numberOfLines={1}>{catName(item) || item.type.replace(/_/g, ' ')}</Text>
                  <Text style={styles.sub}>{formatDate(item.createdAt)} · {item.paymentMethod || 'online'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.amount, { color: credit ? colors.success : colors.danger }]}>
                    {credit ? '+' : '-'}{formatCurrency(item.amount)}
                  </Text>
                  <View style={[styles.statusPill, { backgroundColor: paid ? colors.successBg : colors.surface }]}>
                    <Text style={[styles.status, { color: paid ? colors.success : colors.textMuted }]}>{item.status}</Text>
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}><Ionicons name="receipt-outline" size={44} color={colors.textLight} /></View>
              <Text style={styles.emptyTitle}>No payments yet</Text>
              <Text style={styles.emptySub}>Your payment history will show up here once you book a service.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    topbar: {
      backgroundColor: c.card,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 12, paddingTop: 4 },
    back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: c.surface },
    backSpacer: { width: 40 },
    topTitle: { flex: 1, color: c.text, fontSize: 17.5, fontWeight: '800', textAlign: 'center' },
    list: { padding: 16, paddingBottom: 40, gap: 10 },
    card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.card, borderRadius: 16, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, shadowColor: c.navy, shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
    iconWrap: { height: 42, width: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    cat: { fontSize: 14.5, fontWeight: '700', color: c.text, textTransform: 'capitalize' },
    sub: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    amount: { fontSize: 15, fontWeight: '800' },
    statusPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
    status: { fontSize: 10.5, fontWeight: '700', textTransform: 'capitalize' },
    empty: { alignItems: 'center', marginTop: 70, paddingHorizontal: 40 },
    emptyIcon: { height: 84, width: 84, borderRadius: 42, backgroundColor: c.card, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    emptyTitle: { fontSize: 16, fontWeight: '800', color: c.text },
    emptySub: { fontSize: 13, color: c.textMuted, marginTop: 6, textAlign: 'center', lineHeight: 19 },
  });
