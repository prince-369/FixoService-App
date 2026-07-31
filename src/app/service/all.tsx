import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import api from '@/lib/api';
import { useTheme, type ThemeColors } from '@/lib/theme';
import { SERVICE_GROUPS, serviceBlurbFor, serviceGroupFor, serviceIconFor } from '@/lib/serviceIcons';

interface Category {
  _id: string;
  name: string;
  image?: string;
  tagline?: string;
  description?: string;
  priceStartsFrom?: number;
}

const ALL_FILTER = 'All';
const GUTTER = 16;
const CARD_W = (Dimensions.get('window').width - GUTTER * 2 - 12) / 2;

/**
 * Full category catalogue, reached from the home screen's "More" tile and "View all".
 *
 * The static `all` segment shadows `service/[id]`, so no category may use the id "all".
 */
export default function AllServicesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(typeof params.q === 'string' ? params.q : '');
  const [group, setGroup] = useState<string>(ALL_FILTER);

  useEffect(() => {
    let active = true;
    api
      .get('/customer/categories')
      .then((res) => {
        if (active) setCategories(res.data.categories || res.data || []);
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  // Only offer chips that actually have services behind them.
  const availableGroups = useMemo(() => {
    const present = new Set(categories.map((cat) => serviceGroupFor(cat.name)));
    return [ALL_FILTER, ...SERVICE_GROUPS.filter((g) => present.has(g))];
  }, [categories]);

  // A chip can stop existing while selected, so the effective filter is derived.
  const activeGroup = availableGroups.includes(group) ? group : ALL_FILTER;

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return categories.filter((cat) => {
      if (activeGroup !== ALL_FILTER && serviceGroupFor(cat.name) !== activeGroup) return false;
      if (!needle) return true;
      return [cat.name, cat.tagline, cat.description]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle));
    });
  }, [categories, activeGroup, search]);

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>All Services</Text>
          <View style={styles.backBtn} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.lede}>Verified professionals for every home need — pick a service to get started</Text>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={colors.textLight} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for a service..."
            placeholderTextColor={colors.textLight}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
        </View>

        {availableGroups.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipRail}
            contentContainerStyle={styles.chipRailContent}
          >
            {availableGroups.map((g) => {
              const active = g === activeGroup;
              return (
                <TouchableOpacity
                  key={g}
                  activeOpacity={0.8}
                  onPress={() => setGroup(g)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{g}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}

        {loading ? (
          <ActivityIndicator color={colors.orange} style={{ marginTop: 48 }} />
        ) : visible.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="search" size={26} color={colors.textLight} />
            </View>
            <Text style={styles.emptyTitle}>No services found</Text>
            <Text style={styles.emptyText}>
              {search.trim() ? `Nothing matches "${search.trim()}"` : 'Try another category filter'}
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {visible.map((cat) => (
              <TouchableOpacity
                key={cat._id}
                style={styles.card}
                activeOpacity={0.85}
                onPress={() => router.push({ pathname: '/service/[id]', params: { id: cat._id, name: cat.name } })}
              >
                {/* Always an icon here — the uploaded category photo is not used on this screen. */}
                <View style={styles.cardIcon}>
                  <Ionicons name={serviceIconFor(cat.name)} size={20} color={colors.orange} />
                </View>

                <Text style={styles.cardName} numberOfLines={2}>
                  {cat.name}
                </Text>
                <Text style={styles.cardBlurb} numberOfLines={2}>
                  {cat.tagline?.trim() || cat.description?.trim() || serviceBlurbFor(cat.name)}
                </Text>

                <View style={styles.cardFoot}>
                  <Text style={styles.cardPrice}>
                    {cat.priceStartsFrom ? `From ₹${cat.priceStartsFrom}` : 'View details'}
                  </Text>
                  <Ionicons name="chevron-forward" size={13} color={colors.orange} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Custom request */}
        <View style={styles.ctaCard}>
          <View style={styles.ctaIcon}>
            <Ionicons name="headset-outline" size={21} color={colors.textMuted} />
          </View>
          <Text style={styles.ctaTitle}>Can&apos;t find what you&apos;re looking for?</Text>
          <Text style={styles.ctaText}>Tell us what you need and we&apos;ll connect you with the right professional.</Text>
          <TouchableOpacity style={styles.ctaBtn} activeOpacity={0.85} onPress={() => router.push('/help')}>
            <Text style={styles.ctaBtnText}>Request a Custom Service</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },

    headerSafe: {
      backgroundColor: c.card,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', height: 52, paddingHorizontal: 6 },
    backBtn: { width: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 16.5, fontWeight: '800', color: c.text },

    scroll: { paddingHorizontal: GUTTER, paddingTop: 14, paddingBottom: 40 },
    lede: { fontSize: 13, color: c.textMuted, lineHeight: 19 },

    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: c.surface,
      borderRadius: 16,
      paddingHorizontal: 15,
      marginTop: 14,
    },
    searchInput: { flex: 1, paddingVertical: 13, fontSize: 14, color: c.text },

    chipRail: { marginHorizontal: -GUTTER, marginTop: 14 },
    chipRailContent: { paddingHorizontal: GUTTER, gap: 9 },
    chip: {
      paddingHorizontal: 17,
      paddingVertical: 9,
      borderRadius: 999,
      backgroundColor: c.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    chipActive: { backgroundColor: c.orange, borderColor: c.orange },
    chipText: { fontSize: 12, fontWeight: '700', color: c.textMuted },
    chipTextActive: { color: c.onAccent },

    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 18 },
    card: {
      width: CARD_W,
      borderRadius: 18,
      padding: 14,
      backgroundColor: c.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    cardIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardName: { marginTop: 12, fontSize: 14, fontWeight: '800', color: c.text, lineHeight: 18 },
    cardBlurb: { marginTop: 5, fontSize: 11.5, color: c.textMuted, lineHeight: 16 },
    cardFoot: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 6,
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    cardPrice: { fontSize: 12, fontWeight: '700', color: c.text },

    empty: { alignItems: 'center', marginTop: 54, gap: 6 },
    emptyIcon: {
      height: 62,
      width: 62,
      borderRadius: 31,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    emptyTitle: { color: c.text, fontSize: 15.5, fontWeight: '800' },
    emptyText: { color: c.textMuted, fontSize: 13 },

    ctaCard: {
      marginTop: 26,
      borderRadius: 20,
      padding: 20,
      alignItems: 'center',
      backgroundColor: c.navy50,
    },
    ctaIcon: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: c.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaTitle: { marginTop: 12, fontSize: 15.5, fontWeight: '800', color: c.text, textAlign: 'center' },
    ctaText: { marginTop: 6, fontSize: 12.5, color: c.textMuted, textAlign: 'center', lineHeight: 18 },
    ctaBtn: {
      marginTop: 16,
      paddingHorizontal: 22,
      paddingVertical: 13,
      borderRadius: 12,
      backgroundColor: c.orange,
    },
    ctaBtnText: { color: c.onAccent, fontSize: 13.5, fontWeight: '800' },
  });
