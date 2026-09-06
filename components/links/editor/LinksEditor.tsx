"use client";

import { upload } from "@vercel/blob/client";
import { ExternalLink, Loader2, Plus, RotateCcw, Smartphone } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { publishLinks, saveLinks } from "@/app/links-editor/actions";
import { LinksPublicView } from "@/components/links/LinksPublicView";
import { Button } from "@/components/ui/button";
import { linksSummary } from "@/lib/linkStats";
import { blankItem, blankSection, moveItem, visiblePageNow } from "@/lib/links";
import type { LinksAnalytics } from "@/repositories/linkStats";
import type { LinkKind, LinkProfile, LinkSection, LinksData } from "@/repositories/links";
import type {
  InstagramTokenStatus,
  SocialStats,
  SocialStatsFreshness,
} from "@/repositories/socialStats";
import { LinksStatCards } from "./LinksStatCards";
import { ProfileFields } from "./ProfileFields";
import { SectionEditor } from "./SectionEditor";
import { SortableList } from "./SortableList";
import type { ItemPatch, LinksEditorActions, LinksPickerTarget, SectionPatch } from "./types";

interface LinksEditorProps {
  data: LinksData;
  /** Read on the server; the preview resolves stat tokens with the same
   * figures the public page will use. */
  stats: SocialStats;
  /** The media kit's published photo, shown but not editable here. */
  photo: string;
  /** When each cached figure was last written; read-only. */
  freshness: SocialStatsFreshness;
  /** Health of the token behind the Instagram figure; read-only. */
  instagramToken: InstagramTokenStatus;
  /** What /links has done: views, visitors, and clicks per link. Read-only. */
  analytics: LinksAnalytics;
}

