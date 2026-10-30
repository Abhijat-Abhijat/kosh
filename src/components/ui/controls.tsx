import Ionicons from '@expo/vector-icons/Ionicons';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { useController } from 'react-hook-form';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { colors } from '@/theme';
import { Label } from './text';

/** Full-width bottom bar button, like "REPEAT PAYMENT". */
export function BarButton({
  title,
  onPress,
  tone = 'alert',
  loading,
  disabled,
}: {
  title: string;
  onPress: () => void;
  tone?: 'alert' | 'ink' | 'sage';
  loading?: boolean;
  disabled?: boolean;
}) {
  const bg = tone === 'alert' ? 'bg-alert' : tone === 'ink' ? 'bg-ink' : 'bg-sage';
  const fg = tone === 'alert' ? 'text-alertInk' : 'text-paper';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      className={`${bg} items-center py-6 active:opacity-85 ${disabled ? 'opacity-50' : ''}`}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text className={`font-display-medium text-[14px] uppercase tracking-[1px] ${fg}`}>{title}</Text>
      )}
    </Pressable>
  );
}

/** Thin plus, like the add button at the bottom of the goals screen. */
export function PlusButton({
  onPress,
  size = 44,
  color = colors.ink,
  label = 'Add',
}: {
  onPress: () => void;
  size?: number;
  color?: string;
  label?: string;
}) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} hitSlop={10} className="items-center py-3 active:opacity-70">
      <Ionicons name="add" size={size} color={color} />
    </Pressable>
  );
}

type FieldProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
} & Omit<TextInputProps, 'value' | 'onChangeText'>;

/** RHF-bound text input with hairline underline. Numeric fields hold strings; coerce in Zod. */
export function TextField<T extends FieldValues>({ control, name, label, ...input }: FieldProps<T>) {
  const { field, fieldState } = useController({ control, name });
  return (
    <View className="mb-5">
      <Label tone="mute">{label}</Label>
      <TextInput
        value={field.value == null ? '' : String(field.value)}
        onChangeText={field.onChange}
        onBlur={field.onBlur}
        placeholderTextColor={colors.faint}
        className="border-b border-ink/40 py-2 font-display text-[18px] text-ink"
        {...input}
      />
      {fieldState.error ? (
        <Text className="mt-1 font-display text-[12px] text-alert">{fieldState.error.message}</Text>
      ) : null}
    </View>
  );
}

/** Horizontal chip picker bound to RHF. */
export function ChipField<T extends FieldValues>({
  control,
  name,
  label,
  options,
}: {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  options: { value: string; label: string }[];
}) {
  const { field, fieldState } = useController({ control, name });
  return (
    <View className="mb-5">
      <Label tone="mute" className="mb-2">
        {label}
      </Label>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {options.map((o) => {
          const active = field.value === o.value;
          return (
            <Pressable
              key={o.value}
              onPress={() => field.onChange(o.value)}
              className={`border px-4 py-2 ${active ? 'border-ink bg-ink' : 'border-ink/40'}`}
            >
              <Text className={`font-display text-[13px] ${active ? 'text-paper' : 'text-ink'}`}>{o.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {fieldState.error ? (
        <Text className="mt-1 font-display text-[12px] text-alert">{fieldState.error.message}</Text>
      ) : null}
    </View>
  );
}
