# Phase 16: File Content Viewer - Research

**Researched:** 2026-02-03
**Domain:** File content viewing with syntax highlighting in Tauri + React application
**Confidence:** HIGH

## Summary

Phase 16 implements read-only file content viewing with syntax highlighting for any revision of a Perforce file. The standard approach uses existing `p4_print_to_file` backend (already implemented at line 1185 in `src-tauri/src/commands/p4.rs`), reads the temp file content, and renders with **prism-react-renderer** for lightweight syntax highlighting. Critical requirements: (1) check file size and type before loading, (2) detect programming language from file extension, (3) show warning dialog for large files with option to proceed or cancel.

The key technical challenge is preventing memory exhaustion from large files while maintaining responsive UI. The backend already handles `p4 print` to temp file correctly; frontend needs size validation, language mapping, and progressive loading for large files.

**Primary recommendation:** Use prism-react-renderer for syntax highlighting with file size pre-check (10MB limit) and language auto-detection from file extension. Integrate into existing DetailPane as replacement for "Open This Revision" placeholder button.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| prism-react-renderer | ^2.4.1+ | Syntax highlighting for file content display | Lightweight (~11KB gzipped), vendored Prism (no runtime loading), integrates naturally with React 19 patterns, 1.2M+ weekly downloads, proven performance with large files |
| @tauri-apps/api | ^2.0.0 | File system access for reading temp files | Already in project (line 25 package.json), provides `readTextFile` for reading `p4_print_to_file` output |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-virtuoso | ^4.13.0+ | Virtualized rendering for very large files | Only if file >5000 lines; handles variable line heights better than react-window; already used in codebase for other virtualization |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| prism-react-renderer | react-syntax-highlighter | react-syntax-highlighter is heavier (~150KB), uses runtime AST parsing which is slower on large files; prism-react-renderer uses vendored Prism for better performance |
| prism-react-renderer | Monaco Editor | Monaco is 6MB+ bundle size, extreme overkill for read-only viewer; P4Now uses external editors for editing, not in-app editing |
| prism-react-renderer | highlight.js/react-highlight | Less React-idiomatic API, manual DOM manipulation via dangerouslySetInnerHTML instead of render-props pattern |

**Installation:**
```bash
npm install prism-react-renderer
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── DetailPane/
│   │   ├── FileContentViewer.tsx    # New component for file content display
│   │   ├── RevisionDetailView.tsx   # Update to use FileContentViewer
│   │   └── FileSizeWarningDialog.tsx # New dialog for large file warning
├── hooks/
│   ├── useFileContent.ts            # New hook for fetching file content
│   └── useFileInfo.ts               # New hook for file metadata (size, type)
├── lib/
│   ├── languageMap.ts               # File extension → Prism language mapping
│   └── tauri.ts                     # Update with readTextFile import
```

### Pattern 1: File Content Loading with Size Validation

**What:** Pre-check file size and type before loading content, show warning for large files
**When to use:** Every file content view operation
**Example:**
```typescript
// hooks/useFileInfo.ts
import { useQuery } from '@tanstack/react-query';
import { invokeP4Fstat } from '@/lib/tauri';

export function useFileInfo(depotPath: string, revision: number) {
  return useQuery({
    queryKey: ['file-info', depotPath, revision],
    queryFn: async () => {
      const revSpec = `${depotPath}#${revision}`;
      const fileInfo = await invokeP4Fstat([revSpec]);

      if (fileInfo.length === 0) {
        throw new Error('File not found');
      }

      const info = fileInfo[0];
      return {
        fileSize: parseInt(info.file_size || '0'),
        fileType: info.file_type || 'text',
        depotPath: info.depot_path,
        isBinary: (info.file_type || '').includes('binary')
      };
    }
  });
}
```

**Source:** Adapted from PITFALLS.md Pitfall 4 (p4_print memory handling, lines 301-444)

### Pattern 2: Two-Stage Loading with Warning Dialog

**What:** Check file metadata first, show warning dialog for large files, load content only after user confirmation
**When to use:** Primary pattern for file content viewer
**Example:**
```typescript
// components/DetailPane/FileContentViewer.tsx
import { useState } from 'react';
import { useFileInfo } from '@/hooks/useFileInfo';
import { useFileContent } from '@/hooks/useFileContent';
import { FileSizeWarningDialog } from './FileSizeWarningDialog';

