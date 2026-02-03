import { P4AnnotationLine } from './tauri';

/**
 * Parsed annotation with all line metadata.
 */
export interface ParsedAnnotation {
  changelistId: number;
  user: string;
  date: string;
  lineContent: string;
  lineNumber: number;
}

/**
 * Block of consecutive lines with the same changelist.
 * Used for keyboard navigation and visual grouping.
 */
export interface AnnotationBlock {
  changelistId: number;
  user: string;
  date: string;
  startLine: number;
  endLine: number;
}

/**
 * Groups consecutive lines with the same changelist ID into blocks.
 * Each block tracks startLine and endLine for keyboard navigation.
 *
 * @param annotations - Array of annotation lines to group
 * @returns Array of annotation blocks
 */
export function groupAnnotationBlocks(annotations: P4AnnotationLine[]): AnnotationBlock[] {
  if (annotations.length === 0) {
    return [];
  }

  const blocks: AnnotationBlock[] = [];
  let currentBlock: AnnotationBlock | null = null;

  for (const annotation of annotations) {
    if (!currentBlock || currentBlock.changelistId !== annotation.changelistId) {
      // Start new block
      if (currentBlock) {
        blocks.push(currentBlock);
      }
      currentBlock = {
        changelistId: annotation.changelistId,
        user: annotation.user,
        date: annotation.date,
        startLine: annotation.lineNumber,
        endLine: annotation.lineNumber,
      };
    } else {
      // Extend current block
      currentBlock.endLine = annotation.lineNumber;
    }
  }

  // Push final block
  if (currentBlock) {
    blocks.push(currentBlock);
  }

  return blocks;
}
