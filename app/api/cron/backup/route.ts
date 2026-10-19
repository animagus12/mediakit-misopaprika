import { type NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import {
  createOnlineBackup,
  isOnlineBackupConfigured,
} from "@/services/onlineBackups.server";

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isOnlineBackupConfigured()) {
    return NextResponse.json(
      { error: "Online backups require BLOB_READ_WRITE_TOKEN to be configured." },
      { status: 503 }
    );
  }

  try {
    const snapshot = await createOnlineBackup();
    return NextResponse.json({ ok: true, snapshot });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Daily online backup failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
