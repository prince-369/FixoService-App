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

// Pick a friendly icon based on the category name.
const categoryIcon = (name?: string): keyof typeof Ionicons.glyphMap => {
  const n = (name || '').toLowerCase();
  if (n.includes('electric') || n.includes('light') || n.includes('fan')) return 'flash';
  if (n.includes('plumb') || n.includes('water') || n.includes('tap')) return 'water';
  if (n.includes('clean')) return 'sparkles';
  if (n.includes('paint')) return 'color-palette';
  if (n.includes('carpen') || n.includes('wood') || n.includes('furniture')) return 'hammer';
  if (n.includes('ac') || n.includes('cool') || n.includes('fridge') || n.includes('appliance')) return 'snow';
  return 'construct';
};

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

  const title = cat?.name || name || 'Service';

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.topbar}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color={Brand.white} />
          </TouchableOpacity>
          <Text style={styles.topTitle} numberOfLines={1}>Service</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Friendly hero */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name={categoryIcon(title)} size={30} color={Brand.white} />
          </View>
          <Text style={styles.heroTitle} numberOfLines={2}>{title}</Text>
          <Text style={styles.heroSub}>
            Verified pros · Transparent pricing
            {cat?.priceStartsFrom ? `  ·  from ₹${cat.priceStartsFrom}` : ''}
          </Text>
        </View>
      </SafeAreaView>

      {loading ? (
        <ActivityIndicator color={Brand.orange} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {cat?.description ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>About this service</Text>
              <Text style={styles.desc}>{cat.description}</Text>
            </View>
          ) : null}

          {cat?.services && cat.services.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>What&apos;s included</Text>
              {cat.services.map((s, i) => {
                const sTitle = typeof s === 'string' ? s : (s.title || '');
                const desc = typeof s === 'string' ? '' : (s.description || '');
                if (!sTitle) return null;
                return (
                  <View key={i} style={styles.serviceRow}>
                    <Ionicons name="checkmark-circle" size={20} color={Brand.success} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.serviceText}>{sTitle}</Text>
                      {desc ? <Text style={styles.serviceDesc}>{desc}</Text> : null}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}

          <View style={styles.infoCard}>
            <View style={styles.infoIcon}>
              <Ionicons name="shield-checkmark" size={20} color={Brand.navy} />
            </View>
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
  topbar: { backgroundColor: Brand.navy, borderBottomLeftRadius: 26, borderBottomRightRadius: 26, paddingBottom: 22 },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 4 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, color: Brand.white, fontSize: 15, fontWeight: '700', textAlign: 'center', opacity: 0.85 },
  hero: { alignItems: 'center', paddingHorizontal: 20, marginTop: 4 },
  heroIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: Brand.white, fontSize: 24, fontWeight: '900', textAlign: 'center', marginTop: 12 },
  heroSub: { color: '#cfd8ee', fontSize: 13, marginTop: 4 },
  scroll: { padding: 16, paddingBottom: 30, gap: 14 },
  card: { backgroundColor: Brand.card, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: Brand.border, shadowColor: '#0f1c3f', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: Brand.text, marginBottom: 10 },
  desc: { fontSize: 14, color: Brand.textMuted, lineHeight: 21 },
  serviceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  serviceText: { fontSize: 14, color: Brand.text, fontWeight: '600' },
  serviceDesc: { fontSize: 12.5, color: Brand.textMuted, marginTop: 2, lineHeight: 17 },
  infoCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Brand.navy50, borderRadius: 18, padding: 16 },
  infoIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: Brand.white, alignItems: 'center', justifyContent: 'center' },
  infoText: { fontSize: 12.5, color: Brand.navy, flex: 1, fontWeight: '600', lineHeight: 18 },
  footer: { backgroundColor: Brand.card, borderTopWidth: 1, borderTopColor: Brand.border, paddingHorizontal: 20, paddingTop: 12 },
  bookBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Brand.orange, borderRadius: 16, paddingVertical: 16 },
  bookText: { color: Brand.white, fontSize: 16, fontWeight: '800' },
});
