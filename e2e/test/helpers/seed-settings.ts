import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Seeds the Tauri plugin-store settings.json with P4 connection credentials.
 *
 * Reads environment variables:
 * - P4E2E_PORT: P4 server address (e.g., "ssl:perforce:1666")
 * - P4E2E_USER: P4 username
 * - P4E2E_CLIENT: P4 client/workspace name
 *
 * Writes settings to:
 * - Windows: %APPDATA%\com.a.p4now\settings.json
 * - Linux: ~/.config/com.a.p4now/settings.json
 * - macOS: ~/Library/Application Support/com.a.p4now/settings.json
 *
 * Call this in wdio onPrepare hook BEFORE spawning tauri-driver.
 *
 * @throws {Error} If any required environment variable is missing
 */
export async function seedSettings(): Promise<void> {
  const port = process.env.P4E2E_PORT
  const user = process.env.P4E2E_USER
  const client = process.env.P4E2E_CLIENT

  // Validate environment variables
  const missing: string[] = []
  if (!port) missing.push('P4E2E_PORT')
  if (!user) missing.push('P4E2E_USER')
  if (!client) missing.push('P4E2E_CLIENT')

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables for E2E testing: ${missing.join(', ')}\n` +
      `Set them before running tests:\n` +
      `  P4E2E_PORT=ssl:perforce:1666\n` +
      `  P4E2E_USER=your-username\n` +
      `  P4E2E_CLIENT=your-workspace`
    )
  }

  // Determine Tauri plugin-store path
  const appDataDir = process.platform === 'win32'
    ? process.env.APPDATA!
    : process.platform === 'darwin'
    ? join(process.env.HOME!, 'Library', 'Application Support')
    : join(process.env.HOME!, '.config')

  const storeDir = join(appDataDir, 'com.a.p4now')
  const storePath = join(storeDir, 'settings.json')

  // Create directory if it doesn't exist
  mkdirSync(storeDir, { recursive: true })

  // Write settings in Tauri plugin-store format
  const settings = {
    p4port: port,
    p4user: user,
    p4client: client,
    diffToolPath: '',
    diffToolArgs: '',
    verboseLogging: false,
  }

  writeFileSync(storePath, JSON.stringify(settings, null, 2), 'utf-8')

  console.log(`✓ Seeded P4 settings to: ${storePath}`)
  console.log(`  P4PORT: ${port}`)
  console.log(`  P4USER: ${user}`)
  console.log(`  P4CLIENT: ${client}`)
}
