---
phase: 06-shelve-reconcile
plan: 03
subsystem: ui-reconcile
tags: [reconcile, ui, react, tanstack-query, dialog]
completed: 2026-01-29

requires:
  phases: [06-01]
  artifacts:
    - path: src/lib/tauri.ts
      items: [invokeP4ReconcilePreview, invokeP4ReconcileApply, ReconcilePreview]

provides:
  components:
    - ReconcilePreviewDialog (file selection dialog with grouped views)
    - Reconcile toolbar button (workspace scan trigger)
  hooks:
    - useReconcile (preview + apply mutations)

affects:
  - 07-polish (may inform multi-select UX patterns)

tech-stack:
  added: []
  patterns:
    - Grouped file list with action-based badges (add/edit/delete)
    - Select all/none batch controls
    - Changelist picker in dialogs (target CL selection)

key-files:
  created:
    - src/hooks/useReconcile.ts
    - src/components/dialogs/ReconcilePreviewDialog.tsx
  modified:
    - src/components/SyncToolbar.tsx

decisions:
  - id: D-06-03-01
    decision: ReconcilePreviewDialog uses mutation not query for preview scan
    rationale: User triggers reconcile manually (not automatic background refresh), mutation provides explicit loading/error states
  - id: D-06-03-02
    decision: Select all files by default after scan
    rationale: Most common workflow is reconcile all detected changes, user can deselect unwanted files
  - id: D-06-03-03
    decision: Group files by action type with color-coded badges
    rationale: Visual clarity for add (green), edit (yellow), delete (red) operations, helps user review changes before applying
---

# Phase 06 Plan 03: Reconcile Preview Dialog Summary

**One-liner:** Reconcile workspace dialog with file selection, grouped by action type, and changelist picker

## What Was Built

### Components

**ReconcilePreviewDialog (`src/components/dialogs/ReconcilePreviewDialog.tsx`):**
- Dialog component with scan, preview, and apply workflow
- Automatic scan triggers when dialog opens (useEffect)
- Loading state with spinner: "Scanning workspace for offline changes..."
- Empty state: "No offline changes detected"
- Preview state: grouped file list with checkboxes
- File grouping:
  - "Files to Add (N)" - green badge, Plus icon
  - "Files to Edit (N)" - yellow badge, Edit3 icon
  - "Files to Delete (N)" - red badge, Trash2 icon
- Toolbar with "Select All" / "Select None" buttons + selection count
- Changelist picker dropdown:
  - Label: "Target Changelist"
  - Options: "Default Changelist" + all pending numbered changelists
  - Uses shadcn Select component
  - Fetches changelists via useQuery (enabled when dialog open)
- Footer:
  - "Apply Reconcile" button (disabled if no files selected or applying)
  - "Cancel" button
- Path truncation: shows last 2-3 segments for readability (".../" prefix)
- Checkbox styling: custom HTML checkbox with Tailwind classes (no shadcn checkbox component available)
- Apply operation:
  - Calls reconcileApply.mutateAsync with selected file paths
  - Converts changelistId from string ('default' → undefined, number → parsed int)
  - Closes dialog on success, keeps open on error

**useReconcile Hook (`src/hooks/useReconcile.ts`):**
- `reconcilePreview`: TanStack useMutation calling invokeP4ReconcilePreview
  - Returns ReconcilePreview[] (depotPath, localPath, action)
  - Uses connection store for server/user/client args
- `reconcileApply`: TanStack useMutation calling invokeP4ReconcileApply
  - Accepts { filePaths: string[], changelistId?: number }
  - On success: toast success message, invalidates ['p4', 'opened'], ['p4', 'changes'], ['p4', 'fstat']
  - On error: toast error message

**Toolbar Integration (`src/components/SyncToolbar.tsx`):**
- Added "Reconcile" button next to "Sync Workspace" button
- Icon: FolderSync from lucide-react
- Tooltip: "Reconcile Workspace — detect offline changes"
- Disabled during sync operations (isRunning || isCancelling)
- Opens ReconcilePreviewDialog via state: `[reconcileDialogOpen, setReconcileDialogOpen]`
- Dialog component rendered alongside SyncConflictDialog

