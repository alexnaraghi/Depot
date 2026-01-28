# Stack Research

**Domain:** Windows Desktop Perforce GUI (P4Now)
**Researched:** 2025-01-27
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Tauri 2.0** | 2.9.5+ | Desktop app framework | 95% smaller binaries than Electron, uses native WebView2 on Windows, <40MB RAM vs Electron's 200-400MB, launches in <0.5s, production-ready since Oct 2024 with security audit. Perfect for "never block the user" requirement. |
| **React** | 19.2+ | UI framework | Stable (Dec 2024), massive ecosystem, excellent TypeScript support, fastest hiring. While Svelte/Solid are faster, React's maturity and ecosystem win for AI-friendly development and long-term maintainability. |
| **TypeScript** | 5.7+ | Type safety | Industry standard for desktop apps. 5.7 released Nov 2024 with improved type safety and performance. Strict mode eliminates entire classes of runtime errors when spawning p4.exe processes. |
| **Vite** | 6.0+ | Build tool | Official Tauri integration, 5x faster full builds, 100x faster incremental builds vs Webpack. HMR works seamlessly with Tauri dev workflow. Zero config out of the box. |

### State Management

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **TanStack Query** | 5.x | Async server/CLI state | PRIMARY for all p4.exe operations. Handles caching, retries, background updates, request deduplication. Eliminates manual loading/error states. Perfect for CLI integration. |
| **Zustand** | 5.0.10+ | Client UI state | SECONDARY for local UI state (selected files, filter settings, window state). Lightweight (50.2k stars), native async support, minimal boilerplate. Use for state that doesn't come from p4.exe. |

### UI & Styling

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **Tailwind CSS** | 4.0+ | Styling framework | Compile-time CSS, <10kB production bundle, 5x faster builds in v4. Perfect for desktop apps - no runtime overhead, purges unused CSS automatically. |
| **shadcn/ui** | latest | Component library | Copy-paste components built on Radix UI + Tailwind. Full code ownership (not a dependency). Accessible primitives for dialogs, menus, keyboard shortcuts. |
| **Radix UI** | latest | Headless primitives | Foundation for shadcn/ui. Provides accessible, keyboard-navigable components. Critical for keyboard shortcuts requirement. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **@tauri-apps/plugin-shell** | 2.x | Spawn p4.exe CLI | Execute external processes securely via Rust bridge. Required for all Perforce operations. Handles stdout/stderr streaming. |
| **@tauri-apps/plugin-dialog** | 2.x | Native file dialogs | Windows-native open/save dialogs. Better UX than web file picker for desktop app. |
| **@tauri-apps/plugin-fs** | 2.x | File system access | Read workspace files, write settings, check file status. Secure Rust-backed FS operations. |
| **cmdk** | latest | Command palette | Keyboard-first command interface (Cmd+K pattern). Essential for power user workflow. |
| **react-window** | latest | Virtual scrolling | Handle 10,000+ file lists without perf degradation. Critical for large depots. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **Vitest** | Unit testing | Mock Tauri IPC calls with `@tauri-apps/api/mocks`, jsdom for React components. Fast, Vite-native. |
| **Playwright** | E2E testing | Test full Tauri app via `_electron.launch()` equivalent. Verify p4.exe integration end-to-end. |
| **ESLint** | Linting | TypeScript-aware, catch bugs before runtime. Essential for async CLI operations. |
| **Prettier** | Formatting | Code consistency. Important for AI-assisted development. |

## Installation

