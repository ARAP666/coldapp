import * as Notifications from 'expo-notifications';
import { notifyIncomingCalculatorUpdate } from '../src/notifications';
import { Message } from '../src/types';

const msg = (partial: Partial<Message>): Message => ({
  id: '1',
  alias: 'FRIA-1',
  text: 'hola',
  type: 'text',
  color: null,
  timestamp: 1,
  ...partial,
});

describe('notifyIncomingCalculatorUpdate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('hides normal message text behind calculator copy', async () => {
    await notifyIncomingCalculatorUpdate(msg({ text: 'secreto' }));

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: {
        title: 'Actualiza Calculadora',
        body: 'Actualiza Calculadora',
      },
      trigger: null,
    });
  });

  it('keeps the quick alert icon when one exists', async () => {
    await notifyIncomingCalculatorUpdate(msg({ text: '⚠️ cuidado', type: 'warn', isQuick: true }));

    expect(Notifications.scheduleNotificationAsync).toHaveBeenLastCalledWith({
      content: {
        title: 'Actualiza Calculadora',
        body: '⚠️ Actualiza Calculadora',
      },
      trigger: null,
    });
  });
});
