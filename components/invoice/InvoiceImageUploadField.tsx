"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import styles from "./invoice.module.css";

interface InvoiceImageUploadFieldProps {
  label: string;
  value: string | null;
  onChange: (dataUrl: string | null) => void;
}

export function InvoiceImageUploadField({
  label,
  value,
  onChange,
}: InvoiceImageUploadFieldProps) {
  const inputId = useId();

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <Label className={styles.fieldLabel} htmlFor={inputId}>
        {label}
      </Label>
      <Input
        id={inputId}
        type="file"
        accept="image/*"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {value && (
        <div className={styles.uploadPreview}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className={styles.uploadThumb} />
          <Button type="button" variant="ghost" size="xs" onClick={() => onChange(null)}>
            Remove
          </Button>
        </div>
      )}
    </div>
  );
}
