import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../types';

const { width } = Dimensions.get('window');
const GAP = 12;
const PADDING = 20;
const BTN_SIZE = (width - PADDING * 2 - GAP * 3) / 4;

interface Props {
  onUnlock: () => void;
}

type CalcFn = 'ac' | 'neg' | 'pct' | 'dot' | 'eq';
type CalcOp = '+' | '−' | '×' | '÷';

const BUTTONS: Array<{ label: string; fn?: CalcFn; op?: CalcOp; n?: string; style: 'fn' | 'op' | 'num' | 'zero' | 'eq' }> = [
  { label: 'AC',  fn: 'ac',  style: 'fn' },
  { label: '+/−', fn: 'neg', style: 'fn' },
  { label: '%',   fn: 'pct', style: 'fn' },
  { label: '÷',   op: '÷',  style: 'op' },
  { label: '7',   n: '7',    style: 'num' },
  { label: '8',   n: '8',    style: 'num' },
  { label: '9',   n: '9',    style: 'num' },
  { label: '×',   op: '×',  style: 'op' },
  { label: '4',   n: '4',    style: 'num' },
  { label: '5',   n: '5',    style: 'num' },
  { label: '6',   n: '6',    style: 'num' },
  { label: '−',   op: '−',  style: 'op' },
  { label: '1',   n: '1',    style: 'num' },
  { label: '2',   n: '2',    style: 'num' },
  { label: '3',   n: '3',    style: 'num' },
  { label: '+',   op: '+',  style: 'op' },
  { label: '0',   n: '0',    style: 'zero' },
  { label: '.',   fn: 'dot', style: 'num' },
  { label: '=',   fn: 'eq',  style: 'eq' },
];

function calcOp(a: number, b: number, op: CalcOp): number {
  switch (op) {
    case '+': return a + b;
    case '−': return a - b;
    case '×': return a * b;
    case '÷': return b !== 0 ? a / b : 0;
    default: return b;
  }
}

export function CalculatorScreen({ onUnlock }: Props) {
  const [cur, setCur] = useState('0');
  const [expr, setExpr] = useState('');
  const [op, setOp] = useState<CalcOp | null>(null);
  const [prev, setPrev] = useState<string | null>(null);
  const [fresh, setFresh] = useState(false);

  const press = useCallback(
    (btn: typeof BUTTONS[0]) => {
      Vibration.vibrate(8);

      if (btn.n !== undefined) {
        setCur((c) => {
          if (fresh || c === '0') { setFresh(false); return btn.n!; }
          if (c.length >= 10) return c;
          return c + btn.n;
        });
        return;
      }

      if (btn.op) {
        const newPrev = prev !== null && op && !fresh
          ? String(calcOp(parseFloat(prev), parseFloat(cur), op))
          : cur;
        setPrev(newPrev);
        setOp(btn.op);
        setFresh(true);
        setExpr(newPrev + ' ' + btn.op);
        return;
      }

      if (btn.fn === 'eq') {
        if (prev !== null && op) {
          const res = calcOp(parseFloat(prev), parseFloat(cur), op);
          setExpr(prev + ' ' + op + ' ' + cur + ' =');
          setCur(String(res));
          setOp(null);
          setPrev(null);
          setFresh(true);
          if (Math.round(res) === 666) {
            setTimeout(onUnlock, 400);
          }
        }
        return;
      }

      if (btn.fn === 'ac') {
        setCur('0'); setExpr(''); setOp(null); setPrev(null); setFresh(false);
        return;
      }
      if (btn.fn === 'neg') {
        setCur((c) => parseFloat(c) !== 0 ? String(-parseFloat(c)) : c);
        return;
      }
      if (btn.fn === 'pct') {
        setCur((c) => String(parseFloat(c) / 100));
        return;
      }
      if (btn.fn === 'dot') {
        setCur((c) => { if (!c.includes('.')) { setFresh(false); return c + '.'; } return c; });
        return;
      }
    },
    [cur, op, prev, fresh, onUnlock]
  );

  const displayFontSize = cur.length > 9 ? 40 : cur.length > 6 ? 56 : 72;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.display}>
        <Text style={styles.expr}>{expr}</Text>
        <Text style={[styles.number, { fontSize: displayFontSize }]} numberOfLines={1} adjustsFontSizeToFit>
          {cur}
        </Text>
      </View>

      <View style={styles.grid}>
        {BUTTONS.map((btn, i) => {
          const isZero = btn.style === 'zero';
          const isEq = btn.style === 'eq';
          const isOp = btn.style === 'op' || isEq;
          const isFn = btn.style === 'fn';

          return (
            <TouchableOpacity
              key={i}
              activeOpacity={0.7}
              style={[
                styles.btn,
                isZero && styles.btnZero,
                isOp && styles.btnOp,
                isFn && styles.btnFn,
              ]}
              onPress={() => press(btn)}
            >
              <Text style={[styles.btnLabel, isFn && styles.btnLabelFn, isOp && styles.btnLabelOp]}>
                {btn.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  display: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: PADDING,
    paddingBottom: 12,
  },
  expr: {
    fontSize: 16,
    color: COLORS.txt3,
    textAlign: 'right',
    fontFamily: 'Courier New',
    minHeight: 24,
  },
  number: {
    color: COLORS.txt,
    textAlign: 'right',
    fontWeight: '300',
    letterSpacing: -3,
    lineHeight: undefined,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: PADDING,
    paddingBottom: 24,
    gap: GAP,
  },
  btn: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: BTN_SIZE / 2,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnZero: {
    width: BTN_SIZE * 2 + GAP,
    borderRadius: BTN_SIZE / 2,
    paddingLeft: 28,
    alignItems: 'flex-start',
  },
  btnOp: {
    backgroundColor: COLORS.opOrange,
  },
  btnFn: {
    backgroundColor: COLORS.surface2,
  },
  btnLabel: {
    fontSize: 26,
    color: COLORS.txt,
    fontWeight: '400',
  },
  btnLabelFn: {
    fontSize: 18,
    fontWeight: '500',
  },
  btnLabelOp: {
    fontSize: 30,
    color: '#fff',
    fontWeight: '400',
  },
});