export function LinksEditor({
  data,
  stats,
  photo,
  freshness,
  instagramToken,
  analytics,
}: LinksEditorProps) {
  const [state, setState] = useState<LinksData>(data);
  const [isSaving, startSaveTransition] = useTransition();
  const [isPublishing, startPublishTransition] = useTransition();
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingTargetRef = useRef<LinksPickerTarget | null>(null);

  // Every section mutation funnels through this, so the id lookup and the
  // immutable copy are written once instead of in each handler.
  const mapSection = useCallback(
    (sectionId: string, update: (section: LinkSection) => LinkSection) => {
      setState((prev) => ({
        ...prev,
        sections: prev.sections.map((section) =>
          section.id === sectionId ? update(section) : section
        ),
      }));
    },
    []
  );

  const setProfile = useCallback(<K extends keyof LinkProfile>(field: K, value: LinkProfile[K]) => {
    setState((prev) => ({ ...prev, profile: { ...prev.profile, [field]: value } }));
  }, []);

  const addSocial = useCallback(() => {
    setState((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        socials: [...prev.profile.socials, { platform: "", url: "", enabled: true }],
      },
    }));
  }, []);

  const updateSocial = useCallback((index: number, field: "platform" | "url", value: string) => {
    setState((prev) => {
      const socials = [...prev.profile.socials];
      socials[index] = { ...socials[index], [field]: value };
      return { ...prev, profile: { ...prev.profile, socials } };
    });
  }, []);

  const toggleSocial = useCallback((index: number) => {
    setState((prev) => {
      const socials = [...prev.profile.socials];
      socials[index] = { ...socials[index], enabled: !socials[index].enabled };
      return { ...prev, profile: { ...prev.profile, socials } };
    });
  }, []);

  const removeSocial = useCallback((index: number) => {
    setState((prev) => ({
      ...prev,
      profile: { ...prev.profile, socials: prev.profile.socials.filter((_, i) => i !== index) },
    }));
  }, []);

  const addSection = useCallback(() => {
    setState((prev) => ({ ...prev, sections: [...prev.sections, blankSection()] }));
  }, []);

  const updateSection = useCallback(
    (sectionId: string, patch: SectionPatch) => {
      mapSection(sectionId, (section) => ({ ...section, ...patch }));
    },
    [mapSection]
  );

  const removeSection = useCallback((sectionId: string) => {
    setState((prev) => ({
      ...prev,
      sections: prev.sections.filter((section) => section.id !== sectionId),
    }));
  }, []);

  const reorderSections = useCallback((fromIndex: number, toIndex: number) => {
    setState((prev) => ({ ...prev, sections: moveItem(prev.sections, fromIndex, toIndex) }));
  }, []);

  const addItem = useCallback(
    (sectionId: string, kind: LinkKind) => {
      mapSection(sectionId, (section) => ({
        ...section,
        items: [...section.items, blankItem(kind)],
      }));
    },
    [mapSection]
  );

  const updateItem = useCallback(
    (sectionId: string, itemId: string, patch: ItemPatch) => {
      mapSection(sectionId, (section) => ({
        ...section,
        items: section.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
      }));
    },
    [mapSection]
  );

  const removeItem = useCallback(
    (sectionId: string, itemId: string) => {
      mapSection(sectionId, (section) => ({
        ...section,
        items: section.items.filter((item) => item.id !== itemId),
      }));
    },
    [mapSection]
  );

  const reorderItems = useCallback(
    (sectionId: string, fromIndex: number, toIndex: number) => {
      mapSection(sectionId, (section) => ({
        ...section,
        items: moveItem(section.items, fromIndex, toIndex),
      }));
    },
    [mapSection]
  );

  const openPicker = useCallback((target: LinksPickerTarget) => {
    pendingTargetRef.current = target;
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      const target = pendingTargetRef.current;
      pendingTargetRef.current = null;
      event.target.value = "";
      if (!file || !target) return;

      setUploadingSlot(target.itemId);
      try {
        // Reuses the media kit's upload route: it only verifies the session and
        // returns a Blob client token, with nothing media-kit-specific in it.
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/mediakit/upload",
        });
        updateItem(target.sectionId, target.itemId, { image: blob.url });
        toast.success("Image uploaded");
      } catch (error) {
        const reason = error instanceof Error ? error.message : "";
        toast.error(reason ? `Upload failed — ${reason}` : "Upload failed — try a different image");
      } finally {
        setUploadingSlot(null);
      }
    },
    [updateItem]
  );

  const revert = useCallback(() => {
    setState(data);
    toast.info("Reverted to the last saved draft");
  }, [data]);

  const save = useCallback(() => {
    startSaveTransition(async () => {
      const result = await saveLinks(state);
      if (result.success) toast.success("Draft saved");
      else toast.error(result.error);
    });
  }, [state]);

  const publish = useCallback(() => {
    startPublishTransition(async () => {
      const result = await publishLinks(state);
      if (result.success) toast.success("Published — live at /links");
      else toast.error(result.error);
    });
  }, [state]);

  const actions = useMemo<LinksEditorActions>(
    () => ({
      setProfile,
      addSocial,
      updateSocial,
      toggleSocial,
      removeSocial,
      addSection,
      updateSection,
      removeSection,
      reorderSections,
      addItem,
      updateItem,
      removeItem,
      reorderItems,
      openPicker,
      uploadingSlot,
    }),
    [
      setProfile,
      addSocial,
      updateSocial,
      toggleSocial,
      removeSocial,
      addSection,
      updateSection,
      removeSection,
      reorderSections,
      addItem,
      updateItem,
      removeItem,
      reorderItems,
      openPicker,
      uploadingSlot,
    ]
  );

  // The preview runs the same visibility filter the public page does, so a
  // hidden section or an out-of-window item disappears here exactly as it will
  // there. The 390px frame is a container query root, so the card layout it
  // shows is the phone layout, not the desktop one.
  const preview = visiblePageNow(state, stats);
  const itemCount = state.sections.reduce((count, section) => count + section.items.length, 0);

  // Summed over the links on screen rather than over the stored map, so a link
  // deleted in this unsaved session stops counting immediately — see
  // linksSummary(). The figures themselves describe what is published, which
  // is why they don't move as the draft is edited.
  const summary = linksSummary(state, analytics);

  return (
    <div className="mx-auto max-w-screen-xl space-y-6 px-4 py-10">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-heading text-lg font-semibold">Links</h1>
          <p className="text-muted-foreground text-xs">
            {state.sections.length} section{state.sections.length === 1 ? "" : "s"} · {itemCount} link
            {itemCount === 1 ? "" : "s"} · nothing reaches /links until you publish
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost">
            <Link href="/links" target="_blank" rel="noopener noreferrer" prefetch={false}>
              View live <ExternalLink />
            </Link>
          </Button>
          <Button type="button" variant="ghost" onClick={revert}>
            <RotateCcw /> Revert
          </Button>
          <Button type="button" variant="outline" onClick={save} disabled={isSaving || isPublishing}>
            {isSaving ? <Loader2 className="animate-spin" /> : null} Save draft
          </Button>
          <Button type="button" onClick={publish} disabled={isSaving || isPublishing}>
            {isPublishing ? <Loader2 className="animate-spin" /> : null} Publish
          </Button>
        </div>
      </header>

      <LinksStatCards summary={summary} />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="flex min-w-0 flex-col gap-4">
          <ProfileFields
            profile={state.profile}
            freshness={freshness}
            instagramToken={instagramToken}
            actions={actions}
          />

          <SortableList
            id="links-sections"
            ids={state.sections.map((section) => section.id)}
            onReorder={reorderSections}
          >
            <div className="flex flex-col gap-4">
              {state.sections.map((section, index) => (
                <SectionEditor
                  key={section.id}
                  section={section}
                  index={index}
                  sectionCount={state.sections.length}
                  actions={actions}
                  analytics={analytics}
                />
              ))}
            </div>
          </SortableList>

          {state.sections.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
              No sections yet — add one to start building the page.
            </p>
          ) : null}

          <Button
            type="button"
            variant="outline"
            className="text-muted-foreground hover:text-foreground h-10 border-dashed"
            onClick={addSection}
          >
            <Plus /> Add section
          </Button>
        </div>

        <aside className="hidden xl:sticky xl:top-6 xl:block">
          <p className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-medium">
            <Smartphone className="size-3.5" />
            Preview — 390px, the layout a phone gets
          </p>
          <div className="bg-card ring-foreground/10 h-[720px] w-[390px] overflow-y-auto rounded-2xl shadow-sm ring-1">
            <LinksPublicView
              profile={preview.profile}
              photo={photo}
              followers={preview.followers}
              sections={preview.sections}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
