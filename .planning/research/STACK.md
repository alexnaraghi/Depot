# Stack Research: v3.0 Features

**Domain:** Desktop Perforce GUI (Tauri 2.0 + React 19)
**Researched:** 2026-01-29
**Confidence:** HIGH

## Context

P4Now v2.0 shipped with a validated stack:
- Tauri 2.0, React 19, TanStack Query, Zustand, shadcn/ui, Tailwind CSS
- react-arborist, dnd-kit, tauri-plugin-store, cmdk

v3.0 adds: resolve workflow, depot tree browser, workspace/stream switching, auto-refresh polling, and E2E testing.

**This document covers ONLY stack additions needed for NEW features.**

## Recommended Stack Additions

### E2E Testing Framework

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| @wdio/cli | ^9.23.0 | WebDriver test orchestration | Official Tauri-recommended E2E testing solution; WebDriver is the W3C standard for automated UI testing |
| @wdio/local-runner | ^9.21.0 | Execute tests locally | Runs WebDriver tests on local machine without cloud services |
| @wdio/mocha-framework | ^9.23.0 | Test framework adapter | BDD-style testing with describe/it/expect syntax familiar to JavaScript developers |
| @wdio/spec-reporter | ^9.23.0 | Test output formatting | Human-readable spec-style test results |
| tauri-driver | latest | WebDriver-Tauri bridge | Cross-platform wrapper around native WebDriver servers (WebKitWebDriver on Linux, Edge Driver on Windows) |

### NO Frontend Stack Changes Required

| Feature | Existing Solution | Why Sufficient |
|---------|------------------|----------------|
| Auto-refresh polling | TanStack Query 5.90.20 | Built-in `refetchInterval` option with configurable intervals, background polling, and conditional control |
| Depot tree browser | react-arborist 3.4.3 | Virtualized rendering handles 10,000+ nodes; already used for changelist file trees |
| External tool launching | tauri-plugin-opener 2 | Already used for diff tool; works for merge tools and editors |
| Workspace switching | Existing p4 command infrastructure | Backend spawns p4.exe; no new libraries needed |

## Installation

### E2E Testing (Dev Dependencies)

```bash
# WebdriverIO testing framework
npm install -D @wdio/cli@^9.23.0
npm install -D @wdio/local-runner@^9.21.0
npm install -D @wdio/mocha-framework@^9.23.0
npm install -D @wdio/spec-reporter@^9.23.0

# Tauri WebDriver bridge (Rust)
cargo install tauri-driver --locked
```

### Platform-Specific WebDriver Requirements

**Windows:**
- Install Microsoft Edge Driver matching your Windows Edge version
- Version mismatch causes test suite to hang during connection
- Download from: https://developer.microsoft.com/en-us/microsoft-edge/tools/webdriver/

**Linux:**
- WebKitWebDriver typically bundled with WebKit package
- Verify with: `which WebKitWebDriver`
- If missing, install webkit2gtk package for your distribution

**macOS:**
- WebDriver testing NOT supported (no WKWebView driver available)
- Consider CI-based testing on Windows/Linux instead

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Playwright | Tauri APIs don't work in Playwright browser mode; requires CDP workarounds | WebdriverIO with tauri-driver |
| Vitest for E2E | Only supports frontend unit tests with mocked Tauri APIs, not real IPC | WebdriverIO for E2E; Vitest OK for frontend unit tests |
| Custom polling library | Adds dependency for capability already in TanStack Query | TanStack Query `refetchInterval` |
| New tree library | react-arborist already handles large virtualized trees | Existing react-arborist |
| Process spawning library | Rust std::process + tauri-plugin-opener cover all needs | Existing Tauri infrastructure |

## Auto-Refresh Implementation Pattern

TanStack Query built-in approach (no new dependencies):

```typescript
// Configurable auto-refresh with user settings
const { data } = useQuery({
  queryKey: ['workspace-status'],
  queryFn: fetchWorkspaceStatus,
  refetchInterval: settings.autoRefreshEnabled
    ? settings.autoRefreshIntervalMs
    : false,
  refetchIntervalInBackground: settings.refreshInBackground,
})
```

**Capabilities verified:**
- `refetchInterval` accepts number (ms), false (disabled), or function (dynamic)
- Background polling continues when window loses focus (opt-in)
- Conditional control via function: `(data) => data.needsPolling ? 5000 : false`
- Integrates with existing TanStack Query cache/invalidation

