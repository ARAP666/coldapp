import * as SecureStore from 'expo-secure-store';
import { clearLocalFriaData } from '../src/localData';

describe('clearLocalFriaData', () => {
  it('removes every persisted FRÍA key', async () => {
    await clearLocalFriaData();

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('fria.pushToken');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('fria.cleanupDone.v1');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('fria.crashLog');
  });
});
