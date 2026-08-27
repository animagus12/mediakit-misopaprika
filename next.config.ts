import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
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

/** Latest released version from the top of CHANGELOG.md, e.g. "v1.15.2". */
function changelogVersion(): string | null {
  try {
    const match = readFileSync("CHANGELOG.md", "utf8").match(
      /^##\s+\[(\d+\.\d+\.\d+)\]/m,
    );
    return match ? `v${match[1]}` : null;
  } catch {
    return null;
  }
}

/**
 * Resolve the GitHub release tag for the running deployment, evaluated once at
 * build time. CHANGELOG.md is the source of truth (always in the tree, no git
 * history needed); a reachable git tag on a tagged commit wins over it, and
 * Vercel's git ref is the last resort before "dev".
 */
function resolveDeployedVersion(): string {
  return (
    process.env.NEXT_PUBLIC_APP_VERSION ||
    git("git describe --tags --exact-match") ||
    changelogVersion() ||
    git("git tag -l v* --sort=-v:refname")?.split("\n")[0] ||
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
