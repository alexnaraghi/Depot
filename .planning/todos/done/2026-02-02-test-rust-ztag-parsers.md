---
created: 2026-02-02
title: Test Rust ztag parsers
area: backend
files:
  - src-tauri/src/commands/p4.rs
priority: now
source: architecture-report
---

Zero Rust tests exist. The ztag parsers (parse_ztag_records, parse_ztag_fstat, parse_ztag_changes, etc.) are pure functions that take strings and return structs — easiest possible thing to test and most critical code in the backend. Write tests with real P4 output samples. Highest-value tests per line of code.
