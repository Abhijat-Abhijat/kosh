import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { useController } from 'react-hook-form';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Label, SmallButton } from '@/components/ui';
import { device, deviceCapabilities } from '@/lib/device';
import { colors } from '@/theme';

/** Optional linked Android app (package name), chosen from installed apps or typed by hand. */
export function AppPickerField<T extends FieldValues>({
  control,
  name,
  label = 'Linked app',
}: {
  control: Control<T>;
  name: FieldPath<T>;
  label?: string;
}) {
  const { field } = useController({ control, name });
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const insets = useSafeAreaInsets();
  const apps = useQuery({
    queryKey: ['device', 'installed-apps'],
    queryFn: () => device.listInstalledApps(),
    enabled: open && deviceCapabilities.available,
    staleTime: 10 * 60_000,
  });
  const value = (field.value as string | null | undefined) ?? '';
  const appLabel = apps.data?.find((a) => a.packageName === value)?.label;

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = (apps.data ?? []).slice().sort((a, b) => a.label.localeCompare(b.label));
    return s ? list.filter((a) => a.label.toLowerCase().includes(s) || a.packageName.includes(s)) : list;
  }, [apps.data, q]);

  return (
    <View className="mb-5">
      <Label tone="mute">{label}</Label>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        className="flex-row items-center justify-between border-b border-ink/40 py-2"
      >
        <View className="flex-1">
          <Text className={`font-display text-[18px] ${value ? 'text-ink' : 'text-faint'}`} numberOfLines={1}>
            {value ? appLabel ?? value : 'None — use check-ins'}
          </Text>
          {value && appLabel ? <Label tone="mute">{value}</Label> : null}
        </View>
        <Ionicons name="chevron-down" size={18} color={colors.ink} />
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View className="flex-1 bg-paper" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
          <View className="flex-row items-center justify-between px-5 pb-3 pt-4">
            <Pressable onPress={() => setOpen(false)} accessibilityLabel="Close" hitSlop={12} className="w-10">
              <Ionicons name="close" size={22} color={colors.ink} />
            </Pressable>
            <Text className="font-display-medium text-[13px] uppercase tracking-[1px] text-ink">Link an app</Text>
            <View className="w-10" />
          </View>
          <View className="px-6">
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder={deviceCapabilities.available ? 'Search apps' : 'Package name, e.g. com.netflix.mediaclient'}
              placeholderTextColor={colors.faint}
              autoCapitalize="none"
              autoCorrect={false}
              className="border-b border-ink/40 py-2 font-display text-[18px] text-ink"
            />
            <View className="flex-row gap-2 py-4">
              <SmallButton
                title="No app"
                onPress={() => {
                  field.onChange(null);
                  setOpen(false);
                }}
              />
              {/^[a-z][\w]*(\.[\w]+)+$/i.test(q.trim()) ? (
                <SmallButton
                  title={`Use ${q.trim()}`}
                  tone="solid"
                  onPress={() => {
                    field.onChange(q.trim());
                    setOpen(false);
                  }}
                />
              ) : null}
            </View>
            {!deviceCapabilities.available ? (
              <Body tone="mute">
                Installed apps can only be listed in the Android build. Type a package name, or leave it empty and
                Kosh will ask you every few weeks whether you still use this.
              </Body>
            ) : apps.isLoading ? (
              <Body tone="mute">Loading installed apps…</Body>
            ) : null}
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(a) => a.packageName}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  field.onChange(item.packageName);
                  setOpen(false);
                }}
                className={`border-b border-ink/20 px-6 py-3 active:opacity-70 ${item.packageName === value ? 'bg-sage/30' : ''}`}
              >
                <Text className="font-display-medium text-[16px] text-ink">{item.label}</Text>
                <Label tone="mute">{item.packageName}</Label>
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}
