#!/usr/bin/env node
/**
 * D-S1 — commerce-promo-v1 Skill 集成测试
 *
 * 验证商业宣传片 Skill YAML：
 *   1. 文件存在且可被 listSkillIds 发现
 *   2. YAML 结构符合 Skill schema 关键字段
 *   3. 步骤编排符合 PROD-D01 需求（套图 → 抠白底 → 放大 → 30s 16:9 宣传片）
 *   4. 与 ecommerce-taobao-launch-v1 区分（时长/画幅不同）
 *
 * 运行：
 *   node scripts/test-commerce-skill.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { parse } = require("yaml");

const results = [];
function ok(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.resolve(__dirname, "../packages/agent-skills/skills");

console.log("=== D-S1 commerce-promo-v1 Skill 集成测试 ===\n");

// ============ 1. 文件存在性 ============
const yamlPath = path.join(SKILLS_DIR, "commerce-promo-v1.yaml");
ok("1. commerce-promo-v1.yaml 文件存在", fs.existsSync(yamlPath));

// ============ 2. listSkillIds 能发现 ============
const allYamls = fs
  .readdirSync(SKILLS_DIR)
  .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
  .map((f) => f.replace(/\.(yaml|yml)$/, ""));
ok(
  "2. listSkillIds 包含 commerce-promo-v1",
  allYamls.includes("commerce-promo-v1"),
  `共 ${allYamls.length} 个 Skill`,
);

// ============ 3. YAML 结构解析 ============
const raw = fs.readFileSync(yamlPath, "utf8");
const skill = parse(raw);

ok("3. id = commerce-promo-v1", skill.id === "commerce-promo-v1", skill.id);
ok("4. version = 1", skill.version === 1, `${skill.version}`);
ok("5. name 非空", typeof skill.name === "string" && skill.name.length > 0, skill.name);
ok(
  "6. description 非空",
  typeof skill.description === "string" && skill.description.length > 0,
);
ok(
  "7. confirmIfPointsOver ≥ 100",
  typeof skill.confirmIfPointsOver === "number" && skill.confirmIfPointsOver >= 100,
  `${skill.confirmIfPointsOver}`,
);

// ============ 4. 步骤编排 ============
ok("8. steps 是数组且非空", Array.isArray(skill.steps) && skill.steps.length > 0);
ok("9. 共 4 个步骤", skill.steps.length === 4, `实际 ${skill.steps.length}`);

const [s0, s1, s2, s3] = skill.steps;

ok("10. step[0] type=generate_set", s0?.type === "generate_set");
ok("11. step[0] id=gen_set", s0?.id === "gen_set");
ok(
  "12. step[0] label 含「电商套图」",
  typeof s0?.label === "string" && s0.label.includes("电商套图"),
);

ok("13. step[1] type=tool", s1?.type === "tool");
ok("14. step[1] toolId=cutout", s1?.toolId === "cutout");
ok("15. step[1] sourceStep=gen_set", s1?.sourceStep === "gen_set");
ok("16. step[1] sourceOutputIndex=0", s1?.sourceOutputIndex === 0);

ok("17. step[2] type=tool", s2?.type === "tool");
ok("18. step[2] toolId=upscale", s2?.toolId === "upscale");
ok("19. step[2] sourceStep=cutout_hero", s2?.sourceStep === "cutout_hero");

ok("20. step[3] type=video", s3?.type === "video");
ok("21. step[3] sourceStep=upscale_hero", s3?.sourceStep === "upscale_hero");
ok("22. step[3] modelId=seedance-2", s3?.modelId === "seedance-2");
ok("23. step[3] resolution=1k", s3?.resolution === "1k");
ok("24. step[3] aspectRatio=16:9", s3?.aspectRatio === "16:9", s3?.aspectRatio);

// ============ 5. 与 ecommerce-taobao-launch-v1 区分 ============
const taobaoPath = path.join(SKILLS_DIR, "ecommerce-taobao-launch-v1.yaml");
const taobaoRaw = fs.readFileSync(taobaoPath, "utf8");
const taobaoSkill = parse(taobaoRaw);
const taobaoVideo = taobaoSkill.steps.find((s) => s.type === "video");
const promoVideo = skill.steps.find((s) => s.type === "video");

ok(
  "25. 与 taobao-launch 画幅不同（16:9 vs 9:16）",
  promoVideo?.aspectRatio !== taobaoVideo?.aspectRatio,
  `promo=${promoVideo?.aspectRatio} taobao=${taobaoVideo?.aspectRatio}`,
);
ok(
  "26. commerce-promo 步骤数 > taobao-launch（4 vs 3）",
  skill.steps.length > taobaoSkill.steps.length,
  `promo=${skill.steps.length} taobao=${taobaoSkill.steps.length}`,
);
ok(
  "27. commerce-promo 含 upscale 步骤（taobao 无）",
  skill.steps.some((s) => s.toolId === "upscale") &&
    !taobaoSkill.steps.some((s) => s.toolId === "upscale"),
);

// ============ 6. 积分阈值合理性 ============
ok(
  "28. confirmIfPointsOver > taobao-launch（商业片消耗更高）",
  skill.confirmIfPointsOver > taobaoSkill.confirmIfPointsOver,
  `promo=${skill.confirmIfPointsOver} taobao=${taobaoSkill.confirmIfPointsOver}`,
);

// ============ 总结 ============
const failed = results.filter((r) => !r.pass).length;
console.log(`\n=== 总结 ===\n${results.length - failed}/${results.length} 通过，${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);
