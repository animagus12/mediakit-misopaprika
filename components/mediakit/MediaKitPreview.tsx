import { forwardRef } from "react";
import { Bookmark, Eye, Heart, MessageCircle, Send, type LucideIcon } from "lucide-react";
import { computeMediaKitLayout } from "@/lib/mediakit";
import type { MediaKitLogo, MediaKitTileStats } from "@/repositories/mediakit";
import type { MediaKitFormState } from "./types";
import styles from "./mediakit.module.css";

interface MediaKitPreviewProps {
  state: MediaKitFormState;
}

const SERVICE_ROW_TOPS_MM = [15.4, 25.3, 34.8];
const ADDON_ROW_TOPS_MM = [16.9, 26.7];

const TILE_STAT_ORDER: { key: keyof MediaKitTileStats; Icon: LucideIcon }[] = [
  { key: "views", Icon: Eye },
  { key: "likes", Icon: Heart },
  { key: "comments", Icon: MessageCircle },
  { key: "saves", Icon: Bookmark },
  { key: "shares", Icon: Send },
];

export const MediaKitPreview = forwardRef<HTMLDivElement, MediaKitPreviewProps>(
  function MediaKitPreview({ state }, ref) {
    const layout = computeMediaKitLayout(state.logos.length, state.logoRowsMode);

    const logoRows: MediaKitLogo[][] = [];
    for (let r = 0; r < layout.rows; r++) {
      logoRows.push(state.logos.slice(r * layout.perRow, (r + 1) * layout.perRow));
    }

    return (
      <div className={styles.page} ref={ref}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={`${styles.doodle} ${styles.dTeal}`} src="/mediakit/doodles/teal.svg" alt="" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={`${styles.doodle} ${styles.dRed}`} src="/mediakit/doodles/red.png" alt="" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={`${styles.doodle} ${styles.dGreen}`} src="/mediakit/doodles/green.png" alt="" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={`${styles.doodle} ${styles.dYellow}`} src="/mediakit/doodles/yellow.png" alt="" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={`${styles.doodle} ${styles.dHeart}`} src="/mediakit/doodles/heart.png" alt="" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={`${styles.doodle} ${styles.dBow}`}
          style={{ top: `${layout.bowTopMm}mm` }}
          src="/mediakit/doodles/bow.png"
          alt=""
        />

        <div className={styles.wordmark}>{state.wordmark}</div>
        <div className={styles.tagline}>{state.tagline}</div>

        <div className={styles.photo}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={state.photo} alt="" />
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.crown} src="/mediakit/crown.png" alt="" />

        <div className={styles.about}>
          <h3>ABOUT ME</h3>
          <p className={styles.bio}>{state.bio}</p>
          <div className={styles.facts}>
            <div>
              Followers: <span>{state.followers}</span>
              <br />
              Audience: <span>{state.audience}</span>
              <br />
              Location: <span>{state.location}</span>
            </div>
            <div className={styles.factsRight}>
              {state.instagramUrl ? (
                <a
                  href={state.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.inlineLink}
                >
                  {state.handle}
                </a>
              ) : (
                <span>{state.handle}</span>
              )}
              <br />
              <span>{state.phone}</span>
              <br />
              <a href={`mailto:${state.email}`} className={styles.inlineLink}>
                {state.email}
              </a>
            </div>
          </div>
        </div>

        <div className={`${styles.card} ${styles.stats}`}>
          <div className={styles.statGrid}>
            <div className={styles.stat}>
              <div className={styles.lbl}>
                MONTHLY
                <br />
                VIEWS
              </div>
              <div className={styles.pill}>{state.monthlyViews}</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.lbl}>
                ACCOUNTS
                <br />
                REACHED
              </div>
              <div className={styles.pill}>{state.accountsReached}</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.lbl}>
                ENGAGEMENT
                <br />
                RATE
              </div>
              <div className={styles.pill}>{state.engagementRate}</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.lbl}>
                AVERAGE
                <br />
                REEL VIEWS
              </div>
              <div className={styles.pill}>{state.avgReelViews}</div>
            </div>
          </div>
          <div className={styles.caption}>{state.caption}</div>
        </div>

        <div className={`${styles.card} ${styles.services}`}>
          <h4>SERVICES &amp; RATES</h4>
          <div className={styles.startsAt}>{state.startsAtNote}</div>
          {state.services.map((service, i) => (
            <div key={i} className={styles.rate} style={{ top: `${SERVICE_ROW_TOPS_MM[i]}mm` }}>
              <span className={styles.nm}>{service.name}</span>
              <span className={styles.pr}>{service.price}</span>
            </div>
          ))}
        </div>

        <div className={`${styles.card} ${styles.addons}`}>
          <h4>ADD-ONS</h4>
          {state.addons.map((addon, i) => (
            <div key={i} className={styles.rate} style={{ top: `${ADDON_ROW_TOPS_MM[i]}mm` }}>
              <span className={styles.nm}>{addon.name}</span>
              <span className={styles.pr}>{addon.price}</span>
            </div>
          ))}
          <div className={styles.fine}>{state.bookingTerms}</div>
        </div>

        <div
          className={`${styles.card} ${styles.collabs}`}
          style={{ height: `${layout.collabsHeightMm}mm` }}
        >
          <h4>PAST COLLABS</h4>
          <div className={styles.collabsSub}>{state.collabsSubline}</div>
          <div className={styles.logos} style={{ top: `${layout.logosTopMm}mm` }}>
            {logoRows.map((row, r) => (
              <div
                key={r}
                className={styles.logoRow}
                style={r < logoRows.length - 1 ? { marginBottom: `${layout.rowGapMm}mm` } : undefined}
              >
                {row.map((logo, i) => {
                  const logoStyle = {
                    width: `${layout.logoSizeMm}mm`,
                    height: `${layout.logoSizeMm}mm`,
                    marginRight: i < row.length - 1 ? `${layout.logoGapMm}mm` : undefined,
                  };
                  // eslint-disable-next-line @next/next/no-img-element
                  const img = <img src={logo.src} alt="" />;
                  return logo.url ? (
                    <a
                      key={i}
                      href={logo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.logoLink}
                      style={logoStyle}
                    >
                      {img}
                    </a>
                  ) : (
                    <div key={i} className={styles.logoLink} style={logoStyle}>
                      {img}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div
          className={`${styles.card} ${styles.top}`}
          style={{ top: `${layout.topCardTopMm}mm`, height: `${layout.topCardHeightMm}mm` }}
        >
          <h4>TOP PERFORMING CONTENT</h4>
          <div className={styles.tiles}>
            {state.tiles.map((tile, ti) => {
              const tileStyle = {
                width: `${layout.tileWidthMm}mm`,
                height: `${layout.tileHeightMm}mm`,
                marginRight: ti < state.tiles.length - 1 ? `${layout.tileGapMm}mm` : undefined,
                "--ts": layout.tileScale,
              } as React.CSSProperties;
              const tileContent = (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={tile.img} alt="" style={{ objectPosition: tile.pos }} />
                  <div className={styles.scrim} />
                  <ul>
                    {TILE_STAT_ORDER.map(({ key, Icon }) => (
                      <li key={key}>
                        <Icon />
                        <span>{tile.stats[key]}</span>
                      </li>
                    ))}
                  </ul>
                </>
              );
              return tile.url ? (
                <a
                  key={ti}
                  href={tile.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.tile}
                  style={tileStyle}
                >
                  {tileContent}
                </a>
              ) : (
                <div key={ti} className={styles.tile} style={tileStyle}>
                  {tileContent}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }
);
