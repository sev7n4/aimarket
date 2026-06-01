export type UserRow = {
  id: string;
  email: string;
  credits: number;
  pending_credits?: number | null;
  email_verified_at?: string | null;
  created_at: string;
  phone?: string | null;
};

export function mapUserPublic(row: UserRow) {
  const pending = row.pending_credits ?? 0;
  return {
    id: row.id,
    email: row.email,
    credits: row.credits,
    pending_credits: pending,
    email_verified: Boolean(row.email_verified_at),
    created_at: row.created_at,
    phone: row.phone ?? undefined,
  };
}

export const USER_PUBLIC_SELECT =
  "id, email, credits, pending_credits, email_verified_at, created_at, phone";
