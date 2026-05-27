import { BRAND_SLOGAN } from "@/lib/brand";

export function HeroSection() {
  return (
    <section className="relative px-4 pb-6 pt-8 text-center">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top_right,rgba(249,115,22,0.25),transparent_55%)]"
        aria-hidden
      />
      <div className="relative mx-auto max-w-2xl">
        <h1 className="text-balance text-xl font-semibold leading-snug tracking-tight text-zinc-100 sm:text-2xl md:text-3xl">
          {BRAND_SLOGAN}
        </h1>
      </div>
    </section>
  );
}
