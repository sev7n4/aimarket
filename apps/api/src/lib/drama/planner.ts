import { completeWithFallback, isAgentLlmEnabled } from "@aimarket/agent-core";
import {
  dramaProjectSchema,
  type DramaProjectData,
  type StoryboardShot,
} from "./schema.js";
import { buildGlobalContextBlock } from "./prompt-builders.js";

export interface PlanDramaInput {
  userIdea: string;
  targetDurationSec?: number;
  aspectRatio?: "9:16" | "16:9";
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

function buildRuleBasedProject(input: PlanDramaInput): DramaProjectData {
  const aspectRatio = input.aspectRatio ?? "9:16";
  const shots: StoryboardShot[] = Array.from({ length: 10 }, (_, i) => ({
    id: `shot_${i + 1}`,
    order: i,
    sceneId: i < 5 ? "scene_1" : "scene_2",
    characterIds: i % 3 === 0 ? ["char_1"] : ["char_1", "char_2"],
    dialogue:
      i % 2 === 0
        ? [
            {
              characterId: "char_1",
              line: `这是第${i + 1}镜的对白，推动剧情发展。`,
            },
          ]
        : [],
    visualPrompt: `镜头${i + 1}：${input.userIdea.slice(0, 40)}相关画面，电影感构图`,
    motionPrompt: i % 2 === 0 ? "缓慢推近，情绪张力" : "固定机位，微晃纪实感",
    cameraSpec: {
      shotSize: i % 3 === 0 ? "特写 CU" : "中景 MS",
      movement: i % 2 === 0 ? "推镜头" : "固定",
      lighting: "侧光，戏剧对比",
      colorTemp: "暖色调",
    },
    durationSec: 5,
    useLastFrameContinuity: i > 0 && i < 5,
    status: "pending" as const,
  }));

  const project: DramaProjectData = {
    userIdea: input.userIdea,
    targetDurationSec: input.targetDurationSec ?? 90,
    script: {
      title: "AI 短剧",
      logline: input.userIdea.slice(0, 120),
      acts: [
        { act: 1, sceneId: "scene_1", summary: "开端：建立人物与冲突" },
        { act: 2, sceneId: "scene_1", summary: "发展：矛盾升级" },
        { act: 3, sceneId: "scene_2", summary: "高潮与结局" },
      ],
      narratorLines: ["这是一个关于重逢与和解的故事。"],
    },
    styleBible: {
      palette: ["暖金", "深棕", "柔白"],
      lightingStyle: "电影感侧光，浅景深",
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
      imageModelId: "agnes-image",
      videoModelId: "wan-2.6",
      resolution: "1k",
      previewTier: "full",
    },
  };

  project.styleBible.globalContextBlock = buildGlobalContextBlock(
    project.styleBible,
    project.characters,
  );
  return project;
}

export async function planDramaProject(
  input: PlanDramaInput,
): Promise<DramaProjectData> {
  if (!isAgentLlmEnabled()) {
    return buildRuleBasedProject(input);
  }

  const duration = input.targetDurationSec ?? 90;
  const aspectRatio = input.aspectRatio ?? "9:16";

  try {
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
        imageModelId: "agnes-image",
        videoModelId: "wan-2.6",
        resolution: "1k",
      },
    });

    project.styleBible.globalContextBlock = buildGlobalContextBlock(
      project.styleBible,
      project.characters,
    );
    return project;
  } catch {
    return buildRuleBasedProject(input);
  }
}
