"use client";

import { Suspense } from "react";
import { InviteCapture } from "@/components/invite-capture";

/** 全站捕获 ?invite= 参数（挂于 root layout） */
export function InviteCaptureRoot() {
  return (
    <Suspense fallback={null}>
      <InviteCapture />
    </Suspense>
  );
}
