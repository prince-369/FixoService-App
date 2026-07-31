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
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { useAppSelector } from '@/store/hooks';
import api from '@/lib/api';
import { useTheme, type ThemeColors } from '@/lib/theme';
import { LOGO } from '@/lib/assets';
import { serviceIconFor } from '@/lib/serviceIcons';
import LocationHeader from '@/components/LocationHeader';
import ActiveBookingsHome from '@/components/ActiveBookingsHome';
import HomeStory from '@/components/HomeStory';
import AppDrawer from '@/components/AppDrawer';
import { badgeBus, useNotifsUnread } from '@/lib/badgeBus';
import { cldPreset } from '@/lib/cldUrl';

interface Category {
  _id: string;
  name: string;
  image?: string;
  priceStartsFrom?: number;
}

/** Seven category shortcuts plus a "More" tile fills two rows of four. */
const SHORTCUT_COUNT = 7;
const POPULAR_COUNT = 8;

const SCREEN_W = Dimensions.get('window').width;
const GUTTER = 16;
// Four columns inside the gutters, with 12px between tiles.
const TILE_W = (SCREEN_W - GUTTER * 2 - 12 * 3) / 4;
const POPULAR_CARD_W = 148;

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAppSelector((s) => s.auth);
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const unreadCount = useNotifsUnread();

  useEffect(() => {
    let active = true;
    api
      .get('/customer/categories')
      .then((res) => {
        if (active) setCategories(res.data.categories || res.data || []);
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));

    api
      .get('/customer/notifications')
      .then((res) => {
        if (active) {
          badgeBus.setNotifs((res.data?.notifications || []).filter((n: { isRead?: boolean }) => !n.isRead).length);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  const shortcuts = categories.slice(0, SHORTCUT_COUNT);
  const popular = categories.slice(0, POPULAR_COUNT);

  const submitSearch = () => {
    const trimmed = search.trim();
    router.push({ pathname: '/service/all', params: trimmed ? { q: trimmed } : {} });
  };

  const openCategory = (cat: Category) =>
    router.push({ pathname: '/service/[id]', params: { id: cat._id, name: cat.name } });

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => setDrawerOpen(true)}
            style={styles.headerBtn}
            accessibilityLabel="Open menu"
          >
            <Ionicons name="menu" size={25} color={colors.text} />
          </TouchableOpacity>

          <Image source={LOGO} style={styles.logo} contentFit="contain" />

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => router.push('/notifications')}
              accessibilityLabel="Notifications"
            >
              <Ionicons name="notifications-outline" size={23} color={colors.text} />
              {unreadCount > 0 ? (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/edit-profile')} accessibilityLabel="Your profile">
              {user?.profileImage ? (
                <Image
                  source={{ uri: cldPreset.avatar(user.profileImage, 96) }}
                  style={styles.avatar}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarText}>
                    {(user?.fullName || '?').trim().charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <LocationHeader />

        {/* Search */}
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={19} color={colors.textLight} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for a service..."
            placeholderTextColor={colors.textLight}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            onSubmitEditing={submitSearch}
          />
        </View>

        {/* Category shortcuts */}
        {loading ? (
          <ActivityIndicator color={colors.orange} style={{ marginTop: 36 }} />
        ) : (
          <View style={styles.tileGrid}>
            {shortcuts.map((cat) => (
              <TouchableOpacity key={cat._id} style={styles.tile} activeOpacity={0.7} onPress={() => openCategory(cat)}>
                <View style={styles.tileCircle}>
                  <Ionicons name={serviceIconFor(cat.name)} size={26} color={colors.orange} />
                </View>
                <Text style={styles.tileLabel} numberOfLines={2}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={styles.tile} activeOpacity={0.7} onPress={() => router.push('/service/all')}>
              <View style={styles.tileCircle}>
                <Ionicons name="ellipsis-horizontal" size={25} color={colors.textLight} />
              </View>
              <Text style={styles.tileLabel}>More</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Trust banner */}
        <View style={styles.trustCard}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.trustTitle}>Verified. Reviewed. Reliable.</Text>
            <Text style={styles.trustSub}>Only the best, for your home.</Text>
          </View>
          <Ionicons name="shield-checkmark" size={38} color={colors.orange} />
        </View>

        {/* Active bookings — live status */}
        <ActiveBookingsHome />

        {/* Popular services */}
        {popular.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Popular Services</Text>
              <TouchableOpacity onPress={() => router.push('/service/all')} activeOpacity={0.7}>
                <Text style={styles.sectionLink}>View all</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.railContent}
              // Negative margin lets the rail bleed to the screen edges while the content
              // keeps the same gutter as the rest of the page.
              style={styles.rail}
            >
              {popular.map((cat) => (
                <TouchableOpacity
                  key={cat._id}
                  style={styles.popularCard}
                  activeOpacity={0.85}
                  onPress={() => openCategory(cat)}
                >
                  <View style={styles.popularImgWrap}>
                    {cat.image ? (
                      <Image
                        source={{ uri: cldPreset.category(cat.image) }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        transition={200}
                      />
                    ) : (
                      <View style={[StyleSheet.absoluteFill, styles.popularFallback]}>
                        <Ionicons name={serviceIconFor(cat.name)} size={30} color={colors.orange} />
                      </View>
                    )}
                  </View>

                  <View style={styles.popularBody}>
                    <Text style={styles.popularName} numberOfLines={1}>
                      {cat.name}
                    </Text>
                    <Text style={styles.popularPrice}>
                      {cat.priceStartsFrom ? (
                        <>
                          From <Text style={styles.popularPriceValue}>₹{cat.priceStartsFrom}</Text>
                        </>
                      ) : (
                        'View details'
                      )}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* How Fixo works, describing a job, why Fixo, FAQ — mirrors the web home. */}
        <HomeStory />
      </ScrollView>

      <AppDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
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
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 8,
      height: 54,
    },
    headerBtn: { padding: 8 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    logo: { width: 96, height: 30 },
    bellBadge: {
      position: 'absolute',
      top: 3,
      right: 3,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      paddingHorizontal: 3,
      backgroundColor: c.danger,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bellBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
    avatar: { width: 34, height: 34, borderRadius: 17, marginLeft: 4, backgroundColor: c.surface },
    avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.orange },
    avatarText: { color: c.onAccent, fontSize: 14, fontWeight: '800' },

    scroll: { paddingHorizontal: GUTTER, paddingTop: 6, paddingBottom: 36 },

    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: c.surface,
      borderRadius: 16,
      paddingHorizontal: 15,
      marginTop: 10,
    },
    searchInput: { flex: 1, paddingVertical: 14, fontSize: 14.5, color: c.text },

    tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 20 },
    tile: { width: TILE_W, alignItems: 'center', gap: 8 },
    tileCircle: {
      width: TILE_W - 8,
      height: TILE_W - 8,
      borderRadius: (TILE_W - 8) / 2,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tileLabel: { fontSize: 11.5, fontWeight: '700', color: c.text, textAlign: 'center', lineHeight: 15 },

    trustCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 22,
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderRadius: 18,
      backgroundColor: c.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    trustTitle: { fontSize: 15.5, fontWeight: '800', color: c.text },
    trustSub: { fontSize: 13, color: c.textMuted, marginTop: 3 },

    section: { marginTop: 26 },
    sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
    sectionTitle: { fontSize: 16.5, fontWeight: '800', color: c.text },
    sectionLink: { fontSize: 12.5, fontWeight: '800', color: c.orange },

    rail: { marginHorizontal: -GUTTER, marginTop: 12 },
    railContent: { paddingHorizontal: GUTTER, gap: 12 },
    popularCard: {
      width: POPULAR_CARD_W,
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor: c.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    popularImgWrap: {
      width: '100%',
      height: Math.round((POPULAR_CARD_W * 3) / 4),
      backgroundColor: c.surface,
    },
    popularFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.orange50 },
    popularBody: { paddingHorizontal: 11, paddingTop: 9, paddingBottom: 11 },
    popularName: { fontSize: 13.5, fontWeight: '800', color: c.text },
    popularPrice: { marginTop: 4, fontSize: 11.5, fontWeight: '600', color: c.textMuted },
    popularPriceValue: { fontWeight: '800', color: c.text },
  });
