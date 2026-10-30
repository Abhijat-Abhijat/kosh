import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// SecureStore values are capped near 2 KB, and larger JSON blobs can exceed that,
// so each value is split into chunks under an index key.
const CHUNK_SIZE = 1800;
const indexKey = (key: string) => `${key}__chunks`;
const chunkKey = (key: string, i: number) => `${key}__${i}`;

async function removeItem(key: string) {
  const count = Number((await SecureStore.getItemAsync(indexKey(key))) ?? 0);
  await Promise.all(
    Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(chunkKey(key, i))),
  );
  await SecureStore.deleteItemAsync(indexKey(key));
}

async function getItem(key: string) {
  const count = Number((await SecureStore.getItemAsync(indexKey(key))) ?? 0);
  if (!count) return null;
  const parts = await Promise.all(
    Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(chunkKey(key, i))),
  );
  if (parts.some((p) => p === null)) return null;
  return parts.join('');
}

async function setItem(key: string, value: string) {
  await removeItem(key);
  const chunks = value.match(new RegExp(`.{1,${CHUNK_SIZE}}`, 'gs')) ?? [''];
  await Promise.all(chunks.map((c, i) => SecureStore.setItemAsync(chunkKey(key, i), c)));
  await SecureStore.setItemAsync(indexKey(key), String(chunks.length));
}

// expo-secure-store has no web implementation; web builds (demo/dev only) use localStorage.
const webStorage = {
  getItem: async (key: string) => globalThis.localStorage?.getItem(key) ?? null,
  setItem: async (key: string, value: string) => globalThis.localStorage?.setItem(key, value),
  removeItem: async (key: string) => globalThis.localStorage?.removeItem(key),
};

export const secureStorage = Platform.OS === 'web' ? webStorage : { getItem, setItem, removeItem };
