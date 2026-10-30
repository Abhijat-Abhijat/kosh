import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export type LockKind = 'face' | 'fingerprint' | 'pin';
export type LockCapability = { ok: true; kind: LockKind } | { ok: false; reason: string };

/** What the phone can unlock with: biometrics if enrolled, else the device PIN/pattern, else nothing. */
export async function lockCapability(): Promise<LockCapability> {
  if (Platform.OS === 'web') return { ok: false, reason: 'App lock is only available on the phone app.' };
  const level = await LocalAuthentication.getEnrolledLevelAsync();
  if (level === LocalAuthentication.SecurityLevel.NONE) {
    return {
      ok: false,
      reason: 'Set a screen lock (PIN, pattern, fingerprint or face) in your phone settings first.',
    };
  }
  if (level === LocalAuthentication.SecurityLevel.SECRET) return { ok: true, kind: 'pin' };
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  const face = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
  const finger = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
  return { ok: true, kind: face && !finger ? 'face' : 'fingerprint' };
}

export const lockIcon = { face: 'scan-outline', fingerprint: 'finger-print', pin: 'keypad-outline' } as const;

export async function authenticate() {
  const res = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock Kosh',
    fallbackLabel: 'Use device PIN',
    disableDeviceFallback: false,
  });
  return res.success;
}
