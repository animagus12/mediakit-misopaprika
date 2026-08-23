"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { InvoiceLineItem } from "@/lib/invoice";
import styles from "./invoice.module.css";

interface InvoiceLineItemEditorProps {
  item: InvoiceLineItem;
  index: number;
  canRemove: boolean;
  onChange: (id: string, field: "desc" | "sub" | "qty" | "price", value: string) => void;
  onRemove: (id: string) => void;
}

export function InvoiceLineItemEditor({
  item,
  index,
  canRemove,
  onChange,
  onRemove,
}: InvoiceLineItemEditorProps) {
  return (
    <div className={styles.item}>
      <div className={styles.itemTop}>
        <span className={styles.itemIdx}>LINE {String(index + 1).padStart(2, "0")}</span>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => onRemove(item.id)}
            aria-label={`Remove line ${index + 1}`}
          >
            <X />
          </Button>
        )}
      </div>

      <Label className={styles.fieldLabel} htmlFor={`${item.id}-desc`}>
        Description
      </Label>
      <Input
        id={`${item.id}-desc`}
        value={item.desc}
        onChange={(e) => onChange(item.id, "desc", e.target.value)}
      />

      <Label className={styles.fieldLabel} htmlFor={`${item.id}-sub`}>
        Sub-line (optional bullet)
      </Label>
      <Input
        id={`${item.id}-sub`}
        value={item.sub}
        onChange={(e) => onChange(item.id, "sub", e.target.value)}
      />

      <div className={`${styles.row} ${styles.rowTight}`}>
        <div className={styles.wSm}>
          <Label className={styles.fieldLabel} htmlFor={`${item.id}-qty`}>
            Qty
          </Label>
          <Input
            id={`${item.id}-qty`}
            type="number"
            min={1}
            step={1}
            value={item.qty}
            onChange={(e) => onChange(item.id, "qty", e.target.value)}
          />
        </div>
        <div>
          <Label className={styles.fieldLabel} htmlFor={`${item.id}-price`}>
            Unit price (₹)
          </Label>
          <Input
            id={`${item.id}-price`}
            type="number"
            min={0}
            step={1}
            value={item.price}
            onChange={(e) => onChange(item.id, "price", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
