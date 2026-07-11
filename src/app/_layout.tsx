import { useEffect } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { applyGlobalFont } from '@/lib/globalFont';

import { store } from '@/store';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { restoreSession, forceLogout, refreshMe } from '@/store/authSlice';
import { setUnauthorizedHandler } from '@/lib/api';
import { connectSocket, getSocket } from '@/lib/socket';
import { Brand } from '@/lib/config';
import { LOGO } from '@/lib/assets';
import LiveNotificationBanner from '@/components/LiveNotificationBanner';
import { ToastProvider } from '@/components/Toast';
import { LocationProvider } from '@/lib/locationContext';
import { registerPushNotifications, setupNotificationListeners } from '@/lib/pushNotifications';

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

  // Push notifications: register token + listen for taps.
  useEffect(() => {
    if (!user?._id || !token) return;
    registerPushNotifications();
    const cleanup = setupNotificationListeners((data) => {
      if (data?.bookingId) router.push(`/booking/${data.bookingId}`);
      else router.push('/notifications');
    });
    return cleanup;
  }, [user?._id, token]);

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
  // Brand typeface — Plus Jakarta Sans, applied app-wide (see globalFont).
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  applyGlobalFont();

  if (!fontsLoaded) {
    return (
      <View style={styles.splash}>
        <Image source={LOGO} style={styles.splashLogo} resizeMode="contain" />
        <ActivityIndicator color={Brand.orange} style={{ marginTop: 20 }} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <Provider store={store}>
        <LocationProvider>
          <StatusBar style="dark" />
          <RootNavigator />
          <ToastProvider />
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
