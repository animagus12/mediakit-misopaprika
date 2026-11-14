import "server-only";
import { type NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { renderPrintPdf } from "@/services/printPdf.server";

interface PrintPdfRouteOptions<T> {
  /** The print page that draws the document. */
  path: string;
  /**
   * Checks the JSON the client sent, so a malformed document is refused up
   * front instead of failing inside the headless browser after a long wait.
   */
  isPayload: (value: unknown) => value is T;
  /** What the downloaded file is called. */
  filename: (payload: T) => string;
  /** The answer when `isPayload` refuses the document. */
  invalidPayloadError: string;
  /** Names the document in the server log when rendering fails. */
  logLabel: string;
}

/**
 * The POST handler for a PDF route: the document as it stands in its editor,
 * saved or not, comes back as an A4 PDF download. The caller's own session
 * lets the headless browser past the print page's login check.
 */
export function createPrintPdfRoute<T>({
  path,
  isPayload,
  filename,
  invalidPayloadError,
  logLabel,
}: PrintPdfRouteOptions<T>) {
  return async function POST(request: NextRequest) {
    const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
    if (!sessionToken || !(await verifySessionToken(sessionToken))) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const payload: unknown = await request.json().catch(() => null);
    if (!isPayload(payload)) {
      return NextResponse.json({ error: invalidPayloadError }, { status: 400 });
    }

    try {
      const pdf = await renderPrintPdf({ origin: request.nextUrl.origin, sessionToken, path, payload });
      return new NextResponse(Buffer.from(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename(payload)}"`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch (error) {
      console.error(`${logLabel} PDF failed`, error);
      return NextResponse.json({ error: "Couldn't create the PDF." }, { status: 500 });
    }
  };
}