### UX Flow

1. **User clicks "Reconcile" button in toolbar**
2. **Dialog opens, auto-triggers scan** (previewFiles = [], selectedPaths = Set(), scanning = true)
3. **Scan completes:**
   - If no changes: show empty state
   - If changes found: show grouped file list
4. **All files selected by default** (selectedPaths = Set of all depot paths)
5. **User can:**
   - Select/deselect individual files via checkboxes
   - Click "Select All" / "Select None" for batch operations
   - Choose target changelist from picker (default or numbered)
6. **User clicks "Apply Reconcile":**
   - Button shows spinner: "Applying..."
   - Reconcile applies to selected files only
   - On success: toast message, dialog closes, queries invalidated (UI refreshes)
   - On error: toast error, dialog stays open

## Decisions Made

### D-06-03-01: ReconcilePreviewDialog uses mutation not query for preview scan
**Rationale:** User triggers reconcile manually (not automatic background refresh). Mutation provides explicit loading/error states and user-initiated workflow semantics.

### D-06-03-02: Select all files by default after scan
**Rationale:** Most common workflow is reconcile all detected changes. User can easily deselect unwanted files. Reduces clicks for default case.

### D-06-03-03: Group files by action type with color-coded badges
**Rationale:** Visual clarity for add (green), edit (yellow), delete (red) operations. Helps user review changes before applying. Follows P4V precedent.

## Deviations from Plan

None - plan executed exactly as written.

## Test Results

**TypeScript Compilation:**
```
npx tsc --noEmit
✓ No errors
```

**Visual Verification:**
- Reconcile button visible in toolbar next to Sync button
- Button follows existing toolbar styling (outline variant, sm size, slate colors)
- Icon and tooltip render correctly
- Button disabled during sync operations

**Expected Runtime Behavior:**
1. Clicking Reconcile opens dialog with scanning state
2. Preview shows files grouped by action (add/edit/delete)
3. All files selected by default
4. Select all/none works
5. Changelist picker populated with pending changelists
6. Apply sends only selected files to backend
7. Success invalidates relevant queries (UI refreshes)

## Next Phase Readiness

**Complete - all reconcile requirements met:**
- ✅ RECON-01: User can trigger reconcile scan from toolbar
- ✅ RECON-02: Preview dialog shows detected offline changes
- ✅ RECON-03: User can select/deselect individual files
- ✅ RECON-04: User can choose target changelist for reconciled files

**No blockers for Phase 07 (Polish).**

## Files Changed

**Created:**
- `src/hooks/useReconcile.ts` (64 lines) - Reconcile mutations with query invalidation
- `src/components/dialogs/ReconcilePreviewDialog.tsx` (320 lines) - Dialog with grouped file list, checkboxes, changelist picker

**Modified:**
- `src/components/SyncToolbar.tsx` - Added Reconcile button, wired dialog

## Performance Notes

**Query Strategy:**
- Reconcile preview uses mutation (user-triggered, not cached)
- Changelist picker uses useQuery (enabled when dialog open, cached for 30s from existing setup)
- On apply: invalidates 3 queries (['p4', 'opened'], ['p4', 'changes'], ['p4', 'fstat'])

**UX Optimization:**
- Path truncation reduces visual clutter (shows last 2-3 segments)
- Default "select all" reduces clicks for most common case
- Grouped sections make large file lists scannable

## Integration Points

**Upstream Dependencies:**
- `src/lib/tauri.ts`: invokeP4ReconcilePreview, invokeP4ReconcileApply, ReconcilePreview type
- `src/stores/connectionStore.ts`: p4port, p4user, p4client for command args
- `@tanstack/react-query`: useMutation, useQuery, useQueryClient

**Downstream Consumers:**
- `src/components/SyncToolbar.tsx`: renders Reconcile button, wires dialog state

**Related Features:**
- Similar dialog pattern to FileHistoryDialog (Dialog component, loading/empty states)
- Similar toolbar button pattern to Sync button (icon, size, disabled logic)
- Changelist picker pattern reusable in other dialogs
