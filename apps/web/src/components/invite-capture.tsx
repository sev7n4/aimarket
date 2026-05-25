"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { INVITE_KEY } from "@/components/login-dialog";

/** 从 URL ?invite=CODE 捕获邀请码，供注册时使用 */
export function InviteCapture() {
  const params = useSearchParams();

  useEffect(() => {
    const code = params.get("invite");
    if (code) {
      sessionStorage.setItem(INVITE_KEY, code.toUpperCase());
    }
  }, [params]);

  return null;
}
