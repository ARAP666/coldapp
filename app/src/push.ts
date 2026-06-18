// Push notification registration + foreground behavior.
//
// Behavior:
//   - Foreground: messages arrive via socket.on('message'). We vibrate
//     and play the system sound. We do NOT show a system notification
//     because the user is already looking at the chat.
//   - Background: pushes from the server ("actualizá la calculadora")
//     arrive via Expo/FCM and show as a system notification with sound.
//   - All chat content stays in the app; the system tray only ever sees
//     the cover-story text.

import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const PUSH_TOKEN_KEY = 'fria.pushToken';

async function loadNotifications() {
  // Since SDK 53, Expo Go no longer contains Android remote-push support.
  // Avoid importing expo-notifications there because the module reports a
  // runtime error before React (and therefore ErrorBoundary) can mount.
  if (
    Platform.OS === 'web' ||
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient
  ) {
    return null;
  }

  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}

export async function getExpoPushTokenAsync() {
  if (!Device.isDevice) return null;

  const Notifications = await loadNotifications();
  if (!Notifications) return null;

  let status = 'unknown';
  try {
    const settings = await Notifications.getPermissionsAsync();
    status = settings.status;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
  } catch {
    return null;
  }
  if (status !== 'granted') return null;

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || undefined,
    });
    // Persist in secure storage so we can re-register without asking the
    // user again and so the server can recover it after a relaunch.
    try {
      await SecureStore.setItemAsync(PUSH_TOKEN_KEY, data);
    } catch {
      // SecureStore not available (e.g. on web). Ignore.
    }
    return data;
  } catch {
    return null;
  }
}

export async function getStoredPushTokenAsync() {
  try {
    return await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function configureForegroundPush() {
  const Notifications = await loadNotifications();
  if (!Notifications) return;

  try {
    // Foreground: do NOT show a banner. The user is already looking at
    // the chat, so a banner would just be noise (and would leak the
    // cover). Background pushes still render because they bypass this
    // handler.
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      }),
    });
  } catch {
    // Notifications not available (e.g. on web). Swallow.
  }
}
