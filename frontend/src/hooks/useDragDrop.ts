import { useState, useCallback } from "react";

interface DragItem {
  id: string;
  type: string;
  data?: Record<string, unknown>;
}

/**
 * Custom hook for tracking drag-and-drop state on the canvas.
 * Manages the currently dragged item and provides handlers
 * for drag start/end lifecycle events.
 */
export function useDragDrop() {
  const [isDragging, setIsDragging] = useState(false);
  const [draggedItem, setDraggedItem] = useState<DragItem | null>(null);

  const handleDragStart = useCallback(
    (item: DragItem) => {
      setIsDragging(true);
      setDraggedItem(item);
    },
    [],
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    setDraggedItem(null);
  }, []);

  return {
    isDragging,
    draggedItem,
    handleDragStart,
    handleDragEnd,
  };
}
