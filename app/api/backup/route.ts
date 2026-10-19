import { type NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { MAX_BACKUP_BYTES, createBackupSnapshot, parseBackupSnapshot, restoreBackupSnapshot } from "@/services/backups.server";

export async function GET(request: NextRequest) {
  if (!(await verifySessionToken(request.cookies.get(COOKIE_NAME)?.value))) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const snapshot = await createBackupSnapshot();
    const body = JSON.stringify(snapshot, null, 2);
    if (new TextEncoder().encode(body).byteLength > MAX_BACKUP_BYTES) {
      return NextResponse.json({ error: "Backup files must be 10 MB or smaller." }, { status: 413 });
    }

    const date = snapshot.exportedAt.slice(0, 10);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="mediakit-backup-${date}.json"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Backup export failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Couldn't export the backup." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!(await verifySessionToken(request.cookies.get(COOKIE_NAME)?.value))) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") {
    return NextResponse.json({ error: "Upload a JSON backup file." }, { status: 415 });
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BACKUP_BYTES) {
    return NextResponse.json({ error: "Backup files must be 10 MB or smaller." }, { status: 413 });
  }

  let body: string;
  try {
    body = await request.text();
  } catch (error) {
    console.error("Backup upload could not be read", error);
    return NextResponse.json({ error: "Couldn't read the uploaded backup." }, { status: 400 });
  }

  if (new TextEncoder().encode(body).byteLength > MAX_BACKUP_BYTES) {
    return NextResponse.json({ error: "Backup files must be 10 MB or smaller." }, { status: 413 });
  }

  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "The uploaded file is not valid JSON." }, { status: 400 });
  }

  const snapshot = parseBackupSnapshot(value);
  if (!snapshot) {
    return NextResponse.json(
      { error: "This file is not a supported MediaKit backup or its data is incomplete." },
      { status: 400 }
    );
  }

  try {
    await restoreBackupSnapshot(snapshot);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Backup restore failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Couldn't restore the backup." },
      { status: 500 }
    );
  }
}
