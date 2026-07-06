# L0 Domain — 项目类型变体

> 影响：director systemPrompt 分支、默认时长、Skill 选择

---

## 变体矩阵

| projectType | 标签 | 默认时长 | Director persona 侧重 | 制作 Skill |
|-------------|------|----------|----------------------|------------|
| `short_drama` | 短剧 | 90s | 情绪节奏与 acts 一致；商业短剧视觉 | `drama-short-v1` |
| `mv` | MV / 音乐短片 | 60s | 霓虹/高饱和；BGM 节拍切镜；对白极少 | `drama-mv-v1` |
| `creative` | 创意实验 | 90s | 撞色/超现实；叙事可碎片化 | `drama-short-v1`（或专用 skill） |

实现：`director.ts` → `directorBrief(ctx)` 按 `input.projectType` 切换 systemPrompt。

---

## 共用 Domain 规则

- 画幅：`aspectRatio` 默认 `9:16`，导演输出 `styleBible.aspectRatio` 强制对齐
- 分镜数：8–15 镜（writer + storyboard schema 双约束）
- 角色数：1–4（character schema maxItems: 4）
- 旁白：`narratorLines[]` 由 writer 产出，Skill `narrator_tts` 使用

---

## Replicate 模式

`PlanDramaInput.replicateProfile` 可选注入爆款结构参考（beatStructure、styleHints），各 Agent userPrompt 可扩展读取——当前 writer 以 `userIdea` 为主，replicate 字段在 `planner.ts` 规则路径使用较多。

---

## 扩展新变体 checklist

1. 在 [manifest.yaml](../manifest.yaml) `domain.projectTypes` 注册
2. `director.ts` 增加 `directorBrief` 分支
3. 评估是否需要独立 Skill YAML
4. 更新 [agents/director.md](../agents/director.md) 变体表
5. 单测覆盖新 projectType
