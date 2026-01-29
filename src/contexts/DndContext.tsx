import { createContext, useContext } from 'react';
import { useDragDropManager } from 'react-dnd';

type DragDropManager = ReturnType<typeof useDragDropManager>;

const DndManagerContext = createContext<DragDropManager | null>(null);

export function useDndManager() {
  const manager = useContext(DndManagerContext);
  if (!manager) {
    throw new Error('useDndManager must be used within DndProvider');
  }
  return manager;
}

/**
 * Provides the shared react-dnd manager to child components.
 * Must be rendered inside a DndProvider.
 */
export function DndContext({ children }: { children: React.ReactNode }) {
  const manager = useDragDropManager();
  return (
    <DndManagerContext.Provider value={manager}>
      {children}
    </DndManagerContext.Provider>
  );
}
