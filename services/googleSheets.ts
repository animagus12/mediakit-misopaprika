import "server-only";
import { createSign } from "node:crypto";

const TOKEN_URI = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const EXPIRY_BUFFER_SECONDS = 60;

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

function base64url(input: Buffer): string {
  return input.toString("base64url");
}

// Google service-account auth (JWT bearer flow), signed with the account's
// RSA key via node:crypto — avoids pulling in the full `googleapis` SDK for
// a single read-only endpoint.
async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() / 1000 + EXPIRY_BUFFER_SECONDS) {
    return cachedToken.accessToken;
  }

  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) {
    throw new Error("GOOGLE_SHEETS_CLIENT_EMAIL and GOOGLE_SHEETS_PRIVATE_KEY must be set");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claims = base64url(
    Buffer.from(
      JSON.stringify({
        iss: clientEmail,
        scope: SCOPE,
        aud: TOKEN_URI,
        iat: now,
        exp: now + 3600,
      })
    )
  );
  const signingInput = `${header}.${claims}`;
  const signature = base64url(createSign("RSA-SHA256").update(signingInput).sign(privateKey));
  const assertion = `${signingInput}.${signature}`;

  const res = await fetch(TOKEN_URI, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);

  const data: { access_token: string; expires_in: number } = await res.json();
  cachedToken = { accessToken: data.access_token, expiresAt: now + data.expires_in };
  return data.access_token;
}

// Returns raw rows (including the header row) from the given sheet/tab.
export async function fetchSheetRows(sheetId: string, tabName: string): Promise<string[][]> {
  const accessToken = await getAccessToken();
  const range = encodeURIComponent(tabName);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      next: { revalidate: 300 },
    }
  );
  if (!res.ok) throw new Error(`Google Sheets values.get failed: ${res.status} ${await res.text()}`);

  const data: { values?: string[][] } = await res.json();
  return data.values ?? [];
}
