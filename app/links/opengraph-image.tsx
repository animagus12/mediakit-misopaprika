import { ImageResponse } from "next/og";

// Static by design, for the same reason as the media kit's card: link-preview
// crawlers need this to resolve instantly. Keep the copy in sync with the
// title in ./page.tsx if either changes.
export const alt = "@misopaprika - links";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
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
          background: "linear-gradient(150deg, #1e1b4b 0%, #3b1866 50%, #1b2f57 100%)",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 84, fontWeight: 700 }}>misopaprika</div>
        <div style={{ display: "flex", fontSize: 32, marginTop: 16, opacity: 0.75 }}>
          your resident anime dealer
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 52,
            fontSize: 26,
            padding: "12px 32px",
            border: "2px solid rgba(255,255,255,0.45)",
            borderRadius: 999,
          }}
        >
          socials · creator codes · collabs
        </div>
      </div>
    ),
    { ...size }
  );
}
