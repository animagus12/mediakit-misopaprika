import { type NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { resolveFinancialYearParam } from "@/lib/financialYear";
import { filterEntries, moneyYears, parseMoneyFlow } from "@/lib/moneyBook";
import { moneyCsv, moneyCsvFilename } from "@/lib/moneyCsv";
import { getMoneyBook } from "@/repositories/paymentBook.server";

/**
 * GET ?fy=2026&flow=in: the Payments page's list as a CSV download, filtered
 * exactly as the page filters it (same years, same directions), so the file
 * holds what was on screen.
 */
export async function GET(request: NextRequest) {
  if (!(await verifySessionToken(request.cookies.get(COOKIE_NAME)?.value))) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const book = await getMoneyBook();
    const params = request.nextUrl.searchParams;
    const fy = resolveFinancialYearParam(params.get("fy") ?? undefined, moneyYears(book.entries));
    const flow = parseMoneyFlow(params.get("flow"));
    const csv = moneyCsv(filterEntries(book.entries, { flow, fy }));
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${moneyCsvFilename(fy, flow)}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Payments export failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Couldn't export the payments." },
      { status: 500 }
    );
  }
}
