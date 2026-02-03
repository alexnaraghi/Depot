# Phase 19: Submit Enhancement - Research

**Researched:** 2026-02-03
**Domain:** Submit preview dialog with changelist description and file list display
**Confidence:** HIGH

## Summary

Phase 19 implements submit preview enhancement to show users changelist details before final submission. This replaces the existing simple `SubmitDialog` (112 lines at `src/components/ChangelistPanel/SubmitDialog.tsx`) with a richer preview that displays: (1) editable changelist description, (2) complete file list with action badges, (3) clickable files to view content before submitting, and (4) cancel/edit/proceed actions.

The project has all necessary infrastructure already in place from Phase 16 (FileContentViewer), Phase 18 (p4_describe command for submitted CL files, action badge styling), and existing dialog patterns (ReconcilePreviewDialog, FileSizeWarningDialog, EditDescriptionDialog). The key technical insight is this phase is primarily a **UI composition task**, not a new backend command implementation. All Perforce commands already exist: `p4_submit` (line 543 in p4.rs), `p4_describe` (line 1686), `p4_print_to_file` (line 1185).

Architecture follows established patterns: Dialog component using shadcn/ui `Dialog` primitive (not `AlertDialog`), file list with action badges matching ChangelistDetailView pattern (lines 24-50), FileContentViewer integration for inline file preview, and textarea for description editing. The primary challenge is deciding **where** file content preview appears: (1) replace entire dialog with FileContentViewer modal, (2) split-pane within dialog, or (3) open separate modal on top of submit dialog.

**Primary recommendation:** Enhance existing SubmitDialog with file list display using action badges, make file names clickable to drill into FileContentViewer (separate detail pane navigation), keep description textarea editable, and add "Edit Description" link to open full EditDescriptionDialog for complex changes. This follows "no nested modals" principle and leverages existing navigation patterns.

## Standard Stack

All dependencies already installed. No new packages needed.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @radix-ui/react-dialog | ^1.1.2 | Dialog primitive | Already in use for all dialogs, provides accessibility out-of-box |
| lucide-react | 0.563.0 | Icons (File, Folder icons) | Already in use, consistent with codebase |
| @tanstack/react-query | 5.90.20 | Data fetching for CL files | Already in use, provides caching/invalidation |
| class-variance-authority | 0.7.1 | Badge variants for action colors | Already in use for action badges in ChangelistDetailView |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-hot-toast | ^2.4.1 | Toast notifications | Already in use, shows submit success/error feedback |
| tailwind-merge | 3.4.0 | CSS class composition | Already in use, cn() utility for conditional styling |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Dialog primitive | AlertDialog | AlertDialog is for destructive actions with OK/Cancel. Submit is a workflow action, needs Dialog for richer layout (file list, textarea, action buttons). Existing SubmitDialog incorrectly uses AlertDialog - Phase 19 corrects this. |
| Inline file preview | Separate modal | Separate modal creates nested modal anti-pattern. Inline preview requires dialog expansion/scrolling. Better: Navigate to FileContentViewer in detail pane (no modal nesting). |
| Custom file list | Reuse ChangelistDetailView | ChangelistDetailView has too much UI (action buttons, shelved sections). Extract file list rendering into shared component. |

**Installation:**
No new packages needed. All dependencies already installed.

## Architecture Patterns

### Recommended Project Structure
Current structure already supports this phase:
```
src/
├── components/
│   ├── ChangelistPanel/
│   │   ├── SubmitDialog.tsx           # REPLACE: Enhance with file preview
│   │   └── SubmitFileList.tsx         # NEW: Extracted file list component
│   └── DetailPane/
│       ├── FileContentViewer.tsx      # EXISTS: Reuse for file preview
│       └── ChangelistDetailView.tsx   # EXISTS: Reference for action badge pattern
├── hooks/
│   ├── useFileOperations.ts           # EXISTS: submit() mutation
│   └── useChangelistFiles.ts          # EXISTS: Fetch files for CL preview
└── types/
    └── p4.ts                          # EXISTS: P4Changelist, P4File types
```

### Pattern 1: Dialog Component Structure (not AlertDialog)

