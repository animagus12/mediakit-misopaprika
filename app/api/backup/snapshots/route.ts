import { type NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import {
  createOnlineBackup,
  isOnlineBackupConfigured,
  listOnlineBackups,
} from "@/services/onlineBackups.server";

const MAX_CURSOR_LENGTH = 4096;

export async function GET(request: NextRequest) {
  if (!(await verifySessionToken(request.cookies.get(COOKIE_NAME)?.value))) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!isOnlineBackupConfigured()) {
    return NextResponse.json(
      { error: "Online backups require BLOB_READ_WRITE_TOKEN to be configured." },
      { status: 503 }
    );
  }

  const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;
  if (cursor && cursor.length > MAX_CURSOR_LENGTH) {
    return NextResponse.json({ error: "Invalid backup page cursor." }, { status: 400 });
  }

  try {
    return NextResponse.json(await listOnlineBackups(cursor), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Online backup listing failed", error);
    return NextResponse.json({ error: "Couldn't load online backups." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await verifySessionToken(request.cookies.get(COOKIE_NAME)?.value))) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!isOnlineBackupConfigured()) {
    return NextResponse.json(
      { error: "Online backups require BLOB_READ_WRITE_TOKEN to be configured." },
      { status: 503 }
    );
  }

  try {
    const snapshot = await createOnlineBackup();
    return NextResponse.json({ snapshot }, { status: 201 });
  } catch (error) {
    console.error("Online backup creation failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Couldn't create an online backup." },
      { status: 500 }
    );
  }
}