```bash
# Core framework
cargo install tauri-cli --version "^2"
npm create tauri-app@latest

# Frontend stack
npm install react@19 react-dom@19
npm install @tanstack/react-query zustand
npm install tailwindcss@4 postcss autoprefixer
npm install cmdk react-window

# Tauri plugins
npm install @tauri-apps/plugin-shell
npm install @tauri-apps/plugin-dialog
npm install @tauri-apps/plugin-fs

# UI components (copy/paste via shadcn CLI)
npx shadcn@latest init
npx shadcn@latest add dialog
npx shadcn@latest add dropdown-menu
npx shadcn@latest add table

# Dev dependencies
npm install -D typescript@5.7 vite@6
npm install -D vitest @vitest/ui jsdom
npm install -D @playwright/test
npm install -D eslint prettier
npm install -D @types/react @types/react-dom
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **Tauri 2.0** | Electron | If you MUST have Node.js runtime or need npm packages that require native Node APIs. Electron has larger ecosystem but 10x heavier apps. |
| **React** | Svelte 5 | If bundle size is more critical than ecosystem. Svelte is 40% faster load time, but React has 10x more component libraries and AI knows it better. |
| **TanStack Query** | Redux Toolkit | If you need time-travel debugging or strict unidirectional flow. RTK has more boilerplate but better DevTools for complex state. |
| **Zustand** | Jotai/Recoil | If you have complex derived state or need React Suspense integration. Jotai is more granular, Recoil has better async selectors. |
| **Tailwind** | CSS-in-JS (Emotion/Styled) | If you need dynamic theming based on runtime state. Tailwind is compile-time, CSS-in-JS has runtime overhead but more flexibility. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Electron** | 100MB+ apps, 200-400MB RAM, 1-2s startup. Violates "never block user" principle. | Tauri 2.0 - same dev experience, 10x lighter. |
| **Vue/Angular** | Smaller ecosystems, less AI-friendly. Vue is fine but React has more desktop app examples. | React - better for AI-assisted dev, larger ecosystem. |
| **Redux (classic)** | Massive boilerplate for async operations. Need thunks/sagas for p4.exe calls. | TanStack Query for async, Zustand for sync state. |
| **Create React App** | Deprecated, slow builds, no longer maintained. | Vite - official Tauri integration, 100x faster. |
| **Node.js as runtime** | Tauri uses Rust backend, not Node. Don't try to bundle Node. | Use Tauri shell plugin to spawn p4.exe, handle in Rust. |
| **WebView1 (legacy)** | Insecure, outdated. Windows 11 ships WebView2. | WebView2 (automatic with Tauri on Windows). |

## Stack Patterns by Use Case

**If spawning many p4.exe commands concurrently:**
- Use TanStack Query's parallel queries feature
- Configure retry logic and timeout per command type
- Consider request deduplication for rapid sync checks

**If large file lists (10,000+ files):**
- Use `react-window` for virtual scrolling
- Implement pagination in TanStack Query
- Consider server-side (p4.exe-side) filtering before UI

**If complex keyboard shortcuts:**
- Use Radix UI primitives for shortcut hints
- Leverage cmdk for command palette
- Test with Playwright for E2E keyboard nav

**If external diff tool launch:**
- Use Tauri shell plugin's `Command.spawn()`
- Don't wait for diff tool to close (non-blocking)
- Handle stderr for graceful error messages

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| React 19.2 | TanStack Query 5.x | Fully compatible, uses React 18+ hooks |
| Tauri 2.9.5 | Vite 6.x | Official integration, use `@tauri-apps/vite-plugin` |
| TypeScript 5.7 | All recommended libs | Strict mode recommended for type safety |
| Tailwind 4.0 | PostCSS 8.x | Requires PostCSS, auto-installed via Tailwind |
| Zustand 5.x | React 18+ | Dropped support for React <18 in v5 |

## Sources

**High Confidence (Official Docs):**
- [Tauri 2.0 Official Release](https://v2.tauri.app/blog/tauri-20/) - Release date, features, production readiness
- [Tauri Process Model](https://v2.tauri.app/concept/process-model/) - Security architecture
- [Tauri Shell Plugin](https://v2.tauri.app/plugin/shell/) - CLI spawning documentation
- [Tauri Sidecar Binaries](https://v2.tauri.app/develop/sidecar/) - External process embedding
- [TanStack Query Docs](https://tanstack.com/query/latest) - v5 features, React integration
- [React 19 Release](https://react.dev/blog/2024/12/05/react-19) - Stable release Dec 2024
- [Vite 6.0 Announcement](https://vite.dev/blog/announcing-vite6) - Performance improvements
- [Tailwind CSS v4.0](https://tailwindcss.com/blog/tailwindcss-v4) - v4 features and performance
- [TypeScript 5.7 Release Notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-7.html) - Nov 2024 release
- [Zustand v5 Migration](https://zustand.docs.pmnd.rs/migrations/migrating-to-v5) - v5 changes

**Medium Confidence (Verified Sources):**
- [Electron vs Tauri Comparison (DoltHub 2025)](https://www.dolthub.com/blog/2025-11-13-electron-vs-tauri/) - Performance benchmarks
- [Tauri vs Electron Real-World App](https://www.levminer.com/blog/tauri-vs-electron) - Bundle size, memory usage
- [React vs Vue vs Svelte 2025](https://medium.com/@jessicajournal/react-vs-vue-vs-svelte-the-ultimate-2025-frontend-performance-comparison-5b5ce68614e2) - Framework comparison
- [State Management 2025 Guide](https://dev.to/hijazi313/state-management-in-2025-when-to-use-context-redux-zustand-or-jotai-2d2k) - When to use each solution
- [shadcn/ui vs Radix Comparison](https://workos.com/blog/what-is-the-difference-between-radix-and-shadcn-ui) - Component library relationship
- [Vitest Tauri Testing](https://yonatankra.com/how-to-setup-vitest-in-a-tauri-project/) - Unit test setup

**Low Confidence (WebSearch Only - Verify During Implementation):**
- GitHub Stars: Zustand 50.2k (verify current count)
- Adoption trends: Tauri +35% YoY (single source, verify)
- Performance claims: Svelte 40% faster load (benchmark-dependent)

---
*Stack research for: Windows Desktop Perforce GUI (P4Now)*
*Researched: 2025-01-27*
*Confidence: HIGH (all core recommendations verified with official docs)*
