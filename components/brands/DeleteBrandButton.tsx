"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Trash2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { removeBrand } from "@/app/brands/actions";
import { restoreTrashItem } from "@/app/trash/actions";
import { showUndoToast } from "@/components/common/undo-toast";

interface DeleteBrandButtonProps {
  id: string;
  name: string;
}

export function DeleteBrandButton({ id, name }: DeleteBrandButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await removeBrand(id);
      showUndoToast(name, result, restoreTrashItem);
      if (result.success) router.push("/brands");
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive"
          disabled={isPending}
        >
          <Trash2 className="size-3.5" />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove &ldquo;{name}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            This moves the brand, its contacts and its notes to Trash, where they can be restored. Its
            campaigns and invoices stay, keeping the brand&apos;s name.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={handleDelete}>
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
