import { Text, type TextProps } from 'react-native';

export type Tone = 'ink' | 'mute' | 'faint' | 'onDark' | 'alertInk';
export const toneClass: Record<Tone, string> = {
  ink: 'text-ink',
  mute: 'text-mute',
  faint: 'text-faint',
  onDark: 'text-onDark',
  alertInk: 'text-alertInk',
};

/** Small uppercase tracking label, e.g. "AVAILABLE", "SPENT". */
export function Label({ tone = 'ink', className = '', ...p }: TextProps & { tone?: Tone }) {
  return (
    <Text
      className={`font-display text-[11px] uppercase tracking-[1px] ${toneClass[tone]} ${className}`}
      {...p}
    />
  );
}

export function Body({ tone = 'ink', className = '', ...p }: TextProps & { tone?: Tone }) {
  return <Text className={`font-display text-[15px] ${toneClass[tone]} ${className}`} {...p} />;
}

/** Two-line headline: muted lead + bold line ("Hello, Adam / Here Your Statement"). */
export function Headline({ lead, title, tone = 'ink' }: { lead?: string; title: string; tone?: Tone }) {
  return (
    <Text className="text-[30px] leading-[34px]">
      {lead ? (
        <Text className={`font-display ${tone === 'ink' ? 'text-mute' : 'text-faint'}`}>
          {lead}
          {'\n'}
        </Text>
      ) : null}
      <Text className={`font-display-bold ${toneClass[tone]}`}>{title}</Text>
    </Text>
  );
}
