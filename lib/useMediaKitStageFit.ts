"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Scales a fixed-size A4 `.page` element down to fit the width of its
// `.stage` container, re-measuring on window resize and whenever `deps`
// changes the page's natural height (e.g. logo row count).
export function useMediaKitStageFit(deps: React.DependencyList = []) {
  const stageRef = useRef<HTMLElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [stageInnerHeight, setStageInnerHeight] = useState<number | null>(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { stageRef, pageRef, scale, stageInnerHeight };
}
