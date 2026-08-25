import Link from "next/link";
import { ArrowUpRight, FileText, Sparkles, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface EndpointEntry {
  href: string;
  title: string;
  description: string;
  Icon: LucideIcon;
  access: "public" | "protected";
}

const endpoints: EndpointEntry[] = [
  {
    href: "/mediakit",
    title: "Media kit",
    description: "Public, shareable view of your published media kit.",
    Icon: UserRound,
    access: "public",
  },
  {
    href: "/mediakit-generator",
    title: "Media kit generator",
    description: "Edit and publish the content shown on your media kit.",
    Icon: Sparkles,
    access: "protected",
  },
  {
    href: "/invoice-generator",
    title: "Invoice generator",
    description: "Create and export invoices for brand collaborations.",
    Icon: FileText,
    access: "protected",
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-screen-lg py-10">
      <div className="mb-6 space-y-1">
        <h1 className="font-heading text-lg font-semibold">Dashboard</h1>
        <p className="text-xs text-muted-foreground">
          Everything you can get to from here.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {endpoints.map(({ href, title, description, Icon, access }) => (
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
                <Badge variant={access === "public" ? "outline" : "secondary"}>
                  {access === "public" ? "Public" : "Password protected"}
                </Badge>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
