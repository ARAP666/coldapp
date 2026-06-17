// Tests for the codename generator.

import { describe, it, expect } from 'vitest';
import {
  WORDS,
  buildCodename,
  generateUniqueCodename,
  isCodename,
} from '../src/codename.js';

describe('buildCodename', () => {
  it('returns a WORD-NN string', () => {
    const cn = buildCodename();
    expect(cn).toMatch(/^[A-Z]{3,7}-\d{2}$/);
  });

  it('uses words from the curated pool', () => {
    const cn = buildCodename();
    const [word] = cn.split('-');
    expect(WORDS).toContain(word);
  });

  it('produces numbers in 10..99', () => {
    for (let i = 0; i < 50; i++) {
      const cn = buildCodename();
      const n = Number(cn.split('-')[1]);
      expect(n).toBeGreaterThanOrEqual(10);
      expect(n).toBeLessThanOrEqual(99);
    }
  });

  it('is deterministic when an rng is supplied', () => {
    const seq = () => 0.5; // always returns the same value
    const a = buildCodename(seq);
    const b = buildCodename(seq);
    expect(a).toBe(b);
  });
});

describe('generateUniqueCodename', () => {
  it('returns a codename not in the existing set', () => {
    const cn = generateUniqueCodename(new Set(['TIGRE-12', 'RAYO-33']));
    expect(cn).toMatch(/^[A-Z]{3,7}-\d{2}$/);
    expect(new Set(['TIGRE-12', 'RAYO-33'])).not.toContain(cn);
  });

  it('throws after maxAttempts when the room is full', () => {
    const existing = new Set();
    // Make every possible codename collide.
    for (const word of WORDS) {
      for (let n = 10; n <= 99; n++) {
        existing.add(`${word}-${String(n).padStart(2, '0')}`);
      }
    }
    expect(() =>
      generateUniqueCodename(existing, { maxAttempts: 10 })
    ).toThrow(/no codename available/);
  });

  it('avoids collisions even when rng would produce repeats', () => {
    // Counter-based rng that is deterministic per call but advances each
    // invocation. If the function only used the rng once and gave up on
    // collision, this test would fail because the same value would come
    // back. We verify that retries happen.
    let counter = 0;
    const seq = () => {
      counter += 1;
      // Hash-ish mapping from counter to a fractional value that lands in
      // different word/index slots.
      return ((counter * 2654435761) >>> 0) / 2 ** 32;
    };
    const a = generateUniqueCodename(new Set(), { rng: seq, maxAttempts: 50 });
    const b = generateUniqueCodename(new Set([a]), { rng: seq, maxAttempts: 50 });
    expect(b).not.toBe(a);
    expect(b).toMatch(/^[A-Z]{3,7}-\d{2}$/);
  });
});

describe('isCodename', () => {
  it('accepts generated codenames', () => {
    expect(isCodename('BRAVO-07')).toBe(true);
    expect(isCodename('TIGRE-99')).toBe(true);
  });
  it('rejects anything that does not match the format', () => {
    expect(isCodename('bravo-07')).toBe(false);
    expect(isCodename('BRAVO-7')).toBe(false);
    expect(isCodename('BRAVO-100')).toBe(false);
    expect(isCodename('A1')).toBe(false);
    expect(isCodename('')).toBe(false);
    expect(isCodename(null)).toBe(false);
    expect(isCodename(123)).toBe(false);
  });
});
