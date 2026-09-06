"use client";

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SortableListProps {
  /** Stable per list: dnd-kit warns when two contexts share an id. */
  id: string;
  ids: string[];
  onReorder: (fromIndex: number, toIndex: number) => void;
  children: React.ReactNode;
}

// Both the section list and each section's item list reorder the same way, so
// the DndContext/SortableContext boilerplate lives here once. Same sensor
// setup as MediaKitLogoGrid, with a vertical strategy instead of a grid one.
export function SortableList({ id, ids, onReorder, children }: SortableListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = ids.indexOf(String(active.id));
    const toIndex = ids.indexOf(String(over.id));
    if (fromIndex === -1 || toIndex === -1) return;
    onReorder(fromIndex, toIndex);
  };

  return (
    <DndContext
      id={id}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

/** Wires one row into the list above: spread `handleProps` onto the grip. */
export function useSortableRow(id: string) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  return {
    ref: setNodeRef,
    style: {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.6 : 1,
      // Keeps the dragged row above its siblings' backgrounds while moving.
      zIndex: isDragging ? 1 : undefined,
      position: isDragging ? ("relative" as const) : undefined,
    },
    handleProps: { ...attributes, ...listeners },
  };
}
