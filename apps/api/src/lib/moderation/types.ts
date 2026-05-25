export type ModerationResult = {
  allowed: boolean;
  provider: string;
};

export interface ModerationProvider {
  name: string;
  check(text: string): Promise<ModerationResult>;
}
