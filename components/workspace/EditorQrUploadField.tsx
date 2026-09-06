"use client";

import { upload } from "@vercel/blob/client";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EditorQrUploadFieldProps {
  value: string | null;
  onChange: (url: string | null) => void;
  onError: (message: string) => void;
}

export function EditorQrUploadField({ value, onChange, onError }: EditorQrUploadFieldProps) {
  const inputId = useId();
  const [isUploading, setIsUploading] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setIsUploading(true);
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/workspace/upload",
      });
      onChange(blob.url);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "";
      onError(reason ? `Upload failed(${reason}` : "Upload failed) try a different image");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>UPI QR code</Label>
      <Input
        id={inputId}
        type="file"
        accept="image/*"
        disabled={isUploading}
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
      {isUploading && <p className="text-xs text-muted-foreground">Uploading…</p>}
      {value && (
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="size-16 rounded-md border border-border bg-white object-contain p-1" />
          <Button type="button" variant="ghost" size="xs" onClick={() => onChange(null)}>
            Remove
          </Button>
        </div>
      )}
    </div>
  );
}
