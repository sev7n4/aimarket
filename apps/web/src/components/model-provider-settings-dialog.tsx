"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  RefreshCw,
  Settings2,
  X,
} from "lucide-react";
import { Button } from "@aimarket/ui";
import {
  fetchProviderStatus,
  fetchUserProviderConfig,
  saveUserProviderConfig,
  type UserProviderConfig,
} from "@/lib/api-client";
import { clearByokKeys, loadByokKeys } from "@/lib/byok-keys";
import { useAuth } from "@/lib/auth-context";
import type { ProviderStatusPayload } from "@/lib/provider-status-types";

interface ModelProviderSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  onLogin?: () => void;
}

function StatusDot({ ok }: { ok: boolean }) {
  return ok ? (
    <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" />
  ) : (
    <AlertCircle className="size-3.5 shrink-0 text-amber-400" />
  );
}

function ConfigRow({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-2 py-1.5 text-xs">
      <span className="shrink-0 text-zinc-500">{label}</span>
      <span className="flex min-w-0 items-center gap-1.5 text-right text-zinc-300">
        {ok !== undefined ? <StatusDot ok={ok} /> : null}
        <span className="truncate font-mono text-[11px]">{value}</span>
      </span>
    </div>
  );
}

export function ModelProviderSettingsDialog({
  open,
  onClose,
  onLogin,
}: ModelProviderSettingsDialogProps) {
  const { user } = useAuth();
  const [status, setStatus] = useState<ProviderStatusPayload | null>(null);
  const [userConfig, setUserConfig] = useState<UserProviderConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useByok, setUseByok] = useState(false);
  const [openaiKeyDraft, setOpenaiKeyDraft] = useState("");
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [providerStatus, config] = await Promise.all([
        fetchProviderStatus(),
        user ? fetchUserProviderConfig() : Promise.resolve(null),
      ]);
      setStatus(providerStatus);
      if (config) {
        setUserConfig(config);
        setUseByok(config.useByok);
        setOpenaiBaseUrl(config.openai.baseUrl ?? "");
        setOpenaiKeyDraft("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      if (user) {
        const local = loadByokKeys();
        if (local.openai?.trim()) {
          try {
            await saveUserProviderConfig({
              useByok: true,
              openai: { apiKey: local.openai.trim() },
            });
            clearByokKeys();
          } catch {
            /* 迁移失败仍继续加载 */
          }
        }
      }
      await loadAll();
    })();
  }, [open, user, loadAll]);

  async function handleSaveByok() {
    if (!user) {
      onLogin?.();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body: {
        useByok: boolean;
        openai: { apiKey?: string | null; baseUrl?: string | null };
      } = {
        useByok,
        openai: {
          baseUrl: openaiBaseUrl.trim() || null,
        },
      };
      if (openaiKeyDraft.trim()) {
        body.openai.apiKey = openaiKeyDraft.trim();
      }
      const next = await saveUserProviderConfig(body);
      setUserConfig(next);
      setOpenaiKeyDraft("");
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleClearOpenAiKey() {
    if (!user) return;
    setSaving(true);
    try {
      const next = await saveUserProviderConfig({
        useByok,
        openai: { apiKey: null },
      });
      setUserConfig(next);
      setOpenaiKeyDraft("");
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "清除失败");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const tools = status?.tools;

  return (
    <div className="fixed inset-0 z-[65] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="关闭"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="model-settings-title"
        className="relative flex max-h-[min(88dvh,640px)] w-full max-w-lg flex-col rounded-t-2xl border border-white/10 bg-[#0b0b0b] shadow-2xl sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-5 py-4">
          <div className="flex items-center gap-2">
            <Settings2 className="size-5 text-orange-400" />
            <div>
              <h2 id="model-settings-title" className="text-base font-semibold text-white">
                模型接入
              </h2>
              <p className="text-[11px] text-zinc-500">
                服务端环境 + 账户 BYOK（加密存储）
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void loadAll()}
              disabled={loading}
              className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/10 hover:text-white disabled:opacity-40"
              title="刷新状态"
              aria-label="刷新状态"
            >
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/10 hover:text-white"
              aria-label="关闭"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          ) : null}

          {!user ? (
            <div className="mb-4 rounded-xl border border-white/10 bg-black/30 p-4">
              <p className="text-sm text-zinc-400">登录后可保存 BYOK 与查看完整配置。</p>
              {onLogin ? (
                <Button
                  type="button"
                  variant="primary"
                  className="mt-3 w-full text-sm"
                  onClick={onLogin}
                >
                  登录
                </Button>
              ) : null}
            </div>
          ) : null}

          <section className="mb-4 rounded-xl border border-orange-500/20 bg-orange-500/5 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-zinc-200">
              <KeyRound className="size-3.5 text-orange-400" />
              BYOK（自带 API Key）
            </div>
            <label className="flex items-center gap-2 text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={useByok}
                disabled={!user || saving}
                onChange={(e) => setUseByok(e.target.checked)}
                className="rounded border-white/20"
              />
              生成时优先使用我的 OpenAI Key
            </label>
            {userConfig?.openai.keyHint ? (
              <p className="mt-2 text-[11px] text-emerald-400/90">
                已保存：{userConfig.openai.keyHint}
              </p>
            ) : null}
            <input
              type="password"
              value={openaiKeyDraft}
              disabled={!user || saving}
              onChange={(e) => setOpenaiKeyDraft(e.target.value)}
              placeholder={
                userConfig?.openai.configured
                  ? "留空则保留现有 Key，输入新 Key 可覆盖"
                  : "OpenAI API Key（sk-…）"
              }
              className="mt-2 w-full rounded-lg border border-white/10 bg-black/50 px-2.5 py-2 text-xs outline-none focus:border-orange-500/40 disabled:opacity-50"
              autoComplete="off"
            />
            <input
              type="url"
              value={openaiBaseUrl}
              disabled={!user || saving}
              onChange={(e) => setOpenaiBaseUrl(e.target.value)}
              placeholder="OpenAI Base URL（可选，默认官方）"
              className="mt-2 w-full rounded-lg border border-white/10 bg-black/50 px-2.5 py-2 text-xs outline-none focus:border-orange-500/40 disabled:opacity-50"
            />
            <div className="mt-2 flex gap-2">
              <Button
                type="button"
                variant="primary"
                className="flex-1 text-xs"
                disabled={!user || saving}
                onClick={() => void handleSaveByok()}
              >
                {saving ? "保存中…" : savedFlash ? "已保存" : "保存 BYOK"}
              </Button>
              {userConfig?.openai.configured ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-xs"
                  disabled={saving}
                  onClick={() => void handleClearOpenAiKey()}
                >
                  清除 Key
                </Button>
              ) : null}
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-zinc-600">
              Key 加密存于服务端。创作台选择{" "}
              <span className="text-zinc-400">dall-e-2 / dall-e-3</span> 或{" "}
              <span className="text-zinc-400">Auto</span>（无参考图）时，生成任务将走您的
              OpenAI Key；图生图仍需配置 Seedream / 万相。
            </p>
          </section>

          {status?.hint ? (
            <p
              className={`mb-4 rounded-xl border px-3 py-2 text-xs leading-relaxed ${
                status.usingMock
                  ? "border-amber-500/25 bg-amber-500/10 text-amber-100/90"
                  : "border-emerald-500/25 bg-emerald-500/10 text-emerald-100/90"
              }`}
            >
              {status.hint}
            </p>
          ) : loading && !status ? (
            <p className="text-sm text-zinc-500">正在读取接入状态…</p>
          ) : null}

          {status ? (
            <div className="space-y-4">
              <section className="rounded-xl border border-white/10 bg-black/30 p-3">
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  图像生成（服务端）
                </h3>
                <ConfigRow label="模式" value={status.mode} />
                <ConfigRow label="当前引擎" value={status.activeProvider} />
                <ConfigRow
                  label="OpenAI（部署）"
                  value={status.openaiConfigured ? "已配置" : "未配置"}
                  ok={status.openaiConfigured}
                />
                <ConfigRow
                  label="OpenAI（账户 BYOK）"
                  value={
                    userConfig?.openai.configured ? "已配置" : "未配置"
                  }
                  ok={Boolean(userConfig?.openai.configured)}
                />
                <ConfigRow
                  label="阿里百炼"
                  value={status.aliyunWanConfigured ? "已配置" : "未配置"}
                  ok={status.aliyunWanConfigured}
                />
                <ConfigRow
                  label="火山方舟"
                  value={status.seedreamConfigured ? "已配置" : "未配置"}
                  ok={status.seedreamConfigured}
                />
                {status.aliyunWanModel ? (
                  <ConfigRow label="万相模型" value={status.aliyunWanModel} />
                ) : null}
                {status.seedreamModel ? (
                  <ConfigRow label="Seedream" value={status.seedreamModel} />
                ) : null}
              </section>

              {tools ? (
                <section className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Studio 精修工具
                  </h3>
                  <ConfigRow label="工具模式" value={tools.mode} />
                  <ConfigRow label="抠图" value={tools.cutoutProvider} />
                  <ConfigRow label="超分" value={tools.upscaleProvider} />
                  <ConfigRow label="扩图" value={tools.expandProvider} />
                  <ConfigRow label="变体" value={tools.variationProvider} />
                  {tools.hint ? (
                    <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                      {tools.hint}
                    </p>
                  ) : null}
                </section>
              ) : null}

              {(status.promptOptimize || status.focusPoint || status.moderation) && (
                <section className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    辅助能力
                  </h3>
                  {status.promptOptimize?.provider ? (
                    <ConfigRow
                      label="提示词润色"
                      value={status.promptOptimize.provider}
                    />
                  ) : null}
                  {status.focusPoint?.provider ? (
                    <ConfigRow
                      label="焦点识别"
                      value={status.focusPoint.provider}
                    />
                  ) : null}
                  {status.moderation?.provider ? (
                    <ConfigRow label="内容审核" value={status.moderation.provider} />
                  ) : null}
                </section>
              )}
            </div>
          ) : null}

          <a
            href="https://github.com/sev7n4/aimarket/blob/main/docs/PRODUCTION_SECRETS.md"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1 text-xs text-orange-400/90 hover:text-orange-300"
          >
            部署与密钥说明
            <ExternalLink className="size-3" />
          </a>
        </div>

        <div className="shrink-0 border-t border-white/5 px-5 py-3">
          <Button type="button" variant="primary" className="w-full" onClick={onClose}>
            完成
          </Button>
        </div>
      </div>
    </div>
  );
}
