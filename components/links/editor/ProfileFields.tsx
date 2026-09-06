"use client";

import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LinkProfile } from "@/repositories/links";
import type { InstagramTokenStatus, SocialStatsFreshness } from "@/repositories/socialStats";
import { SocialIcon } from "../SocialIcon";
import { SocialRowNotes } from "./SocialRowNotes";
import type { LinksEditorActions } from "./types";

interface ProfileFieldsProps {
  profile: LinkProfile;
  /** Both sit under the rows they describe — see SocialRowNotes. */
  freshness: SocialStatsFreshness;
  instagramToken: InstagramTokenStatus;
  actions: LinksEditorActions;
}

export function ProfileFields({
  profile,
  freshness,
  instagramToken,
  actions,
}: ProfileFieldsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* One photo across both public pages, uploaded in one place — so
            there is no second copy here to fall out of step with the kit. */}
        <p className="text-muted-foreground text-xs">
          The profile photo comes from your media kit. Change it in the{" "}
          <Link href="/mediakit-generator" className="underline underline-offset-2">
            media kit generator
          </Link>
          , then publish the kit and it updates here and on /links.
        </p>

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
            <Label htmlFor="tagline">Tagline</Label>
            <Input
              id="tagline"
              value={profile.tagline}
              onChange={(event) => actions.setProfile("tagline", event.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Social icons</Label>
          {profile.socials.map((social, index) => {
            const name = social.platform || `social ${index + 1}`;
            return (
              <div key={index} className={social.enabled ? "" : "opacity-60"}>
                <div className="flex items-center gap-2">
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
                <SocialRowNotes
                  platform={social.platform}
                  freshness={freshness}
                  instagramToken={instagramToken}
                />
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
