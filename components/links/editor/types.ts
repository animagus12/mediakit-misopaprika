import type { LinkItem, LinkKind, LinkProfile, LinkSection, LinksData } from "@/repositories/links";

// Which item's image a file picker click is filling: addressed by id rather
// than index so a concurrent reorder can't land an upload on the wrong card.
// The profile photo is not a target: it belongs to the media kit.
export interface LinksPickerTarget {
  sectionId: string;
  itemId: string;
}

export type SectionPatch = Partial<Omit<LinkSection, "id" | "items">>;
export type ItemPatch = Partial<Omit<LinkItem, "id">>;

export interface LinksEditorActions {
  setProfile: <K extends keyof LinkProfile>(field: K, value: LinkProfile[K]) => void;
  addSocial: () => void;
  updateSocial: (index: number, field: "platform" | "url", value: string) => void;
  toggleSocial: (index: number) => void;
  removeSocial: (index: number) => void;

  addSection: () => void;
  updateSection: (sectionId: string, patch: SectionPatch) => void;
  removeSection: (sectionId: string) => void;
  reorderSections: (fromIndex: number, toIndex: number) => void;

  addItem: (sectionId: string, kind: LinkKind) => void;
  updateItem: (sectionId: string, itemId: string, patch: ItemPatch) => void;
  removeItem: (sectionId: string, itemId: string) => void;
  reorderItems: (sectionId: string, fromIndex: number, toIndex: number) => void;

  openPicker: (target: LinksPickerTarget) => void;
  /** Id of the item currently uploading, else null. */
  uploadingSlot: string | null;
}

export interface LinksEditorState {
  data: LinksData;
  actions: LinksEditorActions;
}
