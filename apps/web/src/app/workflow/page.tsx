import { Suspense } from "react";
import { WorkflowPageClient } from "./workflow-page-client";

export const metadata = {
  title: "工作流 · 无限画布",
};

export default function WorkflowPage() {
  return (
    <Suspense fallback={<div className="h-dvh bg-[#0f0f0f]" />}>
      <WorkflowPageClient />
    </Suspense>
  );
}
