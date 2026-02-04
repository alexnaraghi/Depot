---
created: 2026-02-03T21:26
title: Prepare repository for public GitHub publish
area: general
files: []
---

## Problem

The repository needs to be prepared for public open-source release on GitHub. This involves multiple concerns:

1. **README**: Create a comprehensive README with project description, screenshots, features, installation instructions, build steps, and contribution guidelines
2. **License**: Choose and add an appropriate open-source license file
3. **Gitignore audit**: Ensure `.gitignore` covers all build artifacts, IDE files, credentials, and platform-specific files that shouldn't be in the repo
4. **Sensitive content audit**: Review the entire repo for anything that shouldn't be public:
   - Hardcoded credentials, API keys, tokens
   - Internal server names, IP addresses, or paths
   - Personal information in comments or configs
   - `.planning/` directory contents (internal project management)
   - Any test data with real/sensitive information
   - Debug configurations with internal endpoints
5. **General cleanup**: Remove any files that shouldn't ship (temp files, `nul`, debug artifacts)

## Solution

TBD — Will need a thorough audit pass. Key areas to check:
- `src-tauri/` for any hardcoded paths or credentials
- `.env` files or equivalent config
- Git history for accidentally committed secrets (may need BFG or git-filter-repo)
- Whether `.planning/` should be included or gitignored for public release
- Choose license (MIT, Apache 2.0, etc.)
