import Analytics from "@/components/sections/Analytics";
import Audience from "@/components/sections/Audience";
import Brands from "@/components/sections/Brands";
import Hero from "@/components/sections/Hero";
import Videos from "@/components/sections/Videos";
import Services from "@/components/sections/Services";
import Contact from "@/components/sections/Contact";

export default function HomePage() {
  return (
    <div className="max-w-screen-2xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section id="hero" className="scroll-mt-16">
          <Hero />
        </section>

        <section id="analytics" className="scroll-mt-16">
          <Analytics />
        </section>

        <section id="audience" className="scroll-mt-16">
          <Audience />
        </section>

        <section id="brands" className="scroll-mt-16">
          <Brands />
        </section>

        <section id="services" className="scroll-mt-16">
          <Services />
        </section>

        <section id="videos" className="scroll-mt-16">
          <Videos />
        </section>

        <section id="contact" className="scroll-mt-16">
          <Contact />
        </section>
      </div>
    </div>
  )
}
