import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Message, ALERT_COLORS, COLORS } from '../types';

interface Props {
  msg: Message;
  myAlias: string;
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'ahora';
  if (diff < 3600000) return `hace ${Math.floor(diff / 60000)} min`;
  return new Date(ts).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

export function ChatBubble({ msg, myAlias }: Props) {
  const isOut = msg.alias === myAlias;
  const colors = ALERT_COLORS[msg.type] ?? ALERT_COLORS.text;

  const bubbleStyle = msg.type !== 'text'
    ? { backgroundColor: colors.bg, borderColor: colors.border }
    : isOut
    ? { backgroundColor: '#3b82f614', borderColor: '#3b82f640' }
    : { backgroundColor: COLORS.surface2, borderColor: COLORS.border };

  const textColor = msg.type !== 'text' ? colors.text : isOut ? '#7db8ff' : COLORS.txt2;

  return (
    <View style={[styles.wrap, isOut && styles.outWrap]}>
      <Text style={styles.meta}>
        {msg.alias} · {formatTime(msg.timestamp)}
      </Text>
      <View style={[styles.bubble, bubbleStyle, isOut && styles.outBubble]}>
        <Text style={[styles.text, { color: textColor }]}>{msg.text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  outWrap: {
    alignItems: 'flex-end',
  },
  meta: {
    fontSize: 10,
    color: COLORS.txt3,
    marginBottom: 4,
    fontFamily: 'Courier New',
    letterSpacing: 0.4,
  },
  bubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    maxWidth: '82%',
  },
  outBubble: {
    borderBottomRightRadius: 4,
  },
  text: {
    fontSize: 13,
    lineHeight: 18,
  },
});
