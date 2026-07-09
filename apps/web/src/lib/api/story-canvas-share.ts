import { request } from "./core";

export async function toggleStoryCanvasShare(body: {
  sessionId: string;
  enabled: boolean;
  expiresInDays?: number;
}) {
  const res = await request<{
    data: {
      enabled: boolean;
      shareUrl?: string;
      expiresAt?: string | null;
      active?: boolean;
    };
  }>("/api/v1/story-canvas/share/toggle", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}

export async function getStoryCanvasShareStatus(sessionId: string) {
  const params = new URLSearchParams({ sessionId });
  const res = await request<{
    data: { active: boolean; expiresAt: string | null; createdAt: string | null };
  }>(`/api/v1/story-canvas/share/status?${params.toString()}`);
  return res.data;
}

export async function viewStoryCanvasShare(token: string) {
  const params = new URLSearchParams({ token });
  const res = await request<{
    data: {
      sessionId: string;
      title: string;
      kind: string;
      updatedAt: string;
      expiresAt: string | null;
      canvasLayout: unknown;
      messageCount: number;
    };
  }>(`/api/v1/story-canvas/share/view?${params.toString()}`);
  return res.data;
}

export async function cloneStoryCanvasShare(body: {
  token: string;
  title?: string;
  workspaceId?: string;
}) {
  const res = await request<{
    data: { sessionId: string; session: { id: string; title: string } };
  }>("/api/v1/story-canvas/share/clone", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}
