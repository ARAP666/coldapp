// ── Message types ──
export type AlertType =
  | 'text'
  | 'status'
  | 'alert'
  | 'police'
  | 'danger'
  | 'warn'
  | 'stop'
  | 'distance'
  | 'service'
  | 'food'
  | 'restroom'
  | 'clear'
  | 'abort';

export interface Message {
  id: string;
  alias: string;
  text: string;
  type: AlertType;
  color: string | null;
  timestamp: number;
  isQuick?: boolean;
}

export interface Member {
  socketId: string;
  alias: string;
  joinedAt: number;
  lastSeen: number;
  lat?: number;
  lng?: number;
}

export interface QuickResponse {
  label: string;
  icon: string;
  type: AlertType;
  message?: string;
  confirm?: boolean;
}

export interface PeerLocation {
  alias: string;
  lat: number;
  lng: number;
  timestamp: number;
}

// ── Theme colors ──
export const COLORS = {
  bg: '#0a0a0b',
  surface: '#111113',
  surface2: '#18181c',
  border: '#222228',
  border2: '#2e2e38',
  txt: '#f0f0f4',
  txt2: '#8888a0',
  txt3: '#444458',
  blue: '#3b82f6',
  blueDim: '#3b82f614',
  blueRing: '#3b82f640',
  red: '#f43f5e',
  redDim: '#f43f5e12',
  green: '#22c55e',
  greenDim: '#22c55e12',
  amber: '#f59e0b',
  amberDim: '#f59e0b12',
  cyan: '#06b6d4',
  cyanDim: '#06b6d412',
  purple: '#a855f7',
  purpleDim: '#a855f712',
  opOrange: '#ff9f0a',
};

export const ALERT_COLORS: Record<AlertType, { text: string; bg: string; border: string }> = {
  text:     { text: COLORS.txt2,    bg: COLORS.surface2,   border: COLORS.border },
  status:   { text: '#cffafe',      bg: '#06b6d432',       border: '#67e8f9aa' },
  alert:    { text: '#fecdd3',      bg: '#be123c26',       border: '#fb718570' },
  police:   { text: '#ffedd5',      bg: '#f59e0b22',       border: '#f59e0b70' },
  danger:   { text: '#fecaca',      bg: '#ef444426',       border: '#ef444470' },
  warn:     { text: '#fef3c7',      bg: '#eab30822',       border: '#eab30870' },
  stop:     { text: '#ffedd5',      bg: '#f9731622',       border: '#f9731670' },
  distance: { text: '#dbeafe',      bg: '#38bdf822',       border: '#38bdf870' },
  service:  { text: '#dbeafe',      bg: '#60a5fa22',       border: '#60a5fa70' },
  food:     { text: '#ede9fe',      bg: '#a78bfa22',       border: '#a78bfa70' },
  restroom: { text: '#cffafe',      bg: '#22d3ee22',       border: '#22d3ee70' },
  clear:    { text: '#dcfce7',      bg: '#22c55e22',       border: '#22c55e70' },
  abort:    { text: '#fecaca',      bg: '#ef44442e',       border: '#ef444488' },
};

export const QUICK_BTN_COLORS: Record<string, [string, string]> = {
  status:   ['#67e8f9', '#06b6d4'],
  alert:    ['#fb7185', '#be123c'],
  police:   ['#f59e0b', '#b45309'],
  danger:   ['#ef4444', '#991b1b'],
  warn:     ['#eab308', '#92400e'],
  stop:     ['#f97316', '#9a3412'],
  distance: ['#38bdf8', '#0369a1'],
  service:  ['#60a5fa', '#1d4ed8'],
  food:     ['#a78bfa', '#6d28d9'],
  restroom: ['#22d3ee', '#0e7490'],
  clear:    ['#4ade80', '#15803d'],
  abort:    ['#7f1d1d', '#450a0a'],
};