const MAX_AUTO_LOAD_SIZE = 1 * 1024 * 1024; // 1MB auto-load threshold
const MAX_VIEWABLE_SIZE = 10 * 1024 * 1024; // 10MB absolute limit

export function FileContentViewer({ depotPath, revision }) {
  const [userConfirmedLargeFile, setUserConfirmedLargeFile] = useState(false);

  const { data: fileInfo, isLoading: isLoadingInfo } = useFileInfo(depotPath, revision);

  const shouldLoad = fileInfo && (
    fileInfo.fileSize <= MAX_AUTO_LOAD_SIZE ||
    userConfirmedLargeFile
  );

  const { data: content, isLoading: isLoadingContent } = useFileContent(
    depotPath,
    revision,
    { enabled: shouldLoad }
  );

  if (isLoadingInfo) return <Spinner />;

  if (fileInfo.isBinary) {
    return (
      <Alert variant="warning">
        Cannot view binary files ({fileInfo.fileType}).
        <Button onClick={() => openInExternalEditor(depotPath, revision)}>
          Open in External Editor
        </Button>
      </Alert>
    );
  }

  if (fileInfo.fileSize > MAX_VIEWABLE_SIZE) {
    return (
      <Alert variant="error">
        File too large to view ({(fileInfo.fileSize / 1024 / 1024).toFixed(1)}MB).
        Maximum is 10MB.
        <Button onClick={() => openInExternalEditor(depotPath, revision)}>
          Open in External Editor
        </Button>
      </Alert>
    );
  }

  if (fileInfo.fileSize > MAX_AUTO_LOAD_SIZE && !userConfirmedLargeFile) {
    return (
      <FileSizeWarningDialog
        fileSize={fileInfo.fileSize}
        onConfirm={() => setUserConfirmedLargeFile(true)}
        onCancel={() => {/* navigate back */}}
      />
    );
  }

  if (isLoadingContent) return <Spinner>Loading file content...</Spinner>;

  return <SyntaxHighlightedContent content={content} fileName={depotPath} />;
}
```

**Source:** Combines patterns from PITFALLS.md Pitfall 4 (lines 324-444) and web search results on [file size validation](https://learnersbucket.com/examples/react/react-validate-the-file-size-before-upload/)

### Pattern 3: Language Detection from File Extension

**What:** Map file extension to Prism language identifier for syntax highlighting
**When to use:** Every syntax highlighting render
**Example:**
```typescript
// lib/languageMap.ts
export function getLanguageFromPath(filePath: string): string {
  const extension = filePath.split('.').pop()?.toLowerCase();

  const extensionToLanguage: Record<string, string> = {
    // Web
    'js': 'javascript',
    'jsx': 'jsx',
    'ts': 'typescript',
    'tsx': 'tsx',
    'html': 'markup',
    'xml': 'markup',
    'css': 'css',
    'scss': 'scss',
    'json': 'json',

    // Systems
    'c': 'c',
    'h': 'c',
    'cpp': 'cpp',
    'cc': 'cpp',
    'cxx': 'cpp',
    'hpp': 'cpp',
    'cs': 'csharp',
    'rs': 'rust',
    'go': 'go',
    'java': 'java',

    // Scripting
    'py': 'python',
    'rb': 'ruby',
    'sh': 'bash',
    'bat': 'batch',
    'ps1': 'powershell',

    // Config
    'yaml': 'yaml',
    'yml': 'yaml',
    'toml': 'toml',
    'ini': 'ini',
    'md': 'markdown',

    // Default fallback
  };

  return extensionToLanguage[extension || ''] || 'plaintext';
}
```

**Source:** Derived from [GitHub Gist: Programming Languages and File Extensions](https://gist.github.com/ppisarczyk/43962d06686722d26d176fad46879d41) and [prism-react-renderer supported languages](https://github.com/FormidableLabs/prism-react-renderer)

### Pattern 4: Syntax Highlighted Rendering with prism-react-renderer

**What:** Render file content with syntax highlighting using prism-react-renderer
**When to use:** Final rendering step after content loaded
**Example:**
```tsx
// components/DetailPane/SyntaxHighlightedContent.tsx
import { Highlight, themes } from 'prism-react-renderer';
import { getLanguageFromPath } from '@/lib/languageMap';

