"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MediaKitTileStats } from "@/repositories/mediakit";
import { MediaKitImagePickerButton } from "./MediaKitImagePickerButton";
import type { MediaKitFormActions, MediaKitTile } from "./types";
import styles from "./mediakit.module.css";

interface MediaKitTileEditorProps {
  tile: MediaKitTile;
  index: number;
  actions: MediaKitFormActions;
}

const STAT_FIELDS: { key: keyof MediaKitTileStats; label: string }[] = [
  { key: "views", label: "Views" },
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Comments" },
  { key: "saves", label: "Saves" },
  { key: "shares", label: "Shares" },
];

export function MediaKitTileEditor({ tile, index, actions }: MediaKitTileEditorProps) {
  const idPrefix = `tile${index}`;

  return (
    <div className={styles.cardS}>
      <span className={styles.idx}>REEL {String(index + 1).padStart(2, "0")}</span>

      <div className={styles.row}>
        {STAT_FIELDS.slice(0, 2).map(({ key, label }) => (
          <div key={key}>
            <Label className={styles.fieldLabel} htmlFor={`${idPrefix}-${key}`}>
              {label}
            </Label>
            <Input
              id={`${idPrefix}-${key}`}
              value={tile.stats[key]}
              onChange={(e) => actions.updateTileStat(index, key, e.target.value)}
            />
          </div>
        ))}
      </div>
      <div className={styles.row}>
        {STAT_FIELDS.slice(2).map(({ key, label }) => (
          <div key={key}>
            <Label className={styles.fieldLabel} htmlFor={`${idPrefix}-${key}`}>
              {label}
            </Label>
            <Input
              id={`${idPrefix}-${key}`}
              value={tile.stats[key]}
              onChange={(e) => actions.updateTileStat(index, key, e.target.value)}
            />
          </div>
        ))}
      </div>

      <MediaKitImagePickerButton
        src={tile.img}
        label="Change cover"
        onClick={() => actions.openPicker({ kind: "tile", index })}
      />
    </div>
  );
}
