import "server-only";
import { existsSync } from "node:fs";
import { join } from "node:path";
import puppeteer, { type Browser } from "puppeteer-core";

/** Where Chrome or Edge usually lives, for rendering on a development machine. */
function localBrowserCandidates(): string[] {
  switch (process.platform) {
    case "win32": {
      const roots = [
        process.env.PROGRAMFILES,
        process.env["PROGRAMFILES(X86)"],
        process.env.LOCALAPPDATA,
      ].filter((root): root is string => Boolean(root));
      return [
        ...roots.map((root) => join(root, "Google", "Chrome", "Application", "chrome.exe")),
        ...roots.map((root) => join(root, "Microsoft", "Edge", "Application", "msedge.exe")),
      ];
    }
    case "darwin":
      return [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
      ];
    default:
      return [
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/usr/bin/microsoft-edge",
      ];
  }
}

function localBrowserPath(): string {
  const configured = process.env.CHROME_EXECUTABLE_PATH;
  if (configured) return configured;
  const found = localBrowserCandidates().find((path) => existsSync(path));
  if (!found) {
    throw new Error(
      "No Chrome or Edge found to render PDFs with. Set CHROME_EXECUTABLE_PATH to a Chromium-based browser."
    );
  }
  return found;
}

/**
 * A headless Chromium for server-side rendering. On Vercel it is the
 * serverless build from @sparticuz/chromium (imported only there: it sets up
 * Lambda library paths on import, and its 60 MB binary is unpacked on first
 * use); elsewhere it is the machine's own Chrome or Edge.
 * The caller closes it.
 */
export async function launchBrowser(): Promise<Browser> {
  if (process.env.VERCEL) {
    const { default: chromium } = await import("@sparticuz/chromium");
    return puppeteer.launch({
      args: await puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }),
      executablePath: await chromium.executablePath(),
      headless: "shell",
    });
  }
  return puppeteer.launch({ executablePath: localBrowserPath(), headless: true });
}
