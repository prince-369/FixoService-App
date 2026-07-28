import { useCallback, useEffect, useRef } from 'react';
import { Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand } from '@/lib/config';
import { useAppSelector } from '@/store/hooks';
import api from '@/lib/api';
import { connectSocket, getSocket } from '@/lib/socket';
import { getTicketSeenMap, unreadTicketIds, isTicketUnread, peekTicketSeenMap, type TicketLike } from '@/lib/ticketSeen';
import { badgeBus, useProfileBadge } from '@/lib/badgeBus';
import { useAppActive, useForegroundSync, useSocketReconnectSync, usePollOwner, useSyncGuard } from '@/lib/appLifecycle';

function BadgeIcon({ name, color, size, badge }: { name: keyof typeof Ionicons.glyphMap; color: string; size: number; badge?: number }) {
  return (
    <View style={{ width: size + 10, height: size + 4, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={name} size={size} color={color} />
      {badge && badge > 0 ? (
        <View style={{ position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: Brand.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
          <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function TabsLayout() {
  const { user } = useAppSelector((s) => s.auth);
  const insets = useSafeAreaInsets();
  const profileBadge = useProfileBadge();
  const appActive = useAppActive();

  // Single in-flight guard so overlapping badge fetches never stack.
  const fetchInFlight = useRef(false);
  const fetchCounts = useCallback(async () => {
    if (!user?._id || fetchInFlight.current) return;
    fetchInFlight.current = true;
    try {
      const [notifRes, ticketRes, seen] = await Promise.all([
        api.get('/customer/notifications').catch(() => ({ data: { notifications: [] } })),
        api.get('/customer/help-tickets').catch(() => ({ data: { tickets: [] } })),
        getTicketSeenMap(),
      ]);
      const notifs = notifRes.data?.notifications || [];
      badgeBus.setNotifs(notifs.filter((n: any) => !n.isRead).length);
      const tickets = ticketRes.data?.tickets || [];
      badgeBus.reconcileTickets(unreadTicketIds(tickets, seen));
    } catch { /* keep last good counts */ } finally {
      fetchInFlight.current = false;
    }
  }, [user?._id]);

  // runNow = immediate (startup); syncNow = cooldown-guarded so a foreground + reconnect
  // that fire close together collapse into a single badge fetch.
  const { runNow, syncNow } = useSyncGuard(fetchCounts);

  // Startup fetch + event-driven badge updates (socket is the primary channel).
  useEffect(() => {
    if (!user?._id) return;
    runNow();
    connectSocket(user._id);
    const socket = getSocket();
    if (!socket) return;

    // Authoritative unread-notification count pushed by the server.
    const onNotifCount = (payload: { count?: number }) => {
      badgeBus.setNotifs(Number(payload?.count) || 0);
    };
    // A ticket changed → recompute just that ticket's unread state against the local
    // last-seen marker and add/remove it from the Set (idempotent).
    const onTicketUpdated = (payload: { ticket?: TicketLike }) => {
      const ticket = payload?.ticket;
      if (!ticket?._id) return;
      // Synchronous marker read so a "mark seen" firing on the same event settles cleanly.
      badgeBus.applyTicketUnread(ticket._id, isTicketUnread(ticket, peekTicketSeenMap()));
    };
    socket.on('badge:notif-count', onNotifCount);
    socket.on('help_ticket_updated', onTicketUpdated);
    return () => {
      socket.off('badge:notif-count', onNotifCount);
      socket.off('help_ticket_updated', onTicketUpdated);
    };
  }, [user?._id, runNow]);

  // Slow 3-minute fallback poll — only while the app is in the foreground.
  useEffect(() => {
    if (!user?._id || !appActive) return;
    const interval = setInterval(syncNow, 180000);
    return () => clearInterval(interval);
  }, [user?._id, appActive, syncNow]);

  // One immediate resync when the app returns to foreground or the socket reconnects.
  useForegroundSync(syncNow);
  useSocketReconnectSync(syncNow);
  usePollOwner('customer-badges', !!user?._id && appActive);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Brand.navy,
        tabBarInactiveTintColor: Brand.textLight,
        tabBarStyle: {
          borderTopColor: Brand.border,
          height: 60 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Bookings',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="rewards"
        options={{
          title: 'Rewards',
          tabBarIcon: ({ color, size }) => <Ionicons name="gift" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <BadgeIcon name="person" color={color} size={size} badge={profileBadge} />,
        }}
      />
    </Tabs>
  );
}
