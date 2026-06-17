import React, { useState, useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  Vibration,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { QuickResponse, QUICK_BTN_COLORS } from '../types';

interface Props {
  item: QuickResponse;
  onSend: (item: QuickResponse) => void;
  compact?: boolean;
}

export function QuickButton({ item, onSend, compact = false }: Props) {
  const [confirmLevel, setConfirmLevel] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const colors = QUICK_BTN_COLORS[item.type] ?? ['#3b82f6', '#1d4ed8'];

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!item.confirm) {
      onSend(item);
      return;
    }

    // 3-press confirm for abort
    const next = confirmLevel + 1;
    setConfirmLevel(Math.min(next, 3));
    if (timerRef.current) clearTimeout(timerRef.current);

    if (next >= 3) {
      onSend(item);
      setConfirmLevel(0);
    } else {
      timerRef.current = setTimeout(() => setConfirmLevel(0), 3000);
    }
  };

  const confirmColors = [
    null,
    ['#f59e0b', '#9a3412'],
    ['#fb7185', '#be123c'],
    ['#ef4444', '#450a0a'],
  ];

  const activeColors =
    confirmLevel > 0 ? (confirmColors[confirmLevel] ?? colors) : colors;

  if (compact) {
    return (
      <TouchableOpacity
        style={[styles.compactBtn, { backgroundColor: activeColors[0] }]}
        onPress={handlePress}
        activeOpacity={0.75}
      >
        <Text style={styles.compactIcon}>{item.icon}</Text>
      </TouchableOpacity>
    );
  }

  const isAbort = item.type === 'abort';

  return (
    <TouchableOpacity
      style={[
        styles.btn,
        isAbort && styles.abortBtn,
        { backgroundColor: activeColors[0] },
      ]}
      onPress={handlePress}
      activeOpacity={0.75}
    >
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>{item.icon}</Text>
      </View>
      <Text style={styles.label} numberOfLines={2}>
        {item.label}
        {confirmLevel > 0 ? ` · ${confirmLevel}/3` : ''}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
    minHeight: 48,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  abortBtn: {
    minHeight: 56,
    borderColor: 'rgba(244,63,94,0.44)',
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 14 },
  label: {
    flex: 1,
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  compactBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactIcon: { fontSize: 20 },
});
