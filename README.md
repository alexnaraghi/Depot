# Depot

A modern, fast Windows GUI for Perforce, intended to eventually support daily development work.

> **WARNING: Early Testing Software** 
>
> This is an experiment in agentic coding using [GSD Meta-Prompting](https://github.com/glittercowboy/get-shit-done) and is NOT ready for production use. Almost everything is vibe coded. USE AT YOUR OWN RISK. 
>
> Expect bugs and missing features.
>
> Settings are stored in `%APPDATA%\com.depot.client`. If you encounter issues, please report them on GitHub.

## Overview

Depot is a Windows GUI replacement for P4V designed around 3 core principles: 
1. **The user is never blocked**. Operations are cancellable and the app stays responsive even during network issues, VPN disconnections, or long-running operations.
2. **Fast, fuzzy search** on files, changelists, and authors.
3. **Efficient, modern layout** for higher productivity.

Built on Tauri 2.0 and React 19, Depot uses progressive loading, instant fuzzy search works across 10,000+ files, and incremental updates avoid full tree rebuilds when only a few files change. The modern three-column layout (file tree, detail pane, changelists) and command palette provide efficient workflows without modal dialog traps.

![Depot main interface](docs/screenshot.png)



## Quick Start

### Prerequisites

- Windows 10 or later
- Perforce Helix Core server (P4D) access
- `p4.exe` command-line client in PATH ([download from Perforce](https://www.perforce.com/downloads/helix-command-line-client-p4))

### Installation

1. Download the latest installer from [GitHub Releases](https://github.com/alexnaraghi/depot/releases)
2. Run the installer (`.msi` or `.exe`)
3. If Windows SmartScreen shows a warning, see the section below

#### Windows SmartScreen Warning

Depot binaries are currently unsigned (no code signing certificate). Windows SmartScreen may block the first run with "Windows protected your PC."

**To bypass the warning:**
1. Click **More info**
2. Click **Run anyway**

The source code is open and auditable on GitHub.

### First Workflow

1. Launch Depot
2. Click **Connect** in the header
3. Enter your connection settings:
   - **P4PORT**: Your Perforce server address (e.g., `ssl:perforce.company.com:1666`)
   - **P4USER**: Your Perforce username
   - **P4CLIENT**: Your workspace/client name
4. Browse your workspace in the file tree
5. Check out files with right-click → **Check Out**
6. Make your changes in your editor
7. Submit with right-click → **Submit** or Ctrl+Enter

## P4V Feature Parity

| Feature | P4V | Depot |
|---------|-----|-------|
| **Search** | Multi-entry dialog | ✅ Fast fuzzy search |
| **Error Handling** | Modal dialogs | ✅ Inline errors, workflow continues |
| **Disconnection Handling** | Blocking dialogs | ✅ Inline notifications, workflow continues |
| **Stability** | ✅ | ❌ In **EARLY ALPHA** testing |
| **UI Theme** | Traditional UI | Modern, dark themed |
| **Pending Changelists** | ✅ | ✅ |
| **File History** | ✅ | ✅ |
| **Diff Tool** | ✅  | ✅ Opens in specified external tool |
| **Shelving** | ✅  | 🟡 Works but with UX issues  |
| **Annotations** | ✅  | 🟡 Limited functionality |
| **Reconcile** | ✅  | ✅ |
| **Large File Tree (10K+ files)** | ✅ | ✅ Progressive loading, <500ms first batch |
| **Conflict Resolution** | ✅ Built-in merge tool | ✅ External merge tool (P4Merge, etc.) |
| **Branch/Integrate** | ✅ | ❌ Not yet implemented |
| **Stream Graph** | ✅ | ❌ Not yet implemented |
| **Time-Lapse View** | ✅ | ❌Not yet implemented |
| **Admin Tools** | ✅ | ❌ Not yet implemented |

Depot focuses on daily development workflows with better performance and UX. For advanced operations like branching or admin tasks, P4V remains the recommended tool. Depot is in its current state a complementary tool, not a replacement.

## Built with Claude

Built with [Claude](https://claude.ai) using the GSD (Get Shit Done) agentic methodology. Development history and planning artifacts are available in `.planning/` for those interested in seeing a transparent, AI-assisted development process.

## License

MIT License - see [LICENSE](LICENSE) for details.
