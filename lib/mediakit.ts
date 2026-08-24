export type MediaKitLogoRowsMode = "auto" | "1" | "2";

export interface MediaKitLayout {
  rows: number;
  perRow: number;
  logoSizeMm: number;
  logoGapMm: number;
  logosTopMm: number;
  rowGapMm: number;
  collabsHeightMm: number;
  topCardTopMm: number;
  topCardHeightMm: number;
  tileWidthMm: number;
  tileHeightMm: number;
  tileGapMm: number;
  tileScale: number;
  bowTopMm: number;
  note: string;
}

// The "Past Collabs" logo grid and the "Top Performing Content" tiles below it
// share one fixed-height A4 page, so the logo count/row-mode cascades all the
// way down into tile size — everything here is tuned to keep the sheet at
// exactly one page. Ported 1:1 from the original tool's layoutLogosAndReels().
const LOGO_ROW_WIDTH_MM = 162.5;
const LOGOS_TOP_MM = 13.4;
const LOGO_ROW_GAP_MM = 2;
const MAX_LOGO_SIZE_MM = 13;
const COLLABS_CARD_TOP_MM = 190.2;
const CARD_GAP_MM = 3.8;
const PAGE_BOTTOM_MM = 291.9;
const BASE_TILE_WIDTH_MM = 44.3;
const BASE_TILE_HEIGHT_MM = 58;
const BASE_TILE_GAP_MM = 10.5;

export function computeMediaKitLayout(
  logoCount: number,
  rowsMode: MediaKitLogoRowsMode
): MediaKitLayout {
  const n = Math.max(logoCount, 1);
  const rows = rowsMode === "1" ? 1 : rowsMode === "2" ? 2 : n > 14 ? 2 : 1;
  const perRow = Math.ceil(n / rows);

  const logoSizeMm = Math.min(MAX_LOGO_SIZE_MM, (LOGO_ROW_WIDTH_MM - (perRow - 1) * 0.8) / perRow);
  const rawGap = perRow > 1 ? (LOGO_ROW_WIDTH_MM - perRow * logoSizeMm) / (perRow - 1) : 0;
  const logoGapMm = Math.max(0.6, Math.min(5, rawGap));

  const logosTopMm = LOGOS_TOP_MM + (rows === 1 ? (MAX_LOGO_SIZE_MM - logoSizeMm) / 2 : 0);
  const logosHeightMm = rows * logoSizeMm + (rows - 1) * LOGO_ROW_GAP_MM;
  const collabsHeightMm = rows === 1 ? 28.5 : LOGOS_TOP_MM + logosHeightMm + 1.6;

  const topCardTopMm = COLLABS_CARD_TOP_MM + collabsHeightMm + CARD_GAP_MM;
  const topCardHeightMm = PAGE_BOTTOM_MM - topCardTopMm;
  const tileHeightMm = topCardHeightMm - 9 - 2.4;
  const tileScale = tileHeightMm / BASE_TILE_HEIGHT_MM;
  const tileWidthMm = BASE_TILE_WIDTH_MM * tileScale;
  const tileGapMm = BASE_TILE_GAP_MM * tileScale;
  const bowTopMm = topCardTopMm - 1.8;

  const note =
    rows === 1
      ? `${n} brands in one row · logos ${logoSizeMm.toFixed(1)}mm`
      : `${n} brands over two rows · logos ${logoSizeMm.toFixed(1)}mm · reels ${Math.round(tileScale * 100)}% size`;

  return {
    rows,
    perRow,
    logoSizeMm,
    logoGapMm,
    logosTopMm,
    rowGapMm: LOGO_ROW_GAP_MM,
    collabsHeightMm,
    topCardTopMm,
    topCardHeightMm,
    tileWidthMm,
    tileHeightMm,
    tileGapMm,
    tileScale,
    bowTopMm,
    note: note + (logoSizeMm < 9.5 ? " — getting too small to read" : ""),
  };
}

// Placeholder shown in a logo slot right after "+ Add brand", before the user
// picks a real image — generated at runtime, not a static asset.
const BLANK_LOGO_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
  '<rect width="100" height="100" fill="#EDF1F7"/>' +
  '<text x="50" y="58" font-family="sans-serif" font-size="34" fill="#A9B6C8" text-anchor="middle">+</text></svg>';

export const BLANK_LOGO = `data:image/svg+xml;utf8,${encodeURIComponent(BLANK_LOGO_SVG)}`;
