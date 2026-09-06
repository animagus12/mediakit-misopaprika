import { isExternal, isNavigable } from "@/lib/links";
import type { LinkItem } from "@/repositories/links";
import { CopyCodeButton } from "./CopyCodeButton";
import { SocialIcon } from "./SocialIcon";
import styles from "./links.module.css";

interface LinkCardProps {
  item: LinkItem;
}

// Left slot for the "thumbnail" variant: an uploaded image wins over the
// platform mark, so a social card with a real cover doesn't get a redundant
// glyph. The mark is looked up from the label ("Instagram" → the Instagram
// icon), which is what the editor's Label field controls.
function Leading({ item }: LinkCardProps) {
  if (item.image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={styles.thumb} src={item.image} alt="" />;
  }
  if (item.kind === "social") {
    return (
      <span className={styles.iconSlot} aria-hidden>
        <SocialIcon platform={item.label} size={30} />
      </span>
    );
  }
  return <span className={styles.spacer} aria-hidden />;
}

function CardText({ item }: LinkCardProps) {
  return (
    <span className={styles.cardBody}>
      <span className={styles.cardLabel}>{item.label}</span>
      {item.sublabel ? (
        <span className={styles.cardSublabel}>
          {/* The platform mark reads as a label for the handle beside it, the
              same lookup Leading() does from the item's own Label field. */}
          {item.kind === "social" ? (
            <span className={styles.sublabelIcon} aria-hidden>
              <SocialIcon platform={item.label} size={12} />
            </span>
          ) : null}
          {item.sublabel}
        </span>
      ) : null}
      {item.badge ? <span className={styles.badge}>{item.badge}</span> : null}
    </span>
  );
}

export function LinkCard({ item }: LinkCardProps) {
  const showCode = item.kind === "code" && item.code.length > 0;
  // A banner variant with no image uploaded yet falls back to the row layout
  // rather than rendering an empty picture frame.
  const isBanner = item.variant === "banner" && item.image.length > 0;

  const body = isBanner ? (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.banner} src={item.image} alt="" loading="lazy" />
      <CardText item={item} />
      {showCode ? <CopyCodeButton code={item.code} /> : null}
    </>
  ) : (
    <>
      {item.variant === "thumbnail" ? <Leading item={item} /> : <span className={styles.spacer} aria-hidden />}
      <CardText item={item} />
      {showCode ? <CopyCodeButton code={item.code} /> : <span className={styles.spacer} aria-hidden />}
    </>
  );

  const className = isBanner ? `${styles.card} ${styles.bannerCard}` : styles.card;

  // A card with no destination still renders — a creator code is useful on
  // its own — it just isn't a link. See isNavigable().
  if (!isNavigable(item)) {
    return <div className={className}>{body}</div>;
  }

  const external = isExternal(item.url);

  return (
    <a
      className={className}
      href={item.url}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
    >
      {body}
    </a>
  );
}
