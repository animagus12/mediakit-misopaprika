import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Static by design: link-preview crawlers (Discord, Slack, iMessage, etc.)
// need this to resolve instantly and reliably, even when Redis is
// unconfigured or the published data hasn't loaded yet. Keep the copy here
// in sync with the hardcoded title in ./page.tsx if either changes.
export const alt = "Media kit - @misopaprika";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const crown = await readFile(join(process.cwd(), "public/mediakit/crown.png"), "base64");
  const crownSrc = `data:image/png;base64,${crown}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0052c4",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 96,
            height: 96,
            borderRadius: "50%",
            background: "#fff",
            marginBottom: 28,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={crownSrc} width={56} height={42} alt="" />
        </div>
        <div style={{ display: "flex", fontSize: 96, fontWeight: 700, letterSpacing: 6 }}>
          MISOPAPRIKA
        </div>
        <div style={{ display: "flex", fontSize: 28, marginTop: 20, opacity: 0.85, letterSpacing: 6 }}>
          ANIME · COSPLAY · COLLECTIBLES · MANGA
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 56,
            fontSize: 26,
            padding: "12px 32px",
            border: "2px solid rgba(255,255,255,0.55)",
            borderRadius: 999,
          }}
        >
          @misopaprika
        </div>
      </div>
    ),
    { ...size }
  );
}
