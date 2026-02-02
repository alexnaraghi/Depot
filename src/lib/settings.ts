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
    editorPath: (await store.get<string>('editorPath')) || defaultSettings.editorPath,
    verboseLogging: (await store.get<boolean>('verboseLogging')) ?? defaultSettings.verboseLogging,
    autoRefreshInterval: (await store.get<number>('autoRefreshInterval')) ?? defaultSettings.autoRefreshInterval,
    showDeletedDepotFiles: (await store.get<boolean>('showDeletedDepotFiles')) ?? defaultSettings.showDeletedDepotFiles,
  };
}

export async function saveSettings(settings: P4Settings): Promise<void> {
  const store = await getStore();
  await store.set('p4port', settings.p4port);
  await store.set('p4user', settings.p4user);
  await store.set('p4client', settings.p4client);
  await store.set('diffToolPath', settings.diffToolPath);
  await store.set('diffToolArgs', settings.diffToolArgs);
  await store.set('editorPath', settings.editorPath);
  await store.set('verboseLogging', settings.verboseLogging);
  await store.set('autoRefreshInterval', settings.autoRefreshInterval);
  await store.set('showDeletedDepotFiles', settings.showDeletedDepotFiles);
  await store.save();
}

export async function getVerboseLogging(): Promise<boolean> {
  const store = await getStore();
  return (await store.get<boolean>('verboseLogging')) ?? false;
}

export async function getAutoRefreshInterval(): Promise<number> {
  const store = await getStore();
  return (await store.get<number>('autoRefreshInterval')) ?? defaultSettings.autoRefreshInterval;
}

export async function getShowDeletedDepotFiles(): Promise<boolean> {
  const store = await getStore();
  return (await store.get<boolean>('showDeletedDepotFiles')) ?? false;
}

export async function getColumnWidths(): Promise<{ left: number; right: number }> {
  const store = await getStore();
  return {
    left: (await store.get<number>('layout.leftColumnWidth')) ?? 280,
    right: (await store.get<number>('layout.rightColumnWidth')) ?? 320,
  };
}

export async function saveColumnWidths(left: number, right: number): Promise<void> {
  const store = await getStore();
  await store.set('layout.leftColumnWidth', left);
  await store.set('layout.rightColumnWidth', right);
  await store.save();
}
