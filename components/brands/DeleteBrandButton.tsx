"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { removeBrand } from "@/app/brands/actions";

interface DeleteBrandButtonProps {
  id: string;
  name: string;
}

export function DeleteBrandButton({ id, name }: DeleteBrandButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!window.confirm(`Remove "${name}" and all its contacts/notes/activity from the brand CRM?`)) return;
    startTransition(async () => {
      const result = await removeBrand(id);
      if (result.success) router.push("/brands");
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="text-muted-foreground hover:text-destructive"
      disabled={isPending}
      onClick={handleDelete}
    >
      <Trash2 className="size-3.5" />
      Delete
    </Button>
  );
}
