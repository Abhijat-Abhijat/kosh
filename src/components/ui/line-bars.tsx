import { View } from 'react-native';

/**
 * Thin vertical-line bar chart, the signature motif of the design.
 * Values are normalised to the tallest; pass `color` as a hex.
 */
export function LineBars({
  values,
  height = 48,
  color = '#1f231c',
  gap = 3,
  thickness = 1.5,
  dimAfter,
}: {
  values: number[];
  height?: number;
  color?: string;
  gap?: number;
  thickness?: number;
  /** Bars at index >= dimAfter render at 35% opacity (e.g. future days). */
  dimAfter?: number;
}) {
  const max = Math.max(1, ...values);
  return (
    <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap }}>
      {values.map((v, i) => (
        <View
          key={i}
          style={{
            width: thickness,
            height: Math.max(2, (v / max) * height),
            backgroundColor: color,
            opacity: dimAfter !== undefined && i >= dimAfter ? 0.35 : 1,
          }}
        />
      ))}
    </View>
  );
}

/** Solid block for the done part and hairlines for the remainder, like the goals card. */
export function ProgressLines({
  progress,
  height = 56,
  fill = '#65705f',
  line = '#1f231c',
  lines = 26,
}: {
  progress: number;
  height?: number;
  fill?: string;
  line?: string;
  lines?: number;
}) {
  const p = Math.min(1, Math.max(0, progress));
  const remaining = Math.max(1, Math.round(lines * (1 - p)));
  return (
    <View style={{ height, flexDirection: 'row', alignItems: 'flex-end' }}>
      <View style={{ flex: p, height: height * 0.6, backgroundColor: fill }} />
      <View
        style={{
          flex: 1 - p,
          height,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          paddingLeft: 6,
        }}
      >
        {Array.from({ length: remaining }, (_, i) => (
          <View key={i} style={{ width: 1, height, backgroundColor: line, opacity: 0.7 }} />
        ))}
      </View>
    </View>
  );
}
