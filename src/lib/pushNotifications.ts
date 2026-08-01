import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import api from '@/lib/api';

/**
 * Push notifications.
 *
 * `expo-notifications` runs device-push auto-registration at import time, and since
 * SDK 53 that code throws inside Expo Go (remote push was removed from the Go client).
 * A top-level import therefore crashed _layout.tsx on boot.
 *
 * Fix: require the module lazily and never touch it in Expo Go. Push then works
 * normally in a development/production build, and is silently skipped in Expo Go.
 */

/** Expo Go reports 'storeClient'; dev/prod builds report 'standalone' or 'bare'.
 *  Same detection as settings.tsx — keep the two in sync. */
const isExpoGo =
  Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';

type NotificationsModule = typeof import('expo-notifications');

let mod: NotificationsModule | null = null;
let loadAttempted = false;

function loadNotifications(): NotificationsModule | null {
  if (loadAttempted) return mod;
  loadAttempted = true;
  if (isExpoGo) return (mod = null); // Push isn't supported in Expo Go — don't even import.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('expo-notifications') as NotificationsModule;
    // Foreground presentation, configured once on first successful load.
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {
    mod = null;
  }
  return mod;
}

/** True only where remote push can actually work (i.e. not Expo Go). */
export function isPushAvailable(): boolean {
  return loadNotifications() !== null;
}

/**
 * Register for push notifications.
 * Call this after user logs in successfully.
 */
export async function registerPushNotifications(): Promise<string | null> {
  const Notifications = loadNotifications();
  if (!Notifications) {
    console.log('[Push] Skipped — needs a development build (not available in Expo Go)');
    return null;
  }

  if (!Device.isDevice) {
    console.log('[Push] Not a physical device, skipping registration');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Push] Permission not granted');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#f97316',
      sound: 'default',
    });
  }

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId || undefined,
    });
    const token = tokenData.data;
    console.log('[Push] Expo push token:', token);

    // Send to backend
    await api.post('/notifications/mobile/register', {
      token,
      platform: Platform.OS,
      deviceName: Device.deviceName || 'Unknown',
    }).catch((e) => {
      console.log('[Push] Failed to send token to server:', e?.message);
    });

    return token;
  } catch (error) {
    console.log('[Push] Error getting token:', error);
    return null;
  }
}

/**
 * Listen for notifications. Returns a no-op unsubscribe where push is unavailable,
 * so callers can always just call it in an effect cleanup.
 */
export function setupNotificationListeners(onNotificationTap: (data: any) => void): () => void {
  const Notifications = loadNotifications();
  if (!Notifications) return () => {};

  const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    onNotificationTap(data);
  });

  const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
    console.log('[Push] Received in foreground:', notification.request.content.title);
  });

  return () => {
    responseSubscription.remove();
    receivedSubscription.remove();
  };
}
