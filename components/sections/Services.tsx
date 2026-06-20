"use client"

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { CheckCircle2 } from "lucide-react"
import servicesData from "@/data/services.json"

export default function Services() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{servicesData.title}</h3>
          <p className="text-sm text-muted-foreground">{servicesData.description}</p>
        </div>
      </div>

      <Card className="rounded-lg">
        <CardContent className="space-y-6 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {servicesData.packages.map((pkg) => (
              <Card
                key={pkg.name}
                className={`rounded-3xl border-2 transition-all flex flex-col ${
                  pkg.isPopular ? "border-purple-500 shadow-lg ring-2 ring-purple-500/30 scale-[1.02]" : "border-border/50 hover:border-border"
                }`}
              >
                <CardHeader className="space-y-3 pb-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className={`text-2xl leading-tight wrap-break-word ${pkg.color.replace("bg-", "text-")}`}>{pkg.name}</CardTitle>
                    </div>
                    {pkg.isPopular && (
                      <Badge className="shrink-0 bg-purple-500 text-white whitespace-nowrap text-xs">Most Popular</Badge>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="text-3xl font-bold text-foreground wrap-break-word">{pkg.price}</div>
                    <CardDescription>{pkg.description}</CardDescription>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 flex-1 flex flex-col">
                  <Separator />
                  <div className="space-y-3 flex-1">
                    {pkg.features.map((feature, idx) => (
                      <div key={idx} className="flex gap-3">
                        <CheckCircle2 className="size-4 shrink-0 text-emerald-500 mt-0.5" />
                        <span className="text-sm text-foreground/80">{feature}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="text-lg font-semibold mb-4">ADD-ONS</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {servicesData.addOns.map((addon, idx) => (
                  <Card key={idx} className="rounded-2xl border-border/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">{addon.category}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {addon.items.map((item, itemIdx) => (
                        <div key={itemIdx} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-foreground/60">•</span>
                          <span>{item}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4 bg-muted/30 rounded-2xl p-4">
            <div>
              <h4 className="text-base font-semibold mb-3">TERMS & CONDITIONS</h4>
              <ul className="space-y-2">
                {servicesData.terms.map((term, idx) => (
                  <li key={idx} className="text-sm text-foreground/80 flex gap-2">
                    <span className="text-foreground/50">•</span>
                    <span>{term}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Separator />

            <div>
              <h4 className="text-base font-semibold mb-3">DEFINITIONS</h4>
              <ul className="space-y-2">
                {servicesData.definitions.map((def, idx) => (
                  <li key={idx} className="text-sm text-foreground/80 flex gap-2">
                    <span className="text-foreground/50">•</span>
                    <span>{def}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
