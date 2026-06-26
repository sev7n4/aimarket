import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { skillDefinitionSchema, type SkillDefinition } from "./schema.js";

function resolveSkillsDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const built = path.join(here, "skills");
  if (fs.existsSync(built)) return built;
  return path.join(here, "..", "skills");
}

export function listSkillIds(): string[] {
  const dir = resolveSkillsDir();
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .map((f) => f.replace(/\.(yaml|yml)$/, ""));
}

export function loadSkill(skillId: string): SkillDefinition {
  const dir = resolveSkillsDir();
  const yamlPath =
    fs.existsSync(path.join(dir, `${skillId}.yaml`))
      ? path.join(dir, `${skillId}.yaml`)
      : path.join(dir, `${skillId}.yml`);
  if (!fs.existsSync(yamlPath)) {
    throw new Error(`SKILL_NOT_FOUND: ${skillId}`);
  }
  const raw = parse(fs.readFileSync(yamlPath, "utf8"));
  const skill = skillDefinitionSchema.parse(raw);
  if (skill.id !== skillId) {
    throw new Error(`SKILL_ID_MISMATCH: file ${skillId}, id ${skill.id}`);
  }
  return skill;
}

export function listSkillsPublic(): Array<{
  id: string;
  version: number;
  name: string;
  description?: string;
  stepCount: number;
  confirmIfPointsOver: number;
}> {
  return listSkillIds().map((id) => {
    const s = loadSkill(id);
    return {
      id: s.id,
      version: s.version,
      name: s.name,
      description: s.description,
      stepCount: s.steps.length,
      confirmIfPointsOver: s.confirmIfPointsOver,
    };
  });
}

/**
 * PROD-D03 — 从 YAML 字符串解析 SkillDefinition（供 marketplace 上架校验）
 * 与 loadSkill 不同，不要求文件存在，也不校验 id 与文件名匹配。
 */
export function parseSkillFromYamlString(raw: string): SkillDefinition {
  const parsed = parse(raw);
  return skillDefinitionSchema.parse(parsed);
}
