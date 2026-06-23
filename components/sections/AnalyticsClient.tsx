"use client"

import { useState } from "react"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { ChevronDown } from "lucide-react"
import { FaInstagram, FaYoutube } from "react-icons/fa"
import type { AnalyticsData } from "@/repositories"

type Range = 14 | 30 | 60

function fmt(n: number) {
  return n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
    ? `${(n / 1_000).toFixed(1)}k`
    : `${n}`
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex flex-col cursor-help">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className="text-lg font-medium">{value}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent sideOffset={6}>{hint ?? String(value)}</TooltipContent>
    </Tooltip>
  )
}

export default function AnalyticsClient({ data }: { data: AnalyticsData }) {
  const ranges = data.ranges as Range[]
  const [range, setRange] = useState<Range>(30)

  const ig = data.platforms.instagram.byRange[range]
  const yt = data.platforms.youtube.byRange[range]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{data.title}</h3>
          <p className="text-sm text-muted-foreground">{data.description}</p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              {range} days <ChevronDown className="ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {ranges.map((r) => (
              <DropdownMenuItem key={r} onSelect={() => setRange(r)}>
                {r} days
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-gradient-to-br from-pink-500 to-yellow-400 text-white">
                <FaInstagram className="size-5" />
              </div>
              <div>
                <div className="text-sm font-medium">{data.platforms.instagram.displayName}</div>
                <div className="text-xs text-muted-foreground">{data.platforms.instagram.description}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Stat label="Total Views" value={fmt(ig.totalViews)} />
              <Stat label="Accounts Reached" value={fmt(ig.accountsReached)} />
              <Stat label="Engagement %" value={`${ig.engagementPct}%`} />
              <Stat label="Avg Views" value={fmt(ig.avgViews)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-red-600 text-white">
                <FaYoutube className="size-5" />
              </div>
              <div>
                <div className="text-sm font-medium">{data.platforms.youtube.displayName}</div>
                <div className="text-xs text-muted-foreground">{data.platforms.youtube.description}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Stat label="Total Views" value={fmt(yt.totalViews)} />
              <Stat label="Subscribers" value={fmt(yt.accountsReached)} />
              <Stat label="Engagement %" value={`${yt.engagementPct}%`} />
              <Stat label="Avg Views" value={fmt(yt.avgViews)} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
