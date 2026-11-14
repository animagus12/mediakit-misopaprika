import type { MediaKitFormState, MediaKitTile } from "@/components/mediakit/types";
import type { MediaKitLogo, MediaKitServiceInput, MediaKitTileStats } from "@/repositories/mediakit";
import type { MediaKitLogoRowsMode } from "./mediakit";
import { fetchPdf, pdfFilename } from "./printPdf";

/**
 * The contract between the media kit editor, its PDF route and its print
 * page (lib/printPdf.ts says why the server draws the PDF).
 */
export interface MediaKitPrintPayload {
  state: MediaKitFormState;
}

export const MEDIAKIT_PRINT_PATH = "/mediakit-generator/print";

/** The media kit as the editor shows it, as a PDF file. */
export function fetchMediaKitPdf(payload: MediaKitPrintPayload): Promise<File> {
  return fetchPdf("/api/mediakit/pdf", payload, mediaKitPdfFilename(payload.state.handle));
}

const STRING_FIELDS = [
  "wordmark",
  "tagline",
  "bio",
  "followers",
  "audience",
  "location",
  "handle",
  "instagramUrl",
  "phone",
  "email",
  "photo",
  "monthlyViews",
  "accountsReached",
  "engagementRate",
  "avgReelViews",
  "caption",
  "startsAtNote",
  "bookingTerms",
  "collabsSubline",
] as const satisfies readonly (keyof MediaKitFormState)[];

const TILE_STAT_FIELDS = [
  "views",
  "likes",
  "comments",
  "saves",
  "shares",
] as const satisfies readonly (keyof MediaKitTileStats)[];

const LOGO_ROWS_MODES: readonly string[] = ["auto", "1", "2"] satisfies readonly MediaKitLogoRowsMode[];

// The sheet has a fixed slot for each: three rates, two add-ons, three reels.
const SERVICE_COUNT = 3;
const ADDON_COUNT = 2;
const TILE_COUNT = 3;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isListOf<T>(value: unknown, isItem: (item: unknown) => item is T, length?: number): value is T[] {
  return Array.isArray(value) && (length === undefined || value.length === length) && value.every(isItem);
}

function isService(value: unknown): value is MediaKitServiceInput {
  return isRecord(value) && typeof value.name === "string" && typeof value.price === "string";
}

function isLogo(value: unknown): value is MediaKitLogo {
  return isRecord(value) && typeof value.src === "string" && typeof value.url === "string";
}

function isTileStats(value: unknown): value is MediaKitTileStats {
  return isRecord(value) && TILE_STAT_FIELDS.every((field) => typeof value[field] === "string");
}

function isTile(value: unknown): value is MediaKitTile {
  return (
    isRecord(value) &&
    typeof value.img === "string" &&
    typeof value.pos === "string" &&
    typeof value.url === "string" &&
    isTileStats(value.stats)
  );
}

function isMediaKitFormState(value: unknown): value is MediaKitFormState {
  return (
    isRecord(value) &&
    STRING_FIELDS.every((field) => typeof value[field] === "string") &&
    typeof value.logoRowsMode === "string" &&
    LOGO_ROWS_MODES.includes(value.logoRowsMode) &&
    isListOf(value.services, isService, SERVICE_COUNT) &&
    isListOf(value.addons, isService, ADDON_COUNT) &&
    isListOf(value.logos, isLogo) &&
    isListOf(value.tiles, isTile, TILE_COUNT)
  );
}

/**
 * Checked field by field because the payload arrives as JSON from the
 * client: a malformed one is refused up front instead of failing inside the
 * headless browser after a long wait.
 */
export function isMediaKitPrintPayload(value: unknown): value is MediaKitPrintPayload {
  return isRecord(value) && isMediaKitFormState(value.state);
}

/** "misopaprika-media-kit.pdf": named after the handle on the sheet. */
export function mediaKitPdfFilename(handle: string): string {
  return pdfFilename(`${handle}-media-kit`);
}
