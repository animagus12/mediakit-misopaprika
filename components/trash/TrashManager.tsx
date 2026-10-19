"use client";

import { useState, useTransition } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteTrashItem, emptyTrash, restoreTrashItem } from "@/app/trash/actions";
import type { TrashEntry } from "@/repositories/trash";
import { trashTypeLabel } from "@/repositories/trash";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { formatTimestampIST } from "@/lib/time";

interface TrashManagerProps {
  entries: TrashEntry[];
}

function formatDeletedAt(iso: string): string {
  return `${formatTimestampIST(iso)} IST`;
}

export function TrashManager({ entries }: TrashManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [visibleEntries, setVisibleEntries] = useState(entries);

  function runAction(
    action: () => Promise<{ success: true } | { success: false; error: string }>,
    done: () => void
  ) {
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        done();
        toast.success("Trash updated");
      } catch (error) {
        toast.error("Couldn't update Trash", {
          description: error instanceof Error ? error.message : "Please try again.",
        });
      }
    });
  }

  function restore(entry: TrashEntry) {
    runAction(() => restoreTrashItem(entry.id), () => {
      setVisibleEntries((current) => current.filter((item) => item.id !== entry.id));
    });
  }

  function permanentlyDelete(entry: TrashEntry) {
    runAction(() => deleteTrashItem(entry.id), () => {
      setVisibleEntries((current) => current.filter((item) => item.id !== entry.id));
    });
  }

  function handleEmptyTrash() {
    runAction(emptyTrash, () => setVisibleEntries([]));
  }

  if (visibleEntries.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Trash is empty.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={isPending}>
              Empty Trash
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Permanently delete everything in Trash?</AlertDialogTitle>
              <AlertDialogDescription>
                These records can no longer be restored.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleEmptyTrash}>
                Empty Trash
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {visibleEntries.map((entry) => (
        <Card key={entry.id}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{entry.label}</p>
              <p className="text-xs text-muted-foreground">
                {trashTypeLabel(entry.payload.type)} · Deleted {formatDeletedAt(entry.deletedAt)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={isPending} onClick={() => restore(entry)}>
                <RotateCcw />
                Restore
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    disabled={isPending}
                    aria-label={`Permanently delete ${entry.label}`}
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Permanently delete &ldquo;{entry.label}&rdquo;?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This can&apos;t be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={() => permanentlyDelete(entry)}
                    >
                      Delete forever
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
