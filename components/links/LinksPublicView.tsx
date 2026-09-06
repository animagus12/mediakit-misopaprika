import type { LinkProfile, LinkSection } from "@/repositories/links";
import { LinkCard } from "./LinkCard";
import { ProfileHeader } from "./ProfileHeader";
import styles from "./links.module.css";

interface LinksPublicViewProps {
  profile: LinkProfile;
  // Already filtered by visibleSections() — this component renders what it's
  // given and makes no visibility decisions of its own.
  sections: LinkSection[];
}

export function LinksPublicView({ profile, sections }: LinksPublicViewProps) {
  return (
    // .frame is the container-query root the responsive card rules key off,
    // so the editor's narrow preview gets the phone layout rather than the
    // desktop one. See links.module.css.
    <div className={styles.frame}>
      <div className={styles.page}>
        <main className={styles.column}>
          <ProfileHeader profile={profile} />

          <div className={styles.sections}>
            {sections.map((section) => (
              <section key={section.id}>
                {section.title ? <h2 className={styles.sectionTitle}>{section.title}</h2> : null}
                <div className={styles.items}>
                  {section.items.map((item) => (
                    <LinkCard key={item.id} item={item} />
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
