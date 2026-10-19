import { type NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import {
  isOnlineBackupConfigured,
  previewOnlineBackup,
  restoreOnlineBackup,
} from "@/services/onlineBackups.server";

async function isAuthenticated(request: NextRequest): Promise<boolean> {
  return verifySessionToken(request.cookies.get(COOKIE_NAME)?.value);
}

function unavailableResponse() {
  return NextResponse.json(
    { error: "Online backups require BLOB_READ_WRITE_TOKEN to be configured." },
    { status: 503 }
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!isOnlineBackupConfigured()) return unavailableResponse();

  const { id } = await params;
  try {
    return NextResponse.json(await previewOnlineBackup(id), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Online backup preview failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Couldn't preview the online backup." },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!isOnlineBackupConfigured()) return unavailableResponse();

  const { id } = await params;
  try {
    await restoreOnlineBackup(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Online backup restore failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Couldn't restore the online backup." },
      { status: 500 }
    );
  }
}
