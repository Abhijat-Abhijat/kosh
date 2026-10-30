import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, View, type ViewProps } from 'react-native';

export type BandTone = 'paper' | 'sage' | 'deep' | 'forest' | 'alert' | 'goal';
const bg: Record<BandTone, string> = {
  paper: 'bg-paper',
  sage: 'bg-sage',
  deep: 'bg-deep',
  forest: 'bg-forest',
  alert: 'bg-alert',
  goal: 'bg-goal',
};

/** Text tone that reads on each band. */
export const bandText = {
  paper: 'ink',
  sage: 'onDark',
  deep: 'onDark',
  forest: 'onDark',
  alert: 'alertInk',
  goal: 'ink',
} as const;

/** Full-bleed colour block section. Optional arrow button top-right when pressable. */
export function Band({
  tone = 'sage',
  onPress,
  className = '',
  children,
  ...p
}: ViewProps & { tone?: BandTone; onPress?: () => void }) {
  const body = (
    <View className={`${bg[tone]} px-6 py-5 ${className}`} {...p}>
      {children}
      {onPress ? (
        <View className="absolute right-5 top-4 h-11 w-11 items-center justify-center rounded-full bg-white/20">
          <Ionicons name="arrow-forward" size={18} color="#fff" style={{ transform: [{ rotate: '-45deg' }] }} />
        </View>
      ) : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" className="active:opacity-85">
      {body}
    </Pressable>
  );
}
