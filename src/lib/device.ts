import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

/**
 * Contract for the local Android native module `KoshNative` (modules/kosh-native).
 * Every function degrades safely when the module is missing (web, iOS, Expo Go).
 */
export type RawSms = {
  id: string;
  address: string; // sender, e.g. "VM-HDFCBK"
  body: string;
  date: number; // epoch ms
};

type AppUsage = {
  packageName: string;
  lastTimeUsed: number; // epoch ms, 0 when never used in window
  totalTimeForegroundMs: number;
};

type KoshNativeModule = {
  hasSmsPermission(): Promise<boolean>;
  requestSmsPermission(): Promise<boolean>;
  /** Inbox SMS received strictly after sinceMs, oldest first, at most `limit`. */
  readSmsSince(sinceMs: number, limit: number): Promise<RawSms[]>;
  hasUsageAccess(): Promise<boolean>;
  openUsageAccessSettings(): Promise<void>;
  /** Usage for the given packages over [sinceMs, now]. */
  getAppUsage(packageNames: string[], sinceMs: number): Promise<AppUsage[]>;
  /** Launchable installed apps, for linking a subscription to an app. */
  listInstalledApps(): Promise<{ packageName: string; label: string }[]>;
};

const native =
  Platform.OS === 'android' ? requireOptionalNativeModule<KoshNativeModule>('KoshNative') : null;

export const deviceCapabilities = { available: native !== null };

export const device: KoshNativeModule = {
  hasSmsPermission: async () => (native ? native.hasSmsPermission() : false),
  requestSmsPermission: async () => (native ? native.requestSmsPermission() : false),
  readSmsSince: async (sinceMs, limit) => (native ? native.readSmsSince(sinceMs, limit) : []),
  hasUsageAccess: async () => (native ? native.hasUsageAccess() : false),
  openUsageAccessSettings: async () => {
    if (native) await native.openUsageAccessSettings();
  },
  getAppUsage: async (pkgs, sinceMs) => (native ? native.getAppUsage(pkgs, sinceMs) : []),
  listInstalledApps: async () => (native ? native.listInstalledApps() : []),
};
