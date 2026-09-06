"use client";

import { Button } from "@/components/ui/button";
import styles from "./mediakit.module.css";

interface MediaKitImagePickerButtonProps {
  src: string;
  alt?: string;
  label: string;
  onClick: () => void;
}

// A thumbnail + "Change ..." button pair, used wherever an image is always
// populated and click-to-replace (profile photo, each reel cover): unlike
// InvoiceImageUploadField, there's no "Remove" state here.
export function MediaKitImagePickerButton({
  src,
  alt = "",
  label,
  onClick,
}: MediaKitImagePickerButtonProps) {
  return (
    <div className={styles.swap}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className={styles.swapImg} />
      <Button type="button" variant="outline" className="flex-1" onClick={onClick}>
        {label}
      </Button>
    </div>
  );
}