**Source:** [TanStack Query Auto Refetching Docs](https://tanstack.com/query/v4/docs/framework/react/examples/auto-refetching)

## E2E Testing Setup Pattern

Based on official Tauri v2 documentation:

```javascript
// wdio.conf.js
export const config = {
  specs: ['./test/specs/**/*.js'],
  capabilities: [{
    'tauri:options': {
      application: '../../src-tauri/target/debug/p4now.exe',
    }
  }],
  runner: 'local',
  framework: 'mocha',
  reporters: ['spec'],

  // Build app before tests
  onPrepare: () => {
    return spawn('npm', ['run', 'tauri', 'build', '--debug', '--no-bundle'])
  },

  // Start tauri-driver
  beforeSession: () => {
    tauriDriver = spawn('tauri-driver', [], { stdio: [null, process.stdout, process.stderr] })
  },

  // Cleanup
  afterSession: () => {
    tauriDriver?.kill()
  },
}
```

**Test example:**
```javascript
describe('Resolve workflow', () => {
  it('should detect conflicts after sync', async () => {
    await browser.$('button[data-action="sync"]').click()
    await browser.waitUntil(async () => {
      const conflicts = await browser.$$('[data-status="conflict"]')
      return conflicts.length > 0
    })
  })
})
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| WebdriverIO | Selenium | If team prefers Java/Python over JavaScript; WebdriverIO more modern API |
| WebdriverIO | Playwright CDP | Never for Tauri E2E; Playwright can't call Tauri commands via IPC |
| TanStack Query polling | setInterval | Never; loses cache integration, refetch deduplication, query cancellation |

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| @wdio/cli@9.23.0 | @wdio/local-runner@9.21.0+ | Keep wdio packages on same major version |
| @wdio/mocha-framework@9.23.0 | @wdio/cli@9.x | Framework adapter must match CLI major version |
| tauri-driver@latest | Tauri 2.x | Version independent of other Tauri packages |
| TanStack Query 5.90.20 | React 19.1.0 | Requires React 18.0+ (using useSyncExternalStore) |

## Integration Points

### E2E Tests with Existing Architecture

**Backend commands (already available):**
- spawn_p4_command: Streaming p4.exe output
- p4_command: Synchronous p4.exe execution
- All existing Tauri commands accessible via WebDriver

**Frontend components (testable via selectors):**
- Add data-testid attributes to key UI elements
- Use existing aria-labels for accessibility + testing
- Command palette (cmdk): testable via keyboard simulation

**CI integration:**
- GitHub Actions supports WebDriver tests on Windows/Linux
- Use xvfb-run for headless Linux testing
- Windows tests run natively

### Auto-Refresh with Existing Queries

**No changes to query definitions:**
```typescript
// Existing query
const { data } = useWorkspaceStatus()

// With auto-refresh (user setting)
const { data } = useWorkspaceStatus({
  refetchInterval: settings.autoRefreshInterval
})
```

**Query invalidation still works:**
- Manual refresh button: `queryClient.invalidateQueries(['workspace-status'])`
- After mutations: automatic invalidation via existing patterns
- Polling respects cache staleness rules

## Stack Patterns by Feature

### Resolve Workflow
- **New dependencies:** None
- **Use:** Existing tauri-plugin-opener for P4Merge
- **Backend:** Detect conflicts from p4 resolve -n output
- **Frontend:** UI components with shadcn/ui dialogs

### Depot Tree Browser
- **New dependencies:** None
- **Use:** Existing react-arborist with different data source
- **Pattern:** Same as changelist tree, different API endpoint
- **Virtualization:** Handles large depot hierarchies automatically

### Workspace/Stream Switching
- **New dependencies:** None
- **Use:** p4 client -s, p4 switch via existing command infrastructure
- **State:** Zustand for active workspace/stream
- **Persistence:** tauri-plugin-store for recent workspaces

### Auto-Refresh
- **New dependencies:** None
- **Use:** TanStack Query refetchInterval
- **Settings:** Store interval in tauri-plugin-store
- **Pattern:** Conditional polling based on user preference

### E2E Testing
- **New dependencies:** @wdio/cli, @wdio/local-runner, @wdio/mocha-framework, @wdio/spec-reporter, tauri-driver
- **Scope:** Regression tests for existing functionality
- **Coverage:** Sync, checkout, revert, submit, shelve, reconcile, drag-drop
- **CI:** GitHub Actions on Windows/Linux

## Platform Support Matrix

| Feature | Windows | Linux | macOS |
|---------|---------|-------|-------|
| Auto-refresh | Yes | Yes | Yes |
| Depot browser | Yes | Yes | Yes |
| Workspace switching | Yes | Yes | Yes |
| Resolve workflow | Yes | Yes | Yes |
| E2E testing | Yes | Yes | **NO** |

**macOS E2E limitation:** No WKWebView driver available. Run E2E tests in CI on Windows/Linux runners instead.

## Sources

### Official Documentation (HIGH confidence)
- [Tauri v2 WebDriver Testing](https://v2.tauri.app/develop/tests/webdriver/) - Official E2E testing approach
- [Tauri v2 WebdriverIO Setup](https://v2.tauri.app/develop/tests/webdriver/example/webdriverio/) - Configuration examples
- [TanStack Query Auto Refetching](https://tanstack.com/query/v4/docs/framework/react/examples/auto-refetching) - Polling patterns
- [TanStack Query npm](https://www.npmjs.com/package/@tanstack/react-query) - Version 5.90.19 (project uses 5.90.20)

### Package Versions (HIGH confidence)
- [@wdio/cli npm](https://www.npmjs.com/package/@wdio/cli) - Version 9.23.0
- [@wdio/mocha-framework npm](https://www.npmjs.com/package/@wdio/mocha-framework) - Version 9.23.0
- [@wdio/local-runner npm](https://www.npmjs.com/package/@wdio/local-runner) - Version 9.21.0
- [@crabnebula/tauri-driver npm](https://www.npmjs.com/package/@crabnebula/tauri-driver) - Version 2.0.8

### Community Resources (MEDIUM confidence)
- [react-arborist performance discussion](https://blog.openreplay.com/interactive-tree-components-with-react-arborist/) - Virtualization for 10,000+ nodes
- [Playwright CDP with Tauri](https://github.com/Haprog/playwright-cdp) - Why NOT to use Playwright (requires CDP workarounds)
- [Tauri Testing Discussion](https://github.com/tauri-apps/tauri/discussions/10123) - Community E2E testing approaches

---
*Stack research for: P4Now v3.0 features*
*Researched: 2026-01-29*
