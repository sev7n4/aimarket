"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Package, Download, Tag } from "lucide-react";
import { getInstalledSkillIds } from "@/lib/installed-skills";

// ─── 类型定义 ─────────────────────────────

interface MarketplaceSkillItem {
  id: string;
  skillId: string;
  name: string;
  description: string;
  version: number;
  createdAt: string;
}

// ─── API 调用 ─────────────────────────────

async function fetchSkillMarketplace(opts?: {
  pageNum?: number;
  pageSize?: number;
}) {
  const { resolveApiBase } = await import("@/lib/api-base");
  const { getToken } = await import("@/lib/api-client");
  const API_BASE = resolveApiBase();
  const token = getToken();

  const params = new URLSearchParams();
  if (opts?.pageNum) params.set("pageNum", String(opts.pageNum));
  if (opts?.pageSize) params.set("pageSize", String(opts.pageSize));

  const res = await fetch(
    `${API_BASE}/api/v1/skills/marketplace?${params.toString()}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  );
  const json = await res.json();
  if (!res.ok) throw new Error((json as { error?: { message?: string } }).error?.message ?? "请求失败");
  return json as {
    data: MarketplaceSkillItem[];
    total: number;
    pageNum: number;
    pageSize: number;
  };
}

async function installSkill(skillId: string, skillYaml?: string) {
  const { installSkillToStudio } = await import("@/lib/installed-skills");
  installSkillToStudio(skillId, skillYaml);
}

// ─── 组件 ─────────────────────────────

interface SkillMarketplaceProps {
  /** 安装回调 */
  onInstall?: (skillId: string) => void;
}

export function SkillMarketplace({ onInstall }: SkillMarketplaceProps) {
  const [skills, setSkills] = useState<MarketplaceSkillItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [total, setTotal] = useState(0);

  // 加载已安装列表
  useEffect(() => {
    setInstalled(new Set(getInstalledSkillIds()));
  }, []);

  // 获取市场列表
  const loadSkills = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchSkillMarketplace({ pageNum: 1, pageSize: 50 });
      setSkills(result.data);
      setTotal(result.total);
    } catch {
      // 静默处理
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSkills();
  }, [loadSkills]);

  // 搜索过滤
  const filtered = search
    ? skills.filter(
        (s) =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.description.toLowerCase().includes(search.toLowerCase()) ||
          s.skillId.toLowerCase().includes(search.toLowerCase()),
      )
    : skills;

  // 安装处理
  const handleInstall = (skillId: string) => {
    installSkill(skillId);
    setInstalled((prev) => new Set([...prev, skillId]));
    onInstall?.(skillId);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 搜索框 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索 Skill..."
          className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-white/20 focus:outline-none"
        />
      </div>

      {/* 结果计数 */}
      <p className="text-xs text-zinc-500">
        共 {total} 个 Skill{search ? `，筛选 ${filtered.length}` : ""}
      </p>

      {/* 卡片网格 */}
      {loading ? (
        <div className="py-8 text-center text-sm text-zinc-600">加载中...</div>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center text-sm text-zinc-600">
          暂无 Skill
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((skill) => (
            <div
              key={skill.id}
              className="group rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/20"
            >
              {/* 标题行 */}
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Package className="size-4 text-amber-400/70" />
                  <h3 className="text-sm font-medium text-zinc-200">
                    {skill.name}
                  </h3>
                </div>
                <span className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-zinc-500">
                  <Tag className="size-2.5" />
                  v{skill.version}
                </span>
              </div>

              {/* 描述 */}
              <p className="mb-3 line-clamp-2 text-xs text-zinc-500">
                {skill.description || "暂无描述"}
              </p>

              {/* 安装按钮 */}
              <button
                type="button"
                disabled={installed.has(skill.skillId)}
                onClick={() => handleInstall(skill.skillId)}
                className={`flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition ${
                  installed.has(skill.skillId)
                    ? "border-white/5 bg-white/5 text-zinc-600"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-200 hover:border-amber-500/50 hover:bg-amber-500/20"
                }`}
              >
                <Download className="size-3" />
                {installed.has(skill.skillId) ? "已安装" : "安装"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
