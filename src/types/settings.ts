import { z } from 'zod';

export const settingsSchema = z.object({
  p4port: z.string().min(1, 'Server address is required'),
  p4user: z.string().min(1, 'Username is required'),
  p4client: z.string().min(1, 'Workspace is required'),
  diffToolPath: z.string(),
  diffToolArgs: z.string(),
});

export type P4Settings = z.infer<typeof settingsSchema>;

export const defaultSettings: P4Settings = {
  p4port: '',
  p4user: '',
  p4client: '',
  diffToolPath: '',
  diffToolArgs: '',
};
