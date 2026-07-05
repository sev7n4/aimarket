import { completeWithFallback, isAgentLlmEnabled } from "@aimarket/agent-core";
import {
  dramaProjectSchema,
  type DramaProjectData,
  type StoryboardShot,
} from "./schema.js";
import { buildGlobalContextBlock } from "./prompt-builders.js";
import { planDramaProjectMultiAgent } from "./planner/index.js";
import { isDramaMultiAgentPlanEnabled } from "./planner/reasoning.js";
import type { PlanDramaInput } from "./planner/types.js";

export type { PlanDramaInput } from "./planner/types.js";

export type DramaPlanMode = "single" | "multi_agent";

export interface PlanDramaOptions {
  planMode?: DramaPlanMode;
}

const DRAMA_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "logline",
    "styleBible",
    "characters",
    "scenes",
    "shots",
  ],
  properties: {
    title: { type: "string" },
    logline: { type: "string" },
    styleBible: {
      type: "object",
      required: ["palette", "lightingStyle", "aspectRatio", "negativePrompt"],
      properties: {
        palette: { type: "array", items: { type: "string" }, minItems: 2 },
        lightingStyle: { type: "string" },
        filmGrain: { type: "string" },
        aspectRatio: { type: "string", enum: ["9:16", "16:9"] },
        negativePrompt: { type: "string" },
      },
    },
    characters: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: {
        type: "object",
        required: [
          "id",
          "name",
          "personalityTone",
          "visualSignature",
          "promptAnchor",
        ],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          role: { type: "string" },
          personalityTone: { type: "string" },
          voiceStyle: { type: "string" },
          promptAnchor: { type: "string" },
          visualSignature: {
            type: "object",
            required: [
              "ageRange",
              "faceShape",
              "eyeShape",
              "hairStyle",
              "skinTone",
              "signatureOutfit",
            ],
            properties: {
              ageRange: { type: "string" },
              faceShape: { type: "string" },
              eyeShape: { type: "string" },
              hairStyle: { type: "string" },
              skinTone: { type: "string" },
              signatureOutfit: { type: "string" },
              distinguishingFeatures: {
                type: "array",
                items: { type: "string" },
              },
            },
          },
        },
      },
    },
    scenes: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["id", "name", "location", "atmosphere", "promptAnchor"],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          location: { type: "string" },
          era: { type: "string" },
          atmosphere: { type: "string" },
          props: { type: "array", items: { type: "string" } },
          promptAnchor: { type: "string" },
        },
      },
    },
    shots: {
      type: "array",
      minItems: 8,
      maxItems: 15,
      items: {
        type: "object",
        required: [
          "id",
          "order",
          "sceneId",
          "characterIds",
          "visualPrompt",
          "motionPrompt",
          "cameraSpec",
          "durationSec",
        ],
        properties: {
          id: { type: "string" },
          order: { type: "number" },
          sceneId: { type: "string" },
          characterIds: { type: "array", items: { type: "string" } },
          dialogue: {
            type: "array",
            items: {
              type: "object",
              required: ["characterId", "line"],
              properties: {
                characterId: { type: "string" },
                line: { type: "string" },
              },
            },
          },
          visualPrompt: { type: "string" },
          motionPrompt: { type: "string" },
          durationSec: { type: "number" },
          useLastFrameContinuity: { type: "boolean" },
          cameraSpec: {
            type: "object",
            required: ["shotSize", "movement", "lighting"],
            properties: {
              shotSize: { type: "string" },
              movement: { type: "string" },
              lighting: { type: "string" },
              colorTemp: { type: "string" },
            },
          },
        },
      },
    },
    acts: {
      type: "array",
      items: {
        type: "object",
        required: ["act", "sceneId", "summary"],
        properties: {
          act: { type: "number" },
          sceneId: { type: "string" },
          summary: { type: "string" },
          emotion: { type: "string" },
        },
      },
    },
    narratorLines: { type: "array", items: { type: "string" } },
  },
};

