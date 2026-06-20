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
        <section id="hero">
          <Hero />
        </section>

        <section id="analytics">
          <Analytics />
        </section>

        <section id="audience">
          <Audience />
        </section>

        <section id="brands">
          <Brands />
        </section>

        <section id="services">
          <Services />
        </section>

        <section id="videos">
          <Videos />
        </section>

        <section id="contact">
          <Contact />
        </section>
      </div>
    </div>
  )
}
