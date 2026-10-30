import { Text } from 'react-native';

import { moneyParts } from '@/lib/format';
import { toneClass, type Tone } from './text';

const sizes = {
  xs: 'text-[14px]',
  sm: 'text-[17px]',
  md: 'text-[24px]',
  lg: 'text-[32px]',
  xl: 'text-[46px] leading-[52px]',
} as const;

/** Money in the design's style: "₹1,84,320" with a faded ".0". */
export function Amount({
  value,
  size = 'md',
  tone = 'ink',
  signed = false,
  hideFraction = false,
  className = '',
}: {
  value: number;
  size?: keyof typeof sizes;
  tone?: Tone;
  signed?: boolean;
  hideFraction?: boolean;
  className?: string;
}) {
  const p = moneyParts(value, { sign: signed });
  return (
    <Text
      className={`font-num-medium tracking-tight ${sizes[size]} ${toneClass[tone]} ${className}`}
      accessibilityLabel={`${p.sign === '−' ? 'minus ' : ''}${p.whole} rupees`}
    >
      {p.sign}
      {p.whole}
      {hideFraction ? null : <Text className="opacity-35">{p.fraction}</Text>}
    </Text>
  );
}
