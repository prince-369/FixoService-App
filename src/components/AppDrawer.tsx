import { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { logout } from '@/store/authSlice';
import { useTheme, type ThemeColors } from '@/lib/theme';
import { LOGO } from '@/lib/assets';
import { cldPreset } from '@/lib/cldUrl';
import { useNotifsUnread } from '@/lib/badgeBus';

type IoniconName = keyof typeof Ionicons.glyphMap;

interface DrawerItem {
  label: string;
  icon: IoniconName;
  href: string;
  badgeKey?: 'notifications';
}

const PRIMARY: DrawerItem[] = [
  { label: 'Home', icon: 'home-outline', href: '/(tabs)' },
  { label: 'My Bookings', icon: 'calendar-outline', href: '/(tabs)/bookings' },
  { label: 'Wallet & Payments', icon: 'wallet-outline', href: '/transactions' },
  { label: 'Rewards', icon: 'gift-outline', href: '/(tabs)/rewards' },
  { label: 'Coupons', icon: 'pricetag-outline', href: '/coupons' },
  { label: 'Notifications', icon: 'notifications-outline', href: '/notifications', badgeKey: 'notifications' },
];

const ACCOUNT: DrawerItem[] = [
  { label: 'Edit Profile', icon: 'person-outline', href: '/edit-profile' },
  { label: 'Settings', icon: 'settings-outline', href: '/settings' },
  { label: 'Help & Support', icon: 'help-circle-outline', href: '/help' },
  { label: 'Legal', icon: 'document-text-outline', href: '/legal' },
];

/**
 * Slide-in menu behind the home header's hamburger.
 *
 * The bottom tab bar only carries four destinations, so everything else lives here rather
 * than being unreachable.
 */
export default function AppDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((s) => s.auth);
  const { colors, isDark, toggleTheme } = useTheme();
  const notifBadge = useNotifsUnread();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const go = (href: string) => {
    onClose();
    // Let the drawer finish dismissing before pushing, otherwise the modal animation and the
    // navigation transition fight each other on Android.
    setTimeout(() => router.push(href as never), 120);
  };

  const handleLogout = () => {
    onClose();
    setTimeout(() => {
      void dispatch(logout());
    }, 120);
  };

  const renderItem = (item: DrawerItem) => {
    const badge = item.badgeKey === 'notifications' ? notifBadge : 0;

    return (
      <TouchableOpacity key={item.label} style={styles.row} activeOpacity={0.7} onPress={() => go(item.href)}>
        <Ionicons name={item.icon} size={20} color={colors.textMuted} />
        <Text style={styles.rowLabel}>{item.label}</Text>
        {badge > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : (
          <Ionicons name="chevron-forward" size={15} color={colors.textLight} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.panel}>
          <View style={styles.panelHead}>
            <Image source={LOGO} style={styles.logo} contentFit="contain" />
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close menu">
              <Ionicons name="close" size={21} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {user ? (
            <TouchableOpacity style={styles.userRow} activeOpacity={0.7} onPress={() => go('/edit-profile')}>
              {user.profileImage ? (
                <Image source={{ uri: cldPreset.avatar(user.profileImage, 96) }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarText}>
                    {(user.fullName || '?').trim().charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.userName} numberOfLines={1}>{user.fullName}</Text>
                <Text style={styles.userSub} numberOfLines={1}>{user.phone || user.email}</Text>
              </View>
              <Ionicons name="chevron-forward" size={15} color={colors.textLight} />
            </TouchableOpacity>
          ) : null}

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 8 }} showsVerticalScrollIndicator={false}>
            {PRIMARY.map(renderItem)}
            <Text style={styles.sectionLabel}>Account</Text>
            {ACCOUNT.map(renderItem)}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={toggleTheme}>
              <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={20} color={isDark ? colors.amber : colors.textMuted} />
              <Text style={styles.rowLabel}>{isDark ? 'Light Mode' : 'Dark Mode'}</Text>
            </TouchableOpacity>

            {user ? (
              <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={20} color={colors.danger} />
                <Text style={[styles.rowLabel, { color: colors.danger }]}>Logout</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </SafeAreaView>

        {/* Tap-through area to the right of the panel closes the drawer. */}
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close menu" />
      </View>
    </Modal>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    overlay: { flex: 1, flexDirection: 'row', backgroundColor: c.scrim },
    panel: { width: '84%', maxWidth: 340, backgroundColor: c.card },
    scrim: { flex: 1 },
    panelHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    logo: { width: 74, height: 24 },
    closeBtn: { padding: 6 },
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.surface },
    avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.orange },
    avatarText: { color: c.onAccent, fontSize: 17, fontWeight: '800' },
    userName: { fontSize: 14.5, fontWeight: '800', color: c.text },
    userSub: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: 16,
      paddingVertical: 13,
    },
    rowLabel: { flex: 1, fontSize: 14, fontWeight: '700', color: c.text },
    badge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 6,
      backgroundColor: c.danger,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
    sectionLabel: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 4,
      fontSize: 10.5,
      fontWeight: '800',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: c.textLight,
    },
    footer: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, paddingVertical: 6 },
  });
