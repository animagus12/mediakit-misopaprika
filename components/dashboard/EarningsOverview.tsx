import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/invoice";
import type { EarningsSummary } from "@/repositories/earnings";

function monthLabel(month: string): string {
  const [year, monthNum] = month.split("-");
  const date = new Date(Number(year), Number(monthNum) - 1, 1);
  return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

export function EarningsOverview({ summary }: { summary: EarningsSummary }) {
  const stats = [
    { label: "Lifetime earnings", value: summary.total },
    { label: "Cash received", value: summary.paid },
    { label: "Barter value received", value: summary.barter },
    { label: "Pending payments", value: summary.pending },
  ];

  return (
    <section className="mb-8 space-y-3">
      <h2 className="font-heading text-sm font-semibold">Earnings overview</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value }) => (
          <Card key={label}>
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-lg">{formatMoney(value)}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      {summary.monthly.length > 0 && (
        <Card>
          <CardHeader className="gap-3">
            <CardDescription>Monthly breakdown</CardDescription>
            <div className="text-xs">
              <div className="grid grid-cols-5 gap-2 border-b border-foreground/10 pb-2 text-muted-foreground">
                <span>Month</span>
                <span className="text-right">Cash</span>
                <span className="text-right">Barter</span>
                <span className="text-right">Pending</span>
                <span className="text-right">Total</span>
              </div>
              {summary.monthly.map((m) => (
                <div key={m.month} className="grid grid-cols-5 gap-2 py-1.5">
                  <span className="text-muted-foreground">{monthLabel(m.month)}</span>
                  <span className="text-right">{formatMoney(m.paid)}</span>
                  <span className="text-right">{formatMoney(m.barter)}</span>
                  <span className="text-right">{formatMoney(m.pending)}</span>
                  <span className="text-right font-medium">{formatMoney(m.total)}</span>
                </div>
              ))}
            </div>
          </CardHeader>
        </Card>
      )}
    </section>
  );
}
