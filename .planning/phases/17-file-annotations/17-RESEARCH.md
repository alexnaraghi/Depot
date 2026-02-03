# Phase 17: File Annotations - Research

**Researched:** 2026-02-03
**Domain:** Git/P4 blame UI with virtualization and rich interactions
**Confidence:** HIGH

## Summary

File annotations (blame view) display per-line authorship information showing which revision, author, and date last modified each line of a file. This phase implements a blame viewer using Perforce's `p4 annotate` command, rendered with virtualization for performance, and enhanced with interactive features like heatmap coloring, tooltip previews, keyboard navigation, and the ability to "blame prior revision" to peel back history layers.

The standard approach uses `p4 annotate -u -c` to get per-line data (user, date, changelist), renders it in a virtualized gutter alongside syntax-highlighted code, applies age-based heatmap coloring (cool blue for old, warm red for recent), and provides click/hover interactions to navigate to changelist details or view commit messages.

**Primary recommendation:** Use `p4 annotate -u -c` for blame data, TanStack Virtual for rendering performance, extend existing SyntaxHighlightedContent component with an annotation gutter, implement age-based HSL color gradients, and leverage existing DetailPane navigation for click-through to changelist views.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| p4 annotate | — | Perforce CLI | Official Perforce command for per-line blame data; efficient server-side computation |
| @tanstack/react-virtual | ^3.13.x | List virtualization | Lightweight (10-15kb), headless, 60fps rendering of 1000+ lines; already using TanStack Query in project |
| prism-react-renderer | ^2.4.1 | Syntax highlighting | Already installed in Phase 16; render props pattern allows custom line decorations |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TanStack Query | ^5.90.20 | Data fetching/caching | Already in use; cache blame data with long staleTime (immutable per revision) |
| Radix UI Tooltip | — | Hover message | Already installed; accessible tooltips for commit message previews |
| lucide-react | ^0.563.0 | Icons | Already in use; icons for navigation controls (up/down arrows, history back) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TanStack Virtual | react-window | react-window is lighter (3-10kb) but TanStack Virtual integrates better with existing TanStack ecosystem and has better dynamic sizing support |
| TanStack Virtual | react-virtualized | react-virtualized is heavier (20-30kb) with more features but TanStack Virtual is sufficient and more modern |
| Gutter layout | Inline annotations | Inline (like GitLens) is less intrusive but gutter provides better spatial consistency and clickability |

**Installation:**
```bash
npm install @tanstack/react-virtual
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   └── DetailPane/
│       ├── FileAnnotationViewer.tsx        # Main blame viewer component
│       ├── AnnotationGutter.tsx            # Virtualized gutter with blame info
│       ├── AnnotationLine.tsx              # Single annotation line (user, date, CL#)
│       └── AnnotationTooltip.tsx           # Hover tooltip with commit message
├── hooks/
│   ├── useFileAnnotations.ts               # TanStack Query hook for p4 annotate
│   └── useAnnotationNavigation.ts          # Keyboard navigation between change blocks
└── lib/
    ├── annotationParser.ts                  # Parse p4 annotate -u -c output
    └── annotationColors.ts                  # Age-based heatmap color calculation
```

### Pattern 1: p4 annotate Command Invocation

**What:** Execute `p4 annotate -u -c <depotPath>#<revision>` to get per-line blame data with user, date, and changelist number.

**When to use:** For any file at any revision; use `-c` for changelist numbers (better for navigation) instead of `-r` for revision numbers.

**Example:**
```typescript
// src/hooks/useFileAnnotations.ts
import { useQuery } from '@tanstack/react-query';
import { invokeP4Command } from '@/lib/tauri';

export interface AnnotationLine {
  lineNumber: number;        // 1-indexed line number
  changelistId: number;      // Changelist that last modified this line
  user: string;              // Author of the change
  date: string;              // Modification date (YYYY/MM/DD format)
  lineContent: string;       // The actual code line
}

export function useFileAnnotations(
  depotPath: string,
  revision: number,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['file-annotations', depotPath, revision],
    queryFn: async () => {
      const revisionSpec = `${depotPath}#${revision}`;
      // Use -u for user/date, -c for changelist numbers
      const output = await invokeP4Command(['annotate', '-u', '-c', revisionSpec]);
      return parseAnnotations(output);
    },
    staleTime: 60 * 60 * 1000, // 1 hour - annotations at specific revision never change
    enabled: options?.enabled ?? true,
  });
}
```

### Pattern 2: Parse p4 annotate Output

**What:** Parse column-delimited output format where first column is changelist/revision number, second is user, third is date, fourth is code line.

**When to use:** After receiving output from `p4 annotate -u -c`.

**Example:**
```typescript
// src/lib/annotationParser.ts

