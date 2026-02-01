import { browser } from '@wdio/globals'

/**
 * E2E test suite for Changelist Submit Workflow
 *
 * Tests the submit workflow:
 * 1. Checkout a file to add it to default changelist
 * 2. Open submit dialog
 * 3. Fill in changelist description
 * 4. Submit and verify dialog closes
 *
 * Requires:
 * - App built with `npm run tauri build`
 * - Connected to a Perforce server with valid workspace
 * - At least one synced file in the workspace
 * - Valid Perforce credentials with submit permission
 *
 * Note: This test requires a live Perforce server with write access.
 * The test will modify the server state by creating a submitted changelist.
 */
describe('Changelist Submit Workflow', () => {
  before(async () => {
    // Wait for app to be ready
    const appReady = await $('[data-testid="app-ready"]')
    await appReady.waitForDisplayed({ timeout: 30000 })

    // Wait for file tree to load (P4 connection + fstat query)
    const firstFile = await $('[data-testid^="file-node-"]')
    await firstFile.waitForExist({ timeout: 30000 })

    // Revert any files left checked out from a prior failed run
    const existingCLFiles = await $$('[data-testid^="cl-file-"]')
    if (existingCLFiles.length > 0) {
      await existingCLFiles[0].click({ button: 'right' })
      const revertMenuItem = await $('[data-testid="context-menu-revert"]')
      await revertMenuItem.waitForDisplayed({ timeout: 5000 })
      await revertMenuItem.click()
      // Wait for changelist to clear
      await browser.waitUntil(
        async () => (await $$('[data-testid^="cl-file-"]')).length === 0,
        { timeout: 10000 }
      )
    }
  })

  after(async () => {
    // Clean up: revert any files left checked out if the test failed mid-way
    const remainingFiles = await $$('[data-testid^="cl-file-"]')
    if (remainingFiles.length > 0) {
      await remainingFiles[0].click({ button: 'right' })
      const revertMenuItem = await $('[data-testid="context-menu-revert"]')
      const isDisplayed = await revertMenuItem.isDisplayed().catch(() => false)
      if (isDisplayed) {
        await revertMenuItem.click()
        await browser.waitUntil(
          async () => (await $$('[data-testid^="cl-file-"]')).length === 0,
          { timeout: 10000 }
        ).catch(() => {}) // best-effort cleanup
      }
    }
  })

  it('should submit a changelist with description', async () => {
    // First, checkout a file to have something to submit
    const fileNodes = await $$('[data-testid^="file-node-"]')
    const fileNodeCount = await fileNodes.length

    if (fileNodeCount === 0) {
      throw new Error('No files found in workspace tree - ensure workspace has synced files')
    }

    // Select and checkout the first file
    const firstFile = fileNodes[0]
    await firstFile.waitForDisplayed({ timeout: 10000 })
    await firstFile.click({ button: 'right' })

    // The checkout menu item only appears for synced files
    const checkoutMenuItem = await $('[data-testid="context-menu-checkout"]')
    await checkoutMenuItem.waitForDisplayed({ timeout: 5000 })
    await checkoutMenuItem.click()

    // Wait for file to appear in changelist panel
    const clFile = await $('[data-testid^="cl-file-"]')
    await clFile.waitForExist({ timeout: 10000 })

    // Wait for default changelist to appear with files
    const defaultChangelist = await $('[data-testid="changelist-default"]')
    await defaultChangelist.waitForDisplayed({ timeout: 5000 })

    // The submit button is opacity-0 until hover and may be obscured by context menus.
    // Use JavaScript click to bypass visibility/overlap issues.
    const submitButton = await $('[data-testid="context-menu-submit"]')
    await submitButton.waitForExist({ timeout: 5000 })
    await browser.execute((el: HTMLElement) => el.click(), submitButton)

    // Wait for submit dialog to appear
    const submitDialog = await $('[data-testid="submit-dialog"]')
    await submitDialog.waitForDisplayed({ timeout: 5000 })

    // Fill in description
    const descriptionTextarea = await $('[data-testid="submit-description"]')
    await descriptionTextarea.waitForDisplayed({ timeout: 5000 })
    await descriptionTextarea.setValue('E2E test changelist submission')

    // Click submit button
    const submitConfirm = await $('[data-testid="submit-confirm-button"]')
    await submitConfirm.waitForEnabled({ timeout: 5000 })
    await submitConfirm.click()

    // Wait for dialog to close (30s timeout for submit operation)
    await submitDialog.waitForDisplayed({
      timeout: 30000,
      reverse: true
    })
  })
})
