import type { LinkProfile, LinkSection } from "@/repositories/links";
import { LinkCard } from "./LinkCard";
import { ProfileHeader } from "./ProfileHeader";
import styles from "./links.module.css";

interface LinksPublicViewProps {
  profile: LinkProfile;
  // Owned by the media kit, not by this page — see getPublishedProfilePhoto().
  photo: string;
  // Computed by totalFollowers(), like the rest of this component's input:
  // decided by lib/links, rendered here.
  followers: string | null;
  // Already filtered by visibleSections() — this component renders what it's
  // given and makes no visibility decisions of its own.
  sections: LinkSection[];
  /**
   * Count card clicks. Defaults to off so a new surface rendering this view
   * — the editor preview is the one that exists today — can't quietly write
   * to the public page's figures; /links opts in.
   */
  trackClicks?: boolean;
}

export function LinksPublicView({
  profile,
  photo,
  followers,
  sections,
  trackClicks = false,
}: LinksPublicViewProps) {
  return (
    // .frame is the container-query root the responsive card rules key off,
    // so the editor's narrow preview gets the phone layout rather than the
    // desktop one. See links.module.css.
    <div className={styles.frame}>
      <div className={styles.page}>
        <main className={styles.column}>
          <ProfileHeader profile={profile} photo={photo} followers={followers} />

          <div className={styles.sections}>
            {sections.map((section) => (
              <section key={section.id}>
                {section.title ? <h2 className={styles.sectionTitle}>{section.title}</h2> : null}
                <div className={styles.items}>
                  {section.items.map((item) => (
                    <LinkCard key={item.id} item={item} trackClicks={trackClicks} />
                  ))}
                </div>
              </section>
            ))}
          </div>

          <p className={styles.footer}>@{profile.displayName}</p>
        </main>
      </div>
    </div>
  );
}
