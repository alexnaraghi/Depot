import { browser } from '@wdio/globals'

/**
 * E2E test suite for Sync Workflow
 *
 * Tests the sync operation from initiation to completion.
 * Requires:
 * - App built with `npm run tauri build`
 * - Connected to a Perforce server with valid workspace
 */
describe('Sync Workflow', () => {
  it('should initiate and complete sync operation', async () => {
    // Wait for app to be ready (30s timeout for app startup)
    const appReady = await $('[data-testid="app-ready"]')
    await appReady.waitForDisplayed({ timeout: 30000 })

    // Find and click sync button
    const syncButton = await $('[data-testid="sync-button"]')
    await syncButton.waitForEnabled({ timeout: 5000 })
    await syncButton.click()

    // Wait for sync progress indicator to appear
    const syncProgress = await $('[data-testid="sync-progress"]')
    await syncProgress.waitForDisplayed({ timeout: 5000 })

    // Wait for sync to complete (progress indicator disappears)
    // Generous timeout for sync operation
    await syncProgress.waitForDisplayed({
      timeout: 60000,
      reverse: true
    })

    // Verify sync button is enabled again
    await syncButton.waitForEnabled({ timeout: 5000 })
  })
})
