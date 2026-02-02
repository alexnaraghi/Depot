import { useState, useEffect } from 'react';
import { loadSettings, getVerboseLogging } from '@/lib/settings';
import { useConnectionStore } from '@/stores/connectionStore';
import { useOperationStore } from '@/store/operation';
import { invokeP4Info } from '@/lib/tauri';
import type { P4Settings } from '@/types/settings';

export function useSettings() {
  const [settings, setSettings] = useState<P4Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { setConnecting, setConnected, setError, setDisconnected } = useConnectionStore();

  const testConnection = async (s: P4Settings) => {
    // If settings are empty (first launch), stay disconnected
    if (!s.p4port || !s.p4user || !s.p4client) {
      setDisconnected();
      return;
    }

    // Test connection with saved settings
    setConnecting();
    try {
      const { addOutputLine } = useOperationStore.getState();
      const verbose = await getVerboseLogging();
      if (verbose) addOutputLine('p4 info', false);
      const info = await invokeP4Info();
      if (verbose) addOutputLine('... ok', false);
      setConnected({
        workspace: info.client_name,
        stream: info.client_stream || undefined,
        server: info.server_address,
        user: info.user_name,
        p4port: s.p4port,
        p4user: s.p4user,
        p4client: s.p4client,
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    }
  };

  const refreshConnection = async () => {
    if (!settings) return;
    await testConnection(settings);
  };

  useEffect(() => {
    const initSettings = async () => {
      setIsLoading(true);
      try {
        const loaded = await loadSettings();
        setSettings(loaded);
        await testConnection(loaded);
      } catch (error) {
        console.error('Failed to load settings:', error);
        setError(error instanceof Error ? error.message : String(error));
      } finally {
        setIsLoading(false);
      }
    };

    initSettings();
  }, []);

  return {
    settings,
    isLoading,
    refreshConnection,
  };
}
