import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { BRAND_NAME } from "@/lib/brand";

export const metadata = { title: "常见问题" };

const faqs = [
  {
    q: `${BRAND_NAME} 是什么？`,
    a: "专注电商出图与宣传短视频：主图/套图/详情一键生成，并基于出图产出产品宣传短片。",
  },
  {
    q: "积分如何获取？",
    a: "新用户注册赠送 100 积分；可通过充值套餐、每日签到、邀请好友获得额外积分。",
  },
  {
    q: "生成失败会扣积分吗？",
    a: "任务失败会自动退回本次消耗的积分。",
  },
  {
    q: "支持哪些图片格式？",
    a: "上传支持 JPEG、PNG、WebP；生成结果可导出为链接或下载。",
  },
  {
    q: "如何联系客服？",
    a: "请发送邮件至 support@chutubao.example（上线前替换为正式邮箱）。",
  },
];

export default function FaqPage() {
  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-bold">常见问题</h1>
        <ul className="mt-8 space-y-6">
          {faqs.map((item) => (
            <li key={item.q}>
              <h2 className="font-medium text-zinc-200">{item.q}</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                {item.a}
              </p>
            </li>
          ))}
        </ul>
        <Link href="/" className="mt-10 inline-block text-sm text-orange-400">
          ← 返回首页
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
