import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../types';

interface Props {
  codename: string | null;
  connected: boolean;
  onJoin: () => void;
  onAbort: () => void;
}

export function JoinScreen({ codename, connected, onJoin, onAbort }: Props) {
  // Vibrate softly when the codename arrives — confirms "you've been seen".
  useEffect(() => {
    if (codename) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {}
      );
    }
  }, [codename]);

  const ready = Boolean(codename && connected);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.inner}>
        <View style={styles.logoSection}>
          <Text style={styles.logoTitle}>FRÍA</Text>
          <Text style={styles.logoSub}>red cifrada · privada</Text>
          <View style={styles.badgeRow}>
            <View style={styles.badge}><Text style={styles.badgeTxt}>E2E</Text></View>
            <View style={styles.badge}><Text style={styles.badgeTxt}>AES-256</Text></View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>NOMBRE CLAVE DE SESIÓN</Text>
          {codename ? (
            <Text style={styles.codename} testID="assigned-codename">
              {codename}
            </Text>
          ) : (
            <View style={styles.codenameLoading} testID="codename-loading">
              <ActivityIndicator color={COLORS.blue} />
              <Text style={styles.codenameLoadingTxt}>asignando…</Text>
            </View>
          )}
          <Text style={styles.hint}>
            Se genera automáticamente al entrar. Nadie ve tu nombre real.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.joinBtn, !ready && styles.joinBtnDisabled]}
          onPress={onJoin}
          activeOpacity={0.8}
          disabled={!ready}
          testID="enter-button"
        >
          <Text style={styles.joinBtnTxt}>
            {ready ? 'ENTRAR A LA RED' : 'ESPERANDO…'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.abortBtn} onPress={onAbort} activeOpacity={0.7}>
          <Text style={styles.abortTxt}>volver a la calculadora</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Los chats son temporales. Cuando todos salgan, se borran solos.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    gap: 24,
  },
  logoSection: { alignItems: 'center', gap: 6 },
  logoTitle: {
    fontSize: 48,
    fontWeight: '700',
    color: COLORS.txt,
    letterSpacing: 12,
    fontFamily: 'Courier New',
  },
  logoSub: { fontSize: 11, color: COLORS.txt3, fontFamily: 'Courier New', letterSpacing: 2 },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  badge: {
    backgroundColor: COLORS.greenDim,
    borderWidth: 1,
    borderColor: '#22c55e30',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeTxt: { fontSize: 10, color: COLORS.green, fontWeight: '600' },
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  cardLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.txt3,
    letterSpacing: 1.5,
    fontFamily: 'Courier New',
  },
  codename: {
    fontSize: 32,
    color: COLORS.txt,
    fontFamily: 'Courier New',
    letterSpacing: 4,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 8,
  },
  codenameLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  codenameLoadingTxt: {
    fontSize: 13,
    color: COLORS.txt2,
    fontFamily: 'Courier New',
    letterSpacing: 1,
  },
  hint: { fontSize: 11, color: COLORS.txt3, textAlign: 'center' },
  joinBtn: {
    backgroundColor: COLORS.blue,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  joinBtnDisabled: { opacity: 0.4 },
  joinBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 1.5 },
  abortBtn: { alignItems: 'center', paddingVertical: 8 },
  abortTxt: { color: COLORS.txt3, fontSize: 11, fontFamily: 'Courier New', letterSpacing: 1 },
  disclaimer: {
    fontSize: 11,
    color: COLORS.txt3,
    textAlign: 'center',
    lineHeight: 17,
  },
});
