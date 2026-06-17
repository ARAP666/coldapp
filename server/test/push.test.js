// Tests for the Expo push helper. Mocks fetch.

import { describe, it, expect, vi } from 'vitest';
import { sendExpoPush, buildUpdateCalculatorPush } from '../src/push.js';

describe('sendExpoPush', () => {
  it('does nothing when the message list is empty', async () => {
    const fetchFn = vi.fn();
    const result = await sendExpoPush([], { fetchFn });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, sent: 0, data: null });
  });

  it('POSTs the messages to the Expo push endpoint', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ status: 'ok' }] }),
    });
    const messages = [
      { to: 'ExponentPushToken[abc]', title: 't', body: 'b' },
    ];
    const result = await sendExpoPush(messages, { fetchFn, logger: { log() {} } });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://exp.host/--/api/v2/push/send');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual(messages);
    expect(result).toEqual({
      ok: true,
      sent: 1,
      data: { data: [{ status: 'ok' }] },
    });
  });

  it('throws when the server returns a non-2xx', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'rate limited',
    });
    await expect(
      sendExpoPush([{ to: 'x', title: 't', body: 'b' }], { fetchFn })
    ).rejects.toThrow(/expo push 429/);
  });
});

describe('buildUpdateCalculatorPush', () => {
  it('produces one message per token with the cover-story text', () => {
    const out = buildUpdateCalculatorPush({
      tokens: ['ExponentPushToken[a]', 'ExponentPushToken[b]'],
      codename: 'BRAVO-07',
      hoursIdle: 2,
    });
    expect(out).toHaveLength(2);
    expect(out[0].to).toBe('ExponentPushToken[a]');
    expect(out[0].title).toBe('Actualizá la calculadora');
    expect(out[0].body).toMatch(/calculadora/i);
    expect(out[0].data).toEqual({ kind: 'update_calculator', codename: 'BRAVO-07', hoursIdle: 2 });
  });
});
