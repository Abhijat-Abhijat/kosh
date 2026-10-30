import { Pressable, Text } from 'react-native';

const styles = {
  ink: { box: 'border-ink', text: 'text-ink' },
  onDark: { box: 'border-onDark', text: 'text-onDark' },
  alertInk: { box: 'border-alertInk', text: 'text-alertInk' },
  solid: { box: 'border-ink bg-ink', text: 'text-paper' },
  solidLight: { box: 'border-alertInk bg-alertInk', text: 'text-alert' },
} as const;

/** Compact square-edged outline button for inline row actions ("Still using", "Add"). */
export function SmallButton({
  title,
  onPress,
  tone = 'ink',
  disabled,
}: {
  title: string;
  onPress: () => void;
  tone?: keyof typeof styles;
  disabled?: boolean;
}) {
  const s = styles[tone];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      hitSlop={6}
      className={`border px-3 py-2 active:opacity-70 ${s.box} ${disabled ? 'opacity-40' : ''}`}
    >
      <Text className={`font-display-medium text-[11px] uppercase tracking-[1px] ${s.text}`}>{title}</Text>
    </Pressable>
  );
}
