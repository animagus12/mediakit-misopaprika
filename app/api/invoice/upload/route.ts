import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth";

// Issues client upload tokens for the invoice's image pickers (QR code,
// stamp/seal) so files go straight from the browser to Vercel Blob instead of
// being inlined as base64 — mirrors app/api/mediakit/upload/route.ts, which
// exists for the same reason (base64 payloads risk blowing past request size
// limits once persisted).
export async function POST(request: Request): Promise<NextResponse> {
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
        allowedContentTypes: [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif",
          "image/svg+xml",
          "image/heic",
          "image/heif",
        ],
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
