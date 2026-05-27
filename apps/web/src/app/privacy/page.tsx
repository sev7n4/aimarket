import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata = { title: "隐私政策" };

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-12 text-sm leading-relaxed text-zinc-400">
        <h1 className="text-2xl font-bold text-white">隐私政策</h1>
        <p className="mt-4">更新日期：2026-05-24</p>
        <p className="mt-4">
          出图宝重视您的隐私。我们收集账户邮箱用于登录、会话与生成记录用于提供服务，
          上传图片仅用于 AI 处理，不会在未经同意的情况下向第三方出售个人数据。
        </p>
        <p className="mt-4">
          您可随时申请注销账户并删除相关数据（功能上线后可在设置中操作）。
        </p>
        <Link href="/" className="mt-10 inline-block text-orange-400">
          ← 返回首页
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
