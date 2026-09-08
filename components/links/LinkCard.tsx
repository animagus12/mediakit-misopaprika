import { isExternal, isNavigable } from "@/lib/links";
import type { LinkAnimation, LinkItem, SectionLayout } from "@/repositories/links";
import { CopyCodeButton } from "./CopyCodeButton";
import { SocialIcon } from "./SocialIcon";
import { TrackedLink } from "./TrackedLink";
import styles from "./links.module.css";

/**
 * The card's actual shape, once the section's layout and the item's own
 * variant have been reconciled. Everything below keys off this rather than
 * off either input, so the two never have to be reasoned about together.
 */
type CardShape = "row" | "banner" | "tile";

interface ItemProps {
  item: LinkItem;
}

interface ShapeProps extends ItemProps {
  shape: CardShape;
}

interface LinkCardProps extends ItemProps {
  /** The section's layout: see shapeFor() for what it decides. */
  layout: SectionLayout;
  /**
   * Count a click on this card. False in the editor preview, whose cards are
   * the same component and would otherwise report the author's own clicks as
   * traffic.
   */
  trackClicks: boolean;
}

/**
 * The class each animation adds to the card, or nothing for the still default.
 * A lookup rather than styles[item.animation], so a value from a snapshot
 * written by a future build cannot resolve to undefined and reach the DOM as
 * a literal "undefined" class.
 */
const ANIMATION_CLASS: Record<LinkAnimation, string> = {
  none: "",
  wiggle: styles.animWiggle,
  pop: styles.animPop,
  shimmer: styles.animShimmer,
  glitch: styles.animGlitch,
  electric: styles.animElectric,
  orbit: styles.animOrbit,
};

/**
 * A section layout is a decision about the whole block, so where it implies a
 * card shape it overrides the per-item variant rather than combining with it:
 * a grid of tiles with one row card wedged into it is not a grid. Only "list"
 * defers to the item, which is why it stays the default for every section
 * written before the picker existed.
 */
function shapeFor(item: LinkItem, layout: SectionLayout): CardShape {
  if (layout === "grid" || layout === "carousel") return "tile";
  // An image-led card with no image is an empty picture frame, so both routes
  // to one fall back to the row.
  const wantsBanner = layout === "showcase" || item.variant === "banner";
  return wantsBanner && item.image.length > 0 ? "banner" : "row";
}

// Left slot for the "thumbnail" variant: an uploaded image wins over the
// platform mark, so a social card with a real cover doesn't get a redundant
// glyph. The mark is looked up from the label ("Instagram" → the Instagram
// icon), which is what the editor's Label field controls.
function Leading({ item }: ItemProps) {
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

// The picture at the head of a card, in whatever shape the section asked for.
function Media({ item, shape }: ShapeProps) {
  if (shape === "banner") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={styles.banner} src={item.image} alt="" loading="lazy" />;
  }

  if (shape === "tile") {
    if (item.image) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img className={styles.tileImage} src={item.image} alt="" loading="lazy" />;
    }
    // A tile is a picture with a caption under it, so a social with no upload
    // gets its platform mark at the picture's size. Anything else renders no
    // frame at all rather than an empty square: the tile becomes a text tile,
    // which reads as deliberate where a blank box reads as broken.
    return item.kind === "social" ? (
      <span className={styles.tileMark} aria-hidden>
        <SocialIcon platform={item.label} size={44} />
      </span>
    ) : null;
  }

  return item.variant === "thumbnail" ? (
    <Leading item={item} />
  ) : (
    <span className={styles.spacer} aria-hidden />
  );
}

function CardText({ item }: ItemProps) {
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

// Creator codes stack instead of sharing one row: the code is the thing to
// act on, so it gets a full-width ticket of its own with the brand text
// left-aligned above it. The shared row centres its text between two 52px
// columns, which on a phone strands a short label in the middle of a mostly
// empty card.
function CodeBody({ item, shape }: ShapeProps) {
  // A row is the one shape where the picture is part of the head rather than
  // leading the card, so it sits beside the text instead of above it.
  const inline = shape === "row";

  return (
    <>
      {inline ? null : <Media item={item} shape={shape} />}
      <span className={styles.codeHead}>
        {inline && item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.thumb} src={item.image} alt="" />
        ) : null}
        <span className={styles.codeText}>
          <span className={styles.cardLabel}>{item.label}</span>
          {item.sublabel ? <span className={styles.cardSublabel}>{item.sublabel}</span> : null}
        </span>
        {/* The discount reads as a figure attached to the offer, so it sits on
            the headline rather than taking a line under it. */}
        {item.badge ? <span className={`${styles.badge} ${styles.codeBadge}`}>{item.badge}</span> : null}
      </span>
      <CopyCodeButton code={item.code} />
    </>
  );
}

export function LinkCard({ item, layout, trackClicks }: LinkCardProps) {
  const shape = shapeFor(item, layout);
  const showCode = item.kind === "code" && item.code.length > 0;

  const body = showCode ? (
    <CodeBody item={item} shape={shape} />
  ) : (
    <>
      <Media item={item} shape={shape} />
      <CardText item={item} />
      {/* Balances the leading slot so the label is centred in the card rather
          than in the room left beside it. A stacked card has no such slot. */}
      {shape === "row" ? <span className={styles.spacer} aria-hidden /> : null}
    </>
  );

  // One shape class, never two: a tile and a code card each want a padding and
  // a radius, and letting both land on the same element would settle it by
  // source order rather than by intent. A code tile is a tile, and the code
  // parts of it are styled from .tileCard in the stylesheet.
  let shapeClass: string;
  if (shape === "tile") {
    shapeClass = `${styles.card} ${styles.tileCard}`;
  } else if (showCode) {
    shapeClass = `${styles.card} ${styles.codeCard}`;
  } else if (shape === "banner") {
    shapeClass = `${styles.card} ${styles.bannerCard}`;
  } else {
    shapeClass = styles.card;
  }

  // The animation rides on whatever shape the card ended up as: it is a
  // property of the card being noticed, not of how it is laid out.
  const animationClass = ANIMATION_CLASS[item.animation];
  const className = animationClass ? `${shapeClass} ${animationClass}` : shapeClass;

  // A card with no destination still renders: a creator code is useful on
  // its own: it just isn't a link. See isNavigable().
  if (!isNavigable(item)) {
    return <div className={className}>{body}</div>;
  }

  const external = isExternal(item.url);
  const anchorProps = {
    className,
    href: item.url,
    target: external ? "_blank" : undefined,
    rel: external ? "noopener noreferrer" : undefined,
  };

  // Same anchor either way(the tracked one only adds a beacon) so an
  // untracked render (the preview) ships no client JS for this card at all.
  return trackClicks ? (
    <TrackedLink itemId={item.id} {...anchorProps}>
      {body}
    </TrackedLink>
  ) : (
    <a {...anchorProps}>{body}</a>
  );
}
