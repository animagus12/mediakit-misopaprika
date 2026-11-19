"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import {
  COLOR_THEME_ATTRIBUTE,
  COLOR_THEME_STORAGE_KEY,
  DEFAULT_COLOR_THEME,
  isColorTheme,
  type ColorTheme,
} from "@/lib/colorThemes";

const listeners = new Set<() => void>();

// Set when the choice could not be saved (site data blocked, private window):
// the theme still holds for as long as this page is open.
let unsaved: ColorTheme | null = null;

function readColorTheme(): ColorTheme {
  if (unsaved) return unsaved;
  try {
    const stored = localStorage.getItem(COLOR_THEME_STORAGE_KEY);
    if (isColorTheme(stored)) return stored;
  } catch {
    // Storage unavailable: fall through to the default.
  }
  return DEFAULT_COLOR_THEME;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Another tab picked a theme (or cleared site data, which reports key null).
  const onStorage = (event: StorageEvent) => {
    if (event.key === COLOR_THEME_STORAGE_KEY || event.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function applyColorTheme(theme: ColorTheme) {
  document.documentElement.setAttribute(COLOR_THEME_ATTRIBUTE, theme);
}

// Every colour on the page changes at once. Without this, controls that
// animate their colours would fade into the new theme one by one; it is what
// next-themes' disableTransitionOnChange does for light and dark.
function withoutTransitions(change: () => void) {
  const style = document.createElement("style");
  style.textContent = "*,*::before,*::after{transition:none!important}";
  document.head.appendChild(style);
  change();
  // Have the browser settle the new colours before transitions come back.
  window.getComputedStyle(document.body).getPropertyValue("color");
  setTimeout(() => style.remove(), 1);
}

function setColorTheme(theme: ColorTheme) {
  try {
    localStorage.setItem(COLOR_THEME_STORAGE_KEY, theme);
    unsaved = null;
  } catch {
    unsaved = theme;
  }
  withoutTransitions(() => applyColorTheme(theme));
  listeners.forEach((listener) => listener());
}

/**
 * The saved colour theme and a setter for it. The server cannot see this
 * browser's storage, so it renders the default and the first client render
 * corrects it (useSyncExternalStore), never a hydration mismatch.
 */
export function useColorTheme() {
  const colorTheme = useSyncExternalStore(subscribe, readColorTheme, () => DEFAULT_COLOR_THEME);
  return { colorTheme, setColorTheme };
}

/**
 * Keeps <html> on the saved theme after the inline script in the root layout
 * first set it: when another tab changes it, and in development, where
 * Strict Mode's remount resets <html> to the attributes React rendered and so
 * drops the one the script added. Before paint, so neither shows a flash.
 */
export function useColorThemeSync() {
  useLayoutEffect(() => {
    const sync = () => applyColorTheme(readColorTheme());
    sync();
    return subscribe(sync);
  }, []);
}
