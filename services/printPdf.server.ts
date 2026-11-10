import "server-only";
import type { HTTPRequest, Page } from "puppeteer-core";
import { COOKIE_NAME } from "@/lib/auth";
import { PRINT_PAYLOAD_GLOBAL, PRINT_READY_ATTRIBUTE } from "@/lib/printPdf";
import { launchBrowser } from "./browser.server";

// Generous: a cold start unpacks Chromium before the page even loads.
const RENDER_TIMEOUT_MS = 30_000;

export interface RenderPrintPdfOptions {
  /** This deployment's origin, which serves the print page. */
  origin: string;
  /** The caller's session, so the print page passes the login check. */
  sessionToken: string;
  /** The print page that draws the payload, such as INVOICE_PRINT_PATH. */
  path: string;
  /** The document as the print page expects it; already validated. */
  payload: unknown;
}

/**
 * Lets the print page load only what a document is drawn from: this app's
 * own pages, scripts, fonts and images, plus https images (uploaded photos,
 * logos, QR codes and stamps live on Vercel Blob). Anything else, such as a
 * plain-http address on the server's network, is refused. Vercel's analytics
 * beacons are dropped so rendering a PDF never counts as a page view.
 */
function routeRequest(request: HTTPRequest, origin: string, protectionBypass: string | undefined) {
  if (request.isInterceptResolutionHandled()) return;
  const url = new URL(request.url());

  if (url.origin === origin) {
    if (url.pathname.startsWith("/_vercel/")) {
      void request.abort();
      return;
    }
    // Lets the page through Vercel Deployment Protection on preview
    // deployments; only ever sent to this deployment, never to other hosts.
    void request.continue(
      protectionBypass
        ? { headers: { ...request.headers(), "x-vercel-protection-bypass": protectionBypass } }
        : undefined
    );
    return;
  }

  if (url.protocol === "https:" || url.protocol === "data:") {
    void request.continue();
    return;
  }
  void request.abort();
}

async function openPrintPage(page: Page, { origin, path, payload }: RenderPrintPdfOptions) {
  page.setDefaultTimeout(RENDER_TIMEOUT_MS);

  const protectionBypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  await page.setRequestInterception(true);
  page.on("request", (request) => routeRequest(request, origin, protectionBypass));

  // Set before any of the page's scripts run, so the print page finds the
  // document on its first client render.
  await page.evaluateOnNewDocument(
    (key, value) => {
      Object.defineProperty(window, key, { value, writable: false });
    },
    PRINT_PAYLOAD_GLOBAL,
    payload
  );

  await page.goto(new URL(path, origin).href, { waitUntil: "load" });
  // A session that expired in the meantime lands on /login instead.
  if (new URL(page.url()).pathname !== path) {
    throw new Error(`The print page redirected to ${new URL(page.url()).pathname}`);
  }
  await page.waitForSelector(`[${PRINT_READY_ATTRIBUTE}]`);
}

/**
 * The document as an A4 PDF, drawn by headless Chromium from the same print
 * stylesheet the desktop "Save as PDF" uses, so it comes out the same
 * whichever device asked for it.
 */
export async function renderPrintPdf(options: RenderPrintPdfOptions): Promise<Uint8Array> {
  const browser = await launchBrowser();
  try {
    const { hostname, protocol } = new URL(options.origin);
    await browser.setCookie({
      name: COOKIE_NAME,
      value: options.sessionToken,
      domain: hostname,
      path: "/",
      httpOnly: true,
      secure: protocol === "https:",
      sameSite: "Lax",
    });

    const page = await browser.newPage();
    await openPrintPage(page, options);
    return await page.pdf({ printBackground: true, preferCSSPageSize: true });
  } finally {
    await browser.close();
  }
}
