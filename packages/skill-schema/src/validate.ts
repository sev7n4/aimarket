/**
 * Skill YAML 校验函数
 */
import { parse } from "yaml";
import { SkillSchema } from "./schema.js";

/**
 * 校验 Skill YAML 内容
 * @param yamlContent Skill YAML 字符串
 * @returns 校验结果：valid 为 true 时通过，false 时 errors 包含错误信息
 */
export function validateSkill(
  yamlContent: string,
): { valid: boolean; errors?: string[] } {
  let parsed: unknown;
  try {
    parsed = parse(yamlContent);
  } catch (e) {
    return {
      valid: false,
      errors: [`YAML 解析失败: ${(e as Error).message}`],
    };
  }

  const result = SkillSchema.safeParse(parsed);
  if (result.success) {
    return { valid: true };
  }

  return {
    valid: false,
    errors: result.error.errors.map(
      (e) => `${e.path.join(".")}: ${e.message}`,
    ),
  };
}
