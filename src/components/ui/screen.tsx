import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useProfile } from '@/features/profile/store';
import { colors } from '@/theme';

/** Paper-coloured screen. Bands passed as `footer` sit flush at the bottom edge. */
export function Screen({
  children,
  footer,
  scroll = true,
  refreshing,
  onRefresh,
}: {
  children: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const insets = useSafeAreaInsets();
  if (!scroll) {
    return (
      <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }}>
        {children}
      </View>
    );
  }
  return (
    <View className="flex-1 bg-paper">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top }}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.ink} />
          ) : undefined
        }
      >
        {children}
        <View className="flex-1" />
        {footer}
        <View style={{ height: insets.bottom }} />
      </ScrollView>
    </View>
  );
}

function Dots() {
  return (
    <View className="w-[20px] flex-row flex-wrap gap-[4px]">
      {Array.from({ length: 9 }, (_, i) => (
        <View key={i} className="h-[4px] w-[4px] rounded-full bg-ink" />
      ))}
    </View>
  );
}

/** Avatar left (opens /settings), 3x3 dot menu right (opens /menu). */
export function TopBar() {
  const name = useProfile((s) => s.name);
  return (
    <View className="flex-row items-center justify-between px-6 pb-2 pt-5">
      <Pressable
        onPress={() => router.push('/settings')}
        accessibilityLabel="Settings"
        className="h-11 w-11 items-center justify-center rounded-full bg-sage"
      >
        <Text className="font-display-semibold text-[17px] text-paper">{name?.charAt(0).toUpperCase() || 'K'}</Text>
      </Pressable>
      <Pressable onPress={() => router.push('/menu')} accessibilityLabel="Menu" hitSlop={12}>
        <Dots />
      </Pressable>
    </View>
  );
}

/** Centered uppercase title with back chevron, like "CREATE GOAL". */
export function NavHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View className="flex-row items-center justify-between px-5 pb-3 pt-4">
      <Pressable onPress={() => router.back()} accessibilityLabel="Back" hitSlop={12} className="w-10">
        <Ionicons name="chevron-back" size={22} color={colors.ink} />
      </Pressable>
      <Text className="font-display-medium text-[13px] uppercase tracking-[1px] text-ink">{title}</Text>
      <View className="w-10 items-end">{right}</View>
    </View>
  );
}
