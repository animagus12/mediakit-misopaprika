"use client";

import { upload } from "@vercel/blob/client";
import { useState } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ReceiptUploadFieldProps {
  id: string;
  value: string | null;
  onChange: (url: string | null) => void;
  onError: (message: string) => void;
}

/**
 * A photo or PDF of a receipt, uploaded straight from the browser to blob
 * storage like every other image picker here (see lib/blobUpload.ts). The
 * stored value is only the address it was uploaded to.
 */
export function ReceiptUploadField({ id, value, onChange, onError }: ReceiptUploadFieldProps) {
  const [isUploading, setIsUploading] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setIsUploading(true);
    try {
      const blob = await upload(file.name, file, { access: "public", handleUploadUrl: "/api/expenses/upload" });
      onChange(blob.url);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "";
      onError(reason ? `The receipt didn't upload: ${reason}` : "The receipt didn't upload. Try a photo or a PDF.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>Receipt</Label>
      {value ? (
        <div className="flex min-w-0 items-center gap-2">
          <Button asChild variant="outline" size="sm" className="min-w-0">
            <a href={value} target="_blank" rel="noreferrer">
              <FileText />
              <span className="truncate">View receipt</span>
            </a>
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            Remove
          </Button>
        </div>
      ) : (
        <Input
          id={id}
          type="file"
          accept="image/*,application/pdf"
          disabled={isUploading}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            void handleFile(file);
          }}
        />
      )}
      <p className="text-[11px] text-muted-foreground" role={isUploading ? "status" : undefined}>
        {isUploading ? "Uploading…" : "Optional. A photo or a PDF."}
      </p>
    </div>
  );
}
