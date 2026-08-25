import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "@/lib/invoice-auth";

// Issues client upload tokens for the media kit's image pickers (photo, logos,
// tile covers) so files go straight from the browser to Vercel Blob instead of
// through the saveMediaKit/publishMediaKit server actions, which previously
// carried images as inline base64 and blew past the proxy body-buffer limit.
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
        allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"],
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
