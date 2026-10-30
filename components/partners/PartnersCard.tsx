import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toSheetDate } from "@/lib/campaigns";
import { formatMoney } from "@/lib/invoice";
import { debtLabel, settleUpLabel, type PartnerSummary } from "@/lib/partners";
import { PARTNERS, payerLabel } from "@/lib/payers";
import type { PartnerTransferRecord } from "@/repositories/partnerTransfers";
import { DeleteSettleUpButton, SettleCostButtons, SettleUpButton } from "./PartnerActions";

const ROW = "min-w-0 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs";

interface PartnersCardProps {
  summary: PartnerSummary;
  settleUps: PartnerTransferRecord[];
}

/**
 * What the two partners have paid for the business personally, who owes whom
 * because of it, the costs still to settle, and the settle-ups so far. All
 * time, whatever year the page is showing: a balance doesn't reset in April.
 */
export function PartnersCard({ summary, settleUps }: PartnersCardProps) {
  const history = [...settleUps].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const firstDebt = summary.debts[0];

  return (
    <Card id="partners" className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="text-base">Partners</CardTitle>
        <CardDescription>
          {PARTNERS.map((partner) => payerLabel(partner)).join(" and ")} share the business 50/50. A cost one of you
          paid personally is repaid from business funds or split equally; this keeps count of who is owed what, across
          every year.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="min-w-0 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Paid personally</p>
            <ul className="space-y-1.5 text-sm">
              {summary.paid.map((entry) => (
                <li key={entry.partner} className="flex min-w-0 items-baseline justify-between gap-3">
                  <span className="truncate">{payerLabel(entry.partner)}</span>
                  <span className="shrink-0 tabular-nums">{formatMoney(entry.amount)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="min-w-0 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Owed right now</p>
            {summary.debts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Everyone is square.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {summary.debts.map((debt) => (
                  <li key={`${debt.from}-${debt.to}`} className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0">
                      {debtLabel(debt)}{" "}
                      <span className="font-medium whitespace-nowrap tabular-nums">{formatMoney(debt.amount)}</span>
                    </span>
                    <SettleUpButton defaults={{ from: debt.from, to: debt.to, amount: debt.amount }} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {summary.toSettle.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              To settle ({summary.toSettle.length}): paid personally, not yet marked to repay or split
            </p>
            <ul className="space-y-2">
              {summary.toSettle.map((cost) => (
                <li key={`${cost.source}-${cost.id}`} className={`${ROW} space-y-2`}>
                  <div className="space-y-0.5">
                    <div className="flex min-w-0 items-baseline justify-between gap-2">
                      <span className="truncate font-medium">{cost.description}</span>
                      <span className="shrink-0 font-medium tabular-nums">{formatMoney(cost.amount)}</span>
                    </div>
                    <p className="truncate text-muted-foreground">
                      {[toSheetDate(cost.date), `Paid by ${payerLabel(cost.paidBy)}`, cost.detail].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <SettleCostButtons
                    cost={{ source: cost.source, id: cost.id, label: cost.description, settlement: cost.settlement }}
                    paidBy={cost.paidBy}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}

        <Collapsible>
          <CollapsibleTrigger className="group/section flex w-full items-center justify-between rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition pointer-coarse:min-h-11 hover:bg-muted">
            Settle-ups ({history.length})
            <ChevronDown className="size-3.5 transition group-data-[state=open]/section:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-2">
            {history.length === 0 ? (
              <p className="text-xs text-muted-foreground">No settle-ups recorded yet.</p>
            ) : (
              <ul className="space-y-2">
                {history.map((settleUp) => (
                  <li key={settleUp.id} className={`${ROW} flex items-start gap-2`}>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex min-w-0 items-baseline justify-between gap-2">
                        <span className="truncate">{settleUpLabel(settleUp)}</span>
                        <span className="shrink-0 font-medium tabular-nums">{formatMoney(settleUp.amount)}</span>
                      </div>
                      <p className="truncate text-muted-foreground">
                        {[toSheetDate(settleUp.date), settleUp.note].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <DeleteSettleUpButton id={settleUp.id} label={settleUpLabel(settleUp)} />
                  </li>
                ))}
              </ul>
            )}
            <SettleUpButton
              label="Record a settle-up"
              variant="ghost"
              defaults={firstDebt ? { from: firstDebt.from, to: firstDebt.to, amount: firstDebt.amount } : { from: "business", to: "subhrajit", amount: 0 }}
            />
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
