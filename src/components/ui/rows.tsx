import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Amount } from './amount';
import { Label } from './text';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** Transaction-style row: dark icon tile, title + caption, amount + meta. */
export function ListRow({
  icon,
  title,
  caption,
  amount,
  meta,
  tileClass = 'bg-forest',
  right,
  onPress,
}: {
  icon: IconName;
  title: string;
  caption?: string;
  amount?: number;
  meta?: string;
  tileClass?: string;
  right?: ReactNode;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} className="flex-row items-stretch active:opacity-80">
      <View className={`w-[72px] items-center justify-center py-6 ${tileClass}`}>
        <Ionicons name={icon} size={22} color="#c3c6b0" />
      </View>
      <View className="flex-1 flex-row items-center justify-between px-4">
        <View className="flex-1 pr-2">
          <Text numberOfLines={1} className="font-display-medium text-[18px] text-ink">
            {title}
          </Text>
          {caption ? (
            <Label tone="mute" className="mt-1">
              {caption}
            </Label>
          ) : null}
        </View>
        <View className="items-end">
          {right ?? (amount !== undefined ? <Amount value={amount} size="sm" /> : null)}
          {meta ? (
            <Label tone="mute" className="mt-1">
              {meta}
            </Label>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

/** Label left, value right, hairline under. */
export function RowLine({
  label,
  children,
  tone = 'ink',
}: {
  label: string;
  children: ReactNode;
  tone?: 'ink' | 'onDark';
}) {
  const border = tone === 'ink' ? 'border-ink/30' : 'border-onDark/30';
  return (
    <View className={`flex-row items-baseline justify-between border-b py-2 ${border}`}>
      <Label tone={tone}>{label}</Label>
      {children}
    </View>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <View className="items-center px-8 py-12">
      <Text className="font-display-medium text-[18px] text-ink">{title}</Text>
      {hint ? <Text className="mt-2 text-center font-display text-[14px] text-mute">{hint}</Text> : null}
    </View>
  );
}
