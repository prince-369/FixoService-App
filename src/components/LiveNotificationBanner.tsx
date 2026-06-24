import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAppSelector } from '@/store/hooks';
import { connectSocket, getSocket } from '@/lib/socket';
import { Brand } from '@/lib/config';

interface IncomingNotif { title?: string; message?: string; type?: string; data?: { bookingId?: string } }

/**
 * Global in-app banner: when a notification arrives over the socket while the
 * app is open, it slides down from the top, auto-dismisses, and is tappable.
 */
export default function LiveNotificationBanner() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAppSelector((s) => s.auth);
  const userId = user?._id;

  const [notif, setNotif] = useState<IncomingNotif | null>(null);
  const translateY = useRef(new Animated.Value(-220)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userId) return;
    connectSocket(userId);
    const socket = getSocket();
    if (!socket) return;
    const onNotif = (data: IncomingNotif) => { if (data?.title || data?.message) setNotif(data); };
    socket.on('notification_event', onNotif);
    return () => { socket.off('notification_event', onNotif); };
  }, [userId]);

  useEffect(() => {
    if (!notif) return;
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 6, speed: 12 }).start();
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(dismiss, 5500);
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notif]);

  const dismiss = () => {
    Animated.timing(translateY, { toValue: -220, duration: 250, useNativeDriver: true }).start(() => setNotif(null));
  };

  const open = () => {
    const bookingId = notif?.data?.bookingId;
    dismiss();
    if (bookingId) router.push(`/booking/${bookingId}`);
    else router.push('/notifications');
  };

  if (!notif) return null;

  const t = notif.type || '';
  const isOffer = t.includes('broadcast') || t.includes('admin') || t.includes('service');

  return (
    <View style={[styles.overlay, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
      <Animated.View style={{ transform: [{ translateY }] }}>
        <TouchableOpacity style={styles.card} activeOpacity={0.92} onPress={open}>
          <View style={[styles.iconBox, { backgroundColor: isOffer ? Brand.orange : Brand.navy }]}>
            <Ionicons name={isOffer ? 'megaphone' : 'notifications'} size={20} color={Brand.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{notif.title || 'Fixo'}</Text>
            {notif.message ? <Text style={styles.msg} numberOfLines={2}>{notif.message}</Text> : null}
          </View>
          <TouchableOpacity onPress={dismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={18} color={Brand.textLight} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9999, paddingHorizontal: 12 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Brand.card, borderRadius: 16, padding: 12,
    borderWidth: 1, borderColor: Brand.border,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 10,
  },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14.5, fontWeight: '800', color: Brand.text },
  msg: { fontSize: 12.5, color: Brand.textMuted, marginTop: 2, lineHeight: 17 },
});
