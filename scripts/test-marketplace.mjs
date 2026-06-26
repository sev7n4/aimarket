#!/usr/bin/env node
/**
 * D-S3 (PROD-D03) — Skill / 模板市场 集成测试
 *
 * 验证：
 *   1. DB 迁移：marketplace_skills 表
 *   2. Skill 包：parseSkillFromYamlString 导出
 *   3. 后端 lib：marketplace.ts 函数
 *   4. 后端路由：marketplace.ts 端点 + admin 审核
 *   5. index.ts 路由注册
 *   6. 前端 API client + 类型 + 组件 + 页面
 *
 * 运行：node scripts/test-marketplace.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const results = [];
function ok(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

console.log("=== D-S3 Skill / 模板市场 集成测试 ===\n");

// ============ 1. DB 迁移 ============
const dbIndexPath = path.join(ROOT, "apps/api/src/db/index.ts");
const dbIndexRaw = fs.existsSync(dbIndexPath)
  ? fs.readFileSync(dbIndexPath, "utf8")
  : "";

ok("1. db/index.ts 含 marketplace_skills 表", dbIndexRaw.includes("CREATE TABLE IF NOT EXISTS marketplace_skills"));

ok("2. 含 slug 字段", dbIndexRaw.includes("slug TEXT NOT NULL UNIQUE"));

ok("3. 含 skill_yaml 字段", dbIndexRaw.includes("skill_yaml TEXT NOT NULL"));

ok("4. 含 status 字段", dbIndexRaw.includes("status TEXT NOT NULL DEFAULT 'pending_review'"));

ok("5. 含 PROD-D03 注释", dbIndexRaw.includes("PROD-D03"));

ok("6. 含 install_count 字段", dbIndexRaw.includes("install_count INTEGER NOT NULL DEFAULT 0"));

ok("7. 含 idx_marketplace_skills_status 索引", dbIndexRaw.includes("idx_marketplace_skills_status"));

const pgPath = path.join(ROOT, "apps/api/src/db/migrations/postgres.sql");
const pgRaw = fs.existsSync(pgPath) ? fs.readFileSync(pgPath, "utf8") : "";

ok("8. postgres.sql 含 marketplace_skills 表", pgRaw.includes("CREATE TABLE IF NOT EXISTS marketplace_skills"));

// ============ 2. Skill 包 ============
const loadPath = path.join(ROOT, "packages/agent-skills/src/load.ts");
const loadRaw = fs.existsSync(loadPath) ? fs.readFileSync(loadPath, "utf8") : "";

ok("9. load.ts 含 parseSkillFromYamlString 导出", loadRaw.includes("export function parseSkillFromYamlString"));

ok("10. parseSkillFromYamlString 用 skillDefinitionSchema 校验", loadRaw.includes("skillDefinitionSchema.parse"));

const indexPath = path.join(ROOT, "packages/agent-skills/src/index.ts");
const indexRaw = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, "utf8") : "";

ok("11. index.ts re-export parseSkillFromYamlString", indexRaw.includes("parseSkillFromYamlString"));

// ============ 3. 后端 lib ============
const libPath = path.join(ROOT, "apps/api/src/lib/marketplace.ts");
const libRaw = fs.existsSync(libPath) ? fs.readFileSync(libPath, "utf8") : "";

ok("12. lib/marketplace.ts 存在", fs.existsSync(libPath));

ok("13. createMarketplaceSkill 导出", libRaw.includes("export function createMarketplaceSkill"));

ok("14. listPublishedMarketplaceSkills 导出", libRaw.includes("export function listPublishedMarketplaceSkills"));

ok("15. getMarketplaceSkill 导出", libRaw.includes("export function getMarketplaceSkill"));

ok("16. listMyMarketplaceSkills 导出", libRaw.includes("export function listMyMarketplaceSkills"));

ok("17. listPendingMarketplaceSkills 导出", libRaw.includes("export function listPendingMarketplaceSkills"));

ok("18. publishMarketplaceSkill 导出", libRaw.includes("export function publishMarketplaceSkill"));

ok("19. rejectMarketplaceSkill 导出", libRaw.includes("export function rejectMarketplaceSkill"));

ok("20. import parseSkillFromYamlString", libRaw.includes("parseSkillFromYamlString"));

ok("21. import sqlNow", libRaw.includes("sqlNow"));

ok("22. generateSlug 函数", libRaw.includes("function generateSlug"));

ok("23. serialize 函数", libRaw.includes("function serialize"));

ok("24. reviewerId 接受 null", libRaw.includes("reviewerId: string | null"));

// ============ 4. 后端路由 ============
const routePath = path.join(ROOT, "apps/api/src/routes/marketplace.ts");
const routeRaw = fs.existsSync(routePath) ? fs.readFileSync(routePath, "utf8") : "";

ok("25. routes/marketplace.ts 存在", fs.existsSync(routePath));

ok("26. marketplace 公开路由导出", routeRaw.includes("export const marketplace"));

ok("27. marketplaceAuthed 认证路由导出", routeRaw.includes("export const marketplaceAuthed"));

ok("28. marketplaceAdmin admin 路由导出", routeRaw.includes("export const marketplaceAdmin"));

ok("29. GET /skills 公开端点", routeRaw.includes('marketplace.get("/skills"'));

ok("30. GET /skills/:slug 详情端点", routeRaw.includes('marketplace.get("/skills/:slug"'));

ok("31. GET /skills/:slug/yaml 下载端点", routeRaw.includes('marketplace.get("/skills/:slug/yaml"'));

ok("32. GET /my/skills 我的上架端点", routeRaw.includes('marketplaceAuthed.get("/my/skills"'));

ok("33. POST /skills 上架端点", routeRaw.includes('marketplaceAuthed.post("/skills"'));

ok("34. admin GET /skills/pending 审核队列", routeRaw.includes('marketplaceAdmin.get("/skills/pending"'));

ok("35. admin POST /skills/:id/publish 发布", routeRaw.includes('marketplaceAdmin.post("/skills/:id/publish"'));

ok("36. admin POST /skills/:id/reject 拒绝", routeRaw.includes('marketplaceAdmin.post("/skills/:id/reject"'));

ok("37. submitBody zod 校验", routeRaw.includes("submitBody"));

// ============ 5. 路由注册 ============
const apiIndexPath = path.join(ROOT, "apps/api/src/index.ts");
const apiIndexRaw = fs.existsSync(apiIndexPath) ? fs.readFileSync(apiIndexPath, "utf8") : "";

ok("38. index.ts import marketplace 路由", apiIndexRaw.includes("from \"./routes/marketplace.js\""));

ok("39. index.ts 注册公开路由", apiIndexRaw.includes('app.route("/api/v1/marketplace", marketplace)'));

ok("40. index.ts 注册认证路由", apiIndexRaw.includes('authed.route("/marketplace", marketplaceAuthed)'));

const adminPath = path.join(ROOT, "apps/api/src/routes/admin.ts");
const adminRaw = fs.existsSync(adminPath) ? fs.readFileSync(adminPath, "utf8") : "";

ok("41. admin.ts import marketplaceAdmin", adminRaw.includes("marketplaceAdmin"));

ok("42. admin.ts 挂载 marketplaceAdmin", adminRaw.includes('admin.route("/marketplace", marketplaceAdmin)'));

// ============ 6. 前端 ============
const apiClientPath = path.join(ROOT, "apps/web/src/lib/api-client.ts");
const apiClientRaw = fs.existsSync(apiClientPath) ? fs.readFileSync(apiClientPath, "utf8") : "";

ok("43. api-client 含 MarketplaceSkill 接口", apiClientRaw.includes("export interface MarketplaceSkill"));

ok("44. fetchMarketplaceSkills 导出", apiClientRaw.includes("export async function fetchMarketplaceSkills"));

ok("45. fetchMarketplaceSkill 导出", apiClientRaw.includes("export async function fetchMarketplaceSkill"));

ok("46. fetchMyMarketplaceSkills 导出", apiClientRaw.includes("export async function fetchMyMarketplaceSkills"));

ok("47. publishMarketplaceSkill 导出", apiClientRaw.includes("export async function publishMarketplaceSkill"));

const galleryPath = path.join(ROOT, "apps/web/src/components/marketplace-gallery.tsx");
ok("48. marketplace-gallery.tsx 存在", fs.existsSync(galleryPath));

const pagePath = path.join(ROOT, "apps/web/src/app/marketplace/page.tsx");
ok("49. marketplace/page.tsx 存在", fs.existsSync(pagePath));

const headerPath = path.join(ROOT, "apps/web/src/components/site-header.tsx");
const headerRaw = fs.existsSync(headerPath) ? fs.readFileSync(headerPath, "utf8") : "";
ok("50. site-header 含市场链接", headerRaw.includes('href="/marketplace"'));

// ============ 总结 ============
const failed = results.filter((r) => !r.pass).length;
console.log(`\n=== 总结 ===\n${results.length - failed}/${results.length} 通过，${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);
