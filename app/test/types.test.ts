// Tests for the shared AlertType enum + color tables in src/types.

import { COLORS, ALERT_COLORS, QUICK_BTN_COLORS } from '../src/types';
import type { AlertType } from '../src/types';

const ALL_TYPES: AlertType[] = [
  'text',
  'status',
  'alert',
  'police',
  'danger',
  'warn',
  'stop',
  'distance',
  'service',
  'food',
  'restroom',
  'clear',
  'abort',
];

describe('theme colors', () => {
  it('every AlertType has an ALERT_COLORS entry', () => {
    for (const t of ALL_TYPES) {
      expect(ALERT_COLORS[t]).toBeDefined();
      const c = ALERT_COLORS[t];
      expect(typeof c.text).toBe('string');
      expect(typeof c.bg).toBe('string');
      expect(typeof c.border).toBe('string');
    }
  });

  it('QUICK_BTN_COLORS has a palette for every non-text type', () => {
    const nonText = ALL_TYPES.filter((t) => t !== 'text');
    for (const t of nonText) {
      expect(QUICK_BTN_COLORS[t]).toBeDefined();
      const c = QUICK_BTN_COLORS[t];
      expect(c).toHaveLength(2);
    }
  });

  it('exposes core COLORS keys', () => {
    expect(COLORS.bg).toBeDefined();
    expect(COLORS.txt).toBeDefined();
    expect(COLORS.blue).toBeDefined();
    expect(COLORS.red).toBeDefined();
  });
});
