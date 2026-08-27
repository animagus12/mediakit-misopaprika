import { execSync } from "node:child_process";
import type { NextConfig } from "next";

function git(command: string): string | null {
  try {
    const out = execSync(command, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

/**
 * Resolve the GitHub release tag for the running deployment, evaluated once at
 * build time. Prefers the nearest reachable tag (`git describe`), falls back to
 * the highest `vX.Y.Z` tag in the repo, then Vercel's git ref, then "dev".
 */
function resolveDeployedVersion(): string {
  return (
    process.env.NEXT_PUBLIC_APP_VERSION ||
    git("git describe --tags --abbrev=0") ||
    git("git tag -l v* --sort=-v:refname") ?.split("\n")[0] ||
    process.env.VERCEL_GIT_COMMIT_REF ||
    "dev"
  );
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: resolveDeployedVersion(),
  },
};

export default nextConfig;
