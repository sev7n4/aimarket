import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata = {
  title: "关于我们",
};

export default function AboutPage() {
  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-3xl font-bold">AI 修图，就用 AIMarket</h1>
        <p className="mt-4 leading-relaxed text-zinc-400">
          我们相信强大的工具应当隐于无形。无论是人像精修、电商海报，还是创意合成，
          您只需用中文描述需求，我们将繁琐的后期流程凝练为「所想即所得」的流畅体验。
        </p>
        <h2 className="mt-10 text-xl font-semibold">多模型智能路由</h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          系统会分析任务意图，在多种图像大模型之间动态调度，在效果、速度与成本之间寻找最佳平衡。
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
