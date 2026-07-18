import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Animated, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';

import api from '@/lib/api';
import { useAppSelector } from '@/store/hooks';
import { connectSocket, getSocket } from '@/lib/socket';
import { Brand } from '@/lib/config';
import { formatDateTime } from '@/lib/format';
import { badgeBus } from '@/lib/badgeBus';

interface Notif {
  _id: string;
  title: string;
  message: string;
  type?: string;
  isRead: boolean;
  createdAt: string;
}

const iconFor = (type?: string): keyof typeof Ionicons.glyphMap => {
  if (type?.includes('bid')) return 'pricetag';
  if (type?.includes('payment')) return 'card';
  if (type?.includes('reward')) return 'gift';
  if (type?.includes('complete') || type?.includes('work')) return 'checkmark-done';
  return 'notifications';
};

// Friendly accent colour per notification type.
const colorFor = (type?: string): { color: string; bg: string } => {
  if (type?.includes('bid')) return { color: Brand.orange, bg: Brand.orange50 };
  if (type?.includes('payment')) return { color: Brand.success, bg: Brand.successBg };
  if (type?.includes('reward')) return { color: '#7c3aed', bg: '#ede9fe' };
  if (type?.includes('complete') || type?.includes('work')) return { color: Brand.success, bg: Brand.successBg };
  return { color: Brand.navy, bg: Brand.navy50 };
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAppSelector((s) => s.auth);
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/customer/notifications');
      setItems(res.data.notifications || res.data || []);
    } catch { /* keep */ } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Keep the shared badge store (home bell + profile tab) in sync with the list,
  // so reading/deleting here clears those badges instantly.
  useEffect(() => {
    badgeBus.setNotifs(items.filter((n) => !n.isRead).length);
  }, [items]);

  useEffect(() => {
    if (!user?._id) return;
    connectSocket(user._id);
    const socket = getSocket();
    if (!socket) return;
    const onNew = (data: Notif) => setItems((prev) => [{ ...data, isRead: false }, ...prev]);
    socket.on('notification_event', onNew);
    return () => { socket.off('notification_event', onNew); };
  }, [user?._id]);

  const markRead = async (id: string) => {
    setItems((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
    try { await api.patch(`/customer/notifications/${id}/read`); } catch { /* ignore */ }
  };

  const markAll = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try { await api.patch('/customer/notifications/read-all'); } catch { /* ignore */ }
  };

  const deleteNotif = async (id: string) => {
    setItems((p) => p.filter((n) => n._id !== id));
    try { await api.delete(`/customer/notifications/${id}`); } catch { /* ignore */ }
  };

  const renderRightActions = () => (
    <View style={styles.deleteAction}>
      <Ionicons name="trash" size={20} color={Brand.white} />
      <Text style={styles.deleteT}>Delete</Text>
    </View>
  );

  const unread = items.filter((n) => !n.isRead).length;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.topbar}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={Brand.white} />
          </TouchableOpacity>
          <View style={styles.titleWrap}>
            <Text style={styles.topTitle}>Notifications</Text>
            {unread > 0 ? <Text style={styles.topSub}>{unread} unread</Text> : null}
          </View>
          {unread > 0 ? (
            <TouchableOpacity onPress={markAll} style={styles.readAllBtn} activeOpacity={0.7}><Text style={styles.readAll}>Read all</Text></TouchableOpacity>
          ) : <View style={{ width: 64 }} />}
        </View>
      </SafeAreaView>

      {loading ? (
        <ActivityIndicator color={Brand.orange} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n._id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Brand.orange} />}
          renderItem={({ item }) => {
            const accent = colorFor(item.type);
            return (
              <Swipeable renderRightActions={renderRightActions} onSwipeableOpen={() => deleteNotif(item._id)} overshootRight={false}>
                <TouchableOpacity style={[styles.card, !item.isRead && styles.cardUnread]} onPress={() => markRead(item._id)} activeOpacity={0.8}>
                  <View style={[styles.iconWrap, { backgroundColor: accent.bg }]}>
                    <Ionicons name={iconFor(item.type)} size={18} color={accent.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{item.title}</Text>
                    <Text style={styles.msg}>{item.message}</Text>
                    <Text style={styles.time}>{formatDateTime(item.createdAt)}</Text>
                  </View>
                  {!item.isRead ? <View style={styles.dot} /> : null}
                </TouchableOpacity>
              </Swipeable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}><Ionicons name="notifications-off-outline" size={44} color={Brand.textLight} /></View>
              <Text style={styles.emptyTitle}>You&apos;re all caught up</Text>
              <Text style={styles.emptySub}>New booking, bid and reward updates will appear here.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

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
  titleWrap: { flex: 1, alignItems: 'center' },
  topTitle: { color: Brand.white, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  topSub: { color: 'rgba(255,255,255,0.7)', fontSize: 11.5, fontWeight: '600', marginTop: 1 },
  readAllBtn: { width: 64, alignItems: 'flex-end' },
  readAll: { color: Brand.amber, fontSize: 13, fontWeight: '800' },
  list: { padding: 16, paddingBottom: 40, gap: 10, flexGrow: 1 },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: Brand.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Brand.border, shadowColor: '#0f1c3f', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  cardUnread: { borderColor: '#fed7aa', backgroundColor: '#fffdf9' },
  iconWrap: { height: 40, width: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14.5, fontWeight: '700', color: Brand.text },
  msg: { fontSize: 13, color: Brand.textMuted, marginTop: 2, lineHeight: 18 },
  time: { fontSize: 11, color: Brand.textLight, marginTop: 6 },
  dot: { height: 9, width: 9, borderRadius: 5, backgroundColor: Brand.orange, marginTop: 4 },
  deleteAction: { backgroundColor: Brand.danger, justifyContent: 'center', alignItems: 'center', width: 80, borderRadius: 16, marginLeft: 8 },
  deleteT: { color: Brand.white, fontSize: 11, fontWeight: '700', marginTop: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 70, paddingHorizontal: 40 },
  emptyIcon: { height: 84, width: 84, borderRadius: 42, backgroundColor: Brand.card, borderWidth: 1, borderColor: Brand.border, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: Brand.text },
  emptySub: { fontSize: 13, color: Brand.textMuted, marginTop: 6, textAlign: 'center', lineHeight: 19 },
});
