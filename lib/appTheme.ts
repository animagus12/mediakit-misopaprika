// Hex copies of the theme tokens in app/globals.css, for the places that
// cannot read CSS variables: the web app manifest and the theme-color meta
// tags a phone uses for its status bar and launch screen. Keep them in step
// with --background when the palette changes.
export const APP_COLORS = {
  /** :root --background, oklch(0.994 0.004 65) */
  backgroundLight: "#fffdfa",
  /** .dark --background, oklch(0.155 0.009 45) */
  backgroundDark: "#100b09",
} as const;
