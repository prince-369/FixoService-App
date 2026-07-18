import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { useAppSelector } from '@/store/hooks';
import api from '@/lib/api';
import { Brand } from '@/lib/config';
import { LOGO } from '@/lib/assets';
import LocationHeader from '@/components/LocationHeader';
import ActiveBookingsHome from '@/components/ActiveBookingsHome';
import { badgeBus, useNotifsUnread } from '@/lib/badgeBus';

interface Category {
  _id: string;
  name: string;
  image?: string;
  priceStartsFrom?: number;
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAppSelector((s) => s.auth);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [banners, setBanners] = useState<{ id: string; image: string; alt: string }[]>([]);
  const bannerRef = useRef<FlatList>(null);
  const [bannerIdx, setBannerIdx] = useState(0);
  const unreadCount = useNotifsUnread();
  const screenWidth = Dimensions.get('window').width - 32; // account for padding

  useEffect(() => {
    let active = true;
    api.get('/customer/categories')
      .then((res) => { if (active) setCategories(res.data.categories || res.data || []); })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    // Fetch banners from deployed web app
    fetch('https://fixoservice.vercel.app/api/public-banners')
      .then((r) => r.json())
      .then((data) => { if (active && data?.banners) setBanners(data.banners); })
      .catch(() => {});
    // Fetch unread notification count into the shared badge store
    api.get('/customer/notifications')
      .then((res) => { if (active) badgeBus.setNotifs((res.data?.notifications || []).filter((n: any) => !n.isRead).length); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  // Auto-scroll banners
  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => {
      setBannerIdx((prev) => {
        const next = (prev + 1) % banners.length;
        bannerRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 4000);
    return () => clearInterval(t);
  }, [banners.length]);

  const filtered = search
    ? categories.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : categories;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.headerRow}>
          <Image source={LOGO} style={styles.logoImg} contentFit="contain" />
          <TouchableOpacity style={styles.bell} onPress={() => router.push('/notifications')}>
            <Ionicons name="notifications-outline" size={22} color={Brand.white} />
            {unreadCount > 0 ? (
              <View style={styles.bellBadge}><Text style={styles.bellBadgeT}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View>
            ) : null}
          </TouchableOpacity>
        </View>

        <View style={styles.greetRow}>
          <View>
            <Text style={styles.hi}>Hello, {user?.fullName?.split(' ')[0] || 'there'} 👋</Text>
            <Text style={styles.name}>What do you need fixed?</Text>
          </View>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={Brand.textLight} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for a service..."
            placeholderTextColor={Brand.textLight}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={{ marginBottom: 14 }}>
          <LocationHeader />
        </View>

        {/* Banner Carousel */}
        {banners.length > 0 ? (
          <View style={{ marginBottom: 14 }}>
            <FlatList
              ref={bannerRef}
              data={banners}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(b) => b.id}
              onMomentumScrollEnd={(e) => { const idx = Math.round(e.nativeEvent.contentOffset.x / screenWidth); setBannerIdx(idx); }}
              getItemLayout={(_, index) => ({ length: screenWidth, offset: screenWidth * index, index })}
              renderItem={({ item }) => (
                <View style={[styles.bannerSlide, { width: screenWidth }]}>
                  <Image source={{ uri: `https://fixoservice.vercel.app${item.image}` }} style={styles.bannerImg} contentFit="cover" transition={200} />
                </View>
              )}
            />
            {banners.length > 1 && (
              <View style={styles.bannerDots}>
                {banners.map((_, i) => (
                  <View key={i} style={[styles.bannerDot, i === bannerIdx && styles.bannerDotActive]} />
                ))}
              </View>
            )}
          </View>
        ) : (
          <LinearGradient colors={[Brand.orange, '#fb923c']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.banner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>Book trusted experts</Text>
              <Text style={styles.bannerSub}>Verified professionals near you, at fair prices.</Text>
            </View>
            <Ionicons name="shield-checkmark" size={54} color="rgba(255,255,255,0.35)" />
          </LinearGradient>
        )}

        {/* Active bookings — live status, right below the banner */}
        <ActiveBookingsHome />

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>All Services</Text>
          <Text style={styles.sectionCount}>{filtered.length}</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={Brand.orange} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="cube-outline" size={36} color={Brand.textLight} />
            </View>
            <Text style={styles.emptyTitle}>{search ? 'No matching services' : 'No services available'}</Text>
            <Text style={styles.emptyText}>{search ? 'Try a different keyword.' : 'Please check back again soon.'}</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {filtered.map((cat) => (
              <TouchableOpacity
                key={cat._id}
                style={styles.catCard}
                activeOpacity={0.85}
                onPress={() => router.push({ pathname: '/service/[id]', params: { id: cat._id, name: cat.name } })}
              >
                <View style={styles.catImgWrap}>
                  {cat.image ? (
                    <Image source={{ uri: cat.image }} style={styles.catImg} contentFit="cover" transition={200} />
                  ) : (
                    <Ionicons name="construct" size={34} color={Brand.orange} />
                  )}
                </View>
                <Text style={styles.catName} numberOfLines={1}>{cat.name}</Text>
                <View style={styles.catBookRow}>
                  <Text style={styles.catBookText}>Book now</Text>
                  <Ionicons name="arrow-forward" size={13} color={Brand.orange} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  headerSafe: { backgroundColor: Brand.navy, paddingHorizontal: 20, paddingBottom: 18, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  logoImg: { width: 80, height: 26 },
  greetRow: { marginTop: 10 },
  hi: { color: '#aab8d8', fontSize: 13 },
  name: { color: Brand.white, fontSize: 22, fontWeight: '800' },
  bell: { height: 42, width: 42, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  bellBadge: { position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: Brand.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  bellBadgeT: { color: '#fff', fontSize: 9, fontWeight: '800' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Brand.white, borderRadius: 14, paddingHorizontal: 14, marginTop: 16 },
  searchInput: { flex: 1, paddingVertical: 13, fontSize: 14.5, color: Brand.text },
  scroll: { padding: 20, paddingBottom: 40 },
  banner: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, padding: 20, overflow: 'hidden' },
  bannerTitle: { color: Brand.white, fontSize: 18, fontWeight: '900' },
  bannerSub: { color: 'rgba(255,255,255,0.92)', fontSize: 12.5, marginTop: 6, lineHeight: 17 },
  bannerSlide: { borderRadius: 16, overflow: 'hidden' },
  bannerImg: { width: '100%', height: 160, borderRadius: 16 },
  bannerDots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 10 },
  bannerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#d1d5db' },
  bannerDotActive: { width: 20, backgroundColor: Brand.orange },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 26, marginBottom: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: Brand.text },
  sectionCount: { fontSize: 12, fontWeight: '700', color: Brand.orange, backgroundColor: Brand.orange50, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
  empty: { alignItems: 'center', marginTop: 50, gap: 6 },
  emptyIcon: { height: 80, width: 80, borderRadius: 40, backgroundColor: Brand.navy50, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle: { color: Brand.text, fontSize: 16, fontWeight: '800' },
  emptyText: { color: Brand.textMuted, fontSize: 13.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  catCard: {
    width: '47%', backgroundColor: Brand.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: Brand.border,
    shadowColor: '#0f1c3f', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  catImgWrap: { height: 72, width: 72, borderRadius: 20, backgroundColor: Brand.orange50, alignItems: 'center', justifyContent: 'center', marginBottom: 12, overflow: 'hidden' },
  catImg: { height: 72, width: 72 },
  catName: { fontSize: 15, fontWeight: '800', color: Brand.text },
  catBookRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  catBookText: { fontSize: 12.5, color: Brand.orange, fontWeight: '700' },
});
