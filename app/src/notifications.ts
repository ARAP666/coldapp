import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Message } from './types';

const TITLE = 'Actualiza Calculadora';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let ready = false;

async function ensureNotificationsReady() {
  if (ready) return true;
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('calculator-updates', {
      name: 'Calculadora',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  ready = true;
  return true;
}

function signalIcon(msg: Message) {
  return msg.isQuick ? msg.text.trim().split(/\s+/)[0] : '';
}

export async function notifyIncomingCalculatorUpdate(msg: Message) {
  try {
    if (!(await ensureNotificationsReady())) return;
    const icon = signalIcon(msg);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: TITLE,
        body: icon ? `${icon} ${TITLE}` : TITLE,
      },
      trigger: null,
    });
  } catch {
    // Best-effort only; chat delivery must not depend on OS notification state.
  }
}
