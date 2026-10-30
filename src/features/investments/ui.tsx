import { Text, View } from 'react-native';

import type { BandTone, IconName } from '@/components/ui';
import { moneyParts } from '@/lib/format';
import { colors } from '@/theme';
import type { HoldingKind } from '@/types/db';

/** Goal-yellow for deposit-style savings, dark greens for market and insurance. */
export const KIND_TONE: Record<HoldingKind, BandTone> = {
  fd: 'goal',
  rd: 'goal',
  stock: 'forest',
  mutual_fund: 'deep',
  gold: 'sage',
  lic: 'forest',
  ppf: 'goal',
  other: 'sage',
};

const toneHex = (t: BandTone) => colors[t];

/** Icon tile class per kind (literal strings so Tailwind sees them). */
export const KIND_TILE: Record<HoldingKind, string> = {
  fd: 'bg-forest',
  rd: 'bg-forest',
  stock: 'bg-forest',
  mutual_fund: 'bg-deep',
  gold: 'bg-sage',
  lic: 'bg-forest',
  ppf: 'bg-deep',
  other: 'bg-sage',
};

export const KIND_ICON: Record<HoldingKind, IconName> = {
  fd: 'lock-closed-outline',
  rd: 'repeat-outline',
  stock: 'trending-up-outline',
  mutual_fund: 'pie-chart-outline',
  gold: 'diamond-outline',
  lic: 'shield-checkmark-outline',
  ppf: 'leaf-outline',
  other: 'wallet-outline',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2026-03-15' -> '15 Mar 2026' without going through the device timezone. */
export function fmtDay(iso: string | null | undefined, withYear = true) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${+d} ${MONTHS[+m - 1]}${withYear ? ` ${y}` : ''}`;
}

export const fmtPct = (p: number) => `${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p).toFixed(1)}%`;

/** Signed money + percent. `onDark` switches to the light gain colour for bands. */
export function Gain({ value, pct, onDark = false, size = 15 }: { value: number; pct: number; onDark?: boolean; size?: number }) {
  const up = value >= 0;
  const color = up ? (onDark ? colors.gain : colors.sage) : colors.loss;
  const p = moneyParts(value, { sign: true });
  return (
    <Text className="font-num-medium" style={{ color, fontSize: size }}>
      {p.sign}
      {p.whole} · {fmtPct(pct)}
    </Text>
  );
}

/** Allocation as thin vertical lines, each kind's share coloured by its band tone. */
export function AllocationStrip({ parts, lines = 72, height = 36 }: { parts: { kind: HoldingKind; value: number }[]; lines?: number; height?: number }) {
  const total = parts.reduce((a, p) => a + Math.max(0, p.value), 0);
  if (total <= 0) return null;
  const bars = parts.flatMap((p) =>
    Array.from({ length: Math.max(1, Math.round((Math.max(0, p.value) / total) * lines)) }, () => toneHex(KIND_TONE[p.kind])),
  );
  return (
    <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
      {bars.map((c, i) => (
        <View key={i} style={{ width: 2, height, backgroundColor: c }} />
      ))}
    </View>
  );
}
