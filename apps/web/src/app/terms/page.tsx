import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata = { title: "服务条款" };

export default function TermsPage() {
  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-12 text-sm leading-relaxed text-zinc-400">
        <h1 className="text-2xl font-bold text-white">服务条款</h1>
        <p className="mt-4">更新日期：2026-05-24</p>
        <p className="mt-4">
          使用 AIMarket 即表示您同意遵守本条款。生成内容由 AI 产出，您需自行确保
          不侵犯他人知识产权、肖像权与商标权，并符合当地法律法规。
        </p>
        <p className="mt-4">
          积分一经用于成功完成的任务不予退还；失败任务将按产品规则退回积分。
          我们保留在违规使用时暂停或终止账户的权利。
        </p>
        <Link href="/" className="mt-10 inline-block text-orange-400">
          ← 返回首页
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
