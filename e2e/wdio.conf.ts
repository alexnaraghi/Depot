import { spawn, type ChildProcess } from 'node:child_process'
import { join } from 'node:path'

// PREREQUISITE: Build the app before running tests
// Run: npm run tauri build
// This config does NOT auto-build to avoid adding minutes to every test run

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
        application: join(process.cwd(), '..', 'src-tauri', 'target', 'release', 'p4now.exe'),
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

  // Before test session: Start tauri-driver
  beforeSession: async () => {
    tauriDriver = spawn('tauri-driver', [], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    // Give tauri-driver time to start
    await new Promise((resolve) => setTimeout(resolve, 500))
  },

  // After test session: Kill tauri-driver
  afterSession: async () => {
    tauriDriver.kill()
  },
}