export function buildRuleBasedProject(input: PlanDramaInput): DramaProjectData {
  const projectType = input.projectType ?? "short_drama";
  const aspectRatio = input.aspectRatio ?? "9:16";
  const defaultDuration =
    projectType === "mv" ? 60 : input.targetDurationSec ?? 90;
  const targetDurationSec = input.targetDurationSec ?? defaultDuration;
  const shotCount = projectType === "mv" ? 8 : 10;
  const actCount =
    targetDurationSec <= 45 ? 2 : targetDurationSec <= 90 ? 3 : targetDurationSec <= 150 ? 4 : 5;
  const actSummaries = [
    "开端：建立人物与冲突",
    "发展：矛盾升级",
    "转折：意外与选择",
    "高潮：冲突爆发",
    "结局：收束与余韵",
  ];
  const acts = Array.from({ length: actCount }, (_, i) => ({
    act: i + 1,
    sceneId: i < 2 ? "scene_1" : "scene_2",
    summary: actSummaries[i] ?? `第 ${i + 1} 幕`,
  }));

  const shots: StoryboardShot[] = Array.from({ length: shotCount }, (_, i) => ({
    id: `shot_${i + 1}`,
    order: i,
    sceneId: i < shotCount / 2 ? "scene_1" : "scene_2",
    characterIds: i % 3 === 0 ? ["char_1"] : ["char_1", "char_2"],
    dialogue:
      projectType === "mv"
        ? i === 0
          ? [{ characterId: "char_1", line: "（哼唱）跟着节拍走下去" }]
          : []
        : i % 2 === 0
          ? [
              {
                characterId: "char_1",
                line: `这是第${i + 1}镜的对白，推动剧情发展。`,
              },
            ]
          : [],
    visualPrompt:
      projectType === "creative"
        ? `镜头${i + 1}：${input.userIdea.slice(0, 40)}，超现实意象与装置艺术构图`
        : projectType === "mv"
          ? `镜头${i + 1}：${input.userIdea.slice(0, 40)}，舞台灯光与节拍切镜`
          : `镜头${i + 1}：${input.userIdea.slice(0, 40)}相关画面，电影感构图`,
    motionPrompt:
      projectType === "mv"
        ? "鼓点切镜，快切与慢动作交替"
        : i % 2 === 0
          ? "缓慢推近，情绪张力"
          : "固定机位，微晃纪实感",
    cameraSpec: {
      shotSize: i % 3 === 0 ? "特写 CU" : "中景 MS",
      movement: projectType === "mv" ? "跟拍" : i % 2 === 0 ? "推镜头" : "固定",
      lighting: projectType === "creative" ? "高对比实验光" : "侧光，戏剧对比",
      colorTemp: projectType === "mv" ? "霓虹冷色" : "暖色调",
    },
    durationSec: projectType === "mv" ? 4 : 5,
    useLastFrameContinuity: i > 0 && i < shotCount / 2,
    status: "pending" as const,
  }));

  const project: DramaProjectData = {
    projectType,
    userIdea: input.userIdea,
    targetDurationSec,
    script: {
      title:
        projectType === "mv"
          ? "AI MV"
          : projectType === "creative"
            ? "创意短片"
            : "AI 短剧",
      logline: input.userIdea.slice(0, 120),
      acts,
      narratorLines:
        projectType === "mv"
          ? ["音乐铺底，单线情绪推进至高潮。"]
          : projectType === "creative"
            ? ["碎片意象串联情绪与隐喻。"]
            : ["这是一个关于重逢与和解的故事。"],
    },
    styleBible: {
      palette:
        projectType === "mv"
          ? ["霓虹紫", "电光蓝", "高光白"]
          : projectType === "creative"
            ? ["品红", "青绿", "深黑"]
            : ["暖金", "深棕", "柔白"],
      lightingStyle:
        projectType === "mv"
          ? "舞台追光，强节奏明暗闪烁"
          : projectType === "creative"
            ? "超现实侧光，高反差剪影"
            : "电影感侧光，浅景深",
      filmGrain: "轻微胶片颗粒",
      aspectRatio,
      negativePrompt: "变形、多余肢体、文字水印、风格不一致",
    },
    characters: [
      {
        id: "char_1",
        name: "主角",
        role: "主人公",
        personalityTone: "坚韧内敛",
        visualSignature: {
          ageRange: "25-30岁",
          faceShape: "鹅蛋",
          eyeShape: "杏仁眼",
          hairStyle: "黑色短发",
          skinTone: "自然",
          signatureOutfit: "简约白衬衫",
          distinguishingFeatures: ["左眉细疤"],
        },
        promptAnchor:
          "25岁亚洲女性，鹅蛋脸杏仁眼，黑色短发，白衬衫，左眉细疤",
        voiceStyle: "温柔坚定",
      },
      {
        id: "char_2",
        name: "配角",
        role: "对手/友人",
        personalityTone: "外向直接",
        visualSignature: {
          ageRange: "28-32岁",
          faceShape: "方脸",
          eyeShape: "单眼皮",
          hairStyle: "棕色卷发",
          skinTone: "小麦色",
          signatureOutfit: "深色夹克",
          distinguishingFeatures: [],
        },
        promptAnchor: "30岁男性，方脸单眼皮，棕色卷发，深色夹克",
        voiceStyle: "爽朗",
      },
    ],
    scenes: [
      {
        id: "scene_1",
        name: "室内",
        location: "现代公寓客厅",
        atmosphere: "温馨但紧张",
        props: ["沙发", "落地窗"],
        promptAnchor: "现代公寓客厅，落地窗，傍晚暖光",
      },
      {
        id: "scene_2",
        name: "室外",
        location: "城市街道",
        atmosphere: "霓虹夜景",
        props: ["路灯", "雨迹地面"],
        promptAnchor: "雨夜城市街道，霓虹反射",
      },
    ],
    shots,
    productionParams: {
      aspectRatio,
      imageModelId: "omni-v2",
      videoModelId: "wan-2.6",
      resolution: "1k",
      previewTier: "full",
      autoQcRetry: false,
      qcRetryThreshold: 70,
      qcAutoRetryMaxShots: 1,
    },
  };

  project.styleBible.globalContextBlock = buildGlobalContextBlock(
    project.styleBible,
    project.characters,
  );
  return project;
}

