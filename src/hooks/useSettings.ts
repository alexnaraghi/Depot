import { useState, useEffect } from 'react';
import { loadSettings } from '@/lib/settings';
import { useConnectionStore } from '@/stores/connectionStore';
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
      const info = await invokeP4Info(s.p4port, s.p4user, s.p4client);
      setConnected({
        workspace: info.client_name,
        stream: info.client_stream || undefined,
        server: info.server_address,
        user: info.user_name,
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
