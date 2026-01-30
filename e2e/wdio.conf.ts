import { spawn, type ChildProcess } from 'node:child_process'
import { join } from 'node:path'

// PREREQUISITES:
// 1. Build the app: npm run tauri build
// 2. Install tauri-driver: cargo install tauri-driver
// 3. Install msedgedriver (required by tauri-driver on Windows):
//    - Download from https://developer.microsoft.com/en-us/microsoft-edge/tools/webdriver/
//    - Match your Edge version (edge://version to check)
//    - Add msedgedriver.exe to your PATH

let tauriDriver: ChildProcess

export const config = {
  specs: ['./test/specs/**/*.ts'],
  maxInstances: 1, // Sequential execution — tauri-driver handles one session at a time

  // Connect to tauri-driver's WebDriver server
  hostname: 'localhost',
  port: 4444,

  capabilities: [
    {
      browserName: 'wry',
      'tauri:options': {
        application: join(process.cwd(), 'src-tauri', 'target', 'release', 'p4now.exe'),
      },
    } as any,
  ],

  logLevel: 'info',
  bail: 0,
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,

  framework: 'mocha',
  reporters: ['spec'],

  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
  },

  // Start tauri-driver once before all workers
  onPrepare: async () => {
    tauriDriver = spawn('tauri-driver', [], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    // Wait for tauri-driver to bind to port 4444
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        resolve() // proceed anyway after 2s, connection retries will handle it
      }, 2000)

      tauriDriver.stderr?.on('data', (data: Buffer) => {
        const msg = data.toString()
        // tauri-driver logs to stderr when ready
        if (msg.includes('listening')) {
          clearTimeout(timeout)
          resolve()
        }
      })

      tauriDriver.on('error', (err) => {
        clearTimeout(timeout)
        reject(new Error(`Failed to start tauri-driver: ${err.message}`))
      })

      tauriDriver.on('close', (code) => {
        if (code !== null && code !== 0) {
          clearTimeout(timeout)
          reject(new Error(`tauri-driver exited with code ${code}`))
        }
      })
    })
  },

  // Stop tauri-driver after all workers finish
  onComplete: async () => {
    if (tauriDriver) {
      tauriDriver.kill()
    }
  },
}
