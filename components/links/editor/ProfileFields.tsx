"use client";

import { Eye, EyeOff, ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LinkProfile } from "@/repositories/links";
import { SocialIcon } from "../SocialIcon";
import { StatTokenHint } from "./StatTokenHint";
import type { LinksEditorActions } from "./types";

interface ProfileFieldsProps {
  profile: LinkProfile;
  actions: LinksEditorActions;
}

export function ProfileFields({ profile, actions }: ProfileFieldsProps) {
  const uploading = actions.uploadingSlot === "avatar";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          {profile.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar}
              alt=""
              className="size-16 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="bg-muted size-16 shrink-0 rounded-full" />
          )}
          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            onClick={() => actions.openPicker({ kind: "avatar" })}
          >
            {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />} Change photo
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              value={profile.displayName}
              onChange={(event) => actions.setProfile("displayName", event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="followers">Followers line</Label>
            <Input
              id="followers"
              placeholder="8.7K followers"
              value={profile.followers}
              onChange={(event) => actions.setProfile("followers", event.target.value)}
            />
            <StatTokenHint />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="tagline">Tagline</Label>
          <Input
            id="tagline"
            value={profile.tagline}
            onChange={(event) => actions.setProfile("tagline", event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Social icons</Label>
          <p className="text-muted-foreground text-xs">
            The platform name picks the icon — instagram, youtube, tiktok, x, discord. Anything else
            falls back to a generic link glyph. Hide keeps the URL; delete discards it.
          </p>
          {profile.socials.map((social, index) => {
            const name = social.platform || `social ${index + 1}`;
            return (
              <div
                key={index}
                className={`flex items-center gap-2 ${social.enabled ? "" : "opacity-60"}`}
              >
                <span className="text-muted-foreground flex size-9 shrink-0 items-center justify-center">
                  <SocialIcon platform={social.platform} size={20} />
                </span>
                <Input
                  aria-label={`Social ${index + 1} platform`}
                  placeholder="instagram"
                  className="sm:max-w-40"
                  value={social.platform}
                  onChange={(event) => actions.updateSocial(index, "platform", event.target.value)}
                />
                <Input
                  aria-label={`Social ${index + 1} URL`}
                  placeholder="https://..."
                  value={social.url}
                  onChange={(event) => actions.updateSocial(index, "url", event.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={social.enabled ? `Hide ${name}` : `Show ${name}`}
                  title={social.enabled ? "Hide this icon" : "Show this icon"}
                  onClick={() => actions.toggleSocial(index)}
                >
                  {social.enabled ? <Eye /> : <EyeOff />}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${name}`}
                  onClick={() => actions.removeSocial(index)}
                >
                  <Trash2 />
                </Button>
              </div>
            );
          })}
          <Button type="button" variant="outline" size="sm" className="self-start" onClick={actions.addSocial}>
            <Plus /> Add social
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
