import { MediaKitPreview } from "./MediaKitPreview";
import type { MediaKitFormState } from "./types";
import styles from "./mediakit.module.css";

interface MediaKitPublicViewProps {
  state: MediaKitFormState;
}

// Read-only counterpart to MediaKitGenerator's stage: same scale-to-fit
// A4 sheet (see .stageInner's transform in mediakit.module.css), no controls
// panel, no editing.
export function MediaKitPublicView({ state }: MediaKitPublicViewProps) {
  return (
    <div className={styles.app}>
      <main className={styles.stage}>
        <div className={styles.stageInner}>
          <MediaKitPreview state={state} />
        </div>
      </main>
    </div>
  );
}
