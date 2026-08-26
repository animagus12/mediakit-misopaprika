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
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { computeMediaKitLayout, type MediaKitLogoRowsMode } from "@/lib/mediakit";
import type { MediaKitLogo } from "@/repositories/mediakit";
import type { MediaKitFormActions, MediaKitFormState } from "./types";
import styles from "./mediakit.module.css";

interface MediaKitLogoGridProps {
  state: MediaKitFormState;
  actions: MediaKitFormActions;
}

const ROW_MODE_OPTIONS: { value: MediaKitLogoRowsMode; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "1", label: "One row" },
  { value: "2", label: "Two rows" },
];

interface SortableLogoItemProps {
  id: string;
  index: number;
  logo: MediaKitLogo;
  actions: MediaKitFormActions;
}

function SortableLogoItem({ id, index, logo, actions }: SortableLogoItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={styles.logoItem}>
      <div className={styles.logoImageWrap}>
        <button
          type="button"
          title={`Replace logo ${index + 1}`}
          onClick={() => actions.openPicker({ kind: "logo", index })}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo.src} alt="" />
        </button>
        <span
          className={styles.logoDragHandle}
          title="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={12} />
        </span>
      </div>
      <Input
        type="url"
        placeholder="Brand link"
        value={logo.url}
        onChange={(e) => actions.setLogoUrl(index, e.target.value)}
        className={styles.logoLinkInput}
      />
    </div>
  );
}

export function MediaKitLogoGrid({ state, actions }: MediaKitLogoGridProps) {
  const layout = computeMediaKitLayout(state.logos.length, state.logoRowsMode);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const itemIds = state.logos.map((_, index) => `logo-${index}`);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = itemIds.indexOf(String(active.id));
    const toIndex = itemIds.indexOf(String(over.id));
    if (fromIndex === -1 || toIndex === -1) return;
    actions.reorderLogos(fromIndex, toIndex);
  };

  return (
    <>
      <Label className={styles.fieldLabel}>
        Logos — tap image to replace, drag the handle to reorder
      </Label>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={itemIds} strategy={rectSortingStrategy}>
          <div className={styles.logoGrid}>
            {state.logos.map((logo, index) => (
              <SortableLogoItem
                key={itemIds[index]}
                id={itemIds[index]}
                index={index}
                logo={logo}
                actions={actions}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className={styles.row} style={{ marginTop: "10px" }}>
        <Button type="button" variant="outline" className="w-full" onClick={actions.addLogo}>
          + Add brand
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={actions.removeLastLogo}
        >
          − Remove last
        </Button>
      </div>

      <Label className={styles.fieldLabel} htmlFor="logoRowsMode">
        Logo layout
      </Label>
      <Select
        value={state.logoRowsMode}
        onValueChange={(value) => actions.setField("logoRowsMode", value as MediaKitLogoRowsMode)}
      >
        <SelectTrigger id="logoRowsMode" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROW_MODE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className={styles.hint} style={{ marginTop: "8px", marginBottom: 0 }}>
        {layout.note}
      </p>
    </>
  );
}
