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

function fmt(n: number) {
  return n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
    ? `${(n / 1_000).toFixed(1)}k`
    : `${n}`
}

export default function AnalyticsClient({ data }: { data: AnalyticsData }) {
  const ranges = data.ranges
  const [range, setRange] = useState(ranges[0])

  const base = data.platforms
  const mul = range / data.ranges[0]

  const ig = {
    totalViews: Math.round(base.instagram.totalViews * mul),
    accountsReached: Math.round(base.instagram.accountsReached * mul),
    engagementPct: +(base.instagram.engagementPct * (1 + (mul - 1) * 0.05)).toFixed(1),
    avgViews: Math.round(base.instagram.avgViews * mul),
  }

  const yt = {
    totalViews: Math.round(base.youtube.totalViews * mul),
    accountsReached: Math.round(base.youtube.accountsReached * mul),
    engagementPct: +(base.youtube.engagementPct * (1 + (mul - 1) * 0.04)).toFixed(1),
    avgViews: Math.round(base.youtube.avgViews * mul),
  }

  const Stat = ({ label, value, hint }: { label: string; value: string | number; hint?: string }) => (
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
          <CardHeader>
            <CardTitle>{base.instagram.displayName}</CardTitle>
            <CardDescription>Last {range} days</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-gradient-to-br from-pink-500 to-yellow-400 text-white">
                <FaInstagram className="size-5" />
              </div>
              <div>
                <div className="text-sm font-medium">{base.instagram.displayName}</div>
                <div className="text-xs text-muted-foreground">{base.instagram.description}</div>
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
          <CardHeader>
            <CardTitle>{base.youtube.displayName}</CardTitle>
            <CardDescription>Last {range} days</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-red-600 text-white">
                <FaYoutube className="size-5" />
              </div>
              <div>
                <div className="text-sm font-medium">{base.youtube.displayName}</div>
                <div className="text-xs text-muted-foreground">{base.youtube.description}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Stat label="Total Views" value={fmt(yt.totalViews)} />
              <Stat label="Accounts Reached" value={fmt(yt.accountsReached)} />
              <Stat label="Engagement %" value={`${yt.engagementPct}%`} />
              <Stat label="Avg Views" value={fmt(yt.avgViews)} />
            </div>
          </CardContent>
        </Card>
    </div>
    </div>
  )
}
