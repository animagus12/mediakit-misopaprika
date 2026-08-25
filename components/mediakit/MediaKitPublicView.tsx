"use client";

import { useMediaKitStageFit } from "@/lib/useMediaKitStageFit";
import { MediaKitPreview } from "./MediaKitPreview";
import type { MediaKitFormState } from "./types";
import styles from "./mediakit.module.css";

interface MediaKitPublicViewProps {
  state: MediaKitFormState;
}

// Read-only counterpart to MediaKitGenerator's stage — same scale-to-fit
// A4 sheet, no controls panel, no editing.
export function MediaKitPublicView({ state }: MediaKitPublicViewProps) {
  const { stageRef, pageRef, scale, stageInnerHeight } = useMediaKitStageFit();

  return (
    <div className={styles.app}>
      <main className={styles.stage} ref={stageRef}>
        <div
          className={styles.stageInner}
          style={{
            transform: `scale(${scale})`,
            height: stageInnerHeight ? `${stageInnerHeight}px` : undefined,
          }}
        >
          <MediaKitPreview ref={pageRef} state={state} />
        </div>
      </main>
    </div>
  );
}
