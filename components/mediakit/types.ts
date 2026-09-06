import type { MediaKitLogoRowsMode } from "@/lib/mediakit";
import type { MediaKitLogo, MediaKitServiceInput, MediaKitTileStats } from "@/repositories/mediakit";

export interface MediaKitTile {
  img: string;
  pos: string;
  url: string;
  stats: MediaKitTileStats;
}

export interface MediaKitFormState {
  wordmark: string;
  tagline: string;
  bio: string;
  followers: string;
  audience: string;
  location: string;
  handle: string;
  instagramUrl: string;
  phone: string;
  email: string;
  photo: string;
  monthlyViews: string;
  accountsReached: string;
  engagementRate: string;
  avgReelViews: string;
  caption: string;
  // Fixed-count by design (no add/remove UI exists for these, unlike
  // `logos`): plain arrays rather than tuples so index-based updates
  // don't fight the type checker; the exact count of 3/3/2 is guaranteed
  // by the repository's default data instead.
  services: MediaKitServiceInput[];
  startsAtNote: string;
  addons: MediaKitServiceInput[];
  bookingTerms: string;
  collabsSubline: string;
  logos: MediaKitLogo[];
  logoRowsMode: MediaKitLogoRowsMode;
  tiles: MediaKitTile[];
}

export type MediaKitPickerTarget =
  | { kind: "photo" }
  | { kind: "logo"; index: number }
  | { kind: "tile"; index: number };

export interface MediaKitFormActions {
  setField: <K extends keyof MediaKitFormState>(field: K, value: MediaKitFormState[K]) => void;
  updateService: (index: number, field: "name" | "price", value: string) => void;
  updateAddon: (index: number, field: "name" | "price", value: string) => void;
  updateTileStat: (tileIndex: number, key: keyof MediaKitTileStats, value: string) => void;
  addLogo: () => void;
  removeLogo: (index: number) => void;
  setLogoUrl: (index: number, url: string) => void;
  addBrandLogos: (logos: MediaKitLogo[]) => void;
  reorderLogos: (fromIndex: number, toIndex: number) => void;
  setTileUrl: (index: number, url: string) => void;
  openPicker: (target: MediaKitPickerTarget) => void;
  print: () => void;
  save: () => void;
  isSaving: boolean;
  publish: () => void;
  isPublishing: boolean;
  reset: () => void;
}
