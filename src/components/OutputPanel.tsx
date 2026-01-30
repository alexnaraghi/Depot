import { useRef, useEffect, useState } from 'react';
import { useDeferredValue } from 'react';
import { useOperationStore } from '@/store/operation';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, Terminal, Trash2 } from 'lucide-react';

/**
 * Collapsible output panel showing raw p4 command output.
 * Per CONTEXT.md:
 * - Like VS Code's terminal panel — collapsible, shows raw output for debugging
 * - Power users can see exactly what p4 commands returned
 *
 * Uses useDeferredValue per RESEARCH.md Pattern 4 to maintain
 * UI responsiveness during high-frequency output.
 */
export function OutputPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const { outputLines, clearOutput } = useOperationStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Defer rendering of lines to prevent blocking during fast output
  const deferredLines = useDeferredValue(outputLines);

  // Auto-scroll to bottom when new lines arrive
  useEffect(() => {
    if (isOpen && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [deferredLines.length, isOpen]);

  const lineCount = outputLines.length;
  const isPending = outputLines.length !== deferredLines.length;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border-t border-border">
      <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-2 bg-accent hover:bg-accent/80">
        <div className="flex items-center gap-2 text-sm text-foreground">
          <Terminal className="h-4 w-4" />
          <span>Output</span>
          {lineCount > 0 && (
            <span className="text-xs text-muted-foreground">({lineCount} lines)</span>
          )}
          {isPending && (
            <span className="text-xs text-yellow-500">(updating...)</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lineCount > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearOutput();
              }}
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
              title="Clear output"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div
          className={`max-h-64 overflow-y-auto bg-background font-mono text-xs ${
            isPending ? 'opacity-80' : ''
          }`}
        >
          {deferredLines.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground">
              No output yet. Run a p4 command to see output here.
            </div>
          ) : (
            <div className="p-2">
              {deferredLines.map((line, index) => (
                <div
                  key={`${line.timestamp}-${index}`}
                  className={`py-0.5 px-2 ${
                    line.isStderr ? 'text-red-400' : 'text-foreground'
                  }`}
                >
                  {line.line}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
