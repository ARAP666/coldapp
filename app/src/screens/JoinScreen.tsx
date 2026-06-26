import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../types';
import { CalculatorMark } from '../components/CalculatorMark';

interface Props {
  codename: string | null;
  connected: boolean;
  connectionError: string | null;
  roomCode: string | null;
  pendingAnswerCode: string | null;
  onCreateRoom: () => void;
  onJoinRoomCode: (code: string) => void;
  onAcceptAnswerCode: (code: string) => void;
  onShareRoomCode: () => void;
  onShareAnswerCode: () => void;
  onRetry: () => void;
  onJoin: () => void;
  onAbort: () => void;
}

export function JoinScreen({
  codename,
  connected,
  connectionError,
  roomCode,
  pendingAnswerCode,
  onCreateRoom,
  onJoinRoomCode,
  onAcceptAnswerCode,
  onShareRoomCode,
  onShareAnswerCode,
  onRetry,
  onJoin,
  onAbort,
}: Props) {
  const [joinCode, setJoinCode] = useState('');
  const [answerCode, setAnswerCode] = useState('');

  useEffect(() => {
    if (codename) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {}
      );
    }
  }, [codename]);

  const ready = Boolean(codename);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.inner}>
        <View style={styles.logoSection}>
          <CalculatorMark compact />
          <Text style={styles.logoTitle}>FRIA</Text>
          <Text style={styles.logoSub}>red directa sin servidor</Text>
          <View style={styles.badgeRow}>
            <View style={styles.badge}><Text style={styles.badgeTxt}>P2P</Text></View>
            <View style={styles.badge}><Text style={styles.badgeTxt}>WEBRTC</Text></View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>SALA SIN API NI BASE DE DATOS</Text>
          {connectionError ? (
            <View style={styles.connectionError} testID="connection-error">
              <Text style={styles.connectionErrorTitle}>CODIGO NO CONECTO</Text>
              <Text style={styles.connectionErrorText}>
                Revisa el codigo o prueba en la misma red.
              </Text>
              <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
                <Text style={styles.retryBtnText}>NUEVA SALA</Text>
              </TouchableOpacity>
            </View>
          ) : codename ? (
            <Text style={styles.codename} testID="assigned-codename">
              {codename}
            </Text>
          ) : (
            <View style={styles.codenameLoading} testID="codename-loading">
              <View style={styles.loadingVisual}>
                <CalculatorMark compact />
                <ActivityIndicator
                  color={COLORS.blue}
                  size="small"
                  style={styles.loadingSpinner}
                />
              </View>
              <View style={styles.loadingCopy}>
                <Text style={styles.codenameLoadingTitle}>SIN SESION</Text>
                <Text style={styles.codenameLoadingTxt}>
                  crea una sala o pega una invitacion
                </Text>
              </View>
            </View>
          )}
          <Text style={styles.hint}>
            Los codigos se comparten por chat. FRIA no guarda salas ni mensajes.
          </Text>
        </View>

        {!codename && (
          <View style={styles.card}>
            <TouchableOpacity style={styles.joinBtn} onPress={onCreateRoom} activeOpacity={0.8}>
              <Text style={styles.joinBtnTxt}>CREAR SALA</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.codeInput}
              value={joinCode}
              onChangeText={setJoinCode}
              placeholder="pegar invitacion recibida"
              placeholderTextColor={COLORS.txt3}
              multiline
              testID="room-code-input"
            />
            <TouchableOpacity
              style={[styles.retryBtn, !joinCode.trim() && styles.joinBtnDisabled]}
              onPress={() => onJoinRoomCode(joinCode)}
              disabled={!joinCode.trim()}
            >
              <Text style={styles.retryBtnText}>USAR INVITACION</Text>
            </TouchableOpacity>
          </View>
        )}

        {codename && !roomCode && !pendingAnswerCode && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>SUMAR PERSONA</Text>
            <TouchableOpacity style={styles.joinBtn} onPress={onCreateRoom} activeOpacity={0.8}>
              <Text style={styles.joinBtnTxt}>CREAR OTRA INVITACION</Text>
            </TouchableOpacity>
          </View>
        )}

        {roomCode && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>INVITACION</Text>
            <TouchableOpacity style={styles.joinBtn} onPress={onShareRoomCode} activeOpacity={0.8}>
              <Text style={styles.joinBtnTxt}>COMPARTIR CODIGO</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.codeInput}
              value={answerCode}
              onChangeText={setAnswerCode}
              placeholder="pegar respuesta del invitado"
              placeholderTextColor={COLORS.txt3}
              multiline
            />
            <TouchableOpacity
              style={[styles.retryBtn, !answerCode.trim() && styles.joinBtnDisabled]}
              onPress={() => onAcceptAnswerCode(answerCode)}
              disabled={!answerCode.trim()}
            >
              <Text style={styles.retryBtnText}>ACEPTAR RESPUESTA</Text>
            </TouchableOpacity>
          </View>
        )}

        {pendingAnswerCode && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>RESPUESTA LISTA</Text>
            <TouchableOpacity style={styles.joinBtn} onPress={onShareAnswerCode} activeOpacity={0.8}>
              <Text style={styles.joinBtnTxt}>ENVIAR RESPUESTA</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={[styles.joinBtn, !ready && styles.joinBtnDisabled]}
          onPress={onJoin}
          activeOpacity={0.8}
          disabled={!ready}
          testID="enter-button"
        >
          <Text style={styles.joinBtnTxt}>
            {ready ? 'ENTRAR A LA RED' : 'CREA O PEGA UN CODIGO'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.abortBtn} onPress={onAbort} activeOpacity={0.7}>
          <Text style={styles.abortTxt}>volver a la calculadora</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Sin servidor: si todos salen, la sala desaparece.
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
    gap: 16,
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
    borderRadius: 8,
    padding: 14,
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
    fontSize: 28,
    color: COLORS.txt,
    fontFamily: 'Courier New',
    letterSpacing: 3,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 8,
  },
  codenameLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 12,
  },
  loadingVisual: { position: 'relative' },
  loadingSpinner: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
  },
  loadingCopy: { gap: 5, flex: 1 },
  codenameLoadingTitle: {
    fontSize: 12,
    color: COLORS.txt,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  codenameLoadingTxt: {
    fontSize: 10,
    color: COLORS.txt3,
    fontFamily: 'Courier New',
    letterSpacing: 0.7,
  },
  connectionError: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  connectionErrorTitle: { color: '#ef4444', fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  connectionErrorText: { color: COLORS.txt2, fontSize: 12, textAlign: 'center' },
  retryBtn: {
    borderWidth: 1,
    borderColor: COLORS.blue,
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 9,
    alignItems: 'center',
  },
  retryBtnText: { color: COLORS.blue, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  hint: { fontSize: 11, color: COLORS.txt3, textAlign: 'center' },
  codeInput: {
    minHeight: 72,
    maxHeight: 120,
    backgroundColor: COLORS.surface2,
    borderWidth: 1,
    borderColor: COLORS.border2,
    borderRadius: 8,
    padding: 10,
    color: COLORS.txt,
    fontSize: 11,
    fontFamily: 'Courier New',
    textAlignVertical: 'top',
  },
  joinBtn: {
    backgroundColor: COLORS.blue,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  joinBtnDisabled: { opacity: 0.4 },
  joinBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 1.2 },
  abortBtn: { alignItems: 'center', paddingVertical: 6 },
  abortTxt: { color: COLORS.txt3, fontSize: 11, fontFamily: 'Courier New', letterSpacing: 1 },
  disclaimer: { fontSize: 11, color: COLORS.txt3, textAlign: 'center', lineHeight: 17 },
});
