import { ChevronDown } from "lucide-react";
import { Badge, type badgeVariants } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { VariantProps } from "class-variance-authority";
import type { Collaboration } from "@/repositories/collaborations";
import { computeCollaborationStats } from "@/lib/collaborations";
import { formatMoney } from "@/lib/invoice";
import { NewCollaborationButton } from "./NewCollaborationButton";

function statusVariant(status: string): VariantProps<typeof badgeVariants>["variant"] {
  switch (status.toLowerCase()) {
    case "completed":
      return "default";
    case "cancelled":
      return "destructive";
    case "todo":
    case "brainstorming":
      return "outline";
    default:
      return "secondary";
  }
}

interface CollaborationsSectionProps {
  active: Collaboration[];
  past: Collaboration[];
  error?: string | null;
}

export function CollaborationsSection({ active, past, error }: CollaborationsSectionProps) {
  if (error) {
    return (
      <section className="mb-8">
        <SectionHeader />
        <Card>
          <CardContent className="py-6 text-xs text-muted-foreground">
            Couldn&apos;t load collaborations from Google Sheets — {error}
          </CardContent>
        </Card>
      </section>
    );
  }

  const stats = computeCollaborationStats([...active, ...past]);

  return (
    <section className="mb-8 space-y-4">
      <SectionHeader />

      {stats.total > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardDescription>Total collaborations</CardDescription>
              <CardTitle className="text-lg">{stats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Paid collaborations</CardDescription>
              <CardTitle className="text-lg">{stats.paid}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Barter collaborations</CardDescription>
              <CardTitle className="text-lg">{stats.barter}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Highest-value collaboration</CardDescription>
              <CardTitle className="text-lg">
                {stats.highestValue ? formatMoney(stats.highestValue.total) : "—"}
              </CardTitle>
              {stats.highestValue && (
                <p className="truncate text-xs text-muted-foreground">
                  {stats.highestValue.brand}
                </p>
              )}
            </CardHeader>
          </Card>
        </div>
      )}

      {active.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-xs text-muted-foreground">
            No active or upcoming collaborations right now.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((collab) => (
            <Card key={collab.id} size="sm">
              <CardContent className="space-y-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-heading text-sm font-medium">
                    {collab.brand}
                  </span>
                  <Badge variant={statusVariant(collab.status)}>{collab.status}</Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="truncate">{collab.reels || "No reels"}</span>
                  <span className="truncate">{collab.story || "No story"}</span>
                  {collab.date && <span className="ml-auto shrink-0 whitespace-nowrap">{collab.date}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {past.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="group/trigger flex w-full items-center justify-between rounded-md border border-border px-4 py-2 text-xs font-medium text-muted-foreground transition hover:bg-muted">
            Past collaborations ({past.length})
            <ChevronDown className="size-3.5 transition group-data-[state=open]/trigger:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 overflow-hidden rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead>Brand</TableHead>
                  <TableHead>Reels</TableHead>
                  <TableHead>Story</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {past.map((collab) => (
                  <TableRow key={collab.id}>
                    <TableCell className="max-w-40 truncate font-medium">{collab.brand}</TableCell>
                    <TableCell className="text-muted-foreground">{collab.reels || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{collab.story || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{collab.date || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(collab.status)}>{collab.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CollapsibleContent>
        </Collapsible>
      )}
    </section>
  );
}

function SectionHeader() {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="space-y-1">
        <h2 className="font-heading text-sm font-semibold">Collaborations</h2>
      </div>
      <NewCollaborationButton />
    </div>
  );
}
