import * as SecureStore from 'expo-secure-store';

const FRIA_KEYS = [
  'fria.pushToken',
  'fria.cleanupDone.v1',
  'fria.crashLog',
];

export async function clearLocalFriaData(): Promise<void> {
  await Promise.all(
    FRIA_KEYS.map(async (key) => {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch {
        // Best-effort: storage failure must not block emergency exit.
      }
    })
  );
}
