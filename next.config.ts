import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Saving the media kit form can include several base64-encoded images
    // (photo, up to 20 logos, 3 tile covers) — well past the 1MB default.
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
