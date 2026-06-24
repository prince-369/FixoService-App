import { useEffect } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';

import { store } from '@/store';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { restoreSession, forceLogout, refreshMe } from '@/store/authSlice';
import { setUnauthorizedHandler } from '@/lib/api';
import { connectSocket, getSocket } from '@/lib/socket';
import { Brand } from '@/lib/config';
import { LOGO } from '@/lib/assets';
import LiveNotificationBanner from '@/components/LiveNotificationBanner';
import { LocationProvider } from '@/lib/locationContext';

function RootNavigator() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const segments = useSegments();
  const { token, hydrated, block, user } = useAppSelector((s) => s.auth);

  // Restore the saved session once on launch.
  useEffect(() => {
    void dispatch(restoreSession());
    // When any request 401s, drop the session so the guard routes to login.
    setUnauthorizedHandler(() => dispatch(forceLogout()));
  }, [dispatch]);

  // Real-time block/unblock: refresh /auth/me when an admin acts.
  useEffect(() => {
    if (!user?._id) return;
    connectSocket(user._id);
    const socket = getSocket();
    if (!socket) return;
    const onChange = () => dispatch(refreshMe());
    socket.on('account_blocked', onChange);
    socket.on('account_unblocked', onChange);
    return () => { socket.off('account_blocked', onChange); socket.off('account_unblocked', onChange); };
  }, [user?._id, dispatch]);

  // Auth + block gate.
  useEffect(() => {
    if (!hydrated) return;
    const inAuthGroup = segments[0] === '(auth)';
    const onBlocked = segments[0] === 'blocked';
    if (!token && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (token && block?.isBlocked && !onBlocked) {
      router.replace('/blocked');
    } else if (token && !block?.isBlocked && (inAuthGroup || onBlocked)) {
      router.replace('/(tabs)');
    }
  }, [hydrated, token, block?.isBlocked, segments, router]);

  if (!hydrated) {
    return (
      <View style={styles.splash}>
        <Image source={LOGO} style={styles.splashLogo} resizeMode="contain" />
        <ActivityIndicator color={Brand.orange} style={{ marginTop: 20 }} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
      </Stack>
      <LiveNotificationBanner />
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Provider store={store}>
        <LocationProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </LocationProvider>
      </Provider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.navy,
  },
  splashLogo: { width: 190, height: 66 },
});
