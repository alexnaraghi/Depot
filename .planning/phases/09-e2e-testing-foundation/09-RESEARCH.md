# Phase 09: E2E Testing Foundation - Research

**Researched:** 2026-01-29
**Domain:** Tauri E2E testing with WebdriverIO
**Confidence:** HIGH

## Summary

WebdriverIO v9 is the official and recommended E2E testing framework for Tauri applications on Windows. Tauri provides tauri-driver, a cross-platform WebDriver server that enables automated testing via native platform drivers (Microsoft Edge Driver on Windows). The stack is mature, well-documented, and actively maintained with Tauri v2 providing comprehensive examples and CI templates.

**Key findings:**
- WebdriverIO v9.21.0 (latest as of Jan 2026) with Mocha framework is the standard stack for Tauri E2E testing
- Windows support via Microsoft Edge Driver requires version matching between Edge browser and driver
- TypeScript support is first-class with zero-config compilation via tsx
- Page Object pattern is recommended but optional; direct selectors work well for smaller test suites
- Test isolation happens at spec file level (each file gets its own browser session)
- Built-in expect-webdriverio assertion library provides automatic retry mechanism for resilient tests

**Primary recommendation:** Use WebdriverIO v9 + Mocha + TypeScript with tauri-driver. Organize tests by feature area (changelist, file-operations, sync) using suite-level setup/teardown hooks. Use data-testid selectors for stability. Start with direct selectors for simplicity; introduce Page Objects if test maintenance becomes burdensome.

## Standard Stack

The established libraries/tools for Tauri E2E testing:

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @wdio/cli | ^9.21.0 | Test runner and orchestrator | Official WebdriverIO test runner, handles worker processes and config |
| @wdio/local-runner | ^9.21.0 | Local test execution | Runs tests in separate worker processes for isolation |
| @wdio/mocha-framework | ^9.21.0 | Test framework adapter | Mocha integration for WebdriverIO, provides describe/it syntax |
| @wdio/spec-reporter | ^9.21.0 | Console output | Clear, hierarchical test output for CI and local development |
| tauri-driver | latest | WebDriver server for Tauri | Official Tauri tool, wraps platform-specific WebDriver servers |
| tsx | latest | TypeScript execution | Zero-config TS compilation for config and test files |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @wdio/types | ^9.21.0 | TypeScript definitions | Type safety for WebdriverIO APIs and config |
| expect-webdriverio | (built-in) | Assertions | Included with WebdriverIO, provides automatic retry for resilient assertions |
| msedgedriver-tool | latest (Rust) | Edge Driver management | Windows-only, automates matching Edge Driver download to browser version |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| WebdriverIO | Selenium + Node | WebdriverIO has better Tauri integration examples and simpler async/await API |
| Mocha | Jasmine or Cucumber | Mocha is used in official Tauri examples, Jasmine/Cucumber add complexity |
| tauri-driver | Direct platform drivers | tauri-driver provides cross-platform abstraction and Tauri-specific capabilities |

**Installation:**
```bash
npm install --save-dev @wdio/cli @wdio/local-runner @wdio/mocha-framework @wdio/spec-reporter @wdio/types tsx
cargo install tauri-driver --locked
# Windows only: Edge Driver management
cargo install --git https://github.com/chippers/msedgedriver-tool
msedgedriver-tool  # Downloads matching Edge Driver to ~/.cargo/bin
```

## Architecture Patterns

### Recommended Project Structure

```
e2e/
├── test/
│   ├── specs/
│   │   ├── sync.test.ts          # Sync workflow tests
│   │   ├── file-operations.test.ts  # Checkout, revert tests
│   │   ├── changelist.test.ts    # Submit workflow tests
│   │   └── ...                   # Other feature areas
│   └── pageobjects/              # (Optional) Page Objects if tests grow large
│       ├── Page.ts               # Base class
│       ├── FileTree.page.ts      # File tree component
│       └── ChangelistPanel.page.ts
├── wdio.conf.ts                  # WebdriverIO configuration
└── tsconfig.json                 # TypeScript config for test code
```

