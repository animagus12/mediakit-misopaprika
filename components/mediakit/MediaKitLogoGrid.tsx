"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { computeMediaKitLayout, type MediaKitLogoRowsMode } from "@/lib/mediakit";
import type { MediaKitFormActions, MediaKitFormState } from "./types";
import styles from "./mediakit.module.css";

interface MediaKitLogoGridProps {
  state: MediaKitFormState;
  actions: MediaKitFormActions;
}

const ROW_MODE_OPTIONS: { value: MediaKitLogoRowsMode; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "1", label: "One row" },
  { value: "2", label: "Two rows" },
];

export function MediaKitLogoGrid({ state, actions }: MediaKitLogoGridProps) {
  const layout = computeMediaKitLayout(state.logos.length, state.logoRowsMode);

  return (
    <>
      <Label className={styles.fieldLabel}>
        Logos — tap image to replace, add a link to make it clickable
      </Label>
      <div className={styles.logoGrid}>
        {state.logos.map((logo, index) => (
          <div key={index} className={styles.logoItem}>
            <button
              type="button"
              title={`Replace logo ${index + 1}`}
              onClick={() => actions.openPicker({ kind: "logo", index })}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo.src} alt="" />
            </button>
            <Input
              type="url"
              placeholder="Brand link"
              value={logo.url}
              onChange={(e) => actions.setLogoUrl(index, e.target.value)}
              className={styles.logoLinkInput}
            />
          </div>
        ))}
      </div>

      <div className={styles.row} style={{ marginTop: "10px" }}>
        <Button type="button" variant="outline" className="w-full" onClick={actions.addLogo}>
          + Add brand
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={actions.removeLastLogo}
        >
          − Remove last
        </Button>
      </div>

      <Label className={styles.fieldLabel} htmlFor="logoRowsMode">
        Logo layout
      </Label>
      <Select
        value={state.logoRowsMode}
        onValueChange={(value) => actions.setField("logoRowsMode", value as MediaKitLogoRowsMode)}
      >
        <SelectTrigger id="logoRowsMode" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROW_MODE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className={styles.hint} style={{ marginTop: "8px", marginBottom: 0 }}>
        {layout.note}
      </p>
    </>
  );
}
