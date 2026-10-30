import { Pressable, ScrollView, Text } from 'react-native';

/** Uncontrolled-by-RHF horizontal chip picker, for filters and inline pickers. */
export function Chips({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityState={{ selected: active }}
            className={`border px-4 py-2 ${active ? 'border-ink bg-ink' : 'border-ink/40'}`}
          >
            <Text className={`font-display text-[13px] ${active ? 'text-paper' : 'text-ink'}`}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
