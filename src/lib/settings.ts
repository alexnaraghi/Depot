import { load } from '@tauri-apps/plugin-store';
import type { P4Settings } from '@/types/settings';
import { defaultSettings } from '@/types/settings';

let storeInstance: Awaited<ReturnType<typeof load>> | null = null;

async function getStore() {
  if (!storeInstance) {
    storeInstance = await load('settings.json');
  }
  return storeInstance;
}

export async function loadSettings(): Promise<P4Settings> {
  const store = await getStore();
  return {
    p4port: (await store.get<string>('p4port')) || defaultSettings.p4port,
    p4user: (await store.get<string>('p4user')) || defaultSettings.p4user,
    p4client: (await store.get<string>('p4client')) || defaultSettings.p4client,
    diffToolPath: (await store.get<string>('diffToolPath')) || defaultSettings.diffToolPath,
    diffToolArgs: (await store.get<string>('diffToolArgs')) || defaultSettings.diffToolArgs,
  };
}

export async function saveSettings(settings: P4Settings): Promise<void> {
  const store = await getStore();
  await store.set('p4port', settings.p4port);
  await store.set('p4user', settings.p4user);
  await store.set('p4client', settings.p4client);
  await store.set('diffToolPath', settings.diffToolPath);
  await store.set('diffToolArgs', settings.diffToolArgs);
  await store.save();
}
