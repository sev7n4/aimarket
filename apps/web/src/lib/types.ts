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
  status: string;
  updated_at: string;
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
