import { useMemo } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { logout } from '@/store/authSlice';
import { cldPreset } from '@/lib/cldUrl';
import { useNotifsUnread, useSupportUnread } from '@/lib/badgeBus';
import { useTheme, type ThemeColors } from '@/lib/theme';

type IoniconName = keyof typeof Ionicons.glyphMap;

export default function ProfileScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { user } = useAppSelector((s) => s.auth);
  const notifsUnread = useNotifsUnread();
  const supportUnread = useSupportUnread();

  const confirmLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => dispatch(logout()) },
    ]);
  };

  const MenuRow = ({ icon, label, onPress, danger, color, last, badge }: {
    icon: IoniconName; label: string; onPress: () => void; danger?: boolean; color?: string; last?: boolean; badge?: number;
  }) => (
    <>
      <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
        <View style={[styles.rowIcon, { backgroundColor: danger ? colors.dangerBg : (color ? `${color}1a` : colors.navy50) }]}>
          <Ionicons name={icon} size={20} color={danger ? colors.danger : (color || colors.navy)} />
        </View>
        <Text style={[styles.rowLabel, danger && { color: colors.danger }]}>{label}</Text>
        {badge && badge > 0 ? (
          <View style={styles.rowBadge}><Text style={styles.rowBadgeT}>{badge > 99 ? '99+' : badge}</Text></View>
        ) : null}
        {!danger && <Ionicons name="chevron-forward" size={18} color={colors.textLight} />}
      </TouchableOpacity>
      {!last && <View style={styles.divider} />}
    </>
  );

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Navy header */}
        <LinearGradient colors={[colors.navy, colors.navyLight]} style={styles.header}>
          <SafeAreaView edges={['top']}>
            <Text style={styles.headerTitle}>Profile</Text>
            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                {user?.profileImage ? (
                  <Image source={{ uri: cldPreset.avatar(user.profileImage, 160) }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarText}>{(user?.fullName || 'U').charAt(0).toUpperCase()}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{user?.fullName || 'User'}</Text>
                {user?.phone ? (
                  <View style={styles.contactRow}>
                    <Ionicons name="call-outline" size={13} color="#aab8d8" />
                    <Text style={styles.contact}>{user.phone}</Text>
                  </View>
                ) : null}
                {user?.email ? (
                  <View style={styles.contactRow}>
                    <Ionicons name="mail-outline" size={13} color="#aab8d8" />
                    <Text style={styles.contact}>{user.email}</Text>
                  </View>
                ) : null}
              </View>
              <TouchableOpacity style={styles.editBtn} activeOpacity={0.8} onPress={() => router.push('/edit-profile')}>
                <Ionicons name="create-outline" size={18} color={colors.white} />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </LinearGradient>

        {/* Quick actions */}
        <View style={styles.quickRow}>
          <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/(tabs)/bookings')} activeOpacity={0.85}>
            <View style={[styles.quickIcon, { backgroundColor: colors.navy50 }]}>
              <Ionicons name="calendar" size={22} color={colors.text} />
            </View>
            <Text style={styles.quickLabel}>My Bookings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/(tabs)/rewards')} activeOpacity={0.85}>
            <View style={[styles.quickIcon, { backgroundColor: colors.successBg }]}>
              <Ionicons name="gift" size={22} color={colors.success} />
            </View>
            <Text style={styles.quickLabel}>Rewards</Text>
          </TouchableOpacity>
        </View>

        {/* Account */}
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.menuCard}>
          <MenuRow icon="person-outline" label="Edit Profile" color={colors.text} onPress={() => router.push('/edit-profile')} />
          <MenuRow icon="card-outline" label="Transactions" color="#7c3aed" onPress={() => router.push('/transactions')} />
          <MenuRow icon="pricetag-outline" label="My Coupons" color={colors.orange} onPress={() => router.push('/coupons')} />
          <MenuRow icon="options-outline" label="App Permissions" color="#0ea5e9" onPress={() => router.push('/settings')} last />
        </View>

        {/* Support */}
        <Text style={styles.sectionLabel}>Support</Text>
        <View style={styles.menuCard}>
          <MenuRow icon="notifications-outline" label="Notifications" color="#0ea5e9" badge={notifsUnread} onPress={() => router.push('/notifications')} />
          <MenuRow icon="help-circle-outline" label="Help & Support" color={colors.success} badge={supportUnread} onPress={() => router.push('/help')} />
          <MenuRow icon="shield-checkmark-outline" label="Privacy Policy" color="#6366f1" onPress={() => router.push({ pathname: '/legal', params: { type: 'privacy' } })} />
          <MenuRow icon="document-text-outline" label="Terms of Service" color="#6366f1" onPress={() => router.push({ pathname: '/legal', params: { type: 'terms' } })} />
          <MenuRow icon="information-circle-outline" label="About Fixo" color={colors.textMuted}
            onPress={() => Alert.alert('About Fixo', 'Fixo connects you with trusted, verified local professionals for home services. Version 1.0.0')} last />
        </View>

        {/* Logout */}
        <View style={[styles.menuCard, { marginTop: 16 }]}>
          <MenuRow icon="log-out-outline" label="Log Out" danger onPress={confirmLogout} last />
        </View>

        <Text style={styles.version}>Fixo Service · v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  header: { paddingHorizontal: 20, paddingBottom: 28, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  headerTitle: { color: c.white, fontSize: 22, fontWeight: '800', marginTop: 6, marginBottom: 18 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: { height: 70, width: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { height: 70, width: 70 },
  avatarText: { color: c.white, fontSize: 28, fontWeight: '800' },
  name: { color: c.white, fontSize: 20, fontWeight: '800' },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  contact: { color: '#aab8d8', fontSize: 13 },
  editBtn: { height: 40, width: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  quickRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginTop: -20 },
  quickCard: {
    flex: 1, backgroundColor: c.card, borderRadius: 18, padding: 16, alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: c.border,
    shadowColor: '#0f1c3f', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  quickIcon: { height: 44, width: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 13.5, fontWeight: '800', color: c.text },
  sectionLabel: { fontSize: 12, fontWeight: '800', color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 24, marginBottom: 10, marginLeft: 24 },
  menuCard: { backgroundColor: c.card, borderRadius: 18, marginHorizontal: 20, borderWidth: 1, borderColor: c.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  rowIcon: { height: 40, width: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: c.text },
  rowBadge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: c.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, marginRight: 8 },
  rowBadgeT: { color: '#fff', fontSize: 10.5, fontWeight: '800' },
  divider: { height: 1, backgroundColor: c.border, marginLeft: 70 },
  version: { textAlign: 'center', color: c.textLight, fontSize: 12, marginTop: 24 },
});
