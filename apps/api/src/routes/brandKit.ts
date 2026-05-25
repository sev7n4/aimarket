import { Hono } from "hono";
import { z } from "zod";
import type { AuthVariables } from "../middleware/auth.js";
import { db } from "../db/index.js";

const brandKit = new Hono<{ Variables: AuthVariables }>();

brandKit.get("/", (c) => {
  const userId = c.get("userId");
  const row = db
    .prepare(
      `SELECT brand_name, primary_color, secondary_color, logo_url, font_hint, updated_at
       FROM brand_kits WHERE user_id = ?`,
    )
    .get(userId);
  return c.json({ data: row ?? null });
});

brandKit.put("/", async (c) => {
  const userId = c.get("userId");
  const body = z
    .object({
      brandName: z.string().max(100).optional(),
      primaryColor: z.string().max(20).default("#f97316"),
      secondaryColor: z.string().max(20).default("#a855f7"),
      logoUrl: z.string().max(500).optional(),
      fontHint: z.string().max(100).optional(),
    })
    .parse(await c.req.json());

  const existing = db
    .prepare("SELECT user_id FROM brand_kits WHERE user_id = ?")
    .get(userId);

  if (existing) {
    db.prepare(
      `UPDATE brand_kits SET brand_name = ?, primary_color = ?, secondary_color = ?,
       logo_url = ?, font_hint = ?, updated_at = datetime('now') WHERE user_id = ?`,
    ).run(
      body.brandName ?? null,
      body.primaryColor,
      body.secondaryColor,
      body.logoUrl || null,
      body.fontHint ?? null,
      userId,
    );
  } else {
    db.prepare(
      `INSERT INTO brand_kits (user_id, brand_name, primary_color, secondary_color, logo_url, font_hint)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      userId,
      body.brandName ?? null,
      body.primaryColor,
      body.secondaryColor,
      body.logoUrl || null,
      body.fontHint ?? null,
    );
  }

  const row = db
    .prepare("SELECT * FROM brand_kits WHERE user_id = ?")
    .get(userId);
  return c.json({ data: row });
});

export { brandKit };