**What:** Use Dialog primitive for workflow dialogs with rich content, AlertDialog only for destructive confirmations
**When to use:** Submit preview, reconcile preview, any dialog showing data lists and multiple actions
**Example:**
```typescript
// Source: src/components/dialogs/ReconcilePreviewDialog.tsx (lines 133-150)
// REUSE THIS PATTERN - correct dialog primitive for submit preview

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

export function SubmitPreviewDialog({ changelist, open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Submit Changelist {changelist.id}</DialogTitle>
        </DialogHeader>

        {/* File list and description here */}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Submit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Why Dialog, not AlertDialog:**
- AlertDialog is for destructive actions ("Delete this?") with simple OK/Cancel
- Dialog supports complex layouts (file lists, text areas, split views)
- Current SubmitDialog incorrectly uses AlertDialog - Phase 19 corrects this

### Pattern 2: File List with Action Badges

**What:** Display file list with colored action badges matching ChangelistDetailView styling
**When to use:** Any file list in submit preview, changelist detail views
**Example:**
```typescript
// Source: src/components/DetailPane/ChangelistDetailView.tsx (lines 24-50, 198-210)
// REUSE THIS EXACT FUNCTION

const getActionBadgeColor = (action?: FileAction | string): string => {
  const actionLower = typeof action === 'string' ? action.toLowerCase() : action;
  switch (actionLower) {
    case FileAction.Edit:
    case 'edit':
      return 'bg-blue-900/30 text-blue-300';
    case FileAction.Add:
    case 'add':
      return 'bg-green-900/30 text-green-300';
    case FileAction.Delete:
    case 'delete':
      return 'bg-red-900/30 text-red-300';
    case FileAction.Branch:
    case 'branch':
      return 'bg-purple-900/30 text-purple-300';
    case FileAction.Integrate:
    case 'integrate':
      return 'bg-yellow-900/30 text-yellow-300';
    case FileAction.MoveAdd:
    case 'move/add':
    case FileAction.MoveDelete:
    case 'move/delete':
      return 'bg-orange-900/30 text-orange-300';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

// Render file list
{changelist.files.map((file) => {
  const fileName = file.depotPath.split('/').pop() || file.depotPath;
  const actionBadgeClass = getActionBadgeColor(file.action);

  return (
    <div key={file.depotPath} className="flex items-center gap-2 p-2 hover:bg-accent rounded-md">
      <Badge className={cn('text-xs font-mono', actionBadgeClass)}>
        {file.action?.toLowerCase() || 'edit'}
      </Badge>
      <button
        className="text-sm text-foreground hover:underline truncate"
        onClick={() => handleFileClick(file.depotPath, file.revision)}
      >
        {fileName}
      </button>
    </div>
  );
})}
```

### Pattern 3: Clickable File Navigation to Detail Pane

**What:** File clicks in submit preview navigate to FileContentViewer in detail pane, don't open nested modal
**When to use:** Any file list where user might want to view content before action
**Example:**
```typescript
// Source: src/components/DetailPane/ChangelistDetailView.tsx (lines 119-133)
// ADAPT THIS PATTERN for submit preview file clicks

const handleFileClick = (depotPath: string, revision: number) => {
  // Navigate to file detail view in detail pane
  // User can review file content, then return to submit dialog
  useDetailPaneStore.getState().drillToRevision(depotPath, '', {
    rev: revision,
    action: 'edit',
    file_type: '',
    change: changelist.id,
    user: changelist.user,
    client: changelist.client,
    time: 0,
    desc: changelist.description,
  });

  // Dialog remains open - user can close it manually after reviewing files
  // Or: Close dialog automatically when navigating to file?
  // Decision: Keep dialog open for better UX (user can review multiple files)
};
```

**Why this pattern:**
- Avoids nested modals (submit dialog -> file preview modal on top)
- Uses existing detail pane navigation (drillToRevision)
- Consistent with how file clicks work in ChangelistDetailView
- User can review files, then return to submit dialog to proceed

### Pattern 4: Description Editing with Textarea

**What:** Inline textarea for description editing, with link to full EditDescriptionDialog for complex changes
**When to use:** Submit preview where description might need tweaking before submit
**Example:**
```typescript
// Source: Existing SubmitDialog.tsx (lines 76-87) - KEEP THIS PATTERN

const [description, setDescription] = useState('');

// Initialize description from changelist when dialog opens
useEffect(() => {
  if (open && changelist) {
    setDescription(changelist.description);
  }
}, [open, changelist]);

return (
  <div className="my-4">
    <div className="flex items-center justify-between mb-2">
      <label className="text-sm font-medium text-foreground">
        Description
      </label>
      <Button
        variant="link"
        size="sm"
        onClick={() => openEditDescriptionDialog()}
        className="text-xs"
      >
        Edit in Full Editor
      </Button>
    </div>
    <textarea
      value={description}
      onChange={(e) => setDescription(e.target.value)}
      className="w-full h-24 px-3 py-2 bg-background border border-border rounded-md text-foreground"
      placeholder="Enter changelist description..."
      disabled={isSubmitting}
    />
  </div>
);
```

**Pattern enhancement:**
- Add "Edit in Full Editor" link to open EditDescriptionDialog for multi-line editing
- Textarea height: 4-6 lines (h-24) for quick edits
- EditDescriptionDialog provides full-screen editing for complex descriptions
- Sync description state between dialogs via changelist update mutation

### Pattern 5: Submit Flow with Preview

**What:** Two-stage submit flow: Preview -> Confirm -> Execute
**When to use:** All submit operations from context menus, command palette, keyboard shortcuts
**Example:**
```typescript
// Source: Adapt from src/components/ChangelistPanel/ChangelistPanel.tsx submit flow

// Stage 1: User triggers submit action
const handleSubmitAction = (changelist: P4Changelist) => {
  // Open preview dialog - NOT immediate submit
  setSelectedChangelist(changelist);
  setSubmitDialogOpen(true);
};

// Stage 2: User reviews preview and clicks Submit button
const handleSubmitConfirm = async () => {
  if (!selectedChangelist) return;

  setIsSubmitting(true);
  try {
    // Execute submit with potentially edited description
    const newClId = await submit(selectedChangelist.id, description);

    // Close dialog and show success
    setSubmitDialogOpen(false);
    toast.success(`Changelist ${selectedChangelist.id} submitted as #${newClId}`);

    // Navigate to submitted CL in detail pane?
    useDetailPaneStore.getState().selectChangelist({
      ...selectedChangelist,
      id: newClId,
      status: 'submitted',
    });
  } catch (error) {
    // Error already handled by useFileOperations (toast)
  } finally {
    setIsSubmitting(false);
  }
};
```

**Flow stages:**
1. Trigger: User clicks Submit button/menu item
2. Preview: Dialog opens showing CL description, file list
3. Review: User can edit description, click files to view content
4. Confirm: User clicks Submit button in dialog
5. Execute: `p4_submit` runs, dialog closes, toast shows success
6. Navigate: Detail pane shows submitted CL (optional)

### Anti-Patterns to Avoid

- **Nested modals:** Don't open FileContentViewer modal on top of SubmitDialog. Use detail pane navigation instead.
- **AlertDialog for submit preview:** AlertDialog is for simple destructive confirmations. Submit preview needs Dialog for rich layout.
- **Fetching file list on every dialog open:** For pending CLs, files are already in `changelist.files` from changelist query. Don't re-fetch. Only fetch for submitted CLs (Phase 18 pattern).
- **Blocking submit on description validation:** User should be able to submit with empty description (P4 allows this). Show warning, but don't block.
- **Immediate submit without preview:** Current SubmitDialog already shows preview. Phase 19 enhances it, doesn't remove it. Always show preview.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Action badge styling | Custom color logic for each action | `getActionBadgeColor()` from ChangelistDetailView | Already implemented and tested, consistent colors across app, handles all action types including move/add and move/delete |
| File list rendering | Custom list component | Extract from ChangelistDetailView into shared `SubmitFileList` component | DRY principle, consistent styling, includes hover states and truncation logic |
| File content viewing | Custom syntax highlighting | FileContentViewer component from Phase 16 | Already handles size validation, binary files, syntax highlighting, all edge cases solved |
| Description editing | Custom textarea validation | EditDescriptionDialog component | Already exists for complex editing, multi-line support, keyboard shortcuts |
| Dialog primitives | Custom modal implementation | shadcn/ui Dialog components | Accessibility, keyboard navigation, focus trapping, ESC to close all handled |

**Key insight:** Phase 19 is primarily a UI composition task. All backend commands exist. All UI components exist. Challenge is composing them into cohesive submit preview flow.

## Common Pitfalls

### Pitfall 1: Nested Modal Anti-Pattern

**What goes wrong:** User clicks file in submit preview. New modal opens on top with FileContentViewer. User closes file modal, submits CL. Dialog stack confusion, ESC key behavior ambiguous, focus trapping conflicts.

**Why it happens:** Intuitive to open file preview in modal "closer" to submit dialog. Seems like natural drill-down UX. But nested modals have fundamental usability issues: (1) ESC key closes which modal?, (2) Focus trapping conflicts, (3) Background dimming stacks (very dark), (4) User loses context of submit dialog.

**How to avoid:**
1. **Never nest modals.** Use detail pane navigation for file preview.
2. When user clicks file in submit dialog, navigate detail pane to FileContentViewer.
3. Keep submit dialog open (floating on left side) while detail pane shows file.
4. User can review multiple files, return to dialog when ready.
5. Alternative: Close submit dialog when navigating to file, re-open via "Resume Submit" action.

**Warning signs:**
- Two dimmed overlays visible (very dark background)
- ESC key closes wrong modal
- User reports: "Can't get back to submit dialog"
- Focus trapped in wrong modal
- Screen reader announces nested dialog roles

**Source:** Web accessibility best practices, [Nielsen Norman Group: Modal & Nonmodal Dialogs](https://www.nngroup.com/articles/modal-nonmodal-dialog/), Material Design dialog guidelines

### Pitfall 2: Fetching Files Unnecessarily for Pending Changelists

**What goes wrong:** Submit dialog opens for pending CL. Hook calls `useChangelistFiles(changelist.id, true)` to fetch file list. Query fires, p4_describe runs, returns same data already in `changelist.files`. Wasted server round-trip, delayed dialog display, users see loading spinner.

**Why it happens:** Phase 18 introduced `useChangelistFiles()` hook for **submitted** changelists (which don't have files loaded in `changelist.files`). Easy to misuse for pending CLs without checking `enabled` parameter.

**How to avoid:**
1. Only fetch files for submitted CLs: `useChangelistFiles(changelist.id, changelist.status === 'submitted')`
2. For pending CLs, files already exist in `changelist.files` from pending changelist query.
3. Check hook `enabled` parameter matches CL status.
4. Add JSDoc comment to `useChangelistFiles` clarifying use case.

**Warning signs:**
- Dialog shows loading spinner for pending CLs
- Network tab shows p4_describe for pending CL IDs
- Submit dialog slower than expected
- Users report: "Why does submit take so long to open?"

**Source:** Phase 18 implementation, existing `useChangelistFiles.ts` (lines 14-27)

### Pitfall 3: Description State Sync Between Dialogs

**What goes wrong:** User opens submit preview, edits description in textarea, clicks "Edit in Full Editor" link. EditDescriptionDialog opens, shows old description. User makes changes, saves. Returns to submit preview - sees old description in textarea. Submits with wrong description.

**Why it happens:** Two dialogs maintain separate local state for description. EditDescriptionDialog saves to backend via mutation. SubmitDialog initializes from prop on mount, doesn't re-sync after external updates.

**How to avoid:**
1. **Option A: Single source of truth in changelist query:**
   - EditDescriptionDialog mutation invalidates changelist query
   - SubmitDialog re-initializes description from prop on query update
   - Use `useEffect` to sync local state with prop changes

2. **Option B: Shared state in Zustand store:**
   - Create `useSubmitFlowStore` with `{ changelistId, draftDescription }`
   - Both dialogs read/write same store
   - Clear store on submit completion

3. **Option C: Pass description as controlled prop:**
   - Parent component (ChangelistPanel) owns description state
   - Pass `description` and `onDescriptionChange` to both dialogs
   - Dialogs become fully controlled components

**Recommendation:** Option A (query invalidation) is most consistent with existing architecture. EditDescriptionDialog already invalidates queries. SubmitDialog just needs `useEffect` to re-sync on prop change.

```typescript
// In SubmitDialog:
useEffect(() => {
  if (open && changelist) {
    setDescription(changelist.description); // Re-sync on any changelist update
  }
}, [open, changelist, changelist?.description]); // Include description in deps
```

**Warning signs:**
- Description reverts after using EditDescriptionDialog
- Submit uses old description, not edited one
- User reports: "My description changes didn't save"
- Tests fail: "Expected description X, got Y"

**Source:** React controlled component patterns, existing EditDescriptionDialog implementation

### Pitfall 4: File Click Navigation Closes Dialog Unexpectedly

**What goes wrong:** User clicks file in submit preview to review content. Detail pane navigates to FileContentViewer. Submit dialog closes automatically. User reviews file, wants to return to submit - dialog gone. Must trigger submit action again, loses context.

**Why it happens:** Dialog open/closed state managed by parent component. File click triggers detail pane navigation, which may trigger dialog `onOpenChange(false)` callback. Or: File click handler explicitly closes dialog assuming user is "done" with submit flow.

**How to avoid:**
1. **Keep dialog open during file review:** Don't close dialog when navigating to file. Let user close it manually when ready.
2. Alternative: Add "Resume Submit" button to FileContentViewer when user navigated from submit dialog.
3. Store submit flow state in Zustand: `{ inSubmitFlow: boolean, changelistId: number }`.
4. FileContentViewer shows banner: "You're reviewing files for submit. [Return to Submit] [Cancel Submit]"

**Recommendation:** Keep dialog open. It floats on left side while detail pane shows file. User can review multiple files, close dialog when done or click Submit when ready.

```typescript
const handleFileClick = (depotPath: string, revision: number) => {
  // Navigate to file in detail pane
  useDetailPaneStore.getState().drillToRevision(/* ... */);

  // DON'T close dialog:
  // onOpenChange(false); // WRONG - user loses submit context

  // Dialog stays open - user can review files and return to submit
};
```

**Warning signs:**
- Dialog disappears when clicking files
- User must re-open submit dialog after viewing files
- User reports: "Can't get back to submit dialog"
- Tests fail: "Dialog should remain open during file review"

**Source:** UX patterns for multi-step workflows, existing detail pane navigation

### Pitfall 5: Action Badge Colors Don't Match Existing UI

**What goes wrong:** Submit preview shows file list with action badges. Colors don't match ChangelistDetailView. Blue for "add", green for "edit" (opposite of established pattern). User confused: "Why are colors different in submit dialog?"

**Why it happens:** Developer copies badge styling from external source or creates custom color scheme without checking existing ChangelistDetailView implementation (lines 24-50). Color mapping logic duplicated, diverges over time.

**How to avoid:**
1. **Extract `getActionBadgeColor()` to shared utility:** Move from ChangelistDetailView to `lib/actionBadges.ts`.
2. Import and reuse in SubmitDialog, SubmitFileList, anywhere showing action badges.
3. Document color choices in utility file (edit=blue, add=green, delete=red, etc.).
4. Add comment: "DO NOT DUPLICATE - import getActionBadgeColor() from lib/actionBadges"

```typescript
// lib/actionBadges.ts
export const getActionBadgeColor = (action?: FileAction | string): string => {
  // ... existing implementation from ChangelistDetailView
};

// SubmitFileList.tsx
import { getActionBadgeColor } from '@/lib/actionBadges';

<Badge className={cn('text-xs font-mono', getActionBadgeColor(file.action))}>
  {file.action}
</Badge>
```

**Warning signs:**
- Visual inconsistency between views
- Users report color confusion
- Code review flags duplicated logic
- Tests fail on color assertions

**Source:** DRY principle, existing ChangelistDetailView implementation

## Code Examples

Verified patterns from codebase:

### Enhanced Submit Dialog Structure

```typescript
// Adapt from ReconcilePreviewDialog pattern + existing SubmitDialog
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFileOperations } from '@/hooks/useFileOperations';
import { useDetailPaneStore } from '@/stores/detailPaneStore';
import { P4Changelist, FileAction } from '@/types/p4';
import { cn } from '@/lib/utils';
import { getActionBadgeColor } from '@/lib/actionBadges'; // Extracted utility

interface SubmitPreviewDialogProps {
  changelist: P4Changelist | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted?: (newChangelistId: number) => void;
}

export function SubmitPreviewDialog({
  changelist,
  open,
  onOpenChange,
  onSubmitted,
}: SubmitPreviewDialogProps) {
  const { submit } = useFileOperations();
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize description from changelist
  useEffect(() => {
    if (open && changelist) {
      setDescription(changelist.description);
    }
  }, [open, changelist?.description]); // Re-sync on description changes

  const handleSubmit = async () => {
    if (!changelist) return;

    setIsSubmitting(true);
    try {
      const newClId = await submit(changelist.id, description);
      onOpenChange(false);
      onSubmitted?.(newClId);
    } catch (error) {
      // Error handled by useFileOperations
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileClick = (depotPath: string, revision: number) => {
    // Navigate to file in detail pane, keep dialog open
    useDetailPaneStore.getState().drillToRevision(depotPath, '', {
      rev: revision,
      action: 'edit',
      file_type: '',
      change: changelist.id,
      user: changelist.user,
      client: changelist.client,
      time: 0,
      desc: changelist.description,
    });
  };

  if (!changelist) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Submit Changelist {changelist.id === 0 ? '(Default)' : changelist.id}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4">
          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Description</label>
              <Button
                variant="link"
                size="sm"
                className="text-xs"
                onClick={() => {
                  // Open EditDescriptionDialog
                }}
              >
                Edit in Full Editor
              </Button>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full h-24 px-3 py-2 bg-background border border-border rounded-md"
              disabled={isSubmitting}
            />
          </div>

          {/* File List */}
          <div>
            <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
              FILES ({changelist.files.length})
            </h3>
            <div className="space-y-1">
              {changelist.files.map((file) => {
                const fileName = file.depotPath.split('/').pop() || file.depotPath;
                return (
                  <div
                    key={file.depotPath}
                    className="flex items-center gap-2 p-2 hover:bg-accent rounded-md"
                  >
                    <Badge className={cn('text-xs font-mono', getActionBadgeColor(file.action))}>
                      {file.action?.toLowerCase() || 'edit'}
                    </Badge>
                    <button
                      className="text-sm text-foreground hover:underline truncate"
                      onClick={() => handleFileClick(file.depotPath, file.revision)}
                    >
                      {fileName}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !description.trim()}
          >
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Extracted Action Badge Utility

```typescript
// lib/actionBadges.ts
// Extracted from ChangelistDetailView.tsx to prevent duplication
import { FileAction } from '@/types/p4';

/**
 * Get Tailwind CSS classes for file action badge color
 * Used in ChangelistDetailView, SubmitDialog, and any file list display
 *
 * Color scheme:
 * - Edit: Blue (most common, default)
 * - Add: Green (new file)
 * - Delete: Red (removal)
 * - Branch: Purple (branch operation)
 * - Integrate: Yellow (merge operation)
 * - Move: Orange (rename/move)
 */
export function getActionBadgeColor(action?: FileAction | string): string {
  const actionLower = typeof action === 'string' ? action.toLowerCase() : action;

  switch (actionLower) {
    case FileAction.Edit:
    case 'edit':
      return 'bg-blue-900/30 text-blue-300';
    case FileAction.Add:
    case 'add':
      return 'bg-green-900/30 text-green-300';
    case FileAction.Delete:
    case 'delete':
      return 'bg-red-900/30 text-red-300';
    case FileAction.Branch:
    case 'branch':
      return 'bg-purple-900/30 text-purple-300';
    case FileAction.Integrate:
    case 'integrate':
      return 'bg-yellow-900/30 text-yellow-300';
    case FileAction.MoveAdd:
    case 'move/add':
    case FileAction.MoveDelete:
    case 'move/delete':
      return 'bg-orange-900/30 text-orange-300';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

/**
 * Format action for display (lowercase, human-readable)
 */
export function formatActionLabel(action?: FileAction | string): string {
  if (!action) return 'edit';
  const actionStr = typeof action === 'string' ? action : action.toLowerCase();
  return actionStr.replace('/', ' / '); // "move/add" -> "move / add"
}
```

### File Click Navigation Pattern

```typescript
// Adapted from ChangelistDetailView.tsx handleSubmittedFileClick (lines 119-133)
const handleFileClick = (depotPath: string, revision: number) => {
  // Navigate to revision detail view in detail pane
  useDetailPaneStore.getState().drillToRevision(depotPath, '', {
    rev: revision,
    action: 'edit',
    file_type: '',
    change: changelist.id,
    user: changelist.user,
    client: changelist.client,
    time: 0,
    desc: changelist.description,
  });

  // Dialog stays open - user can review multiple files before submitting
  // User closes dialog manually when ready
};
```

### Description State Sync Pattern

```typescript
// Sync description from changelist prop, including external updates
useEffect(() => {
  if (open && changelist) {
    // Re-sync whenever changelist.description changes
    // Handles updates from EditDescriptionDialog mutation
    setDescription(changelist.description);
  }
}, [open, changelist, changelist?.description]);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AlertDialog for all confirmations | Dialog for workflows, AlertDialog for destructive actions | Phase 19 | Better UX for rich content, accessibility improvements, clearer semantic meaning |
| Inline file preview in modals | Detail pane navigation | Phase 19 | Avoids nested modal anti-pattern, consistent navigation, better context preservation |
| Duplicated action badge logic | Shared utility function | Phase 19 | DRY principle, consistent styling, single source of truth |
| Immediate submit (no preview) | Two-stage preview -> submit flow | Phase 19 | Prevents accidental submits, allows file review, better description editing |

**Deprecated/outdated:**
- **AlertDialog for submit preview**: Current SubmitDialog uses AlertDialog (lines 64-109), which is semantically incorrect. AlertDialog is for simple destructive confirmations, not workflow dialogs with rich content.
- **Simple file list without action badges**: Current SubmitDialog shows file names only (lines 89-96), no action indicators. Users can't tell which files are add vs edit vs delete.
- **No file preview capability**: Current SubmitDialog doesn't allow clicking files to view content before submitting.

## Open Questions

Things that couldn't be fully resolved:

1. **Should submit dialog auto-close when user clicks file to review?**
   - What we know: Nested modals are anti-pattern. Detail pane navigation is preferred.
   - What's unclear: Does keeping dialog open cause confusion? Should dialog minimize/hide during file review?
   - Recommendation: Keep dialog open (floating on left) during file review. User can manually close after reviewing. Test with users to validate UX.

2. **Should "Edit in Full Editor" open EditDescriptionDialog or navigate to ChangelistDetailView?**
   - What we know: EditDescriptionDialog exists for multi-line editing. ChangelistDetailView has "Edit Description" button.
   - What's unclear: Which provides better UX during submit flow? Opening EditDescriptionDialog creates modal nesting issue.
   - Recommendation: Use EditDescriptionDialog but make it replace submit dialog (close submit, open edit, return to submit after save). Or: Just increase textarea height in submit dialog to 8 lines (h-32).

3. **What happens if user edits description in submit dialog, then cancels?**
   - What we know: Local state changes aren't persisted unless user clicks Submit.
   - What's unclear: Should draft be saved somewhere? Should we warn "Discard changes?"
   - Recommendation: Don't persist drafts. Canceling submit dialog discards description changes. User can use EditDescriptionDialog first if they want to save description before submitting.

4. **Should file list be virtualized for CLs with 100+ files?**
   - What we know: ReconcilePreviewDialog doesn't virtualize file list.
   - What's unclear: At what file count does non-virtualized list cause performance issues?
   - Recommendation: Start without virtualization. Most CLs have <50 files. If users report performance issues with large CLs, add react-virtuoso (already in dependencies from Phase 17).

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/components/ChangelistPanel/SubmitDialog.tsx` (current implementation)
- Existing codebase: `src/components/DetailPane/ChangelistDetailView.tsx` (action badge pattern, file click navigation)
- Existing codebase: `src/components/dialogs/ReconcilePreviewDialog.tsx` (Dialog pattern for file lists)
- Existing codebase: `src/components/DetailPane/FileContentViewer.tsx` (Phase 16 file content viewing)
- Existing codebase: `src/hooks/useChangelistFiles.ts` (Phase 18 describe command)
- Existing codebase: `src-tauri/src/commands/p4.rs` (p4_submit line 543, p4_describe line 1686)

### Secondary (MEDIUM confidence)
- [Nielsen Norman Group: Modal & Nonmodal Dialogs](https://www.nngroup.com/articles/modal-nonmodal-dialog/) - Nested modal anti-patterns
- [Material Design: Dialogs](https://m2.material.io/components/dialogs) - Dialog vs AlertDialog semantic differences
- [Radix UI Dialog Documentation](https://www.radix-ui.com/docs/primitives/components/dialog) - shadcn/ui Dialog primitive API
- Phase 16 RESEARCH.md - File content viewer patterns (lines 59-162)
- Phase 18 RESEARCH.md - Action badge styling, p4_describe usage (lines 166-188)

### Tertiary (LOW confidence)
- Web search on React dialog UX patterns (general best practices, not specific to this stack)
- Assumption that submit preview improves UX over immediate submit (validate with user testing)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, verified in package.json and existing components
- Architecture: HIGH - Patterns extracted directly from existing codebase (ReconcilePreviewDialog, ChangelistDetailView, FileContentViewer)
- Pitfalls: MEDIUM - Some pitfalls derived from general UX principles (nested modals), not specific to P4Now codebase
- Code examples: HIGH - Adapted from existing implementation patterns, all dependencies verified

**Research date:** 2026-02-03
**Valid until:** 2026-05-03 (90 days - stable ecosystem, no new libraries)
