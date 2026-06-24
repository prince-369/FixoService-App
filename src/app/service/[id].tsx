import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import api from '@/lib/api';
import { Brand } from '@/lib/config';

type ServiceItem = string | { title?: string; description?: string; _id?: string };

interface CategoryDetail {
  _id?: string;
  name: string;
  description?: string;
  services?: ServiceItem[];
  priceStartsFrom?: number;
  highlights?: string[];
}

export default function ServiceDetailScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const router = useRouter();
  const [cat, setCat] = useState<CategoryDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.get(`/customer/categories/${id}`)
      .then((res) => { if (active) setCat(res.data.category || res.data); })
      .catch(() => { if (active) setCat({ name: name || 'Service' }); })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [id, name]);

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.topbar}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color={Brand.white} />
          </TouchableOpacity>
          <Text style={styles.topTitle} numberOfLines={1}>{cat?.name || name || 'Service'}</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      {loading ? (
        <ActivityIndicator color={Brand.orange} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {cat?.description ? (
            <>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.desc}>{cat.description}</Text>
            </>
          ) : null}

          {cat?.services && cat.services.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>What&apos;s included</Text>
              {cat.services.map((s, i) => {
                const title = typeof s === 'string' ? s : (s.title || '');
                const desc = typeof s === 'string' ? '' : (s.description || '');
                if (!title) return null;
                return (
                  <View key={i} style={styles.serviceRow}>
                    <Ionicons name="checkmark-circle" size={18} color={Brand.success} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.serviceText}>{title}</Text>
                      {desc ? <Text style={styles.serviceDesc}>{desc}</Text> : null}
                    </View>
                  </View>
                );
              })}
            </>
          ) : null}

          <View style={styles.infoCard}>
            <Ionicons name="shield-checkmark" size={20} color={Brand.navy} />
            <Text style={styles.infoText}>Verified professionals · Transparent pricing · Secure payment</Text>
          </View>
        </ScrollView>
      )}

      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <TouchableOpacity
          style={styles.bookBtn}
          activeOpacity={0.9}
          onPress={() => router.push({ pathname: '/booking/new', params: { category: String(id), name: cat?.name || String(name || '') } })}
        >
          <Text style={styles.bookText}>Book Now</Text>
          <Ionicons name="arrow-forward" size={18} color={Brand.white} />
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  topbar: { backgroundColor: Brand.navy },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 12, paddingTop: 4 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, color: Brand.white, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  scroll: { padding: 20, paddingBottom: 30 },
  priceTag: { backgroundColor: Brand.orange50, borderRadius: 14, padding: 16, alignItems: 'center' },
  priceLabel: { fontSize: 12, color: Brand.orangeDark },
  priceVal: { fontSize: 26, fontWeight: '900', color: Brand.orangeDark, marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: Brand.text, marginTop: 24, marginBottom: 10 },
  desc: { fontSize: 14, color: Brand.textMuted, lineHeight: 21 },
  serviceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  serviceText: { fontSize: 14, color: Brand.text, fontWeight: '600' },
  serviceDesc: { fontSize: 12.5, color: Brand.textMuted, marginTop: 2, lineHeight: 17 },
  infoCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Brand.navy50, borderRadius: 14, padding: 14, marginTop: 24 },
  infoText: { fontSize: 12.5, color: Brand.navy, flex: 1, fontWeight: '600' },
  footer: { backgroundColor: Brand.card, borderTopWidth: 1, borderTopColor: Brand.border, paddingHorizontal: 20, paddingTop: 12 },
  bookBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Brand.orange, borderRadius: 16, paddingVertical: 16 },
  bookText: { color: Brand.white, fontSize: 16, fontWeight: '800' },
});
