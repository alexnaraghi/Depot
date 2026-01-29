import { create } from 'zustand';

interface ConnectionState {
  status: 'connected' | 'disconnected' | 'error' | 'connecting';
  workspace: string | null;
  stream: string | null;
  server: string | null;
  user: string | null;
  errorMessage: string | null;

  setConnecting: () => void;
  setConnected: (info: { workspace: string; stream?: string; server: string; user: string }) => void;
  setDisconnected: () => void;
  setError: (message: string) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: 'disconnected',
  workspace: null,
  stream: null,
  server: null,
  user: null,
  errorMessage: null,

  setConnecting: () => set({ status: 'connecting', errorMessage: null }),
  setConnected: ({ workspace, stream, server, user }) => set({
    status: 'connected',
    workspace,
    stream: stream || null,
    server,
    user,
    errorMessage: null,
  }),
  setDisconnected: () => set({
    status: 'disconnected',
    workspace: null,
    stream: null,
    server: null,
    user: null,
    errorMessage: null,
  }),
  setError: (message) => set({
    status: 'error',
    errorMessage: message,
  }),
}));
