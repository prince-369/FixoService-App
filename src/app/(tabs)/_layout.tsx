import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand } from '@/lib/config';
import { useAppSelector } from '@/store/hooks';
import api from '@/lib/api';
import { connectSocket, getSocket } from '@/lib/socket';
import { getSeenTickets, countUnreadTickets } from '@/lib/ticketSeen';
import { badgeBus, useProfileBadge } from '@/lib/badgeBus';

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

  useEffect(() => {
    if (!user?._id) return;
    const fetchCounts = async () => {
      try {
        const [notifRes, ticketRes, seen] = await Promise.all([
          api.get('/customer/notifications').catch(() => ({ data: { notifications: [] } })),
          api.get('/customer/help-tickets').catch(() => ({ data: { tickets: [] } })),
          getSeenTickets(),
        ]);
        const notifs = notifRes.data?.notifications || [];
        badgeBus.setNotifs(notifs.filter((n: any) => !n.isRead).length);
        const tickets = ticketRes.data?.tickets || [];
        badgeBus.setSupport(countUnreadTickets(tickets, seen));
      } catch { /* */ }
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 15000);

    connectSocket(user._id);
    const socket = getSocket();
    if (!socket) { clearInterval(interval); return; }
    const onNotif = () => { badgeBus.incNotifs(); };
    const onTicket = () => { badgeBus.incSupport(); };
    socket.on('notification_event', onNotif);
    socket.on('help_ticket_updated', onTicket);
    return () => { clearInterval(interval); socket.off('notification_event', onNotif); socket.off('help_ticket_updated', onTicket); };
  }, [user?._id]);

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
