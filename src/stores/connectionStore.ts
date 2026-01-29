import { create } from 'zustand';

interface ConnectionState {
  status: 'connected' | 'disconnected' | 'error' | 'connecting';
  // Display values (from p4 info response)
  workspace: string | null;
  stream: string | null;
  server: string | null;
  user: string | null;
  errorMessage: string | null;
  // Connection args (from user settings — used for p4 command -p/-u/-c flags)
  p4port: string | null;
  p4user: string | null;
  p4client: string | null;

  setConnecting: () => void;
  setConnected: (info: {
    workspace: string;
    stream?: string;
    server: string;
    user: string;
    p4port: string;
    p4user: string;
    p4client: string;
  }) => void;
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
  p4port: null,
  p4user: null,
  p4client: null,

  setConnecting: () => set({ status: 'connecting', errorMessage: null }),
  setConnected: ({ workspace, stream, server, user, p4port, p4user, p4client }) => set({
    status: 'connected',
    workspace,
    stream: stream || null,
    server,
    user,
    p4port,
    p4user,
    p4client,
    errorMessage: null,
  }),
  setDisconnected: () => set({
    status: 'disconnected',
    workspace: null,
    stream: null,
    server: null,
    user: null,
    p4port: null,
    p4user: null,
    p4client: null,
    errorMessage: null,
  }),
  setError: (message) => set({
    status: 'error',
    errorMessage: message,
  }),
}));