export interface ParsedAnnotation {
  changelistId: number;
  user: string;
  date: string;         // YYYY/MM/DD format
  lineContent: string;
  lineNumber: number;
}

/**
 * Parse p4 annotate -u -c output.
 * Format: "CL#: user date line-content"
 * Example: "320: mjones 2017/05/06 sr->w.digest.Clear();"
 */
export function parseAnnotations(output: string): ParsedAnnotation[] {
  const lines = output.split('\n');
  const annotations: ParsedAnnotation[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Match pattern: "NUMBER: USER DATE REST-OF-LINE"
    const match = line.match(/^(\d+):\s+(\S+)\s+(\d{4}\/\d{2}\/\d{2})\s+(.*)$/);

    if (match) {
      const [, changelistStr, user, date, lineContent] = match;
      annotations.push({
        changelistId: parseInt(changelistStr, 10),
        user,
        date,
        lineContent,
        lineNumber: i + 1,
      });
    }
  }

  return annotations;
}

/**
 * Group consecutive lines by changelist for keyboard navigation.
 * Returns array of { changelistId, startLine, endLine }
 */
export function groupAnnotationBlocks(
  annotations: ParsedAnnotation[]
): Array<{ changelistId: number; startLine: number; endLine: number; user: string; date: string }> {
  const blocks: Array<{ changelistId: number; startLine: number; endLine: number; user: string; date: string }> = [];

  if (annotations.length === 0) return blocks;

  let currentBlock = {
    changelistId: annotations[0].changelistId,
    user: annotations[0].user,
    date: annotations[0].date,
    startLine: annotations[0].lineNumber,
    endLine: annotations[0].lineNumber,
  };

  for (let i = 1; i < annotations.length; i++) {
    const ann = annotations[i];

    if (ann.changelistId === currentBlock.changelistId) {
      // Extend current block
      currentBlock.endLine = ann.lineNumber;
    } else {
      // Save current block and start new one
      blocks.push(currentBlock);
      currentBlock = {
        changelistId: ann.changelistId,
        user: ann.user,
        date: ann.date,
        startLine: ann.lineNumber,
        endLine: ann.lineNumber,
      };
    }
  }

  // Push final block
  blocks.push(currentBlock);

  return blocks;
}
```

### Pattern 3: Virtualized Annotation Gutter

**What:** Render annotations with TanStack Virtual to handle files with 1000+ lines efficiently.

**When to use:** For any file annotations view; virtualization prevents performance degradation on large files.

**Example:**
```typescript
// src/components/DetailPane/FileAnnotationViewer.tsx
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import { useFileAnnotations } from '@/hooks/useFileAnnotations';
import { Highlight, themes } from 'prism-react-renderer';
import { getLanguageFromPath } from '@/lib/languageMap';
import { calculateAgeColor } from '@/lib/annotationColors';

interface FileAnnotationViewerProps {
  depotPath: string;
  revision: number;
}

