import { useState, useEffect, useCallback } from 'react';
import { AnnotationBlock } from '@/lib/annotationParser';

/**
 * Hook for keyboard navigation between annotation blocks.
 *
 * Provides Alt+ArrowUp/Down navigation between consecutive change blocks.
 * Returns current block index and programmatic navigation functions.
 *
 * @param blocks - Array of annotation blocks to navigate
 * @param scrollToLine - Callback to scroll to a specific line number
 * @returns Navigation state and control functions
 */
export function useAnnotationNavigation(
  blocks: AnnotationBlock[],
  scrollToLine: (lineNumber: number) => void
) {
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);

  // Programmatic navigation functions
  const goToNextBlock = useCallback(() => {
    if (blocks.length === 0) return;

    const newIndex = Math.min(currentBlockIndex + 1, blocks.length - 1);
    setCurrentBlockIndex(newIndex);
    scrollToLine(blocks[newIndex].startLine);
  }, [blocks, currentBlockIndex, scrollToLine]);

  const goToPreviousBlock = useCallback(() => {
    if (blocks.length === 0) return;

    const newIndex = Math.max(currentBlockIndex - 1, 0);
    setCurrentBlockIndex(newIndex);
    scrollToLine(blocks[newIndex].startLine);
  }, [blocks, currentBlockIndex, scrollToLine]);

  // Keyboard event handler
  useEffect(() => {
    if (blocks.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle Alt+Arrow keys
      if (!e.altKey) return;

      // Ignore if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        goToNextBlock();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        goToPreviousBlock();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [blocks, goToNextBlock, goToPreviousBlock]);

  // Reset index when blocks change (e.g., different file)
  useEffect(() => {
    setCurrentBlockIndex(0);
  }, [blocks]);

  return {
    currentBlockIndex,
    currentBlock: blocks.length > 0 ? blocks[currentBlockIndex] : null,
    totalBlocks: blocks.length,
    goToNextBlock,
    goToPreviousBlock,
  };
}
