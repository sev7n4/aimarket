import { db } from "./index.js";
import { backfillWorkspaces } from "../lib/workspaces.js";
import { seedInspirationTemplates } from "./inspiration-seed.js";
import { seedDramaTemplates } from "./drama-templates-seed.js";

const PACKAGES = [
  {
    id: "pkg-starter",
    name: "体验包",
    credits: 500,
    price_cents: 2900,
    badge: null,
    sort_order: 1,
  },
  {
    id: "pkg-pro",
    name: "专业包",
    credits: 2000,
    price_cents: 9900,
    badge: "热门",
    sort_order: 2,
  },
  {
    id: "pkg-team",
    name: "团队包",
    credits: 10000,
    price_cents: 39900,
    badge: "最划算",
    sort_order: 3,
  },
] as const;

export function seedDatabase() {
  for (const pkg of PACKAGES) {
    const exists = db
      .prepare("SELECT id FROM credit_packages WHERE id = ?")
      .get(pkg.id);
    if (!exists) {
      db.prepare(
        `INSERT INTO credit_packages (id, name, credits, price_cents, badge, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(
        pkg.id,
        pkg.name,
        pkg.credits,
        pkg.price_cents,
        pkg.badge,
        pkg.sort_order,
      );
    }
  }

  const notice = db
    .prepare("SELECT id FROM notices WHERE id = 'default-promo'")
    .get();
  if (!notice) {
    db.prepare(
      `INSERT INTO notices (id, title, content, link_label, link_path, active)
       VALUES ('default-promo', '推荐官活动', '邀请好友注册，双方各得 100 积分', '立即查看', '/invite', 1)`,
    ).run();
  }

  backfillWorkspaces();
  seedInspirationTemplates();
  seedDramaTemplates();
}
