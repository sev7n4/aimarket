import { BRAND_NAME, BRAND_SLOGAN } from "@/lib/brand";

export function HeroSection() {
  return (
    <section className="relative px-4 pb-8 pt-10 text-center">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top_right,rgba(249,115,22,0.25),transparent_55%)]"
        aria-hidden
      />
      <div className="relative mx-auto max-w-3xl">
        <div className="mx-auto mb-6 flex size-28 items-center justify-center rounded-full bg-gradient-to-br from-orange-500/20 to-purple-600/20 ring-1 ring-white/10">
          <span className="text-5xl" role="img" aria-label="品牌吉祥物">
            ✨
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
          {BRAND_NAME}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-base text-zinc-400 sm:text-lg">
          {BRAND_SLOGAN}
        </p>
      </div>
    </section>
  );
}
