import type {
  CharacterCard,
  CharacterAngle,
  SceneCard,
  StoryboardShot,
  StyleBible,
} from "./schema.js";

const CHARACTER_ANGLES: Record<CharacterAngle, string> = {
  front: "正面全身照，直视镜头，中性表情，纯色背景",
  three_quarter: "四分之三侧面全身照，同一角色同一服装，纯色背景",
  side: "侧面全身照，同一角色同一服装，纯色背景",
};

/** RHTV Anchor First：构建角色定稿板 prompt */
export function buildCharacterRefPrompt(
  character: CharacterCard,
  angle: CharacterAngle,
  styleBible: StyleBible,
): string {
  const sig = character.visualSignature;
  const features = sig.distinguishingFeatures.join("、");
  return [
    "【角色定稿板 - Anchor First】",
    styleBible.globalContextBlock ?? "",
    character.promptAnchor,
    `年龄${sig.ageRange}，${sig.faceShape}脸型，${sig.eyeShape}，${sig.hairStyle}，${sig.skinTone}肤色`,
    `标志性服装：${sig.signatureOutfit}`,
    features ? `辨识特征：${features}` : "",
    CHARACTER_ANGLES[angle] ?? CHARACTER_ANGLES.front,
    `画风：${styleBible.lightingStyle}`,
    styleBible.negativePrompt ? `避免：${styleBible.negativePrompt}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildSceneRefPrompt(
  scene: SceneCard,
  styleBible: StyleBible,
): string {
  return [
    "【场景定稿 - 空镜 establishing shot】",
    styleBible.globalContextBlock ?? "",
    scene.promptAnchor,
    `地点：${scene.location}`,
    scene.era ? `时代：${scene.era}` : "",
    `氛围：${scene.atmosphere}`,
    scene.props.length ? `道具：${scene.props.join("、")}` : "",
    `色调：${styleBible.palette.join("、")}`,
    `光影：${styleBible.lightingStyle}`,
    "无人物，广角空镜",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Dream.ai 全局上下文块 + 角色 DNA 注入 */
export function buildKeyframePrompt(
  shot: StoryboardShot,
  characters: CharacterCard[],
  scene: SceneCard | undefined,
  styleBible: StyleBible,
): string {
  const charAnchors = shot.characterIds
    .map((id) => characters.find((c) => c.id === id)?.promptAnchor)
    .filter(Boolean);

  return [
    "【分镜关键帧】",
    styleBible.globalContextBlock ?? "",
    ...charAnchors.map((a) => `【角色锚点】${a}`),
    scene ? `【场景】${scene.promptAnchor}` : "",
    shot.visualPrompt,
    `景别：${shot.cameraSpec.shotSize}`,
    `机位运动：${shot.cameraSpec.movement}`,
    `灯光：${shot.cameraSpec.lighting}`,
    shot.cameraSpec.colorTemp ? `色温：${shot.cameraSpec.colorTemp}` : "",
    `画风：${styleBible.lightingStyle}，色板：${styleBible.palette.join("、")}`,
    styleBible.negativePrompt ? `避免：${styleBible.negativePrompt}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildShotVideoPrompt(
  shot: StoryboardShot,
  characters: CharacterCard[],
  styleBible: StyleBible,
): string {
  const dialogue = shot.dialogue
    .map((d) => {
      const name = characters.find((c) => c.id === d.characterId)?.name ?? "";
      return `${name}：${d.line}`;
    })
    .join(" ");

  return [
    "【图生视频 - 关键帧锁定】",
    styleBible.globalContextBlock ?? "",
    shot.motionPrompt,
    dialogue ? `对白情境：${dialogue}` : "",
    `镜头：${shot.cameraSpec.movement}，${shot.cameraSpec.lighting}`,
    "保持角色身份与关键帧一致，禁止换脸",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildGlobalContextBlock(
  styleBible: StyleBible,
  characters: CharacterCard[],
): string {
  const charDesc = characters
    .map((c) => `${c.name}：${c.promptAnchor}`)
    .join("；");
  return [
    `【全片视觉锁定】画风：${styleBible.lightingStyle}`,
    `主色板：${styleBible.palette.join("、")}`,
    `画幅：${styleBible.aspectRatio}`,
    `角色设定：${charDesc}`,
    "所有镜头必须保持角色面部、服装、风格完全一致",
  ].join("\n");
}

export const CHARACTER_REF_ANGLES = ["front", "three_quarter", "side"] as const;
