// First-run cleanup: reminds the user to delete the install package
// (the APK zip + extracted folder) from the device's Downloads area and
// offers a best-effort auto-delete via the system Filesystem picker.
//
// On iOS, the app sandbox prevents apps from reading outside its own
// directory, so this module is best-effort only. On Android 11+ the
// Storage Access Framework is the supported way to grant temporary
// access to user-picked folders.

import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as SecureStore from 'expo-secure-store';
import { Alert, Platform } from 'react-native';

const CLEANUP_DONE_KEY = 'fria.cleanupDone.v1';
const TARGET_PATTERNS: RegExp[] = [
  /^calculadora-fria/i,
  /^coldapp/i,
  /\.apk$/i,
  /\.zip$/i,
];

export function looksLikeInstallArtifact(name?: string): boolean {
  if (!name) return false;
  return TARGET_PATTERNS.some((re) => re.test(name));
}

export async function isCleanupDone(): Promise<boolean> {
  try {
    const v = await SecureStore.getItemAsync(CLEANUP_DONE_KEY);
    return v === '1';
  } catch {
    return false;
  }
}

export async function markCleanupDone(): Promise<void> {
  try {
    await SecureStore.setItemAsync(CLEANUP_DONE_KEY, '1');
  } catch {
    // ignore
  }
}

export interface CleanupResult {
  found: string[];
  deleted: string[];
  skipped?: string;
}

// Best-effort auto-delete flow. We use DocumentPicker so the user
// explicitly grants access to the Downloads folder (or any other folder
// they pick). On iOS, this often returns individual file URIs rather
// than a folder, but it still works for picking the install artifacts
// they remember.
export async function runCleanupScan(): Promise<CleanupResult> {
  if (Platform.OS === 'web') {
    return { found: [], deleted: [], skipped: 'web-no-filesystem' };
  }

  let result: DocumentPicker.DocumentPickerResult;
  try {
    result = await DocumentPicker.getDocumentAsync({
      type: ['*/*'],
      multiple: true,
      copyToCacheDirectory: true,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { found: [], deleted: [], skipped: `picker-error: ${msg}` };
  }
  if (result.canceled || !result.assets) {
    return { found: [], deleted: [], skipped: 'cancelled' };
  }

  const found: string[] = [];
  const deleted: string[] = [];
  for (const asset of result.assets) {
    if (!looksLikeInstallArtifact(asset.name)) continue;
    found.push(asset.name);
    try {
      // Best-effort: try to delete the picked URI. The picker grants
      // temporary access; whether deletion succeeds depends on the
      // platform and the source.
      await FileSystem.deleteAsync(asset.uri, { idempotent: true });
      deleted.push(asset.name);
    } catch {
      // ignore — user can still delete manually
    }
  }

  return { found, deleted };
}

// Show a native Alert explaining what the user should do.
export function showCleanupHint(): void {
  Alert.alert(
    'Borrá los archivos de instalación',
    'Para que la app no se delate como instalable manualmente, andá a Descargas y borrá el archivo ZIP y la carpeta extraída de "calculadora-fria" (o "coldapp"). También desactivá "Orígenes desconocidos" si lo activaste para instalar la APK.',
    [
      { text: 'Más tarde', style: 'cancel' },
      { text: 'Buscar y borrar', onPress: () => { runCleanupScan().then(showCleanupResult); } },
    ]
  );
}

function showCleanupResult(result: CleanupResult): void {
  if (result.skipped) {
    Alert.alert('Limpieza cancelada', result.skipped);
    return;
  }
  if (result.found.length === 0) {
    Alert.alert(
      'No encontré archivos',
      'No seleccionaste ningún archivo con nombre de instalador. Borrá manualmente desde Descargas y volvé a abrir la app.'
    );
    return;
  }
  if (result.deleted.length === 0) {
    Alert.alert(
      'No pude borrarlos',
      `Encontré: ${result.found.join(', ')}, pero la app no tiene permiso para borrarlos. Hacelo manualmente desde Descargas.`
    );
    return;
  }
  const leftover = result.found.length > result.deleted.length
    ? ' Otros archivos quedaron.'
    : '';
  Alert.alert('Listo', `Borrado: ${result.deleted.join(', ')}.${leftover}`);
}
