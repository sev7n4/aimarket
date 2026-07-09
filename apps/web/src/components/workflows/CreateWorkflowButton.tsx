"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { clientNavigate } from "@/lib/client-navigate";
import { getActiveWorkspaceId } from "@/lib/active-workspace";
import { buildWorkflowUrl } from "@/lib/studio-navigation";

export function CreateWorkflowButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      data-testid="create-workflow-button"
      onClick={() => {
        clientNavigate(
          router,
          buildWorkflowUrl({
            title: "未命名工作流",
            newDraft: true,
            workspaceId: getActiveWorkspaceId(),
          }),
        );
      }}
      className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/[0.02] text-zinc-400 transition hover:border-white/35 hover:bg-white/[0.04] hover:text-zinc-200"
    >
      <span className="flex size-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.04]">
        <Plus className="size-5" />
      </span>
      <span className="text-sm font-medium">新建无限画布</span>
    </button>
  );
}
