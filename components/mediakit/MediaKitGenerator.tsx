"use client";

import { upload } from "@vercel/blob/client";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { publishMediaKit, saveMediaKit } from "@/app/mediakit-generator/actions";
import { BLANK_LOGO, toFormState, toMediaKitData } from "@/lib/mediakit";
import type { MediaKitData, MediaKitTileStats } from "@/repositories/mediakit";
import { MediaKitControls } from "./MediaKitControls";
import { MediaKitPreview } from "./MediaKitPreview";
import type { MediaKitFormActions, MediaKitFormState, MediaKitPickerTarget } from "./types";
import styles from "./mediakit.module.css";

const MAX_LOGOS = 20;
const MIN_LOGOS = 1;

interface MediaKitGeneratorProps {
  data: MediaKitData;
  viewCount: number;
  uniqueVisitors: number;
}

export function MediaKitGenerator({ data, viewCount, uniqueVisitors }: MediaKitGeneratorProps) {
  const [state, setState] = useState<MediaKitFormState>(() => toFormState(data));
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isSaving, startSaveTransition] = useTransition();
  const [isPublishing, startPublishTransition] = useTransition();

  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingTargetRef = useRef<MediaKitPickerTarget | null>(null);

  const showToast = useCallback((message: string) => {
    setToastMsg(message);
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToastMsg(null), 1800);
  }, []);

  const setField = useCallback(
    <K extends keyof MediaKitFormState>(field: K, value: MediaKitFormState[K]) => {
      setState((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const updateService = useCallback((index: number, field: "name" | "price", value: string) => {
    setState((prev) => {
      const services = [...prev.services];
      services[index] = { ...services[index], [field]: value };
      return { ...prev, services };
    });
  }, []);

  const updateAddon = useCallback((index: number, field: "name" | "price", value: string) => {
    setState((prev) => {
      const addons = [...prev.addons];
      addons[index] = { ...addons[index], [field]: value };
      return { ...prev, addons };
    });
  }, []);

  const updateTileStat = useCallback(
    (tileIndex: number, key: keyof MediaKitTileStats, value: string) => {
      setState((prev) => {
        const tiles = [...prev.tiles];
        tiles[tileIndex] = {
          ...tiles[tileIndex],
          stats: { ...tiles[tileIndex].stats, [key]: value },
        };
        return { ...prev, tiles };
      });
    },
    []
  );

  const addLogo = useCallback(() => {
    if (state.logos.length >= MAX_LOGOS) {
      showToast(`${MAX_LOGOS} logos is the sensible ceiling`);
      return;
    }
    setState((prev) => ({ ...prev, logos: [...prev.logos, { src: BLANK_LOGO, url: "" }] }));
    showToast("Tap the new circle to pick its logo");
  }, [state.logos.length, showToast]);

  const removeLastLogo = useCallback(() => {
    if (state.logos.length <= MIN_LOGOS) {
      showToast("Keep at least one");
      return;
    }
    setState((prev) => ({ ...prev, logos: prev.logos.slice(0, -1) }));
  }, [state.logos.length, showToast]);

  const setLogoUrl = useCallback((index: number, url: string) => {
    setState((prev) => {
      const logos = [...prev.logos];
      logos[index] = { ...logos[index], url };
      return { ...prev, logos };
    });
  }, []);

  const setTileUrl = useCallback((index: number, url: string) => {
    setState((prev) => {
      const tiles = [...prev.tiles];
      tiles[index] = { ...tiles[index], url };
      return { ...prev, tiles };
    });
  }, []);

  const openPicker = useCallback((target: MediaKitPickerTarget) => {
    pendingTargetRef.current = target;
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      const target = pendingTargetRef.current;
      pendingTargetRef.current = null;
      event.target.value = "";
      if (!file || !target) return;

      showToast("Uploading…");
      try {
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/mediakit/upload",
        });
        setState((prev) => {
          if (target.kind === "photo") return { ...prev, photo: blob.url };
          if (target.kind === "logo") {
            const logos = [...prev.logos];
            logos[target.index] = { ...logos[target.index], src: blob.url };
            return { ...prev, logos };
          }
          const tiles = [...prev.tiles];
          tiles[target.index] = { ...tiles[target.index], img: blob.url, pos: "50% 50%" };
          return { ...prev, tiles };
        });
        showToast("Image uploaded");
      } catch (error) {
        const reason = error instanceof Error ? error.message : "";
        showToast(reason ? `Upload failed — ${reason}` : "Upload failed — try a different image");
      }
    },
    [showToast]
  );

  const reset = useCallback(() => {
    setState(toFormState(data));
    showToast("Fields reset");
  }, [data, showToast]);

  const print = useCallback(() => {
    window.print();
  }, []);

  const save = useCallback(() => {
    const payload = toMediaKitData(state, data.brandHandle);
    startSaveTransition(async () => {
      const result = await saveMediaKit(payload);
      showToast(result.success ? "Saved — values updated permanently" : result.error);
    });
  }, [state, data.brandHandle, showToast]);

  const publish = useCallback(() => {
    const payload = toMediaKitData(state, data.brandHandle);
    startPublishTransition(async () => {
      const result = await publishMediaKit(payload);
      showToast(result.success ? "Published — live at /mediakit" : result.error);
    });
  }, [state, data.brandHandle, showToast]);

  const actions = useMemo<MediaKitFormActions>(
    () => ({
      setField,
      updateService,
      updateAddon,
      updateTileStat,
      addLogo,
      removeLastLogo,
      setLogoUrl,
      setTileUrl,
      openPicker,
      print,
      save,
      isSaving,
      publish,
      isPublishing,
      reset,
    }),
    [
      setField,
      updateService,
      updateAddon,
      updateTileStat,
      addLogo,
      removeLastLogo,
      setLogoUrl,
      setTileUrl,
      openPicker,
      print,
      save,
      isSaving,
      publish,
      isPublishing,
      reset,
    ]
  );

  return (
    <div className={styles.app}>
      <MediaKitControls
        state={state}
        actions={actions}
        brandHandle={data.brandHandle}
        viewCount={viewCount}
        uniqueVisitors={uniqueVisitors}
      />

      <main className={styles.stage}>
        <div className={styles.stageInner}>
          <MediaKitPreview state={state} />
        </div>
      </main>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className={`${styles.toast} ${toastMsg ? styles.toastShow : ""}`}>{toastMsg}</div>
    </div>
  );
}
