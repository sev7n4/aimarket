export interface InspirationListItem {
  id: string;
  title: string;
  category: string;
  coverUrl: string;
  aspectRatio?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InspirationDetail {
  id: string;
  title: string;
  category: string;
  prompt: string;
  promptTemplate?: string;
  variables?: Array<{ key: string; label: string; default: string }>;
  modelId: string;
  aspectRatio: string;
  resolution: string;
  coverUrl: string;
  referenceAssets: Array<{ url: string; fileName?: string; assetId?: string }>;
}

export interface ApiUser {
  id: string;
  email: string;
  credits: number;
  created_at?: string;
}

export interface ImageSession {
  id: string;
  title: string;
  mode: string;
  kind?: "canvas" | "project";
  status: string;
  updated_at: string;
  user_id?: string;
  creator_email?: string | null;
  can_edit?: boolean;
  is_read_only?: boolean;
}

export interface SessionAccessMeta {
  can_edit?: boolean;
  is_read_only?: boolean;
}

export interface MessageOutput {
  url: string;
  sort_order: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  job_id: string | null;
  created_at: string;
  outputs: MessageOutput[];
}

export interface ImageModel {
  id: string;
  name: string;
  description: string;
  type: string;
  pointsFactor: number;
}

export interface GenerationJob {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  points_cost: number;
  error: string | null;
  outputs: { url: string; sort_order: number }[];
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}

export interface SessionReference {
  id: string;
  url: string;
  label: string;
  createdAt: string;
}

export interface RouteSuggestion {
  modelId: string;
  reason: string;
}

export interface ProductSetInit {
  platforms: string[];
  markets: string[];
  languages: string[];
  designers: string[];
  slides: { key: string; label: string }[];
}

export interface StudioTool {
  id: string;
  name: string;
  description: string;
  defaultPrompt: string;
}

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price_cents: number;
  badge: string | null;
  sort_order: number;
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  link_label: string | null;
  link_path: string | null;
  created_at?: string;
}

export interface SignStatus {
  signedToday: boolean;
  todayReward: number;
  recentSignDays: number;
  signDate: string;
}

export interface InviteInfo {
  code: string;
  inviteCount: number;
  rewardPerInvite: number;
  totalEarned: number;
  inviteUrl: string;
}
