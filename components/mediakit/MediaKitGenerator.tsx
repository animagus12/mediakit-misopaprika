"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BLANK_LOGO } from "@/lib/mediakit";
import type { MediaKitData, MediaKitTileStats } from "@/repositories/mediakit";
import { MediaKitControls } from "./MediaKitControls";
import { MediaKitPreview } from "./MediaKitPreview";
import type { MediaKitFormActions, MediaKitFormState, MediaKitPickerTarget } from "./types";
import styles from "./mediakit.module.css";

const MAX_LOGOS = 20;
const MIN_LOGOS = 1;

function buildInitialState(data: MediaKitData): MediaKitFormState {
  return {
    wordmark: data.header.wordmark,
    tagline: data.header.tagline,
    bio: data.header.bio,
    followers: data.header.followers,
    audience: data.header.audience,
    location: data.header.location,
    handle: data.header.handle,
    phone: data.header.phone,
    email: data.header.email,
    photo: data.header.photo,
    monthlyViews: data.stats.monthlyViews,
    accountsReached: data.stats.accountsReached,
    engagementRate: data.stats.engagementRate,
    avgReelViews: data.stats.avgReelViews,
    caption: data.stats.caption,
    services: data.services.map((service) => ({ ...service })),
    startsAtNote: data.startsAtNote,
    addons: data.addons.map((addon) => ({ ...addon })),
    bookingTerms: data.bookingTerms,
    collabsSubline: data.collabs.subline,
    logos: [...data.collabs.logos],
    logoRowsMode: "auto",
    tiles: data.tiles.map((tile) => ({ ...tile, stats: { ...tile.stats } })),
  };
}

interface MediaKitGeneratorProps {
  data: MediaKitData;
}

export function MediaKitGenerator({ data }: MediaKitGeneratorProps) {
  const [state, setState] = useState<MediaKitFormState>(() => buildInitialState(data));
  const [scale, setScale] = useState(1);
  const [stageInnerHeight, setStageInnerHeight] = useState<number | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const stageRef = useRef<HTMLElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingTargetRef = useRef<MediaKitPickerTarget | null>(null);

  const showToast = useCallback((message: string) => {
    setToastMsg(message);
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToastMsg(null), 1800);
  }, []);

  const fit = useCallback(() => {
    const stage = stageRef.current;
    const page = pageRef.current;
    if (!stage || !page) return;
    const avail = stage.clientWidth - 40;
    // offsetWidth is the page's natural (untransformed) layout width — unlike
    // getBoundingClientRect(), it ignores the CSS transform:scale() already
    // applied below, so there's no need to "undo" a previous scale (and no
    // risk of that undo using a stale value across the two mount effects).
    const pageWidth = page.offsetWidth;
    const nextScale = Math.min(1, avail / pageWidth);
    setScale(nextScale);
    setStageInnerHeight(page.offsetHeight * nextScale);
  }, []);

  useEffect(() => {
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [fit]);

  useEffect(() => {
    fit();
    // Re-fit whenever the row-mode/logo/tile count changes the page's natural height.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.logos.length, state.logoRowsMode]);

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
    setState((prev) => ({ ...prev, logos: [...prev.logos, BLANK_LOGO] }));
    showToast("Tap the new circle to pick its logo");
  }, [state.logos.length, showToast]);

  const removeLastLogo = useCallback(() => {
    if (state.logos.length <= MIN_LOGOS) {
      showToast("Keep at least one");
      return;
    }
    setState((prev) => ({ ...prev, logos: prev.logos.slice(0, -1) }));
  }, [state.logos.length, showToast]);

  const openPicker = useCallback((target: MediaKitPickerTarget) => {
    pendingTargetRef.current = target;
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const target = pendingTargetRef.current;
    pendingTargetRef.current = null;
    event.target.value = "";
    if (!file || !target) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setState((prev) => {
        if (target.kind === "photo") return { ...prev, photo: dataUrl };
        if (target.kind === "logo") {
          const logos = [...prev.logos];
          logos[target.index] = dataUrl;
          return { ...prev, logos };
        }
        const tiles = [...prev.tiles];
        tiles[target.index] = { ...tiles[target.index], img: dataUrl, pos: "50% 50%" };
        return { ...prev, tiles };
      });
    };
    reader.readAsDataURL(file);
  }, []);

  const reset = useCallback(() => {
    setState(buildInitialState(data));
    showToast("Fields reset");
  }, [data, showToast]);

  const print = useCallback(() => {
    window.print();
  }, []);

  const actions = useMemo<MediaKitFormActions>(
    () => ({
      setField,
      updateService,
      updateAddon,
      updateTileStat,
      addLogo,
      removeLastLogo,
      openPicker,
      print,
      reset,
    }),
    [setField, updateService, updateAddon, updateTileStat, addLogo, removeLastLogo, openPicker, print, reset]
  );

  return (
    <div className={styles.app}>
      <MediaKitControls state={state} actions={actions} brandHandle={data.brandHandle} />

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
