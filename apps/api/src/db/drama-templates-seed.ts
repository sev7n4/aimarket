import { db } from "./index.js";

/**
 * Phase 4 Task 4.3 — 预置工作流模板
 *
 * 三套预置模板：短剧标准流程 / MV 制作 / 广告 TVC。
 * 用户在画布上选中节点组 → 保存为模板时，会写入 is_preset=0 的用户模板；
 * 此处仅初始化 is_preset=1 的系统预置模板。
 */
type PresetTemplate = {
  id: string;
  name: string;
  category: "short_drama" | "mv" | "tvc";
  description: string;
  templateJson: string;
};

const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    id: "preset-short-drama",
    name: "短剧标准流程",
    category: "short_drama",
    description:
      "标准 90 秒竖屏短剧：剧本 → 角色三视图 → 场景 → 分镜 → 关键帧 → 视频 → 拼接。",
    templateJson: JSON.stringify({
      userIdea:
        "一个都市短剧：女主在咖啡店偶遇初恋，两人重逢后揭开当年的误会，最终和好。",
      projectType: "short_drama",
      targetDurationSec: 90,
      aspectRatio: "9:16",
      nodeTemplate: {
        nodes: [
          { type: "script", title: "剧本", role: "source" },
          { type: "character", title: "主角", role: "source" },
          { type: "scene", title: "咖啡店", role: "source" },
          { type: "shot", title: "分镜 #1-12", role: "consumer" },
        ],
        connections: [
          { from: "script", to: "shot" },
          { from: "character", to: "shot" },
          { from: "scene", to: "shot" },
        ],
      },
    }),
  },
  {
    id: "preset-mv",
    name: "MV 制作",
    category: "mv",
    description:
      "音乐 MV 流程：主题创意 → 视觉风格板 → 场景分镜 → 关键帧 → 视频片段 → 音乐合成。",
    templateJson: JSON.stringify({
      userIdea:
        "一首关于夏日夜空的 MV，节奏由慢到快，配合星辰、海浪与城市夜景画面。",
      projectType: "mv",
      targetDurationSec: 120,
      aspectRatio: "16:9",
      nodeTemplate: {
        nodes: [
          { type: "script", title: "MV 主题", role: "source" },
          { type: "scene", title: "夜空 / 海浪 / 城市", role: "source" },
          { type: "shot", title: "镜头分段", role: "consumer" },
        ],
        connections: [
          { from: "script", to: "shot" },
          { from: "scene", to: "shot" },
        ],
      },
    }),
  },
  {
    id: "preset-tvc",
    name: "广告 TVC",
    category: "tvc",
    description:
      "30 秒商品 TVC：产品定位 → 卖点拆解 → 视觉风格 → 分镜 → 关键帧 → 视频 → 配音字幕。",
    templateJson: JSON.stringify({
      userIdea:
        "一款无线降噪耳机的 30 秒 TVC：突出沉浸音质、长续航、商务便携三个卖点。",
      projectType: "creative",
      targetDurationSec: 30,
      aspectRatio: "16:9",
      nodeTemplate: {
        nodes: [
          { type: "script", title: "TVC 脚本", role: "source" },
          { type: "character", title: "模特/产品", role: "source" },
          { type: "scene", title: "商务场景", role: "source" },
          { type: "shot", title: "镜头 1-6", role: "consumer" },
        ],
        connections: [
          { from: "script", to: "shot" },
          { from: "character", to: "shot" },
          { from: "scene", to: "shot" },
        ],
      },
    }),
  },
];

export function seedDramaTemplates() {
  for (const tpl of PRESET_TEMPLATES) {
    const exists = db
      .prepare("SELECT id FROM drama_templates WHERE id = ?")
      .get(tpl.id);
    if (exists) continue;
    db.prepare(
      `INSERT INTO drama_templates
       (id, user_id, name, category, description, template_json, is_preset, created_at, updated_at)
       VALUES (?, NULL, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`,
    ).run(tpl.id, tpl.name, tpl.category, tpl.description, tpl.templateJson);
  }
}