**Key decisions:**
- Tests organized by feature area (not by individual workflow)
- Each spec file is a test suite with shared setup/teardown
- Specs live in `test/specs/` following WebdriverIO conventions
- Page Objects are optional; introduce only if selector reuse becomes significant

### Pattern 1: Suite-Level Test Isolation

**What:** Each spec file gets its own browser session and shares setup/teardown across tests via `before` and `after` hooks.

**When to use:** When tests in a suite operate on the same data or state (e.g., all tests in changelist.test.ts work with the same test workspace).

**Example:**
```typescript
// Source: https://webdriver.io/docs/configurationfile/ (hooks documentation)
// e2e/test/specs/file-operations.test.ts
import { expect } from '@wdio/globals';

describe('File Operations', () => {
  before(async () => {
    // Suite-level setup: revert all pending changes
    // Ensure clean slate for all tests in this suite
    await browser.url('/');
    // Wait for app to be ready
    await $('[data-testid="file-tree"]').waitForDisplayed();
  });

  after(async () => {
    // Suite-level teardown: revert changes made during tests
    // Reset state for next suite
  });

  it('should checkout a file', async () => {
    const file = await $('[data-testid="file-item-example.txt"]');
    await file.click({ button: 2 }); // Right-click
    const checkoutBtn = await $('[data-testid="context-menu-checkout"]');
    await checkoutBtn.click();

    // Verify UI state changed
    await expect(file).toHaveAttribute('data-status', 'checkedOut');
  });

  it('should revert a checked out file', async () => {
    // Test builds on state from previous test or has its own setup
    const file = await $('[data-testid="file-item-example.txt"]');
    await file.click({ button: 2 });
    const revertBtn = await $('[data-testid="context-menu-revert"]');
    await revertBtn.click();

    await expect(file).toHaveAttribute('data-status', 'synced');
  });
});
```

### Pattern 2: WebdriverIO Configuration with Tauri Driver

**What:** Configure WebdriverIO to build the Tauri app, start tauri-driver, and run tests.

**When to use:** Always. This is the foundation configuration for Tauri E2E testing.

**Example:**
```typescript
// Source: https://v2.tauri.app/develop/tests/webdriver/example/webdriverio/
// e2e/wdio.conf.ts
import type { Options } from '@wdio/types';
import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';

let tauriDriver: ChildProcess;

export const config: Options.Testrunner = {
  specs: ['./test/specs/**/*.ts'],
  maxInstances: 1, // Run tests sequentially for now

  capabilities: [{
    maxInstances: 1,
    'tauri:options': {
      // Point to built Tauri app
      application: join(process.cwd(), 'src-tauri', 'target', 'release', 'p4now.exe'),
    },
  }],

  // Build app before starting tests
  onPrepare: () => {
    return spawn('npm', ['run', 'tauri', 'build'], {
      stdio: 'inherit',
      cwd: join(process.cwd()),
      shell: true,
    });
  },

  // Start tauri-driver before session
  beforeSession: () => {
    tauriDriver = spawn('tauri-driver', [], { stdio: 'inherit' });
  },

  // Kill tauri-driver after session
  afterSession: () => {
    tauriDriver?.kill();
  },

  framework: 'mocha',
  reporters: ['spec'],

  mochaOpts: {
    ui: 'bdd',
    timeout: 60000, // 60 seconds for slower operations
  },
};
```

### Pattern 3: Resilient Selectors with data-testid

**What:** Use data-testid attributes for stable, test-specific selectors that don't couple to styling or structure.

**When to use:** Always. Add data-testid to UI components that need to be tested.

**Example:**
```typescript
// Source: https://webdriver.io/docs/selectors/ and https://webdriver.io/docs/bestpractices/
// In React component:
<button data-testid="sync-button" onClick={handleSync}>
  Sync
</button>

// In test:
const syncBtn = await $('[data-testid="sync-button"]');
await syncBtn.click();
await expect(syncBtn).toBeDisabled(); // During sync operation
```

