import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import api from '@/lib/api';
import { useAppSelector } from '@/store/hooks';
import { connectSocket, getSocket } from '@/lib/socket';
import { Brand } from '@/lib/config';
import { formatDateTime } from '@/lib/format';

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

  const unread = items.filter((n) => !n.isRead).length;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.topbar}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color={Brand.white} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Notifications</Text>
          {unread > 0 ? (
            <TouchableOpacity onPress={markAll}><Text style={styles.readAll}>Read all</Text></TouchableOpacity>
          ) : <View style={{ width: 56 }} />}
        </View>
      </SafeAreaView>

      {loading ? (
        <ActivityIndicator color={Brand.orange} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n._id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Brand.orange} />}
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.card, !item.isRead && styles.cardUnread]} onPress={() => markRead(item._id)} activeOpacity={0.8}>
              <View style={[styles.iconWrap, !item.isRead && { backgroundColor: Brand.orange50 }]}>
                <Ionicons name={iconFor(item.type)} size={18} color={!item.isRead ? Brand.orange : Brand.textLight} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.msg}>{item.message}</Text>
                <Text style={styles.time}>{formatDateTime(item.createdAt)}</Text>
              </View>
              {!item.isRead ? <View style={styles.dot} /> : null}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={48} color={Brand.textLight} />
              <Text style={styles.emptyText}>No notifications yet</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  topbar: { backgroundColor: Brand.navy },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 12, paddingTop: 4 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, color: Brand.white, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  readAll: { color: Brand.orange, fontSize: 13, fontWeight: '700', width: 56, textAlign: 'right' },
  list: { padding: 16, gap: 10 },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: Brand.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Brand.border },
  cardUnread: { borderColor: '#fed7aa', backgroundColor: '#fffdf9' },
  iconWrap: { height: 38, width: 38, borderRadius: 10, backgroundColor: Brand.bg, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14.5, fontWeight: '700', color: Brand.text },
  msg: { fontSize: 13, color: Brand.textMuted, marginTop: 2, lineHeight: 18 },
  time: { fontSize: 11, color: Brand.textLight, marginTop: 6 },
  dot: { height: 9, width: 9, borderRadius: 5, backgroundColor: Brand.orange, marginTop: 4 },
  empty: { alignItems: 'center', marginTop: 80, gap: 10 },
  emptyText: { fontSize: 15, color: Brand.textMuted },
});
