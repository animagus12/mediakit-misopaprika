import "server-only";
import { createSign } from "node:crypto";

const TOKEN_URI = "https://oauth2.googleapis.com/token";
// Read-write — the Collaborations quick-add appends rows, not just reads.
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
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

// Appends a single row to the end of the given sheet/tab's table. Returns
// the range it landed in (e.g. "Campaigns!A24:Q24") so callers can patch in
// row-relative formulas afterward without a separate lookup.
export async function appendSheetRow(sheetId: string, tabName: string, row: string[]): Promise<string> {
  const accessToken = await getAccessToken();
  const range = encodeURIComponent(tabName);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=USER_ENTERED`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: [row] }),
      cache: "no-store",
    }
  );
  if (!res.ok) throw new Error(`Google Sheets values.append failed: ${res.status} ${await res.text()}`);

  const data: { updates?: { updatedRange?: string } } = await res.json();
  return data.updates?.updatedRange ?? "";
}

// Resolves a tab name to its numeric grid id, required by batchUpdate requests
// (values.* endpoints take the tab name directly, but batchUpdate doesn't).
export async function getSheetGid(sheetId: string, tabName: string): Promise<number> {
  const accessToken = await getAccessToken();
  const fields = encodeURIComponent("sheets.properties");
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=${fields}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Google Sheets spreadsheets.get failed: ${res.status} ${await res.text()}`);

  const data: { sheets?: { properties: { sheetId: number; title: string } }[] } = await res.json();
  const sheet = data.sheets?.find((s) => s.properties.title === tabName);
  if (!sheet) throw new Error(`Sheet tab "${tabName}" not found`);
  return sheet.properties.sheetId;
}

export interface CellRange {
  sheetId: number;
  startRowIndex: number;
  endRowIndex: number;
  startColumnIndex: number;
  endColumnIndex: number;
}

// This restores the dropdown constraint (arrow + enforced list) on dropdown
// cells (Type/Reels/Story/Status, …), which values.append/update never
// attach to newly-written cells on their own — without this, appended rows
// take any text at all instead of one of the sheet's allowed values.
//
// It does NOT restore the colored "chip" look those cells have elsewhere in
// the sheet. That color isn't stored anywhere retrievable via the API (an
// existing colored cell's effectiveFormat.backgroundColor reads back as
// plain white) — it's the Sheets UI auto-rendering a "chip", which is tied
// to the newer Insert > Dropdown feature rather than classic Data validation
// (this API call). There's currently no known way to set that via Sheets
// API v4; the confirmed workaround is clicking into the cell and re-picking
// the same value once in the Sheets UI, which appears to trigger the color.
export async function setOneOfListValidation(
  sheetId: string,
  rules: { range: CellRange; values: string[] }[]
): Promise<void> {
  const accessToken = await getAccessToken();
  const requests = rules.map(({ range, values }) => ({
    setDataValidation: {
      range,
      rule: {
        condition: {
          type: "ONE_OF_LIST",
          values: values.map((value) => ({ userEnteredValue: value })),
        },
        strict: true,
        showCustomUi: true,
      },
    },
  }));

  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requests }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Google Sheets batchUpdate (setDataValidation) failed: ${res.status} ${await res.text()}`);
}

// Writes values into an exact range (e.g. a single cell like "Campaigns!M24"),
// overwriting whatever is there. USER_ENTERED so a leading "=" is treated as
// a formula, same as appendSheetRow.
export async function updateSheetRange(sheetId: string, range: string, values: string[][]): Promise<void> {
  const accessToken = await getAccessToken();
  const encodedRange = encodeURIComponent(range);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodedRange}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values }),
      cache: "no-store",
    }
  );
  if (!res.ok) throw new Error(`Google Sheets values.update failed: ${res.status} ${await res.text()}`);
}