export function SyntaxHighlightedContent({ content, fileName }: {
  content: string;
  fileName: string;
}) {
  const language = getLanguageFromPath(fileName);

  return (
    <div className="overflow-auto h-full p-4 bg-card">
      <Highlight
        theme={themes.vsDark}
        code={content}
        language={language}
      >
        {({ style, tokens, getLineProps, getTokenProps }) => (
          <pre
            style={style}
            className="text-sm font-mono"
          >
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                <span className="inline-block w-12 text-right text-muted-foreground select-none mr-4">
                  {i + 1}
                </span>
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
}
```

**Source:** Official [prism-react-renderer documentation](https://github.com/FormidableLabs/prism-react-renderer#usage) adapted for P4Now's dark theme

### Pattern 5: Reading Temp File from Tauri Backend

**What:** Use Tauri FS API to read temp file created by `p4_print_to_file`
**When to use:** Content loading hook after `p4_print_to_file` completes
**Example:**
```typescript
// hooks/useFileContent.ts
import { useQuery } from '@tanstack/react-query';
import { invokeP4PrintToFile } from '@/lib/tauri';
import { readTextFile } from '@tauri-apps/plugin-fs';

export function useFileContent(
  depotPath: string,
  revision: number,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['file-content', depotPath, revision],
    queryFn: async () => {
      // Step 1: Print to temp file (backend already implemented)
      const tempFilePath = await invokeP4PrintToFile(depotPath, revision);

      // Step 2: Read temp file content
      const content = await readTextFile(tempFilePath);

      return content;
    },
    staleTime: 60 * 60 * 1000, // 1 hour - file content at specific revision never changes
    enabled: options?.enabled ?? true,
  });
}
```

**Source:** Combines existing `p4_print_to_file` pattern from `src-tauri/src/commands/p4.rs:1185` with [Tauri 2.0 file system API](https://v2.tauri.app/reference/javascript/fs/)

### Anti-Patterns to Avoid

- **Loading entire file into memory in backend then sending via IPC:** Backend already handles this correctly by printing to temp file, but frontend must NOT request file content via IPC serialization for large files. Always use temp file + readTextFile.

- **Using `p4 print` without size check:** Results in OOM crashes on large files or binary files showing garbled UTF-8 decode errors. Always check file size and type with `p4 fstat` before printing.

- **Rendering 5000+ lines without virtualization:** Causes DOM node count explosion and UI freeze. For files >5000 lines, wrap in react-virtuoso (already in project dependencies for other features).

- **Not handling binary files:** Attempting to render binary files as text shows garbled characters or crashes. Check `fileType` field from `p4 fstat` and reject binary types.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Syntax highlighting engine | Custom tokenizer/parser for each language | prism-react-renderer | Supports 50+ languages out of box, vendored (no runtime loading), battle-tested |
| File extension to language mapping | Manual switch/case for each extension | Pre-built language map with fallback | Extension aliases are complex (e.g., .h could be C, C++, or Objective-C); community-maintained lists are more complete |
| Large file virtualization | Custom virtual scroll implementation | react-virtuoso | Handles variable line heights (important for wrapped lines), auto-measures, proven with 10k+ items |
| File size validation | Manual byte counting and threshold checks | Structured validation with dialog pattern | Easy to miss edge cases (e.g., what if fstat returns null fileSize?); dialog pattern provides consistent UX |

**Key insight:** Syntax highlighting is a solved problem with mature libraries. Custom implementations inevitably miss language edge cases, have poor performance, and require ongoing maintenance for new language features.

## Common Pitfalls

### Pitfall 1: Binary File Memory Exhaustion and UTF-8 Decode Errors

**What goes wrong:** User clicks "Open This Revision" on binary file (compiled binary, image, video). Backend runs `p4 print` which succeeds, but frontend attempts `readTextFile` on binary content, causing UTF-8 decode error. Or worse: Decodes partially, shows garbled text, or loads 500MB binary into memory, crashing app.

**Why it happens:** Perforce `p4 print` doesn't distinguish binary vs text files. The existing `p4_print_to_file` implementation (lines 1185-1230 in `p4.rs`) prints to temp file successfully regardless of file type. Frontend then attempts to read as UTF-8 text without validation. Tauri's `readTextFile` expects valid UTF-8, fails on binary data.

**How to avoid:**
1. Check file type BEFORE calling `p4_print_to_file` using `p4 fstat`
2. Reject binary file types: `binary`, `ubinary`, `apple`, `resource`
3. Show error dialog with "Open in External Editor" option for binary files
4. Never attempt to read binary files as text

**Warning signs:**
- Error: "Failed to decode UTF-8" in console
- Memory spikes to 500MB+ when viewing file
- Garbled characters in content display
- File type contains "binary" but content loaded anyway

**Source:** PITFALLS.md Pitfall 4 (lines 301-444), Pitfall 3 (lines 995-1012)

### Pitfall 2: Large File Size Not Checked, Loading 50MB Files Blocks UI

**What goes wrong:** User opens 50MB log file. Frontend calls `p4_print_to_file`, backend prints successfully to temp file. Frontend calls `readTextFile`, which reads entire 50MB into memory. React re-renders with 50MB string, freezing UI for 10+ seconds. Syntax highlighter attempts to tokenize 50MB, further degrading performance.

**Why it happens:** No size validation before loading. The `p4_print_to_file` backend doesn't enforce size limits (correctly, since it's also used for external editors which can handle large files). Frontend must check file size before deciding to load for in-app viewing.

**How to avoid:**
1. Check file size from `p4 fstat` before loading
2. Set threshold: Auto-load <1MB, warn 1-10MB, reject >10MB
3. Show warning dialog for 1-10MB: "This file is XMB. Loading may be slow. Continue?"
4. For files >10MB, show error with "Open in External Editor" button
5. For very large files that user confirms, consider chunked loading or virtualization

**Warning signs:**
- UI freezes for 5+ seconds when opening file
- Memory usage spikes dramatically
- React DevTools shows massive render time
- Console shows no errors but app is unresponsive

**Source:** PITFALLS.md Pitfall 2 (lines 95-198), PITFALLS.md Pitfall 4 (lines 301-444), web search on [file size validation patterns](https://learnersbucket.com/examples/react/react-validate-the-file-size-before-upload/)

### Pitfall 3: File Extension to Language Mapping Missing Edge Cases

**What goes wrong:** User opens file with ambiguous extension (e.g., `.h` could be C, C++, or Objective-C header) or no extension (e.g., `Makefile`, `Dockerfile`). Language detection falls back to plaintext, losing syntax highlighting. Or worse: Maps to wrong language (e.g., `.m` as Markdown instead of Objective-C).

**Why it happens:** File extension to language mapping is non-trivial:
- Some extensions are ambiguous (`.h`, `.m`, `.v`)
- Some files have no extension but well-known names (`Makefile`, `Dockerfile`, `Jenkinsfile`)
- Some languages have multiple extensions (`.cpp`, `.cc`, `.cxx` all map to C++)

Naive implementation uses simple map, misses edge cases.

**How to avoid:**
1. Use comprehensive extension map covering 20+ common languages
2. Add special cases for extensionless files (check filename exactly)
3. Default to `plaintext` language (no highlighting) instead of throwing error
4. Consider content-based heuristics for ambiguous extensions (advanced)

**Warning signs:**
- C++ header files show as plaintext instead of C++
- Dockerfiles show as plaintext
- Makefiles show as plaintext
- User reports: "Syntax highlighting doesn't work for X files"

**Source:** [GitHub Gist: File Extensions List](https://gist.github.com/ppisarczyk/43962d06686722d26d176fad46879d41), [Prism supported languages](https://prismjs.com/#supported-languages)

### Pitfall 4: Not Integrating with Existing RevisionDetailView Pattern

**What goes wrong:** New FileContentViewer component duplicates logic from RevisionDetailView (diff buttons, revision metadata) instead of composing with it. User sees two different UI patterns for "viewing a revision," causing confusion. Code duplication leads to drift (e.g., diff buttons in one view but not the other).

**Why it happens:** FileContentViewer is a new component, easy to build in isolation. Existing RevisionDetailView has placeholder TODO for "Open This Revision" button (line 43). Tempting to replace entire view instead of composing.

**How to avoid:**
1. Keep RevisionDetailView as container with metadata and diff buttons
2. Add FileContentViewer as new section BELOW existing content
3. Replace "Open This Revision" button with "View File Content" toggle
4. When toggled, show FileContentViewer inline
5. Preserve all existing functionality (diff buttons, metadata display)

**Warning signs:**
- New view missing diff buttons that old view had
- Inconsistent styling between revision views
- User feedback: "Where did the diff buttons go?"
- Code reviewer notes duplicated logic

**Source:** Existing codebase pattern in `src/components/DetailPane/RevisionDetailView.tsx`, integration best practices

## Code Examples

Verified patterns from official sources:

### File Size Check Before Loading
```typescript
// Source: Combines PITFALLS.md Pitfall 4 pattern with Tauri FS best practices
const MAX_AUTO_LOAD_SIZE = 1 * 1024 * 1024; // 1MB
const MAX_VIEWABLE_SIZE = 10 * 1024 * 1024; // 10MB

const { data: fileInfo } = useQuery({
  queryKey: ['fstat', depotPath, revision],
  queryFn: async () => {
    const files = await invokeP4Fstat([`${depotPath}#${revision}`]);
    return {
      size: parseInt(files[0]?.file_size || '0'),
      type: files[0]?.file_type || 'text',
      isBinary: (files[0]?.file_type || '').includes('binary')
    };
  }
});

if (fileInfo.isBinary) {
  return <BinaryFileError fileType={fileInfo.type} />;
}

if (fileInfo.size > MAX_VIEWABLE_SIZE) {
  return <FileTooLargeError sizeMB={fileInfo.size / 1024 / 1024} />;
}

if (fileInfo.size > MAX_AUTO_LOAD_SIZE && !userConfirmed) {
  return (
    <ConfirmLoadDialog
      sizeMB={fileInfo.size / 1024 / 1024}
      onConfirm={() => setUserConfirmed(true)}
    />
  );
}
```

### Reading Temp File with Tauri FS
```typescript
// Source: https://v2.tauri.app/reference/javascript/fs/
import { readTextFile } from '@tauri-apps/plugin-fs';

const { data: content } = useQuery({
  queryKey: ['file-content', depotPath, revision],
  queryFn: async () => {
    const tempPath = await invokeP4PrintToFile(depotPath, revision);
    return await readTextFile(tempPath);
  },
  staleTime: 60 * 60 * 1000, // 1 hour - immutable content
});
```

### Syntax Highlighting with prism-react-renderer
```tsx
// Source: https://github.com/FormidableLabs/prism-react-renderer#usage
import { Highlight, themes } from 'prism-react-renderer';

<Highlight
  theme={themes.vsDark}
  code={fileContent}
  language={getLanguageFromPath(fileName)}
>
  {({ tokens, getLineProps, getTokenProps }) => (
    <pre className="text-sm font-mono">
      {tokens.map((line, i) => (
        <div key={i} {...getLineProps({ line })}>
          <span className="line-number">{i + 1}</span>
          {line.map((token, key) => (
            <span key={key} {...getTokenProps({ token })} />
          ))}
        </div>
      ))}
    </pre>
  )}
</Highlight>
```

### Language Detection with Fallback
```typescript
// Source: Derived from GitHub Gist file extensions list
function getLanguageFromPath(filePath: string): string {
  const fileName = filePath.split('/').pop() || '';
  const extension = fileName.split('.').pop()?.toLowerCase();

  // Special case: extensionless files
  const extensionlessMap: Record<string, string> = {
    'Makefile': 'makefile',
    'Dockerfile': 'docker',
    'Jenkinsfile': 'groovy',
  };

  if (!extension || extension === fileName) {
    return extensionlessMap[fileName] || 'plaintext';
  }

  // Standard extension mapping
  const languageMap: Record<string, string> = {
    'js': 'javascript', 'jsx': 'jsx', 'ts': 'typescript', 'tsx': 'tsx',
    'py': 'python', 'rb': 'ruby', 'go': 'go', 'rs': 'rust',
    'c': 'c', 'h': 'c', 'cpp': 'cpp', 'cc': 'cpp', 'cxx': 'cpp',
    'cs': 'csharp', 'java': 'java',
    'html': 'markup', 'xml': 'markup', 'json': 'json',
    'yaml': 'yaml', 'yml': 'yaml', 'md': 'markdown',
    'sh': 'bash', 'bat': 'batch', 'ps1': 'powershell',
  };

  return languageMap[extension] || 'plaintext';
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Monaco Editor for code viewing | Lightweight highlighting libraries (Prism) | 2023+ | 6MB → 11KB bundle size; Monaco overkill for read-only viewing |
| react-syntax-highlighter (runtime parsing) | prism-react-renderer (vendored) | 2022+ | Faster load times, better performance on large files, no runtime dependency loading |
| Manual virtual scrolling | react-virtuoso / @tanstack/react-virtual | 2021+ | Auto-measures line heights, simpler API, better performance |
| File.size validation at upload only | Tauri-side size validation before transfer | 2024+ (Tauri 2.0) | Prevents unnecessary IPC transfers, better UX with early warnings |

**Deprecated/outdated:**
- **Monaco Editor for simple code viewing**: Too heavy for read-only display; use Monaco only for full IDE features (autocomplete, refactoring)
- **Dangerously setting innerHTML for highlighting**: XSS risk, bypasses React diffing; use component-based renderers like prism-react-renderer
- **Synchronous file reading in Tauri commands**: Blocks async runtime; use `tokio::fs::read_to_string` for async I/O

## Open Questions

Things that couldn't be fully resolved:

1. **Should we support opening multiple file revisions simultaneously in tabs?**
   - What we know: DetailPane currently shows single selection at a time
   - What's unclear: Whether tab interface is in scope for v4.0 or deferred to future
   - Recommendation: Single view for v4.0 (matches existing pattern), consider tabs in v5.0 if user feedback requests it

2. **How to handle extremely large files that user confirms (5-10MB range)?**
   - What we know: 10MB is absolute limit per PITFALLS.md
   - What's unclear: Best UX for 5-10MB confirmed loads (progressive loading? virtual scrolling?)
   - Recommendation: For v4.0, show loading spinner and render all at once with react-virtuoso if >5000 lines. Consider chunked loading in v5.0 if performance issues reported.

3. **Should binary file "Open in External Editor" use configured diff tool or separate viewer tool?**
   - What we know: Settings already has `diffToolPath` configured
   - What's unclear: Whether diff tool is appropriate for viewing single files vs diffing
   - Recommendation: Use system default application for file type (Tauri `open` API) instead of diff tool

## Sources

### Primary (HIGH confidence)
- [prism-react-renderer GitHub](https://github.com/FormidableLabs/prism-react-renderer) - Official repository, usage examples, v2.4.1 current
- [prism-react-renderer npm](https://www.npmjs.com/package/prism-react-renderer) - 1.2M+ weekly downloads, official package
- [Tauri 2.0 File System API](https://v2.tauri.app/reference/javascript/fs/) - Official Tauri 2.0 documentation for readTextFile
- [Tauri 2.0 File System Plugin](https://v2.tauri.app/plugin/file-system/) - File management patterns and best practices
- [Existing p4_print_to_file implementation](C:\Projects\Fun\p4now\src-tauri\src\commands\p4.rs:1185) - Already in codebase
- [PITFALLS.md research document](C:\Projects\Fun\p4now\.planning\research\PITFALLS.md) - Comprehensive pitfall analysis for v4.0 features
- [STACK.md research document](C:\Projects\Fun\p4now\.planning\research\STACK.md) - Stack decisions for v4.0 features

### Secondary (MEDIUM confidence)
- [npm-compare: syntax highlighting libraries](https://npm-compare.com/prism-react-renderer,react-highlight,react-syntax-highlighter) - Bundle size comparison, download stats
- [LogRocket: Syntax highlighting in React guide](https://blog.logrocket.com/guide-syntax-highlighting-react/) - Comparison of highlighting approaches
- [Programming Languages File Extensions Gist](https://gist.github.com/ppisarczyk/43962d06686722d26d176fad46879d41) - Community-maintained extension mappings
- [React file size validation tutorial](https://learnersbucket.com/examples/react/react-validate-the-file-size-before-upload/) - File size validation patterns
- [File Management in Tauri 2.0 guide](https://quentinwach.com/blog/2024/11/26/files-in-tauri-v2.html) - Best practices for Tauri FS operations

### Tertiary (LOW confidence - verify during implementation)
- Web search claims about Monaco Editor 6MB size (not verified with official source)
- Community reports of react-syntax-highlighter slowness with large files (no benchmarks)
- Assumption that 10MB is reasonable limit for text file viewing (validate with user testing)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - prism-react-renderer verified from official npm/GitHub, widely used, fits requirements perfectly
- Architecture: HIGH - Patterns derived from existing codebase (RevisionDetailView) and official Tauri/React docs
- Pitfalls: HIGH - All pitfalls documented in PITFALLS.md with official Perforce documentation sources

**Research date:** 2026-02-03
**Valid until:** 2026-05-03 (90 days - stable ecosystem)
