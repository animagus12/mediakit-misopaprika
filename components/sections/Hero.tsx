import Image from "next/image"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { heroRepository } from "@/repositories"

const heroData = heroRepository.get()

export default function Hero() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{heroData.title}</h3>
          <p className="text-sm text-muted-foreground">{heroData.subtitle}</p>
        </div>
      </div>

      <Card className="rounded-lg">
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-muted flex-shrink-0">
              <Image
                src={heroData.image.src}
                alt={heroData.image.alt}
                width={heroData.image.width}
                height={heroData.image.height}
                className="object-cover"
              />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{heroData.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              {heroData.buttonText}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
