---
status: investigating
trigger: "shelve-ui-white-screen"
created: 2026-01-29T00:00:00Z
updated: 2026-01-29T00:00:00Z
---

## Current Focus

hypothesis: Shelved files list/rendering code crashes when encountering actual shelved files (key clue: unshelving via CLI fixes the app)
test: Search for shelve-related rendering code and look for errors in console/logs
expecting: Find code that attempts to render shelved files but fails with data format issues or null reference errors
next_action: Search codebase for shelve rendering code and check for error handling gaps

## Symptoms

expected: When pressing "shelve file", the file should be shelved and the UI should remain functional.
actual: The entire UI goes white when shelving a file. It stays white even after restarting the app.
errors: Unknown - UI just goes blank white.
reproduction: Press "shelve file" on any file in the app.
started: Unknown exact start. The shelve feature was recently implemented.
key_clue: Unshelving the file outside of the app (e.g. via p4 command line) makes the app work again. This strongly suggests the shelved files list/rendering code crashes when it encounters shelved files.

## Eliminated

## Evidence

- timestamp: 2026-01-29T00:05:00Z
  checked: P4ShelvedFile interface in lib/tauri.ts
  found: P4ShelvedFile has camelCase field names (depotPath, fileType)
  implication: Frontend expects camelCase from backend

- timestamp: 2026-01-29T00:06:00Z
  checked: ShelvedFilesSection.tsx lines 107-110
  found: Component accesses file.depotPath (camelCase) in shelvedFiles.map()
  implication: Component expects camelCase field names

- timestamp: 2026-01-29T00:07:00Z
  checked: useShelvedFiles.ts line 21
  found: Query returns type P4ShelvedFile[] from invokeP4DescribeShelved
  implication: Frontend code is written correctly for camelCase

- timestamp: 2026-01-29T00:08:00Z
  checked: Rust struct P4ShelvedFile in src-tauri/src/commands/p4.rs:1292
  found: Struct uses snake_case field names (depot_path, file_type) WITHOUT #[serde(rename_all = "camelCase")]
  implication: Backend serializes to snake_case, but frontend expects camelCase - MISMATCH!

- timestamp: 2026-01-29T00:09:00Z
  checked: ReconcilePreview struct on line 1301
  found: Has #[serde(rename_all = "camelCase")] annotation
  implication: This shows the correct pattern that P4ShelvedFile is missing

## Resolution

root_cause: P4ShelvedFile Rust struct (line 1292) is missing #[serde(rename_all = "camelCase")] annotation. Backend serializes fields as snake_case (depot_path, file_type) but frontend expects camelCase (depotPath, fileType). When ShelvedFilesSection.tsx tries to access file.depotPath, it gets undefined, causing React to crash with a white screen.
fix:
verification:
files_changed: []
