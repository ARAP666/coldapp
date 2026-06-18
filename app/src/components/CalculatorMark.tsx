import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  compact?: boolean;
}

const OPERATIONS = ['+', '−', '×', '÷'] as const;

export function CalculatorMark({ compact = false }: Props) {
  return (
    <View
      style={[styles.mark, compact && styles.markCompact]}
      accessibilityLabel="Calculadora"
      testID="calculator-mark"
    >
      {OPERATIONS.map((operation, index) => (
        <View
          key={operation}
          style={[
            styles.key,
            compact && styles.keyCompact,
            index === OPERATIONS.length - 1 && styles.keyAccent,
          ]}
        >
          <Text style={[styles.symbol, compact && styles.symbolCompact]}>
            {operation}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    width: 118,
    height: 118,
    padding: 12,
    borderRadius: 30,
    backgroundColor: '#17191e',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  markCompact: {
    width: 78,
    height: 78,
    padding: 8,
    borderRadius: 20,
    gap: 6,
  },
  key: {
    width: 43,
    height: 43,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#272a31',
    borderWidth: 1,
    borderColor: '#3a3e48',
  },
  keyCompact: {
    width: 28,
    height: 28,
    borderRadius: 9,
  },
  keyAccent: {
    backgroundColor: '#3b82f6',
    borderColor: '#68a1ff',
  },
  symbol: {
    color: '#f6f7fb',
    fontSize: 25,
    fontWeight: '500',
    lineHeight: 29,
  },
  symbolCompact: {
    fontSize: 17,
    lineHeight: 20,
  },
});
