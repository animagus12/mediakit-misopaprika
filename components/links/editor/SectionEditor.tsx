"use client";

import {
  Eye,
  EyeOff,
  GalleryHorizontal,
  GripVertical,
  Image as ImageIcon,
  LayoutGrid,
  Plus,
  Rows3,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { linkPerformance } from "@/lib/linkStats";
import { SECTION_LAYOUT_LABELS } from "@/lib/links";
import type { LinksAnalytics } from "@/repositories/linkStats";
import { SECTION_LAYOUTS, type LinkSection, type SectionLayout } from "@/repositories/links";
import { ItemEditor } from "./ItemEditor";
import { SortableList, useSortableRow } from "./SortableList";
import type { LinksEditorActions } from "./types";

const LAYOUT_ICONS: Record<SectionLayout, LucideIcon> = {
  list: Rows3,
  grid: LayoutGrid,
  carousel: GalleryHorizontal,
  showcase: ImageIcon,
};

interface SectionEditorProps {
  section: LinkSection;
  index: number;
  sectionCount: number;
  actions: LinksEditorActions;
  /** Passed through whole; each row takes its own figures from it. */
  analytics: LinksAnalytics;
}

export function SectionEditor({
  section,
  index,
  sectionCount,
  actions,
  analytics,
}: SectionEditorProps) {
  const { ref, style, handleProps } = useSortableRow(section.id);

  return (
    <Card ref={ref} style={style} className={section.enabled ? undefined : "opacity-60"}>
      <CardHeader className="flex flex-row flex-wrap items-center gap-2 space-y-0">
        <span
          className="text-muted-foreground cursor-grab touch-none active:cursor-grabbing"
          title={`Drag to reorder: section ${index + 1} of ${sectionCount}`}
          {...handleProps}
        >
          <GripVertical size={18} />
        </span>

        {/* Chromeless until hovered or focused: this is the section's
            heading first and a text field second, and a page of boxed
            inputs gave the eye nothing to structure it by. */}
        <Input
          aria-label="Section title"
          className="hover:border-input focus-visible:border-ring font-heading h-8 max-w-64 flex-1 border-transparent bg-transparent px-2 text-sm font-semibold dark:bg-transparent"
          value={section.title}
          placeholder="Section title"
          onChange={(event) => actions.updateSection(section.id, { title: event.target.value })}
        />

        <Badge variant="secondary">
          {section.items.length} link{section.items.length === 1 ? "" : "s"}
        </Badge>

        {!section.enabled ? <Badge variant="outline">Hidden</Badge> : null}

        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={section.enabled ? "Hide section" : "Show section"}
            title={section.enabled ? "Hide this section" : "Show this section"}
            onClick={() => actions.updateSection(section.id, { enabled: !section.enabled })}
          >
            {section.enabled ? <Eye /> : <EyeOff />}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="ghost" size="icon" aria-label="Delete section">
                <Trash2 />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete “{section.title}”?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the section and its {section.items.length} link
                  {section.items.length === 1 ? "" : "s"}. To take it off the page without losing
                  anything, hide it instead.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => actions.removeSection(section.id)}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-2">
        {/* Above the links rather than beside the title: it changes how every
            card below it is drawn, so it reads as the heading for them. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <ToggleGroup
            type="single"
            variant="outline"
            size="lg"
            spacing={0}
            value={section.layout}
            onValueChange={(value) => {
              // Radix reports "" when the pressed item is pressed again. A
              // section always has a layout, so that is a no-op here rather
              // than a fourth state to model.
              if (value) actions.updateSection(section.id, { layout: value as SectionLayout });
            }}
            aria-label="Section layout"
          >
            {SECTION_LAYOUTS.map((layout) => {
              const LayoutIcon = LAYOUT_ICONS[layout];
              return (
                <ToggleGroupItem key={layout} value={layout} title={layout}>
                  <LayoutIcon />
                  {SECTION_LAYOUT_LABELS[layout]}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
        </div>

        {!section.enabled ? (
          <p className="text-muted-foreground text-xs">
            Hidden: this section and everything in it stays off the public page.
          </p>
        ) : null}

        <SortableList
          id={`section-${section.id}`}
          ids={section.items.map((item) => item.id)}
          onReorder={(from, to) => actions.reorderItems(section.id, from, to)}
        >
          {section.items.map((item) => (
            <ItemEditor
              key={item.id}
              item={item}
              sectionId={section.id}
              actions={actions}
              linkStats={linkPerformance(analytics, item.id)}
            />
          ))}
        </SortableList>

        {section.items.length === 0 ? (
          <p className="text-muted-foreground rounded-md border border-dashed p-4 text-center text-xs">
            Empty: a section with no visible links is skipped on the public page.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => actions.addItem(section.id, "link")}
          >
            <Plus /> Add link
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => actions.addItem(section.id, "social")}
          >
            <Plus /> Add social
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => actions.addItem(section.id, "code")}
          >
            <Plus /> Add creator code
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
