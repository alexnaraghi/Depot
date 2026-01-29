---
status: resolved
trigger: "shelve-ui-white-screen"
created: 2026-01-29T00:00:00Z
updated: 2026-01-29T00:15:00Z
---

## Current Focus

hypothesis: CONFIRMED - Fix applied and verified through build
test: Code compiled successfully with fix in place
expecting: Shelved files to render correctly when app is run
next_action: Ready for manual testing - run app and verify shelving workflow works

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

fix: Added #[serde(rename_all = "camelCase")] annotation to P4ShelvedFile struct in src-tauri/src/commands/p4.rs:1292. This ensures the backend serializes field names to camelCase (depotPath, fileType, etc.) matching what the frontend expects.

verification: Build successful. Manual testing needed: 1) Run the app, 2) Shelve a file, 3) Verify UI doesn't go white, 4) Verify shelved files section displays correctly with file names visible, 5) Test unshelve and delete shelf actions work.

files_changed: ["src-tauri/src/commands/p4.rs"]
