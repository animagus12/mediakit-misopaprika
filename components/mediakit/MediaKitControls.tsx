"use client";

import { Eye, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MediaKitImagePickerButton } from "./MediaKitImagePickerButton";
import { MediaKitLogoGrid } from "./MediaKitLogoGrid";
import { MediaKitTileEditor } from "./MediaKitTileEditor";
import type { MediaKitFormActions, MediaKitFormState } from "./types";
import styles from "./mediakit.module.css";

interface MediaKitControlsProps {
  state: MediaKitFormState;
  actions: MediaKitFormActions;
  brandHandle: string;
  viewCount: number;
  uniqueVisitors: number;
}

export function MediaKitControls({
  state,
  actions,
  brandHandle,
  viewCount,
  uniqueVisitors,
}: MediaKitControlsProps) {
  return (
    <aside className={styles.panel}>
      <div className={styles.brandbar}>
        <h1>MEDIA KIT</h1>
        <span>{brandHandle}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge variant="secondary" className="gap-1">
          <Eye className="size-3" />
          {viewCount.toLocaleString()} views on /mediakit
        </Badge>
        <Badge variant="secondary" className="gap-1">
          <Users className="size-3" />
          {uniqueVisitors.toLocaleString()} unique visitors
        </Badge>
      </div>
      <p className={styles.hint}>
      </p>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Header</legend>

        <Label className={styles.fieldLabel} htmlFor="wordmark">
          Wordmark
        </Label>
        <Input
          id="wordmark"
          value={state.wordmark}
          onChange={(e) => actions.setField("wordmark", e.target.value)}
        />

        <Label className={styles.fieldLabel} htmlFor="tagline">
          Tagline
        </Label>
        <Input
          id="tagline"
          value={state.tagline}
          onChange={(e) => actions.setField("tagline", e.target.value)}
        />

        <Label className={styles.fieldLabel} htmlFor="bio">
          About me
        </Label>
        <Textarea
          id="bio"
          value={state.bio}
          onChange={(e) => actions.setField("bio", e.target.value)}
        />

        <div className={styles.row}>
          <div>
            <Label className={styles.fieldLabel} htmlFor="followers">
              Followers
            </Label>
            <Input
              id="followers"
              value={state.followers}
              onChange={(e) => actions.setField("followers", e.target.value)}
            />
          </div>
          <div>
            <Label className={styles.fieldLabel} htmlFor="audience">
              Audience
            </Label>
            <Input
              id="audience"
              value={state.audience}
              onChange={(e) => actions.setField("audience", e.target.value)}
            />
          </div>
        </div>

        <Label className={styles.fieldLabel} htmlFor="location">
          Location
        </Label>
        <Input
          id="location"
          value={state.location}
          onChange={(e) => actions.setField("location", e.target.value)}
        />

        <Label className={styles.fieldLabel} htmlFor="handle">
          Handle
        </Label>
        <Input
          id="handle"
          value={state.handle}
          onChange={(e) => actions.setField("handle", e.target.value)}
        />

        <Label className={styles.fieldLabel} htmlFor="phone">
          Phone
        </Label>
        <Input
          id="phone"
          value={state.phone}
          onChange={(e) => actions.setField("phone", e.target.value)}
        />

        <Label className={styles.fieldLabel} htmlFor="email">
          Email
        </Label>
        <Input
          id="email"
          value={state.email}
          onChange={(e) => actions.setField("email", e.target.value)}
        />

        <MediaKitImagePickerButton
          src={state.photo}
          label="Change photo"
          onClick={() => actions.openPicker({ kind: "photo" })}
        />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Last 30 days</legend>
        <div className={styles.grid4}>
          <div>
            <Label className={styles.fieldLabel} htmlFor="monthlyViews">
              Monthly views
            </Label>
            <Input
              id="monthlyViews"
              value={state.monthlyViews}
              onChange={(e) => actions.setField("monthlyViews", e.target.value)}
            />
          </div>
          <div>
            <Label className={styles.fieldLabel} htmlFor="accountsReached">
              Accounts reached
            </Label>
            <Input
              id="accountsReached"
              value={state.accountsReached}
              onChange={(e) => actions.setField("accountsReached", e.target.value)}
            />
          </div>
          <div>
            <Label className={styles.fieldLabel} htmlFor="engagementRate">
              Engagement rate
            </Label>
            <Input
              id="engagementRate"
              value={state.engagementRate}
              onChange={(e) => actions.setField("engagementRate", e.target.value)}
            />
          </div>
          <div>
            <Label className={styles.fieldLabel} htmlFor="avgReelViews">
              Avg reel views
            </Label>
            <Input
              id="avgReelViews"
              value={state.avgReelViews}
              onChange={(e) => actions.setField("avgReelViews", e.target.value)}
            />
          </div>
        </div>
        <Label className={styles.fieldLabel} htmlFor="caption">
          Caption
        </Label>
        <Input
          id="caption"
          value={state.caption}
          onChange={(e) => actions.setField("caption", e.target.value)}
        />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Services &amp; rates</legend>
        {state.services.map((service, i) => (
          <div className={styles.row} key={i}>
            <div>
              <Label className={styles.fieldLabel} htmlFor={`service${i}-name`}>
                Service {i + 1}
              </Label>
              <Input
                id={`service${i}-name`}
                value={service.name}
                onChange={(e) => actions.updateService(i, "name", e.target.value)}
              />
            </div>
            <div className={styles.wPrice}>
              <Label className={styles.fieldLabel} htmlFor={`service${i}-price`}>
                Price
              </Label>
              <Input
                id={`service${i}-price`}
                value={service.price}
                onChange={(e) => actions.updateService(i, "price", e.target.value)}
              />
            </div>
          </div>
        ))}
        <Label className={styles.fieldLabel} htmlFor="startsAtNote">
          Note above prices
        </Label>
        <Input
          id="startsAtNote"
          value={state.startsAtNote}
          onChange={(e) => actions.setField("startsAtNote", e.target.value)}
        />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Add-ons</legend>
        {state.addons.map((addon, i) => (
          <div className={styles.row} key={i}>
            <div>
              <Label className={styles.fieldLabel} htmlFor={`addon${i}-name`}>
                Add-on {i + 1}
              </Label>
              <Input
                id={`addon${i}-name`}
                value={addon.name}
                onChange={(e) => actions.updateAddon(i, "name", e.target.value)}
              />
            </div>
            <div className={styles.wPrice}>
              <Label className={styles.fieldLabel} htmlFor={`addon${i}-price`}>
                Price
              </Label>
              <Input
                id={`addon${i}-price`}
                value={addon.price}
                onChange={(e) => actions.updateAddon(i, "price", e.target.value)}
              />
            </div>
          </div>
        ))}
        <Label className={styles.fieldLabel} htmlFor="bookingTerms">
          Booking terms
        </Label>
        <Textarea
          id="bookingTerms"
          value={state.bookingTerms}
          onChange={(e) => actions.setField("bookingTerms", e.target.value)}
        />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Past collabs</legend>
        <Label className={styles.fieldLabel} htmlFor="collabsSubline">
          Subline
        </Label>
        <Input
          id="collabsSubline"
          value={state.collabsSubline}
          onChange={(e) => actions.setField("collabsSubline", e.target.value)}
        />
        <MediaKitLogoGrid state={state} actions={actions} />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Top performing content</legend>
        {state.tiles.map((tile, i) => (
          <MediaKitTileEditor key={i} tile={tile} index={i} actions={actions} />
        ))}
      </fieldset>

      <Button type="button" className="mt-2.5 w-full" onClick={actions.print}>
        Save as PDF
      </Button>
      <Button
        type="button"
        variant="secondary"
        className="mt-2.5 w-full"
        onClick={actions.save}
        disabled={actions.isSaving}
      >
        {actions.isSaving ? "Saving…" : "Save changes"}
      </Button>
      <Button
        type="button"
        className="mt-2.5 w-full"
        onClick={actions.publish}
        disabled={actions.isPublishing}
      >
        {actions.isPublishing ? "Publishing…" : "Publish"}
      </Button>
      <p className={styles.hint}>Publish saves and makes this the version shown at /mediakit.</p>
      <Button type="button" variant="outline" className="mt-2.5 w-full" onClick={actions.reset}>
        Reset fields
      </Button>
    </aside>
  );
}
