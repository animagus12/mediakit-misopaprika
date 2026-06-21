"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { Heart, MessageCircle, Share2, Bookmark, ChevronRight, ChevronLeft } from "lucide-react"
import { FaInstagram, FaYoutube } from "react-icons/fa"
import { videosRepository } from "@/repositories"

const videosData = videosRepository.get()

function metric(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : `${value}`
}

const iconMap: Record<string, React.ReactNode> = {
  instagram: <FaInstagram className="size-4" />,
  youtube: <FaYoutube className="size-4" />,
}

function VideoSection({
  title,
  icon,
  videos,
  expanded,
  onToggle,
}: {
  title: string
  icon: React.ReactNode
  videos: Array<{
    title: string
    url: string
    duration: string
    likes: number
    comments: number
    shares: number
    saves: number
    color: string
  }>
  expanded: boolean
  onToggle: () => void
}) {
  const visibleVideos = expanded ? videos : videos.slice(0, 3)

  return (
    <Card className="rounded-lg">
      <CardHeader className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{expanded ? `Showing ${videos.length} videos` : "Showing top 3 videos"}</CardDescription>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={onToggle}
          aria-label={expanded ? `Show less ${title} videos` : `Show more ${title} videos`}
        >
          {expanded ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {visibleVideos.map((video) => (
            <Link
              key={video.title}
              href={video.url}
              target="_blank"
              rel="noreferrer"
              className="group block overflow-hidden rounded-3xl border border-border bg-popover transition duration-200 ease-out hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="relative aspect-[9/16] overflow-hidden bg-slate-900">
                <div className={`absolute inset-0 bg-gradient-to-br ${video.color} opacity-80`} />
                <div className="absolute inset-0 bg-black/40" />
                <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/70 to-transparent" />

                <div className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white">
                  {icon}
                </div>

                <div className="absolute left-3 top-3 space-y-2 text-[0.7rem] text-white">
                  <div className="flex items-center gap-2 rounded-full bg-black/50 px-2 py-1">
                    <Heart className="size-3" />
                    <span>{metric(video.likes)}</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-black/50 px-2 py-1">
                    <MessageCircle className="size-3" />
                    <span>{metric(video.comments)}</span>
                  </div>
                </div>

                <div className="absolute left-3 bottom-3 right-3 flex flex-wrap gap-2 text-[0.7rem] text-white">
                  <div className="flex items-center gap-1 rounded-full bg-black/50 px-2 py-1">
                    <Share2 className="size-3" />
                    <span>{metric(video.shares)}</span>
                  </div>
                  <div className="flex items-center gap-1 rounded-full bg-black/50 px-2 py-1">
                    <Bookmark className="size-3" />
                    <span>{metric(video.saves)}</span>
                  </div>
                </div>

                <div className="absolute right-3 bottom-3 rounded-full bg-white/10 px-2 py-1 text-[0.65rem] text-white backdrop-blur-sm">
                  {video.duration}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default function Videos() {
  const [instagramExpanded, setInstagramExpanded] = useState(false)
  const [youtubeExpanded, setYoutubeExpanded] = useState(false)

  const sections = videosData.sections

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{videosData.title}</h3>
          <p className="text-sm text-muted-foreground">{videosData.description}</p>
        </div>
      </div>

      {sections.map((section) => (
        <VideoSection
          key={section.platform}
          title={section.platform}
          icon={iconMap[section.icon] ?? <FaInstagram className="size-4" />}
          videos={section.videos}
          expanded={section.platform === "Instagram" ? instagramExpanded : youtubeExpanded}
          onToggle={() =>
            section.platform === "Instagram"
              ? setInstagramExpanded((current) => !current)
              : setYoutubeExpanded((current) => !current)
          }
        />
      ))}
    </div>
  )
}
