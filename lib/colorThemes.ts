/**
 * The colour themes the dashboard can wear. Paprika, the default, is the
 * token set in app/globals.css; the rest are in app/themes.css, keyed on a
 * `data-color-theme` attribute on <html>. Light, dark and system stay with
 * next-themes: every colour theme has a light and a dark version, so the two
 * choices are independent.
 */
export const COLOR_THEMES = [
  { id: "paprika", label: "Paprika" },
  { id: "dracula", label: "Dracula" },
  { id: "catppuccin", label: "Catppuccin" },
  { id: "nord", label: "Nord" },
  { id: "tokyo-night", label: "Tokyo Night" },
  { id: "gruvbox", label: "Gruvbox" },
  { id: "rose-pine", label: "Rosé Pine" },
] as const satisfies readonly { id: string; label: string }[];

export type ColorTheme = (typeof COLOR_THEMES)[number]["id"];

export const DEFAULT_COLOR_THEME: ColorTheme = "paprika";

/** The attribute on <html> (or on one element, to preview a theme) that app/themes.css keys on. */
export const COLOR_THEME_ATTRIBUTE = "data-color-theme";

/** Kept in this browser only, like light and dark: it is a preference of the device, not the account. */
export const COLOR_THEME_STORAGE_KEY = "color-theme";

const COLOR_THEME_IDS: readonly string[] = COLOR_THEMES.map((theme) => theme.id);

export function isColorTheme(value: unknown): value is ColorTheme {
  return typeof value === "string" && COLOR_THEME_IDS.includes(value);
}

export function colorThemeLabel(theme: ColorTheme): string {
  return COLOR_THEMES.find(({ id }) => id === theme)?.label ?? theme;
}

/**
 * Runs in <head> while the page is still being parsed, so a saved theme is
 * on screen from the first paint instead of switching in after hydration.
 * Only a known id is applied; anything else in storage leaves the default.
 */
export const COLOR_THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  COLOR_THEME_STORAGE_KEY,
)});if(${JSON.stringify(COLOR_THEME_IDS)}.indexOf(t)>-1)document.documentElement.setAttribute(${JSON.stringify(
  COLOR_THEME_ATTRIBUTE,
)},t)}catch(e){}})()`;
