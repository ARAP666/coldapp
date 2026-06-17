import { QuickResponse } from '../types';

export const QUICK_RESPONSES: QuickResponse[] = [
  { label: '¿como esta la vara?', icon: '❔', type: 'status', message: '❔ como esta la vara?' },
  { label: 'ALERTA',       icon: '🚨', type: 'alert' },
  { label: 'TRANSITO',     icon: '🚓', type: 'police' },
  { label: 'ACCIDENTE',    icon: '💥', type: 'danger' },
  { label: 'CALLE MAL',    icon: '⚠️', type: 'warn' },
  { label: 'DETENERSE',    icon: '✋', type: 'stop' },
  { label: 'A 500MTS',     icon: '📍', type: 'distance' },
  { label: 'A 1KM',        icon: '📡', type: 'distance' },
  { label: 'A 5KM',        icon: '🧭', type: 'distance' },
  { label: 'COMBUSTIBLE',  icon: '⛽', type: 'service' },
  { label: 'COMIDA',       icon: '🍽️', type: 'food' },
  { label: 'BAÑO',         icon: '🚻', type: 'restroom' },
  { label: 'DESPEJADO',    icon: '✅', type: 'clear' },
  { label: 'ABORTAR',      icon: '⛔', type: 'abort', confirm: true },
];

export const CHAT_QUICK_RESPONSES = QUICK_RESPONSES.filter((q) =>
  ['ALERTA', 'A 500MTS', 'A 1KM', 'A 5KM', 'DESPEJADO'].includes(q.label)
);
