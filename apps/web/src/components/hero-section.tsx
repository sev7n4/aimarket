import { BrandLogo } from "@/components/brand-logo";

export function HeroSection() {
  return (
    <section className="relative px-4 pb-8 pt-10 text-center">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top_right,rgba(249,115,22,0.25),transparent_55%)]"
        aria-hidden
      />
      <div className="relative mx-auto flex max-w-3xl justify-center">
        <BrandLogo
          variant="lockup"
          markSize="lg"
          promoteHeading
          className="text-left"
        />
      </div>
    </section>
  );
}
