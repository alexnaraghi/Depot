import { browser } from '@wdio/globals'

/**
 * E2E test suite for File Operations (Checkout and Revert)
 *
 * Tests the checkout and revert workflows:
 * 1. Find file in tree
 * 2. Right-click to open context menu
 * 3. Checkout: verify file appears in changelist panel
 * 4. Revert: verify file removed from changelist panel
 *
 * Requires:
 * - App built with `npm run tauri build`
 * - Connected to a Perforce server with valid workspace
 * - At least one synced file in the workspace
 */
describe('File Operations', () => {
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

  it('should checkout a file and add it to default changelist', async () => {
    // Find any file node in the tree (data-testid starts with "file-node-")
    const fileNodes = await $$('[data-testid^="file-node-"]')
    const fileNodeCount = await fileNodes.length

    // Verify at least one file exists
    if (fileNodeCount === 0) {
      throw new Error('No files found in workspace tree - ensure workspace has synced files')
    }

    // Select the first file
    const firstFile = fileNodes[0]
    await firstFile.waitForDisplayed({ timeout: 10000 })

    // Right-click to open context menu
    await firstFile.click({ button: 'right' })

    // Wait for context menu and click "Checkout for Edit"
    const checkoutMenuItem = await $('[data-testid="context-menu-checkout"]')
    await checkoutMenuItem.waitForDisplayed({ timeout: 5000 })
    await checkoutMenuItem.click()

    // Wait for file to appear in changelist panel
    const clFile = await $('[data-testid^="cl-file-"]')
    await clFile.waitForExist({ timeout: 10000 })

    // Verify file appears in default changelist
    const defaultChangelist = await $('[data-testid="changelist-default"]')
    await defaultChangelist.waitForDisplayed({ timeout: 5000 })

    // Verify at least one file is in the changelist
    const changelistFiles = await $$('[data-testid^="cl-file-"]')
    const changelistFileCount = await changelistFiles.length
    if (changelistFileCount === 0) {
      throw new Error('Expected at least one file in changelist after checkout')
    }
  })

  it('should revert a checked out file', async () => {
    // Find a file in the changelist panel (data-testid starts with "cl-file-")
    const changelistFilesBefore = await $$('[data-testid^="cl-file-"]')
    const beforeCount = await changelistFilesBefore.length

    // Verify at least one file exists
    if (beforeCount === 0) {
      throw new Error('No files in changelist - run checkout test first')
    }

    // Right-click the first file in changelist
    const firstChangelistFile = changelistFilesBefore[0]
    await firstChangelistFile.click({ button: 'right' })

    // Wait for context menu and click "Revert Changes"
    const revertMenuItem = await $('[data-testid="context-menu-revert"]')
    await revertMenuItem.waitForDisplayed({ timeout: 5000 })
    await revertMenuItem.click()

    // Wait for file count to decrease
    await browser.waitUntil(
      async () => (await $$('[data-testid^="cl-file-"]')).length < beforeCount,
      { timeout: 10000, timeoutMsg: `Expected fewer than ${beforeCount} files after revert` }
    )
  })
})
