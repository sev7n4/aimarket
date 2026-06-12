import { Suspense } from "react";
import { StudioPageClient } from "./studio-page-client";

export const metadata = {
  title: "创作页",
};

export default function StudioPage() {
  return (
    <Suspense fallback={<div className="h-dvh bg-[#030303]" />}>
      <StudioPageClient />
    </Suspense>
  );
}