export async function planDramaSingleLlm(
  input: PlanDramaInput,
): Promise<DramaProjectData> {
  const duration = input.targetDurationSec ?? 90;
  const aspectRatio = input.aspectRatio ?? "9:16";

  const result = await completeWithFallback({
    messages: [
      {
        role: "system",
        content: `你是专业 AI 短剧总编剧（借鉴 RHTV / Dreamina 工作流）。
规则：
1. 输出 8-15 个分镜，总时长约 ${duration} 秒，每镜 3-8 秒。
2. 先锁定角色视觉（promptAnchor 必须具体可执行），再写分镜。
3. 同场景连续镜头设置 useLastFrameContinuity=true（尾帧衔接）。
4. 每个角色需 visualSignature 全字段 + 三视图可用的 promptAnchor。
5. styleBible 需含 palette、lightingStyle、negativePrompt。
6. 含对白镜头需在 dialogue 中写清 characterId 与 line。
7. 只输出 JSON，不要 markdown。`,
      },
      {
        role: "user",
        content: `用户想法：${input.userIdea}\n画幅：${aspectRatio}\n目标时长：${duration}秒`,
      },
    ],
    jsonSchema: DRAMA_JSON_SCHEMA,
    temperature: 0.4,
    maxTokens: 8192,
  });

  const parsed = JSON.parse(result.content) as Record<string, unknown>;
  const project = dramaProjectSchema.parse({
    projectType: input.projectType ?? "short_drama",
    userIdea: input.userIdea,
    targetDurationSec: duration,
    script: {
      title: parsed.title,
      logline: parsed.logline,
      acts: parsed.acts ?? [],
      narratorLines: parsed.narratorLines ?? [],
    },
    styleBible: parsed.styleBible,
    characters: parsed.characters,
    scenes: parsed.scenes,
    shots: (parsed.shots as StoryboardShot[]).map((s) => ({
      ...s,
      status: "pending",
    })),
    productionParams: {
      aspectRatio,
      imageModelId: "omni-v2",
      videoModelId: "wan-2.6",
      resolution: "1k",
    },
  });

  project.styleBible.globalContextBlock = buildGlobalContextBlock(
    project.styleBible,
    project.characters,
  );
  return project;
}

function resolvePlanMode(options?: PlanDramaOptions): DramaPlanMode {
  if (options?.planMode) return options.planMode;
  return isDramaMultiAgentPlanEnabled() ? "multi_agent" : "single";
}

export async function planDramaProject(
  input: PlanDramaInput,
  options?: PlanDramaOptions,
): Promise<DramaProjectData> {
  if (!isAgentLlmEnabled()) {
    return buildRuleBasedProject(input);
  }

  const planMode = resolvePlanMode(options);

  if (planMode === "multi_agent") {
    try {
      return await planDramaProjectMultiAgent(input);
    } catch (err) {
      console.warn("[drama-plan] multi_agent failed, fallback to single:", err);
      try {
        return await planDramaSingleLlm(input);
      } catch {
        return buildRuleBasedProject(input);
      }
    }
  }

  try {
    return await planDramaSingleLlm(input);
  } catch {
    return buildRuleBasedProject(input);
  }
}
