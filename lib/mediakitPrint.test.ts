import { describe, expect, it } from "vitest";
import type { MediaKitFormState } from "@/components/mediakit/types";
import { mediakitRepository } from "@/repositories/mediakit";
import { toFormState } from "./mediakit";
import { isMediaKitPrintPayload, mediaKitPdfFilename } from "./mediakitPrint";

// The default media kit, as the editor seeds its form from it.
function makeState(): MediaKitFormState {
  return toFormState(mediakitRepository.get());
}

function withState(overrides: Record<string, unknown>) {
  return { state: { ...makeState(), ...overrides } };
}

describe("isMediaKitPrintPayload", () => {
  it("accepts the media kit as the editor holds it", () => {
    expect(isMediaKitPrintPayload({ state: makeState() })).toBe(true);
  });

  it("survives a round trip through JSON", () => {
    expect(isMediaKitPrintPayload(JSON.parse(JSON.stringify({ state: makeState() })))).toBe(true);
  });

  it("accepts every logo row mode", () => {
    for (const logoRowsMode of ["auto", "1", "2"]) {
      expect(isMediaKitPrintPayload(withState({ logoRowsMode }))).toBe(true);
    }
  });

  it("refuses anything that isn't a payload", () => {
    expect(isMediaKitPrintPayload(null)).toBe(false);
    expect(isMediaKitPrintPayload("media kit")).toBe(false);
    expect(isMediaKitPrintPayload(makeState())).toBe(false);
  });

  it("refuses a field of the wrong type", () => {
    expect(isMediaKitPrintPayload(withState({ wordmark: 5 }))).toBe(false);
    expect(isMediaKitPrintPayload(withState({ photo: null }))).toBe(false);
    expect(isMediaKitPrintPayload(withState({ logoRowsMode: "3" }))).toBe(false);
  });

  it("refuses a sheet with the wrong number of rates, add-ons or reels", () => {
    const state = makeState();
    expect(isMediaKitPrintPayload(withState({ services: state.services.slice(1) }))).toBe(false);
    expect(isMediaKitPrintPayload(withState({ addons: [...state.addons, state.addons[0]] }))).toBe(false);
    expect(isMediaKitPrintPayload(withState({ tiles: state.tiles.slice(0, 2) }))).toBe(false);
  });

  it("refuses a malformed logo or reel", () => {
    const state = makeState();
    expect(isMediaKitPrintPayload(withState({ logos: [{ src: "/logo.png" }] }))).toBe(false);
    const tiles = state.tiles.map((tile, i) => (i === 0 ? { ...tile, stats: { ...tile.stats, views: 1200 } } : tile));
    expect(isMediaKitPrintPayload(withState({ tiles }))).toBe(false);
  });
});

describe("mediaKitPdfFilename", () => {
  it("names the file after the handle", () => {
    expect(mediaKitPdfFilename("@misopaprika")).toBe("misopaprika-media-kit.pdf");
  });

  it("still has a name without a handle", () => {
    expect(mediaKitPdfFilename("")).toBe("media-kit.pdf");
  });
});
