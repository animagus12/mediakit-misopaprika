"use client";

import { upload } from "@vercel/blob/client";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import styles from "./invoice.module.css";

interface InvoiceImageUploadFieldProps {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  onError: (message: string) => void;
}

export function InvoiceImageUploadField({
  label,
  value,
  onChange,
  onError,
}: InvoiceImageUploadFieldProps) {
  const inputId = useId();
  const [isUploading, setIsUploading] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setIsUploading(true);
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/invoice/upload",
      });
      onChange(blob.url);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "";
      onError(reason ? `Upload failed — ${reason}` : "Upload failed — try a different image");
    } finally {
      setIsUploading(false);
    }
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
        disabled={isUploading}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {isUploading && <p className={styles.fieldLabel}>Uploading…</p>}
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
