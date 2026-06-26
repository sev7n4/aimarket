"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2, Package } from "lucide-react";
import {
  fetchMarketplaceSkills,
  type MarketplaceSkill,
} from "@/lib/api-client";

export function MarketplaceGallery() {
  const [skills, setSkills] = useState<MarketplaceSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<MarketplaceSkill | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchMarketplaceSkills({ pageSize: 50 });
      setSkills(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-500">
        <Loader2 className="mr-2 size-5 animate-spin" />
        加载中...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded border border-rose-500/20 bg-rose-500/[0.04] p-4 text-sm text-rose-300">
        {error}
      </div>
    );
  }

  if (skills.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
        <Package className="mb-3 size-10 opacity-40" />
        <p className="text-sm">市场暂无已发布的 Skill</p>
        <p className="mt-1 text-xs text-zinc-600">
          创作者可在 Studio 中提交 Skill 上架
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {skills.map((skill) => (
          <button
            key={skill.id}
            type="button"
            onClick={() => setSelected(skill)}
            className="group flex flex-col rounded-lg border border-white/10 bg-white/[0.02] p-4 text-left transition hover:border-emerald-400/30 hover:bg-white/[0.04]"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                {skill.category}
              </span>
              <span className="text-[10px] text-zinc-600">v{skill.version}</span>
            </div>
            <h3 className="mb-1 font-medium text-zinc-200 group-hover:text-emerald-300">
              {skill.name}
            </h3>
            <p className="line-clamp-2 text-xs text-zinc-500">
              {skill.description || "无描述"}
            </p>
            <div className="mt-3 flex items-center gap-3 text-[10px] text-zinc-600">
              <span>{skill.installCount} 次安装</span>
              <span className="flex items-center gap-0.5 text-emerald-400/60">
                <ExternalLink className="size-3" />
                查看详情
              </span>
            </div>
          </button>
        ))}
      </div>

      {selected ? (
        <MarketplaceSkillDetail
          skill={selected}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </>
  );
}

function MarketplaceSkillDetail({
  skill,
  onClose,
}: {
  skill: MarketplaceSkill;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(skill.skillYaml).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [skill.skillYaml]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-white/10 bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-white/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
              {skill.category}
            </span>
            <span className="text-[10px] text-zinc-600">v{skill.version}</span>
            <span className="text-[10px] text-zinc-600">
              {skill.installCount} 次安装
            </span>
            <button
              type="button"
              onClick={onClose}
              className="ml-auto text-zinc-500 hover:text-zinc-300"
            >
              ✕
            </button>
          </div>
          <h2 className="text-lg font-bold text-zinc-100">{skill.name}</h2>
          {skill.description ? (
            <p className="mt-1 text-sm text-zinc-400">{skill.description}</p>
          ) : null}
        </div>
        <div className="flex-1 overflow-auto p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Skill YAML</span>
            <button
              type="button"
              onClick={handleCopy}
              className="rounded bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-300 hover:bg-emerald-500/20"
            >
              {copied ? "已复制 ✓" : "复制 YAML"}
            </button>
          </div>
          <pre className="overflow-auto rounded border border-white/5 bg-black/40 p-3 text-[11px] leading-relaxed text-zinc-300">
            <code>{skill.skillYaml}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
