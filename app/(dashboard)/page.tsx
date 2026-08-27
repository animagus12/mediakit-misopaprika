import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EarningsOverview } from "@/components/dashboard/EarningsOverview";
import { PaymentsDueCard } from "@/components/dashboard/PaymentsDueCard";
import { CollaborationsSection } from "@/components/dashboard/CollaborationsSection";
import { navEntries } from "@/lib/navigation";
import { earningsRepository } from "@/repositories/earnings";
import { collaborationRepository } from "@/repositories/collaborations";
import { fetchBrandCampaignRecords } from "@/repositories/brandCampaigns";
import { splitCollaborations } from "@/lib/collaborations";
import { selectDuePayments } from "@/lib/brandCampaignStats";

export default async function HomePage() {
  const earnings = await earningsRepository.getSummary().catch(() => null);
  const duePayments = await fetchBrandCampaignRecords()
    .then((records) => selectDuePayments(records))
    .catch(() => []);

  let active: ReturnType<typeof splitCollaborations>["active"] = [];
  let past: ReturnType<typeof splitCollaborations>["past"] = [];
  let collaborationsError: string | null = null;
  try {
    const collaborations = await collaborationRepository.getAll();
    ({ active, past } = splitCollaborations(collaborations));
  } catch (err) {
    collaborationsError = err instanceof Error ? err.message : "Something went wrong";
  }

  return (
    <div className="mx-auto max-w-screen-lg px-4 py-10">
      <div className="mb-6 space-y-1">
        <h1 className="font-heading text-lg font-semibold">Dashboard</h1>
      </div>

      <PaymentsDueCard due={duePayments} className="mb-8" />

      {earnings && <EarningsOverview summary={earnings} />}

      <CollaborationsSection active={active} past={past} error={collaborationsError} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {navEntries.map(({ href, title, description, Icon, access }) => (
          <Link key={href} href={href} className="group">
            <Card className="h-full transition hover:ring-foreground/20">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon className="size-4 text-muted-foreground" />
                    <CardTitle>{title}</CardTitle>
                  </div>
                  <ArrowUpRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
              <CardContent>
                {access === "public" ? (
                  <Badge variant="outline">Public</Badge>
                ) : (
                  <Badge variant="secondary">Password protected</Badge>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
