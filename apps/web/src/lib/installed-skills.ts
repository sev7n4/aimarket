const STORAGE_KEY = "aimarket_installed_skills";
const YAML_KEY = "aimarket_installed_skill_yaml";

export function getInstalledSkillIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function getInstalledSkillYamlMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(YAML_KEY) ?? "{}") as Record<
      string,
      string
    >;
  } catch {
    return {};
  }
}

export function isSkillInstalled(skillId: string): boolean {
  return getInstalledSkillIds().includes(skillId);
}

/** 将市场 Skill 安装到 Studio（localStorage + 可选 YAML 缓存） */
export function installSkillToStudio(skillId: string, skillYaml?: string): void {
  const installed = getInstalledSkillIds();
  if (!installed.includes(skillId)) {
    installed.push(skillId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(installed));
  }
  if (skillYaml) {
    const map = getInstalledSkillYamlMap();
    map[skillId] = skillYaml;
    localStorage.setItem(YAML_KEY, JSON.stringify(map));
  }
}

export function parseSkillIdFromYaml(skillYaml: string): string | null {
  const match = skillYaml.match(/^id:\s*([^\s#]+)/m);
  return match?.[1] ?? null;
}
