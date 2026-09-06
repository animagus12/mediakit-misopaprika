import { Card, CardContent } from "@/components/ui/card";
import type { EditorTransaction } from "@/repositories/editorTransactions";
import type { Editor } from "@/repositories/editors";
import { EditEditorSheet } from "./EditEditorSheet";
import { NewEditorButton } from "./NewEditorButton";

interface EditorsSectionProps {
  editors: Editor[];
  transactions: EditorTransaction[];
}

export function EditorsSection({ editors, transactions }: EditorsSectionProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-heading text-sm font-semibold">Editors</h2>
        <NewEditorButton />
      </div>

      {editors.length === 0 ? (
        <Card>
          <CardContent className="py-4 text-xs text-muted-foreground">
            No editors yet. Add one to start tagging transactions.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-wrap gap-2">
          {editors.map((editor, index) => (
            <EditEditorSheet key={editor.id} editor={editor} transactions={transactions} colorIndex={index} />
          ))}
        </div>
      )}
    </section>
  );
}
