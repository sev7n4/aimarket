"use client";

import type { StudioInspirationApply } from "@/lib/inspiration-studio";

export type CreationPanelInspirationVarsProps = {
  inspirationApply: StudioInspirationApply;
  inspirationVars: Record<string, string>;
  onInspirationVarChange: (key: string, value: string) => void;
};

export function CreationPanelInspirationVars({
  inspirationApply,
  inspirationVars,
  onInspirationVarChange,
}: CreationPanelInspirationVarsProps) {
  if ((inspirationApply.variables?.length ?? 0) === 0) return null;

  return (
    <div className="mb-3 rounded-xl border border-orange-500/20 bg-orange-500/5 p-3">
      <p className="mb-2 text-xs font-medium text-orange-200/90">
        同款模板 · {inspirationApply.title}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {inspirationApply.variables!.map((v) => (
          <label key={v.key} className="block space-y-1">
            <span className="text-[10px] text-zinc-500">{v.label}</span>
            <input
              type="text"
              value={inspirationVars[v.key] ?? v.default}
              onChange={(e) => onInspirationVarChange(v.key, e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-zinc-100 outline-none focus:border-orange-500/40"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
