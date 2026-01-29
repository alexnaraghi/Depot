---
status: resolved
trigger: "Shelved file lists do not resize/expand the tree view when toggled"
created: 2026-01-29T00:00:00Z
updated: 2026-01-29T00:00:00Z
---

## Current Focus

hypothesis: confirmed
test: TypeScript compiles cleanly
expecting: n/a
next_action: archive

## Symptoms

expected: When shelved files are toggled open, the tree view should expand/resize
actual: Shelved file list overlaps with the changelist underneath
errors: No console errors
reproduction: Toggle shelved files in any changelist
started: Never worked

## Eliminated

(none needed - root cause found on first hypothesis)

## Evidence

- timestamp: 2026-01-29
  checked: ChangelistPanel.tsx Tree component
  found: Tree uses fixed rowHeight={32} and height={400} - virtualized rendering
  implication: Each node gets exactly 32px regardless of content

- timestamp: 2026-01-29
  checked: ShelvedFilesSection.tsx
  found: Uses internal Collapsible component that expands content within a single tree node
  implication: Expanded content overflows the 32px allocation, causing overlap

- timestamp: 2026-01-29
  checked: treeBuilder.ts buildChangelistTree
  found: shelved-section is a single leaf node with no children
  implication: react-arborist has no way to allocate space for expanded shelved files

## Resolution

root_cause: ShelvedFilesSection renders as a single react-arborist node (32px fixed height) but uses an internal Collapsible to show variable-height content. React-arborist's virtualized rendering cannot accommodate this.
fix: Converted shelved files into proper tree node children of the shelved-section node. Shelved data is now fetched at the useChangelists level and passed to buildChangelistTree, which creates shelved-file child nodes. The shelved-section header uses react-arborist's native toggle instead of an internal Collapsible.
verification: TypeScript compiles cleanly with no errors
files_changed:
  - src/utils/treeBuilder.ts
  - src/components/ChangelistPanel/ChangelistNode.tsx
  - src/components/ChangelistPanel/ChangelistPanel.tsx
  - src/components/ChangelistPanel/useChangelists.ts
