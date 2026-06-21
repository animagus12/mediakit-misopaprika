"use client"

import { useRef } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { brandsRepository } from "@/repositories"

const brandsData = brandsRepository.get()

export default function Brands() {
  const containerRef = useRef<HTMLDivElement | null>(null)

  const scroll = (offset: number) => {
    containerRef.current?.scrollBy({ left: offset, behavior: "smooth" })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{brandsData.title}</h3>
          <p className="text-sm text-muted-foreground">{brandsData.description}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => scroll(-240)}>
            <ArrowLeft className="size-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => scroll(240)}>
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>

      <CardContent className="space-y-4">
        <div
          ref={containerRef}
          className="flex gap-4 overflow-x-auto pb-2 scrollbar-none scroll-smooth snap-x snap-mandatory"
        >
          {brandsData.brands.map((brand) => (
            <Link
              key={brand.name}
              href={brand.url}
              target="_blank"
              rel="noreferrer"
              className="min-w-[14rem] shrink-0 snap-start"
            >
              <div className="group flex h-full flex-col justify-between rounded-3xl border border-border bg-popover p-5 text-center transition duration-200 ease-out hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <div className={`flex h-20 w-20 items-center justify-center rounded-full text-xl font-semibold text-white mx-auto ${brand.color}`}>
                  {brand.initials}
                </div>
                <div className="text-sm font-medium">{brand.name}</div>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </div>
  )
}
