import "server-only";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "./auth";

// Every image picker in the dashboard (media kit photo/logos/tiles, invoice
// QR and stamp, editor QR) uploads straight from the browser to Vercel Blob
// rather than passing the file through a server action as inline base64,
// which blew past the proxy body-buffer limit once persisted.
//
// The routes that issue those upload tokens were byte-identical, so the
// handler lives here and each route is a one-line re-export. Keeping the
// routes separate is deliberate: they are distinct paths, so an allow-list or
// rate limit can later diverge per surface without reshaping the caller.

const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/heic",
  "image/heif",
];

/** Issues a client upload token to a signed-in session, and nobody else. */
export async function handleBlobUpload(request: Request): Promise<NextResponse> {
  const cookieStore = await cookies();
  const isAuthenticated = await verifySessionToken(cookieStore.get(COOKIE_NAME)?.value);
  if (!isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ALLOWED_CONTENT_TYPES,
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
