import type { LinkProfile } from "@/repositories/links";
import { SocialIcon } from "./SocialIcon";
import styles from "./links.module.css";

interface ProfileHeaderProps {
  profile: LinkProfile;
  /** The media kit's photo — see getPublishedProfilePhoto(). */
  photo: string;
  /** Computed by totalFollowers(); null hides the line. */
  followers: string | null;
}

export function ProfileHeader({ profile, photo, followers }: ProfileHeaderProps) {
  return (
    <header className={styles.header}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.avatar} src={photo} alt={profile.displayName} />
      ) : null}

      <h1 className={styles.displayName}>{profile.displayName}</h1>
      {profile.tagline ? <p className={styles.tagline}>{profile.tagline}</p> : null}

      {profile.socials.length > 0 ? (
        <nav className={styles.socials} aria-label="Social profiles">
          {profile.socials.map((social) => (
            <a
              key={social.platform}
              className={styles.socialLink}
              href={social.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={social.platform}
            >
              <SocialIcon platform={social.platform} />
            </a>
          ))}
        </nav>
      ) : null}

      {followers ? <p className={styles.followers}>{followers}</p> : null}
    </header>
  );
}
