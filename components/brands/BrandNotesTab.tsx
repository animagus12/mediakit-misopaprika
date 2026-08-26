"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { createBrandNote, removeBrandNote } from "@/app/brands/actions";
import type { BrandNote } from "@/repositories/brandNotes";

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

interface BrandNotesTabProps {
  brandId: string;
  notes: BrandNote[];
}

export function BrandNotesTab({ brandId, notes }: BrandNotesTabProps) {
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const sorted = [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await createBrandNote({ brandId, body: body.trim() });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setBody("");
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await removeBrandNote(id, brandId);
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-2">
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Add a note…"
          rows={2}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button type="submit" size="sm" disabled={isPending || !body.trim()}>
          Add note
        </Button>
      </form>

      {sorted.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-xs text-muted-foreground">No notes yet.</CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sorted.map((note) => (
            <Card key={note.id} size="sm">
              <CardContent className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <p className="whitespace-pre-wrap">{note.body}</p>
                  <p className="text-[0.625rem] text-muted-foreground">{formatTimestamp(note.createdAt)}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  disabled={isPending}
                  onClick={() => handleDelete(note.id)}
                  aria-label="Remove note"
                >
                  <Trash2 />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
