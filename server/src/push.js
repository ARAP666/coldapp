// Expo push notification helper.
// Posts batches of messages to https://exp.host/--/api/v2/push/send.
// Fetch is injected so tests can mock it.

const DEFAULT_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

async function sendExpoPush(messages, { fetchFn, endpoint = DEFAULT_ENDPOINT, logger = console } = {}) {
  if (!messages || messages.length === 0) {
    return { ok: true, sent: 0, data: null };
  }
  const f = fetchFn || globalThis.fetch;
  if (!f) {
    throw new Error('sendExpoPush: no fetch implementation available');
  }
  const res = await f(endpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`expo push ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  logger.log?.(`[push] sent=${messages.length} ok`);
  return { ok: true, sent: messages.length, data };
}

// Build the "actualizá la calculadora" push message. Single source of truth
// so tests and runtime agree on the wording.
function buildUpdateCalculatorPush({ tokens, codename, hoursIdle }) {
  const body =
    'Hay una nueva versión de la calculadora. Mantené la app actualizada ' +
    'para que los cálculos salgan bien.';
  return tokens.map((token) => ({
    to: token,
    title: 'Actualizá la calculadora',
    body,
    sound: 'default',
    data: { kind: 'update_calculator', codename, hoursIdle },
  }));
}

module.exports = { sendExpoPush, buildUpdateCalculatorPush };
