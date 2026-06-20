import type { ReactNode } from "react"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Separator } from "@/components/ui/separator"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import audienceData from "@/data/audience.json"

function ProgressRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <Progress value={value} className={color} />
          </div>
        </TooltipTrigger>
        <TooltipContent sideOffset={6}>{`${label}: ${value}%`}</TooltipContent>
      </Tooltip>
    </div>
  )
}

function StatRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm text-muted-foreground">{label}</div>
      {children}
    </div>
  )
}

export default function Audience() {
  const data = audienceData

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{data.title}</h3>
          <p className="text-sm text-muted-foreground">{data.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{data.displayName.instagram ?? "Instagram"}</CardTitle>
            <CardDescription>Audience breakdown and top cities</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <StatRow label="Gender">
              <div className="space-y-3">
                <ProgressRow label="Female" value={data.instagram.gender.female} color="" />
                <ProgressRow label="Male" value={data.instagram.gender.male} color="" />
                <ProgressRow label="Other" value={data.instagram.gender.other} color="" />
              </div>
            </StatRow>

            <Separator />

            <StatRow label="Age Ranges">
              <div className="space-y-3">
                {data.instagram.age.map(([from, to, pct]) => (
                  <ProgressRow key={`${from}-${to}`} label={`${from}-${to}`} value={pct} color="" />
                ))}
              </div>
            </StatRow>

            <Separator />

            <StatRow label="Top Locations">
              <div className="space-y-2 text-sm">
                {data.instagram.locations.map(([loc, count]) => (
                  <div key={loc} className="flex items-center justify-between">
                    <span>{loc}</span>
                    <Badge variant="secondary">{count.toLocaleString()}</Badge>
                  </div>
                ))}
              </div>
            </StatRow>

            <Separator />

            <StatRow label="Most Active Times">
              <div className="flex flex-col gap-2 text-sm">
                {data.instagram.peakTimes.map((time) => (
                  <div key={time} className="flex items-center justify-between">
                    <span>{time}</span>
                    <Badge variant="outline">Peak</Badge>
                  </div>
                ))}
              </div>
            </StatRow>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{data.displayName.youtube ?? "YouTube"}</CardTitle>
            <CardDescription>Audience breakdown and top cities</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <StatRow label="Gender">
              <div className="space-y-3">
                <ProgressRow label="Female" value={data.youtube.gender.female} color="" />
                <ProgressRow label="Male" value={data.youtube.gender.male} color="" />
                <ProgressRow label="Other" value={data.youtube.gender.other} color="" />
              </div>
            </StatRow>

            <Separator />

            <StatRow label="Age Ranges">
              <div className="space-y-3">
                {data.youtube.age.map(([from, to, pct]) => (
                  <ProgressRow key={`${from}-${to}`} label={`${from}-${to}`} value={pct} color="" />
                ))}
              </div>
            </StatRow>

            <Separator />

            <StatRow label="Top Locations">
              <div className="space-y-2 text-sm">
                {data.youtube.locations.map(([loc, count]) => (
                  <div key={loc} className="flex items-center justify-between">
                    <span>{loc}</span>
                    <Badge variant="secondary">{count.toLocaleString()}</Badge>
                  </div>
                ))}
              </div>
            </StatRow>

            <Separator />

            <StatRow label="Most Active Times">
              <div className="flex flex-col gap-2 text-sm">
                {data.youtube.peakTimes.map((time) => (
                  <div key={time} className="flex items-center justify-between">
                    <span>{time}</span>
                    <Badge variant="outline">Peak</Badge>
                  </div>
                ))}
              </div>
            </StatRow>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
