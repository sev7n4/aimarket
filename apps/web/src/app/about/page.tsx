import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { BRAND_NAME, BRAND_SLOGAN } from "@/lib/brand";

export const metadata = {
  title: "关于我们",
};

export default function AboutPage() {
  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-3xl font-bold">{BRAND_NAME}</h1>
        <p className="mt-2 text-lg text-orange-400/90">{BRAND_SLOGAN}</p>
        <p className="mt-4 leading-relaxed text-zinc-400">
          我们专注电商上架场景：先用中文完成主图、套图与详情出图，再基于同一项目内的商品图
          生成产品宣传短视频。不做泛修图，不做娱乐 AIGC——只为卖家更快上架。
        </p>
        <h2 className="mt-10 text-xl font-semibold">出图 → 短视频</h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          套图与主图落在 Project 画布上，精修满意后一键生成风格一致的宣传短片，
          系统按任务意图在图像与视频模型间智能调度。
        </p>
        <Link
          href="/"
          className="mt-10 inline-block text-sm text-orange-400 hover:underline"
        >
          ← 返回首页
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
