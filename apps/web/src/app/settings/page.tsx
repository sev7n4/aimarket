"use client";

import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { GlassPanel, Button } from "@aimarket/ui";
import { fetchBrandKit, fetchProviderStatus, saveBrandKit } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const [brandName, setBrandName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#f97316");
  const [secondaryColor, setSecondaryColor] = useState("#a855f7");
  const [logoUrl, setLogoUrl] = useState("");
  const [fontHint, setFontHint] = useState("");
  const [provider, setProvider] = useState<string>("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchBrandKit().then((kit) => {
      if (!kit) return;
      setBrandName((kit.brand_name as string) ?? "");
      setPrimaryColor((kit.primary_color as string) ?? "#f97316");
      setSecondaryColor((kit.secondary_color as string) ?? "#a855f7");
      setLogoUrl((kit.logo_url as string) ?? "");
      setFontHint((kit.font_hint as string) ?? "");
    });
    fetchProviderStatus().then((p) =>
      setProvider(
        `${p.activeProvider} · ${p.hint ?? ""}（模式: ${p.mode}，Key: ${p.openaiConfigured ? "已配置" : "未配置"}）`,
      ),
    );
  }, [user]);

  async function handleSave() {
    await saveBrandKit({
      brandName: brandName || undefined,
      primaryColor,
      secondaryColor,
      logoUrl: logoUrl || undefined,
      fontHint: fontHint || undefined,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="mx-auto max-w-lg px-4 py-12">
        <GlassPanel className="p-6">
          <h1 className="text-xl font-semibold">品牌 Kit</h1>
          <p className="mt-1 text-sm text-zinc-500">
            生成电商素材时将参考品牌色与 Logo（Phase 4）
          </p>
          {provider ? (
            <p className="mt-2 text-xs text-orange-400/80">
              当前图像引擎：{provider}
            </p>
          ) : null}

          {!loading && !user ? (
            <p className="mt-6 text-sm text-zinc-500">请先登录</p>
          ) : (
            <form
              className="mt-6 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void handleSave();
              }}
            >
              <Field label="品牌名称">
                <input
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="input-field"
                  placeholder="AIMarket Store"
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="主色">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-10 w-full cursor-pointer rounded-lg border border-white/10 bg-transparent"
                  />
                </Field>
                <Field label="辅色">
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="h-10 w-full cursor-pointer rounded-lg border border-white/10 bg-transparent"
                  />
                </Field>
              </div>
              <Field label="Logo URL">
                <input
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="input-field"
                  placeholder="https://..."
                />
              </Field>
              <Field label="字体偏好">
                <input
                  value={fontHint}
                  onChange={(e) => setFontHint(e.target.value)}
                  className="input-field"
                  placeholder="思源黑体 / 无衬线"
                />
              </Field>
              <Button type="submit" variant="primary" className="w-full">
                {saved ? "已保存" : "保存品牌 Kit"}
              </Button>
            </form>
          )}
          <Link href="/studio" className="mt-6 inline-block text-sm text-zinc-500 hover:text-white">
            ← 返回创作页
          </Link>
        </GlassPanel>
      </main>
      <SiteFooter />
      <style jsx global>{`
        .input-field {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(0, 0, 0, 0.4);
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs text-zinc-500">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
