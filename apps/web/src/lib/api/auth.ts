import { request, getToken, setToken, assetUrl } from "./core";
import type {
  ApiErrorBody,
  ApiUser,
  ChatMessage,
  CreditPackage,
  GenerationJob,
  ImageModel,
  ImageSession,
  InspirationDetail,
  InspirationListItem,
  InviteInfo,
  PublicSharePayload,
  SessionShareStatus,
  Notice,
  ProductSetInit,
  RouteSuggestion,
  SessionAccessMeta,
  SessionReference,
  SignStatus,
  StudioTool,
  VideoModelRouteMeta,
  WorkspaceReview,
  WorkspaceReviewComment,
  DramaProjectVersionDetail,
  DramaProjectVersionDiff,
  DramaProjectVersionSummary,
} from "../types";

export async function register(
  email: string,
  password: string,
  inviteCode?: string,
) {
  const res = await request<{
    data: {
      token: string;
      user: ApiUser;
      inviteBonus?: {
        reward: number;
        message: string;
        pending?: boolean;
      } | null;
      verificationEmailSent?: boolean;
      message?: string;
    };
  }>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, inviteCode }),
    auth: false,
  });
  setToken(res.data.token);
  return res.data;
}


export async function verifyEmail(token: string) {
  const res = await request<{
    data: {
      token: string;
      user: ApiUser;
      creditsGranted: number;
      alreadyVerified: boolean;
      message: string;
    };
  }>("/api/v1/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token }),
    auth: false,
  });
  setToken(res.data.token);
  return res.data;
}


export async function resendVerificationEmail() {
  const res = await request<{ data: { message: string } }>(
    "/api/v1/auth/resend-verification",
    { method: "POST" },
  );
  return res.data;
}


export async function login(email: string, password: string) {
  const res = await request<{ data: { token: string; user: ApiUser } }>(
    "/api/v1/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
      auth: false,
    },
  );
  setToken(res.data.token);
  return res.data;
}


export function logout() {
  setToken(null);
}


export async function sendSmsCode(phone: string) {
  const res = await request<{
    data: { message: string; devCode?: string };
  }>("/api/v1/auth/sms/send", {
    method: "POST",
    body: JSON.stringify({ phone }),
    auth: false,
  });
  return res.data;
}


export async function loginWithSms(
  phone: string,
  code: string,
  inviteCode?: string,
) {
  const res = await request<{
    data: {
      token: string;
      user: ApiUser;
      inviteBonus?: { reward: number; message: string } | null;
    };
  }>("/api/v1/auth/sms/login", {
    method: "POST",
    body: JSON.stringify({ phone, code, inviteCode }),
    auth: false,
  });
  setToken(res.data.token);
  return res.data;
}


export async function loginWithWechat(code: string, inviteCode?: string) {
  const res = await request<{
    data: {
      token: string;
      user: ApiUser;
      inviteBonus?: { reward: number; message: string } | null;
    };
  }>("/api/v1/auth/wechat/login", {
    method: "POST",
    body: JSON.stringify({ code, inviteCode }),
    auth: false,
  });
  setToken(res.data.token);
  return res.data;
}
