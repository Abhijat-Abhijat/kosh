import type { BillingCycle } from '@/types/db';

import type { IconName } from '@/components/ui';

type KnownService = {
  name: string;
  /** Android package for usage tracking; null when there is no Android app (e.g. iCloud). */
  androidPackage: string | null;
  /** Lowercase substrings likely to appear in bank SMS merchant names. */
  merchantPattern: string;
  cycle: BillingCycle;
  icon: IconName;
};

/**
 * BEST-EFFORT map of popular subscriptions in India to their Android packages.
 * Package names and billing descriptors change; always let the user confirm or override.
 */
const KNOWN_SERVICES: KnownService[] = [
  { name: 'Netflix', androidPackage: 'com.netflix.mediaclient', merchantPattern: 'netflix', cycle: 'monthly', icon: 'film-outline' },
  { name: 'Prime Video', androidPackage: 'com.amazon.avod.thirdpartyclient', merchantPattern: 'amazon prime', cycle: 'yearly', icon: 'film-outline' },
  { name: 'JioHotstar', androidPackage: 'in.startv.hotstar', merchantPattern: 'hotstar', cycle: 'monthly', icon: 'tv-outline' },
  { name: 'Disney+ Hotstar', androidPackage: 'in.startv.hotstar', merchantPattern: 'hotstar', cycle: 'yearly', icon: 'tv-outline' },
  { name: 'Spotify', androidPackage: 'com.spotify.music', merchantPattern: 'spotify', cycle: 'monthly', icon: 'musical-notes-outline' },
  { name: 'YouTube Premium', androidPackage: 'com.google.android.youtube', merchantPattern: 'youtube', cycle: 'monthly', icon: 'logo-youtube' },
  { name: 'Zee5', androidPackage: 'com.graymatrix.did', merchantPattern: 'zee5', cycle: 'yearly', icon: 'tv-outline' },
  { name: 'SonyLIV', androidPackage: 'com.sonyliv', merchantPattern: 'sonyliv', cycle: 'yearly', icon: 'tv-outline' },
  { name: 'Tinder', androidPackage: 'com.tinder', merchantPattern: 'tinder', cycle: 'monthly', icon: 'heart-outline' },
  { name: 'Bumble', androidPackage: 'com.bumble.app', merchantPattern: 'bumble', cycle: 'monthly', icon: 'heart-outline' },
  { name: 'Hinge', androidPackage: 'co.hinge.app', merchantPattern: 'hinge', cycle: 'monthly', icon: 'heart-outline' },
  { name: 'Aisle', androidPackage: 'com.aisle.app', merchantPattern: 'aisle', cycle: 'monthly', icon: 'heart-outline' },
  { name: 'LinkedIn Premium', androidPackage: 'com.linkedin.android', merchantPattern: 'linkedin', cycle: 'monthly', icon: 'logo-linkedin' },
  { name: 'Swiggy One', androidPackage: 'in.swiggy.android', merchantPattern: 'swiggy', cycle: 'quarterly', icon: 'fast-food-outline' },
  { name: 'Zomato Gold', androidPackage: 'com.application.zomato', merchantPattern: 'zomato', cycle: 'quarterly', icon: 'fast-food-outline' },
  { name: 'Cult.fit', androidPackage: 'fit.cure.android', merchantPattern: 'cult', cycle: 'monthly', icon: 'barbell-outline' },
  { name: 'Google One', androidPackage: 'com.google.android.apps.subscriptions.red', merchantPattern: 'google one', cycle: 'monthly', icon: 'cloud-outline' },
  { name: 'iCloud+', androidPackage: null, merchantPattern: 'apple', cycle: 'monthly', icon: 'cloud-outline' },
  { name: 'ChatGPT Plus', androidPackage: 'com.openai.chatgpt', merchantPattern: 'openai', cycle: 'monthly', icon: 'chatbubble-ellipses-outline' },
];

/** Case-insensitive prefix/substring match on name, best matches first. */
export function suggestServices(query: string, limit = 5) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return KNOWN_SERVICES.filter((s) => s.name.toLowerCase().includes(q))
    .sort((a, b) => Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q)))
    .slice(0, limit);
}

/** Known service for a merchant / name / package, for icons and prefill. */
export function findService(text: string | null | undefined) {
  if (!text) return undefined;
  const t = text.toLowerCase();
  return KNOWN_SERVICES.find(
    (s) => s.androidPackage === text || t.includes(s.merchantPattern) || t.includes(s.name.toLowerCase()),
  );
}

export function serviceIcon(sub: { name: string; android_package: string | null }): IconName {
  return findService(sub.android_package)?.icon ?? findService(sub.name)?.icon ?? 'repeat-outline';
}
