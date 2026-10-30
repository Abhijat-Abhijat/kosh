import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Screen, type IconName } from '@/components/ui';
import { colors } from '@/theme';

const items: { href: string; label: string; icon: IconName }[] = [
  { href: '/', label: 'Home', icon: 'grid-outline' },
  { href: '/transactions', label: 'Transactions', icon: 'list-outline' },
  { href: '/accounts', label: 'Accounts & Cards', icon: 'card-outline' },
  { href: '/investments', label: 'Savings & Investments', icon: 'pie-chart-outline' },
  { href: '/dues', label: 'Pending Payments', icon: 'alarm-outline' },
  { href: '/subscriptions', label: 'Subscriptions', icon: 'repeat-outline' },
  { href: '/sync', label: 'SMS Sync', icon: 'chatbox-ellipses-outline' },
  { href: '/settings', label: 'Settings', icon: 'settings-outline' },
];

export default function Menu() {
  return (
    <Screen>
      <View className="flex-row justify-end px-6 pt-5">
        <Pressable onPress={() => router.back()} accessibilityLabel="Close" hitSlop={12}>
          <Ionicons name="close" size={26} color={colors.ink} />
        </Pressable>
      </View>
      <View className="pt-4">
        {items.map((it, i) => (
          <Pressable
            key={it.href}
            onPress={() => {
              router.back();
              if (it.href !== '/') router.push(it.href as Href);
            }}
            className="flex-row items-center border-b border-ink/20 active:opacity-70"
          >
            <View className="w-[72px] items-center justify-center py-5" style={{ backgroundColor: colors.forest, opacity: 1 - i * 0.06 }}>
              <Ionicons name={it.icon} size={22} color={colors.paper} />
            </View>
            <Text className="px-5 font-display-medium text-[20px] text-ink">{it.label}</Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
