"use client";

import { useColorThemeSync } from "@/hooks/use-color-theme";

/** Mounted once in the root layout; renders nothing. See useColorThemeSync. */
export function ColorThemeSync() {
  useColorThemeSync();
  return null;
}
