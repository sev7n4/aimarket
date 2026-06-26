import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { MarketplaceGallery } from "@/components/marketplace-gallery";

export const metadata = {
  title: "Skill 市场",
};

export default function MarketplacePage() {
  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-100">Skill 市场</h1>
          <p className="mt-1 text-sm text-zinc-500">
            浏览社区创作者上架的 Skill 模板，复制 YAML 即可使用
          </p>
        </div>
        <MarketplaceGallery />
      </main>
      <SiteFooter />
    </div>
  );
}
