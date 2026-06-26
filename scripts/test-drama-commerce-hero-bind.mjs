#!/usr/bin/env node
/**
 * D-S2 (PROD-D02) — 商品镜头与主图联动 集成测试
 *
 * 验证：
 *   1. storyboardShotSchema 新增 commerceHeroOutputId / commerceHeroSource 字段
 *   2. skill-runs.ts listSessionCommerceHeroes 函数导出与签名
 *   3. drama.ts bind/unbind/list 路由已注册
 *   4. executor.ts prefillCommerceHeroKeyframes 函数存在
 *   5. 前端 api-client 导出 bindDramaShotCommerceHero / unbindDramaShotCommerceHero / listSessionCommerceHeroes
 *   6. 前端 types DramaStoryboardShot 含 commerceHeroOutputId 字段
 *
 * 运行：
 *   node scripts/test-drama-commerce-hero-bind.mjs
 *
 * 注：本测试为结构验证（不需 API 运行中），验证代码改动正确性。
 *     端到端流程测试由 test-agent-orchestration.mjs + E2E 覆盖。
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

console.log("=== D-S2 商品镜头与主图联动 集成测试 ===\n");

// ============ 1. 后端 schema 扩展 ============
const schemaPath = path.join(
  ROOT,
  "apps/api/src/lib/drama/schema.ts",
);
const schemaRaw = fs.existsSync(schemaPath)
  ? fs.readFileSync(schemaPath, "utf8")
  : "";

ok(
  "1. schema.ts 存在",
  fs.existsSync(schemaPath),
);

ok(
  "2. storyboardShotSchema 含 commerceHeroOutputId 字段",
  schemaRaw.includes("commerceHeroOutputId"),
);

ok(
  "3. storyboardShotSchema 含 commerceHeroSource 字段",
  schemaRaw.includes("commerceHeroSource"),
);

ok(
  "4. commerceHeroSource 枚举含 ecommerce_set",
  schemaRaw.includes("ecommerce_set"),
);

ok(
  "5. commerceHeroSource 枚举含 commerce_promo_cutout",
  schemaRaw.includes("commerce_promo_cutout"),
);

ok(
  "6. commerceHeroSource 枚举含 commerce_promo_upscale",
  schemaRaw.includes("commerce_promo_upscale"),
);

// ============ 2. skill-runs.ts listSessionCommerceHeroes ============
const skillRunsPath = path.join(
  ROOT,
  "apps/api/src/lib/agent/skill-runs.ts",
);
const skillRunsRaw = fs.existsSync(skillRunsPath)
  ? fs.readFileSync(skillRunsPath, "utf8")
  : "";

ok("7. skill-runs.ts 存在", fs.existsSync(skillRunsPath));

ok(
  "8. listSessionCommerceHeroes 函数导出",
  skillRunsRaw.includes("export function listSessionCommerceHeroes"),
);

ok(
  "9. CommerceHeroCandidate 接口导出",
  skillRunsRaw.includes("export interface CommerceHeroCandidate"),
);

ok(
  "10. CommerceHeroSource 类型导出",
  skillRunsRaw.includes("export type CommerceHeroSource"),
);

ok(
  "11. COMMERCE_SKILL_IDS 含 commerce-promo-v1",
  skillRunsRaw.includes("commerce-promo-v1"),
);

ok(
  "12. COMMERCE_SKILL_IDS 含 ecommerce-set-v1",
  skillRunsRaw.includes("ecommerce-set-v1"),
);

ok(
  "13. COMMERCE_SKILL_IDS 含 ecommerce-taobao-launch-v1",
  skillRunsRaw.includes("ecommerce-taobao-launch-v1"),
);

ok(
  "14. 查询过滤 status=completed",
  skillRunsRaw.includes("status = 'completed'"),
);

// ============ 3. drama.ts 路由 ============
const dramaRoutePath = path.join(ROOT, "apps/api/src/routes/drama.ts");
const dramaRouteRaw = fs.existsSync(dramaRoutePath)
  ? fs.readFileSync(dramaRoutePath, "utf8")
  : "";

ok("15. drama.ts 存在", fs.existsSync(dramaRoutePath));

ok(
  "16. GET /sessions/:sessionId/commerce-heroes 路由注册",
  dramaRouteRaw.includes("/sessions/:sessionId/commerce-heroes"),
);

ok(
  "17. POST bind-commerce-hero 路由注册",
  dramaRouteRaw.includes("bind-commerce-hero"),
);

ok(
  "18. DELETE bind-commerce-hero 路由注册",
  dramaRouteRaw.includes('drama.delete("/projects/:id/shots/:shotId/bind-commerce-hero"'),
);

ok(
  "19. import listSessionCommerceHeroes",
  dramaRouteRaw.includes("import { listSessionCommerceHeroes"),
);

ok(
  "20. bindBody schema 定义",
  dramaRouteRaw.includes("const bindBody"),
);

// ============ 4. executor.ts prefill 逻辑 ============
const executorPath = path.join(
  ROOT,
  "apps/api/src/lib/drama/executor.ts",
);
const executorRaw = fs.existsSync(executorPath)
  ? fs.readFileSync(executorPath, "utf8")
  : "";

ok("21. executor.ts 存在", fs.existsSync(executorPath));

ok(
  "22. prefillCommerceHeroKeyframes 函数定义",
  executorRaw.includes("function prefillCommerceHeroKeyframes"),
);

ok(
  "23. prefill 设置 keyframeOutputId = commerceHeroOutputId",
  executorRaw.includes("shot.keyframeOutputId = shot.commerceHeroOutputId"),
);

ok(
  "24. prefill 设置 status = keyframe",
  executorRaw.includes('shot.status = "keyframe"'),
);

ok(
  "25. prefill 在 keyframes 步骤调用",
  executorRaw.includes("prefillCommerceHeroKeyframes(row, project)"),
);

ok(
  "26. prefill 保存项目",
  executorRaw.includes("if (changed) saveProject(row, project)"),
);

// ============ 5. 前端 api-client ============
const apiClientPath = path.join(ROOT, "apps/web/src/lib/api-client.ts");
const apiClientRaw = fs.existsSync(apiClientPath)
  ? fs.readFileSync(apiClientPath, "utf8")
  : "";

ok("27. api-client.ts 存在", fs.existsSync(apiClientPath));

ok(
  "28. bindDramaShotCommerceHero 导出",
  apiClientRaw.includes("export async function bindDramaShotCommerceHero"),
);

ok(
  "29. unbindDramaShotCommerceHero 导出",
  apiClientRaw.includes("export async function unbindDramaShotCommerceHero"),
);

ok(
  "30. listSessionCommerceHeroes 导出",
  apiClientRaw.includes("export async function listSessionCommerceHeroes"),
);

ok(
  "31. CommerceHeroCandidate 接口导出（前端）",
  apiClientRaw.includes("export interface CommerceHeroCandidate"),
);

// ============ 6. 前端 types ============
const typesPath = path.join(ROOT, "apps/web/src/lib/types.ts");
const typesRaw = fs.existsSync(typesPath)
  ? fs.readFileSync(typesPath, "utf8")
  : "";

ok(
  "32. DramaStoryboardShot 含 commerceHeroOutputId",
  typesRaw.includes("commerceHeroOutputId"),
);

ok(
  "33. DramaStoryboardShot 含 commerceHeroSource",
  typesRaw.includes("commerceHeroSource"),
);

// ============ 7. 前端组件 UI ============
const timelinePath = path.join(
  ROOT,
  "apps/web/src/components/drama-shot-timeline.tsx",
);
const timelineRaw = fs.existsSync(timelinePath)
  ? fs.readFileSync(timelinePath, "utf8")
  : "";

ok(
  "34. drama-shot-timeline 导入 bindDramaShotCommerceHero",
  timelineRaw.includes("bindDramaShotCommerceHero"),
);

ok(
  "35. drama-shot-timeline 导入 ShoppingBag 图标",
  timelineRaw.includes("ShoppingBag"),
);

ok(
  "36. drama-shot-timeline 含电商主图联动 UI",
  timelineRaw.includes("电商主图联动"),
);

ok(
  "37. drama-shot-timeline 含选择主图按钮",
  timelineRaw.includes("选择主图"),
);

ok(
  "38. drama-shot-timeline 含解绑按钮",
  timelineRaw.includes("解绑"),
);

// ============ 8. 父组件传参 ============
const canvasPath = path.join(
  ROOT,
  "apps/web/src/components/studio-canvas-with-orchestration.tsx",
);
const canvasRaw = fs.existsSync(canvasPath)
  ? fs.readFileSync(canvasPath, "utf8")
  : "";

ok(
  "39. studio-canvas 传递 projectId 给 DramaShotTimeline",
  canvasRaw.includes("projectId={dramaDraftProject?.id}"),
);

ok(
  "40. studio-canvas 传递 sessionId 给 DramaShotTimeline",
  canvasRaw.includes("sessionId={sessionId}"),
);

// ============ 总结 ============
const failed = results.filter((r) => !r.pass).length;
console.log(`\n=== 总结 ===\n${results.length - failed}/${results.length} 通过，${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);