### Pattern 4: Outcome-Focused Assertions

**What:** Assert on end results (file checked out, status updated) rather than intermediate UI states.

**When to use:** Always. Aligns with context decision to validate UI state only, not P4 server state.

**Example:**
```typescript
// Source: https://webdriver.io/docs/api/expect-webdriverio/
// Good: Assert outcome
it('should checkout file', async () => {
  await checkoutFile('example.txt');
  const file = await $('[data-testid="file-item-example.txt"]');
  await expect(file).toHaveAttribute('data-status', 'checkedOut');
  await expect($('[data-testid="changelist-default"]')).toHaveText(/1 file/);
});

// Avoid: Assert intermediate states
it('should checkout file', async () => {
  await checkoutFile('example.txt');
  // Don't assert on loading spinner, progress bar, etc.
  // Just verify the final outcome
});
```

### Anti-Patterns to Avoid

- **Hard-coded pauses:** Never use `browser.pause(5000)`. Use `.waitForDisplayed()` or automatic assertion retries instead.
- **Excessive element queries:** Store elements in variables instead of querying multiple times: `const btn = await $('[data-testid="btn"]'); await btn.click(); await expect(btn).toBeDisabled();`
- **forEach with async:** Use `for...of` loops instead of `forEach()` with async callbacks (forEach doesn't await properly).
- **Generic selectors:** Avoid `$('button')` or `$('.btn')`. Use data-testid or specific semantic selectors like `button=Submit`.
- **Unnecessary waits before assertions:** expect-webdriverio automatically retries, so `await elem.waitForDisplayed(); await expect(elem).toBeDisplayed();` is redundant.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Element wait/retry logic | Custom polling loops | expect-webdriverio matchers | Built-in automatic retry prevents flaky tests; handles timing internally |
| Test data reset | Custom cleanup scripts | beforeSuite/afterSuite hooks with P4 commands | WebdriverIO hooks integrate with test lifecycle; errors fail tests properly |
| TypeScript compilation | Custom build step | tsx (auto-detected by WebdriverIO) | WebdriverIO automatically compiles TS config and tests; zero config needed |
| Screenshot on failure | Custom afterTest logic | WebdriverIO screenshot service | Built-in service handles capture, but context decision is logs-only for this phase |
| Edge Driver download | Manual download/versioning | msedgedriver-tool | Automates version matching; critical for avoiding hangs on Windows |
| Selector helpers | Utility functions | WebdriverIO $ and $$ with chaining | Built-in lazy evaluation and retry logic; custom helpers lose WebdriverIO features |

**Key insight:** WebdriverIO's automatic retry mechanism for assertions is the most important "don't hand-roll" item. Custom wait logic always ends up flakier than the built-in retry system, which polls assertions until timeout and handles race conditions transparently.

## Common Pitfalls

### Pitfall 1: Edge Driver Version Mismatch (Windows-Specific)

**What goes wrong:** WebDriver tests hang indefinitely during connection phase. Microsoft Edge Driver must exactly match the installed Edge browser version.

**Why it happens:** Windows uses Edge WebView2 for Tauri, and tauri-driver connects via Microsoft Edge Driver. Version mismatches cause protocol incompatibilities that result in silent hangs.

**How to avoid:**
- Use msedgedriver-tool to automatically download matching Edge Driver: `cargo install --git https://github.com/chippers/msedgedriver-tool && msedgedriver-tool`
- Add Edge Driver path to $PATH or use tauri-driver's `--native-driver` option
- In CI, automate Edge Driver download as part of workflow setup (see CI section in Tauri docs)

**Warning signs:**
- Tests hang after "Starting session" log
- No error message, just infinite wait
- Edge browser window doesn't appear

**Source:** https://v2.tauri.app/develop/tests/webdriver/ (official Tauri WebDriver docs)

### Pitfall 2: Forgetting await on $ and $$ Results

**What goes wrong:** Tests reference elements before they're queried, causing "Cannot read property of undefined" errors or tests acting on stale elements.

**Why it happens:** WebdriverIO uses lazy evaluation for selectors, but actions/assertions require awaiting the promise.

**How to avoid:**
- Always use `await` when calling methods on elements: `await (await $('button')).click()`
- Store elements in variables to avoid double-awaiting: `const btn = await $('button'); await btn.click();`
- TypeScript helps catch missing awaits via @wdio/types

**Warning signs:**
- "Cannot read property 'click' of undefined"
- Tests pass locally but fail in CI (timing differences)
- Elements not found despite being visible

**Source:** https://webdriver.io/docs/bestpractices/ (official best practices guide)

### Pitfall 3: Using forEach with Async Callbacks

**What goes wrong:** Tests appear to run but async operations inside forEach don't complete before the test finishes. Results in incomplete assertions or skipped cleanup.

**Why it happens:** Array.forEach doesn't await async callbacks; it fires them all and immediately returns.

**How to avoid:**
- Use `for...of` loops instead: `for (const item of items) { await doAsync(item); }`
- Or use `Promise.all()` for parallel operations: `await Promise.all(items.map(async item => doAsync(item)))`

**Warning signs:**
- Tests pass but side effects don't happen
- Cleanup code doesn't run
- "Unhandled promise rejection" errors

**Source:** https://webdriver.io/docs/bestpractices/ (forEach anti-pattern section)

### Pitfall 4: Suite-Level State Pollution

**What goes wrong:** Tests fail when run together but pass when run individually. Happens when one test leaves state that affects the next test.

**Why it happens:** Tests in the same suite share a browser session. If Test A checks out a file and doesn't revert, Test B sees a checked-out file unexpectedly.

**How to avoid:**
- Use `beforeEach` for per-test setup if tests need isolation
- Use `after` hook to revert all pending changes at suite end
- Context decision: Reset state between suites, not between tests (suite-level isolation)
- Document test dependencies if one test intentionally builds on another

**Warning signs:**
- Tests pass individually (using `it.only`) but fail in suite
- Test order affects results
- Intermittent failures depending on which tests ran first

**Source:** https://webdriver.io/docs/organizingsuites/ (test organization docs)

### Pitfall 5: Perforce Server State Not Matching UI State

**What goes wrong:** Tests assert that UI shows "checked out" but P4 server doesn't actually have the file open. Tests pass but integration is broken.

**Why it happens:** Testing only UI state means tests can pass even if backend commands fail silently.

**How to avoid:**
- Context decision: This phase prioritizes UI state validation only. P4 server-side validation is explicitly deferred.
- Acknowledge the limitation: Tests verify "UI shows correct state" not "operation succeeded on server"
- Future enhancement: Add P4 server validation in a later phase (would require p4 CLI commands in tests)

**Warning signs:**
- Tests pass but manual testing shows operations don't work
- UI updates but P4 commands don't execute
- File states drift from reality

**Source:** Phase 09 context decision: "Validate UI state only — assert the UI shows correct status after operations. P4 server-side validation deferred."

### Pitfall 6: macOS Testing Expectations

**What goes wrong:** Developers try to run E2E tests on macOS and get "WebDriver not supported" errors.

**Why it happens:** macOS doesn't have a WKWebView driver tool available. Tauri E2E testing only supports Windows and Linux on desktop.

**How to avoid:**
- Document Windows/Linux-only support prominently in test README
- Add platform checks in test setup that skip gracefully on macOS
- Use CI runners (Windows/Linux) for E2E tests even if development happens on macOS

**Warning signs:**
- "WebDriver server failed to start" on macOS
- tauri-driver errors about missing platform driver

**Source:** https://v2.tauri.app/develop/tests/webdriver/ (platform support section)

## Code Examples

Verified patterns from official sources:

### Basic Test Structure with Mocha

```typescript
// Source: https://v2.tauri.app/develop/tests/webdriver/example/webdriverio/
import { expect } from '@wdio/globals';

describe('Sync Workflow', () => {
  before(async () => {
    // Launch app (handled by WebdriverIO/tauri-driver)
    await browser.url('/'); // Tauri apps use '/' as base URL
    await $('[data-testid="app-ready"]').waitForDisplayed({ timeout: 10000 });
  });

  it('should display sync button', async () => {
    const syncBtn = await $('[data-testid="sync-button"]');
    await expect(syncBtn).toBeDisplayed();
    await expect(syncBtn).toBeEnabled();
  });

  it('should disable sync button during operation', async () => {
    const syncBtn = await $('[data-testid="sync-button"]');
    await syncBtn.click();

    // Button should be disabled immediately
    await expect(syncBtn).toBeDisabled();

    // Wait for operation to complete (watch for re-enable or completion indicator)
    await syncBtn.waitForEnabled({ timeout: 30000 });
  });
});
```

### Using expect-webdriverio Matchers

```typescript
// Source: https://webdriver.io/docs/api/expect-webdriverio/
// Element state assertions (with automatic retry)
const fileItem = await $('[data-testid="file-item"]');

// Visibility
await expect(fileItem).toBeDisplayed();
await expect(fileItem).toBeDisplayedInViewport();

// Attributes and properties
await expect(fileItem).toHaveAttribute('data-status', 'checkedOut');
await expect(fileItem).toHaveElementClass('file-item--modified');
await expect(fileItem).toHaveText('example.txt');

// Interaction state
await expect(fileItem).toBeClickable();
await expect(fileItem).toBeFocused();

// Browser-level assertions
await expect(browser).toHaveUrl('tauri://localhost/');
await expect(browser).toHaveTitle('p4now');

// Soft assertions (continue on failure)
await expect.soft(fileItem).toHaveText('expected.txt'); // Test continues even if fails
await expect.soft(fileItem).toBeDisplayed();
// All soft assertion failures reported at end of test
```

### Efficient Selector Patterns

```typescript
// Source: https://webdriver.io/docs/selectors/ and https://webdriver.io/docs/bestpractices/
// Good: Single CSS selector
const submitBtn = await $('[data-testid="submit-button"]');

// Good: Semantic text matching
const heading = await $('h1=Welcome'); // Exact match
const link = await $('a*=Learn More'); // Partial match

// Good: ARIA-based selection (resembles user interaction)
const button = await $('aria/Submit'); // Finds by aria-label or content

// Avoid: Multiple queries for same element
await $('[data-testid="btn"]').click();
await $('[data-testid="btn"]').waitForEnabled(); // Queries DOM again
// Better:
const btn = await $('[data-testid="btn"]');
await btn.click();
await btn.waitForEnabled();

// Avoid: Chaining $() calls (each queries DOM)
await $('.container').$('.row').$('.button').click(); // 3 DOM queries
// Better:
await $('.container .row .button').click(); // 1 DOM query
```

### Handling Lists of Elements

```typescript
// Source: https://webdriver.io/docs/selectors/
// Find all matching elements
const fileItems = await $$('[data-testid^="file-item-"]');

// Use for...of for sequential operations
for (const file of fileItems) {
  const text = await file.getText();
  console.log('File:', text);
  if (text.includes('.txt')) {
    await file.click();
    break;
  }
}

// Use Promise.all for parallel operations
await Promise.all(
  fileItems.map(async (file) => {
    await expect(file).toBeDisplayed();
  })
);

// Check collection size
await expect(fileItems).toBeElementsArrayOfSize(5);
await expect(fileItems).toBeElementsArrayOfSize({ gte: 1 }); // At least 1
```

### Suite-Level Setup and Teardown

```typescript
// Source: https://webdriver.io/docs/configurationfile/ (hooks)
describe('Changelist Operations', () => {
  before(async () => {
    // Runs once before all tests in this suite
    await browser.url('/');
    await $('[data-testid="file-tree"]').waitForDisplayed();

    // Ensure clean state: revert all pending changes
    // (Would execute P4 commands via Tauri backend)
    await revertAllChanges();
  });

  after(async () => {
    // Runs once after all tests in this suite
    // Clean up any test data
    await revertAllChanges();
  });

  beforeEach(async () => {
    // Runs before each test
    // Only use if per-test isolation needed (context decision: suite-level isolation)
  });

  afterEach(async () => {
    // Runs after each test
    // Only use if per-test cleanup needed
  });

  it('test 1', async () => { /* ... */ });
  it('test 2', async () => { /* ... */ });
});
```

### TypeScript Configuration

```typescript
// Source: https://webdriver.io/docs/typescript/
// e2e/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Node",
    "types": ["node", "@wdio/globals/types", "@wdio/mocha-framework"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": [
    "./test/**/*.ts",
    "./wdio.conf.ts"
  ]
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| WebdriverIO v7 with sync mode | WebdriverIO v9 with async/await | v8+ (2022-2023) | Must use await for all commands; no more synchronous API |
| Chai assertions | expect-webdriverio | v6+ (2020) | Built-in automatic retry makes tests more resilient; less flaky tests |
| Manual WebDriver setup | WebDriver BiDi protocol | v9 (Aug 2024) | Automatic session management; improved reliability and new features |
| Node v16 support | Node v20+ required | v9 (Aug 2024) | Must upgrade Node to v20 or higher |
| Manual element waiting | Automatic assertion retry | v6+ (2020) | Assertions wait for condition automatically; no manual waitFor before assertions |
| selenium-webdriver | @wdio/cli + local-runner | v5+ (2018) | Simpler config; better TypeScript support; more maintainable |

**Deprecated/outdated:**
- **webdriverio sync mode:** Removed in v8. All commands must use async/await now.
- **wdio-mocha-framework (old package):** Use `@wdio/mocha-framework` (scoped package)
- **browser.debug() in CI:** Only works in local REPL mode; doesn't pause CI tests
- **Standalone mode for Tauri:** Use testrunner mode (wdio.conf.ts) for proper lifecycle management
- **tauri-driver --native-driver flag confusion:** Path to native driver (msedgedriver.exe) must be in $PATH, not Tauri app path

## Open Questions

Things that couldn't be fully resolved:

1. **P4 Server Approach for Tests**
   - What we know: Tests need a Perforce server to validate workflows. Options are: (1) Real local p4d instance, (2) Mock P4 commands in Tauri backend, (3) External existing P4 server.
   - What's unclear: Which approach balances test reliability vs. setup complexity. Real p4d gives highest confidence but requires per-suite provisioning. Mocking is fast but doesn't test real P4 integration. External server is simplest but requires manual setup and may have state conflicts.
   - Recommendation: Start with external existing P4 server (lowest friction for Phase 09). Document server requirements (workspace, depot path, permissions). Introduce local p4d provisioning in a future phase if test reliability suffers from shared server state.

2. **Page Object Pattern Adoption**
   - What we know: Page Objects improve maintainability for large test suites. Context decision marks this as "Claude's Discretion."
   - What's unclear: At what test suite size does Page Object overhead pay off. Official Tauri examples use direct selectors.
   - Recommendation: Start without Page Objects (simpler, fewer files). Introduce Page Objects reactively if: (1) Same selectors repeated across 3+ test files, or (2) UI refactoring requires updating selectors in many places. For Phase 09 (5 workflows × 1-2 tests each = ~10 tests), direct selectors are sufficient.

3. **Running Individual Tests**
   - What we know: WebdriverIO supports running specific spec files via CLI patterns. Context decision marks this as "Claude's Discretion."
   - What's unclear: Whether individual test selection (within a file) is needed or just file-level selection.
   - Recommendation: Support file-level selection via `npm run test:e2e -- --spec=test/specs/sync.test.ts`. Individual test selection (via it.only) works but isn't needed for CI. Document both patterns in test README.

4. **Test Fixtures and File Types**
   - What we know: Tests need test files to operate on (sync, checkout, etc.). Context decision marks file types as "Claude's Discretion."
   - What's unclear: Whether tests should (1) Use existing files in test workspace, (2) Create files dynamically, or (3) Have pre-seeded fixture files.
   - Recommendation: Use existing files in test workspace (simplest, no dynamic creation). Tests assume workspace has at least one text file (e.g., readme.txt). Document workspace setup requirements. If tests need specific file states, use P4 commands in before hooks to set up (checkout, add, delete). This avoids test fixture file management complexity.

## Sources

### Primary (HIGH confidence)

- **Tauri WebDriver Documentation** - https://v2.tauri.app/develop/tests/webdriver/ - Official platform support, tauri-driver installation, Edge Driver version matching requirements
- **Tauri WebdriverIO Example** - https://v2.tauri.app/develop/tests/webdriver/example/webdriverio/ - Complete setup guide, configuration examples, test structure
- **Tauri CI Example** - https://v2.tauri.app/develop/tests/webdriver/ci/ - GitHub Actions workflow for Windows E2E testing
- **WebdriverIO Best Practices** - https://webdriver.io/docs/bestpractices/ - Element query optimization, assertion patterns, anti-patterns to avoid
- **WebdriverIO Page Object Pattern** - https://webdriver.io/docs/pageobjects/ - Page Object structure, getter pattern, export recommendations
- **WebdriverIO Selectors** - https://webdriver.io/docs/selectors/ - Selector strategies, data-testid usage, selector hierarchy
- **WebdriverIO Assertion API** - https://webdriver.io/docs/assertion/ - expect-webdriverio matchers, soft assertions
- **WebdriverIO expect-webdriverio API** - https://webdriver.io/docs/api/expect-webdriverio/ - Complete matcher list with examples
- **WebdriverIO TypeScript Setup** - https://webdriver.io/docs/typescript/ - tsx integration, tsconfig requirements, type definitions
- **WebdriverIO Configuration File** - https://webdriver.io/docs/configurationfile/ - Hook execution order, capabilities, suite organization
- **WebdriverIO v9 Release** - https://webdriver.io/blog/2024/08/15/webdriverio-v9-release/ - WebDriver BiDi features, Node v20 requirement, breaking changes

### Secondary (MEDIUM confidence)

- **GitHub webdriver-example** - https://github.com/tauri-apps/webdriver-example - Reference implementation (mentioned in official docs)
- **msedgedriver-tool GitHub** - https://github.com/chippers/msedgedriver-tool - Edge Driver automation tool (referenced in Tauri CI docs)
- **Building WSL-UI E2E Testing** - https://dev.to/octasoft-ltd/building-wsl-ui-e2e-testing-screenshots-and-demo-videos-53d9 - Real-world Tauri + WebdriverIO implementation (1 week old as of Jan 2026)

### Tertiary (LOW confidence)

- **O'Reilly Practical Perforce** - https://www.oreilly.com/library/view/practical-perforce/0596101856/apa.html - P4 test environment setup basics (dated to 2005.1, lacks current specifics)
- Various blog posts and tutorials on WebdriverIO + Tauri (2024-2026) - Provided context but not primary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Tauri docs explicitly recommend WebdriverIO v9 + Mocha, with complete examples and CI templates
- Architecture: HIGH - Patterns extracted directly from official WebdriverIO and Tauri documentation with code examples
- Pitfalls: HIGH - Edge Driver version mismatch and common WebdriverIO mistakes documented in official sources with clear solutions

**Research date:** 2026-01-29
**Valid until:** ~60 days (stable domain, Tauri v2 and WebdriverIO v9 are current; expect minor version updates but no major breaking changes)

**Test coverage for TEST-01 requirement:**
- Sync operation: ✓ (WebdriverIO can click sync button, wait for completion, verify UI state)
- Checkout operation: ✓ (Right-click, context menu, verify status attribute change)
- Submit operation: ✓ (Dialog interaction, form fill, verify success message)
- Revert operation: ✓ (Context menu, confirm, verify status restored)
- Windows CI execution: ✓ (GitHub Actions template provided in Tauri docs)
