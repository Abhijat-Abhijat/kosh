import { Redirect, Stack, type Href } from 'expo-router';

import { useProfile } from '@/features/profile/store';
import { colors } from '@/theme';

// Deep links and onboarding's replace('/accounts/new') still get Home underneath.
export const unstable_settings = { initialRouteName: 'index' };

export default function AppLayout() {
  const onboarded = useProfile((s) => s.onboarded);
  if (!onboarded) return <Redirect href={'/onboarding' as Href} />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
      <Stack.Screen name="menu" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    </Stack>
  );
}
