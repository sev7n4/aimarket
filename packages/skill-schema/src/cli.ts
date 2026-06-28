#!/usr/bin/env node
/**
 * Skill 校验器 CLI
 * 用法: npx @aimarket/skill-schema validate skill.yaml
 */
import fs from "node:fs";
import path from "node:path";
import { validateSkill } from "./validate.js";

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
  console.log("用法: npx @aimarket/skill-schema validate <skill.yaml>");
  console.log("  校验 Skill YAML 文件是否符合 schema");
  process.exit(0);
}

const command = args[0];
const filePath = args[1];

if (command !== "validate" || !filePath) {
  console.error("错误: 未知命令。用法: npx @aimarket/skill-schema validate <skill.yaml>");
  process.exit(1);
}

const resolvedPath = path.resolve(filePath);
if (!fs.existsSync(resolvedPath)) {
  console.error(`错误: 文件不存在 ${resolvedPath}`);
  process.exit(1);
}

const yamlContent = fs.readFileSync(resolvedPath, "utf-8");
const result = validateSkill(yamlContent);

if (result.valid) {
  console.log("✅ Skill YAML 校验通过");
  process.exit(0);
} else {
  console.error("❌ Skill YAML 校验失败:");
  for (const err of result.errors ?? []) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}
