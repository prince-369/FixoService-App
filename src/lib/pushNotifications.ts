import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import api from '@/lib/api';

// Configure how notifications appear when app is in foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Register for push notifications.
 * Call this after user logs in successfully.
 */
export async function registerPushNotifications(): Promise<string | null> {
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
 * Listen for notifications.
 */
export function setupNotificationListeners(onNotificationTap: (data: any) => void): () => void {
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
