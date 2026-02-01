import { useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSearchFilterStore } from '@/stores/searchFilterStore';

/**
 * Global search filter bar that drives in-place column filtering.
 *
 * Always-visible search input in toolbar header.
 * On keystroke, updates global filter store (instant, no debounce).
 * Shows match count badge when filter is active.
 * Escape clears text first, then blurs.
 */
export function SearchBar() {
  const inputRef = useRef<HTMLInputElement>(null);
  const filterTerm = useSearchFilterStore((s) => s.filterTerm);
  const isActive = useSearchFilterStore((s) => s.isActive);
  const fileTreeMatchCount = useSearchFilterStore((s) => s.fileTreeMatchCount);
  const changelistMatchCount = useSearchFilterStore((s) => s.changelistMatchCount);
  const setFilterTerm = useSearchFilterStore((s) => s.setFilterTerm);
  const clearFilter = useSearchFilterStore((s) => s.clearFilter);

  const totalMatches = fileTreeMatchCount + changelistMatchCount;

  // Listen for Ctrl+F focus event from MainLayout
  useEffect(() => {
    const handleFocusSearch = () => {
      inputRef.current?.focus();
      inputRef.current?.select();
    };

    window.addEventListener('p4now:focus-search', handleFocusSearch);
    return () => window.removeEventListener('p4now:focus-search', handleFocusSearch);
  }, []);

  // Handle Escape key - progressive behavior
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (filterTerm) {
        // If input has text, clear it first
        clearFilter();
      } else {
        // If input is empty, blur
        inputRef.current?.blur();
      }
    }
  };

  const handleClear = () => {
    clearFilter();
    inputRef.current?.focus();
  };

  return (
    <div className="flex items-center gap-2 bg-muted rounded-md px-2 py-1 border border-border">
      <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <Input
        ref={inputRef}
        type="text"
        value={filterTerm}
        onChange={(e) => setFilterTerm(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Filter files & changelists..."
        className="w-48 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-foreground placeholder:text-muted-foreground px-0"
        data-testid="search-filter-input"
      />
      {filterTerm && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClear}
          className="h-5 w-5 flex-shrink-0"
          title="Clear search"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
      {isActive && (
        <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
          {totalMatches} {totalMatches === 1 ? 'match' : 'matches'}
        </span>
      )}
    </div>
  );
}