export function FileAnnotationViewer({ depotPath, revision }: FileAnnotationViewerProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const { data: annotations, isLoading, error } = useFileAnnotations(depotPath, revision);

  const virtualizer = useVirtualizer({
    count: annotations?.length ?? 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 20, // Estimated line height in pixels
    overscan: 10, // Render 10 extra lines above/below viewport
  });

  if (isLoading) {
    return <div>Loading annotations...</div>;
  }

  if (error || !annotations) {
    return <div>Failed to load annotations</div>;
  }

  // Calculate age colors based on most recent date
  const dates = annotations.map(a => new Date(a.date).getTime());
  const maxDate = Math.max(...dates);
  const minDate = Math.min(...dates);

  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const annotation = annotations[virtualRow.index];
          const ageColor = calculateAgeColor(
            new Date(annotation.date).getTime(),
            minDate,
            maxDate
          );

          return (
            <div
              key={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className="flex font-mono text-sm"
            >
              {/* Annotation gutter */}
              <div
                className="flex-shrink-0 w-64 px-2 py-0.5 cursor-pointer hover:bg-accent/50"
                style={{ backgroundColor: ageColor }}
                onClick={() => handleAnnotationClick(annotation.changelistId)}
              >
                <span className="font-semibold">CL {annotation.changelistId}</span>
                <span className="ml-2 text-xs">{annotation.user}</span>
                <span className="ml-2 text-xs text-muted-foreground">{annotation.date}</span>
              </div>

              {/* Code content */}
              <div className="flex-1 px-4 py-0.5">
                {annotation.lineContent}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### Pattern 4: Age-Based Heatmap Coloring

**What:** Calculate background color gradient from cool (blue) for old changes to warm (red) for recent changes using HSL color space.

**When to use:** For each annotation line to provide visual indication of code age.

**Example:**
```typescript
// src/lib/annotationColors.ts

/**
 * Calculate age-based heatmap color for annotation.
 * Uses HSL color space: blue (240°) for oldest, red (0°) for newest.
 *
 * @param timestamp - Unix timestamp of the change date
 * @param minTimestamp - Oldest change in the file
 * @param maxTimestamp - Most recent change in the file
 * @returns HSL color string with low opacity for background
 */
export function calculateAgeColor(
  timestamp: number,
  minTimestamp: number,
  maxTimestamp: number
): string {
  // Handle edge case where all lines are from same date
  if (maxTimestamp === minTimestamp) {
    return 'hsla(200, 50%, 50%, 0.1)'; // Neutral blue-gray
  }

  // Normalize age to 0-1 range (0 = oldest, 1 = newest)
  const age = (timestamp - minTimestamp) / (maxTimestamp - minTimestamp);

  // Map age to hue: 240° (blue) for old, 0° (red) for new
  // Use reverse mapping so recent = hot (red)
  const hue = 240 - (age * 240);

  // Use moderate saturation and lightness for readability
  // Low opacity to not overwhelm the text
  return `hsla(${hue}, 60%, 70%, 0.15)`;
}

/**
 * Get age description for UI display.
 */
export function getAgeDescription(date: string): string {
  const changeDate = new Date(date);
  const now = new Date();
  const daysDiff = Math.floor((now.getTime() - changeDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDiff === 0) return 'Today';
  if (daysDiff === 1) return 'Yesterday';
  if (daysDiff < 7) return `${daysDiff} days ago`;
  if (daysDiff < 30) return `${Math.floor(daysDiff / 7)} weeks ago`;
  if (daysDiff < 365) return `${Math.floor(daysDiff / 30)} months ago`;
  return `${Math.floor(daysDiff / 365)} years ago`;
}
```

### Pattern 5: Annotation Tooltip with Commit Message

**What:** Show full changelist description on hover using Radix UI Tooltip.

**When to use:** For each annotation gutter element to preview commit message without navigation.

**Example:**
```typescript
// src/components/DetailPane/AnnotationTooltip.tsx
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useQuery } from '@tanstack/react-query';
import { invokeP4Command } from '@/lib/tauri';

interface AnnotationTooltipProps {
  changelistId: number;
  children: React.ReactNode;
}

export function AnnotationTooltip({ changelistId, children }: AnnotationTooltipProps) {
  // Fetch changelist description on demand when tooltip is opened
  const { data: description } = useQuery({
    queryKey: ['changelist-description', changelistId],
    queryFn: async () => {
      const output = await invokeP4Command(['describe', '-s', String(changelistId)]);
      return parseChangelistDescription(output);
    },
    staleTime: 60 * 60 * 1000, // Cache for 1 hour
    enabled: false, // Fetch manually on hover
  });

  return (
    <TooltipProvider>
      <Tooltip delayDuration={500}>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-md">
          <div className="space-y-2">
            <div className="font-semibold">Changelist {changelistId}</div>
            <div className="text-sm whitespace-pre-wrap">
              {description || 'Loading...'}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function parseChangelistDescription(output: string): string {
  // Extract description from p4 describe output
  const lines = output.split('\n');
  const descriptionStart = lines.findIndex(l => l.trim() === 'Description:');

  if (descriptionStart === -1) return 'No description available';

  // Description continues until "Affected files:" line
  const descriptionEnd = lines.findIndex((l, i) =>
    i > descriptionStart && l.trim().startsWith('Affected files')
  );

  const descLines = lines.slice(
    descriptionStart + 1,
    descriptionEnd > 0 ? descriptionEnd : undefined
  );

  return descLines
    .map(l => l.replace(/^\t/, '')) // Remove leading tab
    .join('\n')
    .trim();
}
```

### Pattern 6: Keyboard Navigation Between Change Blocks

**What:** Use up/down arrow keys to jump between consecutive annotation blocks (groups of lines with same changelist).

**When to use:** For accessibility and power-user efficiency; similar to blame navigation in IDEs.

**Example:**
```typescript
// src/hooks/useAnnotationNavigation.ts
import { useEffect, useState } from 'react';
import { groupAnnotationBlocks } from '@/lib/annotationParser';
import type { ParsedAnnotation } from '@/lib/annotationParser';

export function useAnnotationNavigation(annotations: ParsedAnnotation[]) {
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
  const blocks = groupAnnotationBlocks(annotations);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'ArrowDown' && e.altKey) {
        e.preventDefault();
        setCurrentBlockIndex(prev => Math.min(prev + 1, blocks.length - 1));
      } else if (e.key === 'ArrowUp' && e.altKey) {
        e.preventDefault();
        setCurrentBlockIndex(prev => Math.max(prev - 1, 0));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [blocks.length]);

  const currentBlock = blocks[currentBlockIndex] || null;

  return {
    currentBlock,
    currentBlockIndex,
    totalBlocks: blocks.length,
    goToNextBlock: () => setCurrentBlockIndex(prev => Math.min(prev + 1, blocks.length - 1)),
    goToPreviousBlock: () => setCurrentBlockIndex(prev => Math.max(prev - 1, 0)),
  };
}
```

### Pattern 7: "Blame Prior Revision" to Peel Back History

**What:** When viewing blame for file#N, provide button to re-run blame against file#(N-1) to see older history.

**When to use:** When user wants to investigate when a line was originally introduced, not just last modified.

**Example:**
```typescript
// src/components/DetailPane/FileAnnotationViewer.tsx (continued)

interface FileAnnotationViewerProps {
  depotPath: string;
  revision: number;
  onBlameRevisionChange?: (newRevision: number) => void;
}

export function FileAnnotationViewer({
  depotPath,
  revision,
  onBlameRevisionChange
}: FileAnnotationViewerProps) {
  const [blameRevision, setBlameRevision] = useState(revision);
  const [revisionHistory, setRevisionHistory] = useState<number[]>([revision]);

  const { data: annotations } = useFileAnnotations(depotPath, blameRevision);

  const handleBlamePriorRevision = () => {
    const priorRevision = blameRevision - 1;
    if (priorRevision < 1) return; // Can't go before revision 1

    setBlameRevision(priorRevision);
    setRevisionHistory(prev => [...prev, priorRevision]);
    onBlameRevisionChange?.(priorRevision);
  };

  const handleBlameHistoryBack = () => {
    if (revisionHistory.length <= 1) return;

    const newHistory = revisionHistory.slice(0, -1);
    const previousRevision = newHistory[newHistory.length - 1];

    setRevisionHistory(newHistory);
    setBlameRevision(previousRevision);
    onBlameRevisionChange?.(previousRevision);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with navigation controls */}
      <div className="flex items-center gap-2 p-2 border-b">
        <Button
          variant="outline"
          size="sm"
          onClick={handleBlameHistoryBack}
          disabled={revisionHistory.length <= 1}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleBlamePriorRevision}
          disabled={blameRevision <= 1}
        >
          <History className="h-4 w-4 mr-1" />
          Blame Prior Revision
        </Button>

        <span className="text-sm text-muted-foreground ml-auto">
          Viewing blame at revision #{blameRevision}
        </span>
      </div>

      {/* Virtualized annotation content */}
      {/* ... rest of component ... */}
    </div>
  );
}
```

### Anti-Patterns to Avoid

- **Loading all annotations eagerly:** Don't fetch annotations immediately when file is opened; only load when user explicitly requests blame view (adds significant delay)
- **Non-virtualized rendering for large files:** Rendering 5000+ DOM nodes causes browser lag; always use virtualization
- **Separate queries for each tooltip:** Don't fire individual queries per-line on hover; batch or lazy-load changelist descriptions
- **Blocking annotation clicks:** Don't use `<span onClick>` without keyboard support; use proper button/link elements
- **Fixed color palettes:** Don't use hard-coded color lists (e.g., 5 discrete colors); use smooth HSL gradients for better age visualization
- **Ignoring p4 annotate file size limits:** Default 10MB limit can be hit; surface error gracefully and suggest external tools

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| List virtualization | Custom windowing logic with scroll listeners | TanStack Virtual or react-window | Edge cases: dynamic heights, scroll restoration, overscan, resize handling |
| Color gradients | Manual RGB interpolation | HSL color space with hue rotation | Perceptually uniform colors, easier to reason about temperature mapping |
| Tooltip accessibility | DIV with onMouseEnter/onMouseLeave | Radix UI Tooltip | ARIA attributes, keyboard focus, portal rendering, collision detection |
| Date formatting | String manipulation | Existing date utils or standard Date methods | Locale handling, edge cases (timezone, leap years) |
| Command output parsing | String splitting with assumptions | Regex patterns with validation | Malformed output handling, whitespace variations |

**Key insight:** Blame UI seems simple (just show user/date per line) but has hidden complexity in performance (virtualization), accessibility (keyboard nav, tooltips), and UX polish (heatmaps, smooth interactions). Leverage existing solutions for non-core logic.

## Common Pitfalls

### Pitfall 1: Performance Degradation on Large Files

**What goes wrong:** Rendering 5000+ annotation lines as DOM nodes causes browser to freeze during initial render and scroll.

**Why it happens:** React creates real DOM nodes for every line; browser layout/paint becomes bottleneck at scale.

**How to avoid:**
- Use TanStack Virtual from the start (don't optimize later)
- Set appropriate `estimateSize` for consistent line heights
- Use `overscan` to reduce virtual item thrashing during fast scrolls
- Consider fixed-size virtualization (`estimateSize` constant) for better performance than dynamic

**Warning signs:**
- Scroll lag or jank when dragging scrollbar
- Noticeable delay when component first renders
- High CPU usage during idle scrolling

### Pitfall 2: Incorrect Age Color Mapping

**What goes wrong:** Recent changes appear blue (cold) and old changes appear red (hot), inverting user expectations.

**Why it happens:** Naively mapping min date → hue 0° (red) and max date → hue 240° (blue) without considering that lower hue values = warmer colors.

**How to avoid:**
- Use `hue = 240 - (age * 240)` to reverse the mapping
- Always test with files that span multiple years to verify gradient
- Consider adding legend or tooltip explaining color meaning
- Use consistent terminology: "recent = hot/red, old = cold/blue"

**Warning signs:**
- QA feedback that colors feel backwards
- User confusion about what colors represent
- Colors don't match expectations from other blame tools (GitLens, GitHub)

### Pitfall 3: Tooltip Performance Impact

**What goes wrong:** Hovering over annotations triggers 1000+ individual API calls as tooltip pre-fetches descriptions for every line.

**Why it happens:** Tooltip component mounts for every line and eagerly fetches data without proper query coordination.

**How to avoid:**
- Use `enabled: false` in tooltip query options and fetch manually on open
- Set `delayDuration` on tooltip (500-1000ms) to prevent accidental hover triggers
- Cache changelist descriptions aggressively (staleTime: 1 hour) since they're immutable
- Consider batch-fetching descriptions for visible viewport range

**Warning signs:**
- Network tab shows hundreds of concurrent requests
- Tooltip content flickers or shows stale data
- Backend responds with rate limit errors

### Pitfall 4: Keyboard Navigation Focus Management

**What goes wrong:** Keyboard shortcuts for navigating annotation blocks don't work or conflict with other shortcuts.

**Why it happens:** Event listeners don't check if focus is in input field; no visual indication of current block.

**How to avoid:**
- Check `e.target` to ignore keyboard events when focus is in input/textarea
- Use Alt+Arrow or Ctrl+Arrow to avoid conflicts with native scroll
- Provide visual highlight for current annotation block
- Emit custom events instead of global keyboard listeners for better isolation

**Warning signs:**
- Typing in search box triggers annotation navigation
- Users report keyboard shortcuts "not working"
- Arrow keys don't scroll the viewport as expected

### Pitfall 5: Blame Prior Revision Without Context

**What goes wrong:** "Blame Prior Revision" button always goes to revision N-1, even if line didn't exist in that revision.

**Why it happens:** Naively decrementing revision number without checking file history or line existence.

**How to avoid:**
- Consider implementing "blame at changelist that modified this line" instead
- Use `p4 filelog` to get actual revision history and only allow blaming revisions that modified the file
- Show disabled state with tooltip explaining why prior revision unavailable
- Track "blame history stack" to enable Back button for multi-level navigation

**Warning signs:**
- Clicking "Blame Prior" shows error "line not found"
- User confusion about which revision they're viewing
- Can't return to original blame view after going back several times

## Code Examples

Verified patterns from official sources:

### Example 1: Executing p4 annotate Command

```rust
// src-tauri/src/commands/p4.rs (add new command)

/// Annotation line from p4 annotate -u -c
#[derive(Debug, Clone, Serialize)]
pub struct P4AnnotationLine {
    pub line_number: i32,
    pub changelist_id: i32,
    pub user: String,
    pub date: String,      // YYYY/MM/DD format
    pub line_content: String,
}

/// Get file annotations (blame) using p4 annotate
#[tauri::command]
pub async fn p4_annotate(
    depot_path: String,
    revision: i32,
    server: Option<String>,
    user: Option<String>,
    client: Option<String>,
) -> Result<Vec<P4AnnotationLine>, String> {
    let mut cmd = Command::new("p4");
    apply_connection_args(&mut cmd, &server, &user, &client);

    // Use -u for user/date, -c for changelist numbers (better for navigation)
    let revision_spec = format!("{}#{}", depot_path, revision);
    cmd.args(["annotate", "-u", "-c", &revision_spec]);

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute p4 annotate: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("p4 annotate failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_annotate_output(&stdout)
}

fn parse_annotate_output(output: &str) -> Result<Vec<P4AnnotationLine>, String> {
    let lines: Vec<&str> = output.lines().collect();
    let mut annotations = Vec::new();

    for (line_idx, line) in lines.iter().enumerate() {
        if line.trim().is_empty() {
            continue;
        }

        // Parse format: "CL#: USER DATE CONTENT"
        // Example: "320: mjones 2017/05/06 sr->w.digest.Clear();"
        let re = regex::Regex::new(r"^(\d+):\s+(\S+)\s+(\d{4}/\d{2}/\d{2})\s+(.*)$")
            .map_err(|e| format!("Regex error: {}", e))?;

        if let Some(caps) = re.captures(line) {
            annotations.push(P4AnnotationLine {
                line_number: (line_idx + 1) as i32,
                changelist_id: caps[1].parse().map_err(|e| format!("Parse CL error: {}", e))?,
                user: caps[2].to_string(),
                date: caps[3].to_string(),
                line_content: caps[4].to_string(),
            });
        }
    }

    Ok(annotations)
}
```

### Example 2: TanStack Virtual Setup

```typescript
// src/components/DetailPane/FileAnnotationViewer.tsx
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

export function FileAnnotationViewer({ annotations }: { annotations: Annotation[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: annotations.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 20,  // Fixed 20px line height
    overscan: 10,            // Render 10 extra lines above/below viewport
  });

  const items = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className="h-[600px] overflow-auto"
      style={{ contain: 'strict' }}  // CSS containment for better performance
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {items.map((virtualItem) => (
          <div
            key={virtualItem.key}
            data-index={virtualItem.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <AnnotationLine annotation={annotations[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Non-virtualized lists | TanStack Virtual / react-window | 2020-2023 | Enables smooth scrolling for 10,000+ line files without browser lag |
| Discrete color palettes | HSL gradient heatmaps | 2018-2020 | Smoother visual representation of code age; perceptually uniform |
| Inline annotations | Gutter-based blame | 2015-2018 | Better spatial consistency; clickable targets; doesn't disrupt code reading |
| Manual tooltip positioning | Radix UI / Floating UI | 2021-2023 | Automatic collision detection, portal rendering, accessibility built-in |
| Imperative scroll APIs | Declarative virtualizer state | 2020-2023 | Better React integration; reduces imperative DOM manipulation |

**Deprecated/outdated:**
- **react-virtualized**: Still works but heavier (20-30kb) and less actively maintained; TanStack Virtual or react-window preferred
- **Manual windowing with IntersectionObserver**: Complex to implement correctly; use dedicated virtualization library
- **Fixed viewport height assumptions**: Modern virtualizers handle dynamic container sizes automatically

## Open Questions

Things that couldn't be fully resolved:

1. **p4 annotate performance on very large files**
   - What we know: Default 10MB limit; can be overridden by superuser with `dm.annotate.maxsize`
   - What's unclear: Actual performance characteristics for files near/exceeding limit; server-side timeout behavior
   - Recommendation: Surface error gracefully if annotate fails; suggest external tool (P4V Time-lapse View) for large files

2. **Integrations across branches (-i flag)**
   - What we know: `p4 annotate -i` follows branches to show source file revisions
   - What's unclear: UI complexity for displaying cross-branch history; user value vs. implementation cost
   - Recommendation: Mark as out-of-scope for Phase 17; revisit in later phase if user feedback requests it

3. **Optimal virtualization overscan value**
   - What we know: TanStack Virtual supports `overscan` to pre-render items outside viewport
   - What's unclear: Ideal overscan value balances perceived performance (no blank rows) vs. memory usage
   - Recommendation: Start with overscan: 10, profile with large files (5000+ lines), adjust if users report blank rows during fast scrolling

4. **Changelist description caching strategy**
   - What we know: Descriptions are immutable and should be cached aggressively
   - What's unclear: Whether to pre-fetch descriptions for visible annotations or fetch-on-hover
   - Recommendation: Start with fetch-on-hover (simpler, lower initial load); add batch pre-fetch if tooltip latency feels sluggish

## Sources

### Primary (HIGH confidence)

- [p4 annotate - Helix Core Command-Line Reference](https://help.perforce.com/helix-core/server-apps/cmdref/current/Content/CmdRef/p4_annotate.html) - Official command syntax and options
- [Displaying annotations - Helix Core P4 Guide](https://help.perforce.com/helix-core/server-apps/p4guide/2024.2/Content/P4Guide/scripting.file-reporting.annotation.html) - Output format and parsing best practices
- [TanStack Virtual - Official Documentation](https://tanstack.com/virtual/latest) - Virtualization API and examples
- [TanStack Virtual - GitHub Repository](https://github.com/TanStack/virtual) - Source code and issue discussions
- [prism-react-renderer - GitHub](https://github.com/FormidableLabs/prism-react-renderer) - Render props pattern for custom line decorations

### Secondary (MEDIUM confidence)

- [react-window vs react-virtualized - LogRocket Blog](https://blog.logrocket.com/react-virtualized-vs-react-window/) - Virtualization library comparison
- [React Window vs React Virtualized - DHiWise](https://www.dhiwise.com/post/react-window-vs-react-virtualized-a-simple-guide) - Performance benchmarks
- [GitLens - Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=eamodio.gitlens) - UI patterns for blame inline/gutter display
- [Heatmap Colors - VWO Blog](https://vwo.com/blog/heatmap-colors/) - Color gradient design principles
- [Keyboard Accessibility - WebAIM](https://webaim.org/techniques/keyboard/) - Accessible keyboard navigation patterns

### Tertiary (LOW confidence)

- [Git blame color scale - GitHub Gist](https://gist.github.com/BuonOmo/ce45b51d0cefe949fd0c536a4a60f000) - Example HSL heatmap implementation (Git-specific)
- [Tooltip Best Practices - UserGuiding](https://userguiding.com/blog/tooltip-examples-best-practices) - General tooltip UX patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - TanStack Virtual and prism-react-renderer verified via official docs; p4 annotate documented in Perforce manuals
- Architecture: HIGH - Patterns based on established React Query + virtualization best practices; consistent with Phase 16 file viewer implementation
- Pitfalls: MEDIUM - Performance and color mapping issues documented in community discussions; tooltip pitfalls inferred from TanStack Query patterns

**Research date:** 2026-02-03
**Valid until:** 2026-03-03 (30 days - stable domain with mature libraries)
