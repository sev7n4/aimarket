import type { DramaProjectData } from "./schema.js";
import { estimatePoints } from "../pricing.js";

const DRAMA_TOOL_POINTS: Record<string, number> = {
  tts: 5,
  lipsync: 15,
  concat: 10,
};

/** 按镜头数估算整包积分（RHTV 式制作前明细预估） */
export function estimateDramaPoints(project: DramaProjectData): number {
  const shotCount = project.shots.length;
  const charCount = project.characters.length;
  const sceneCount = project.scenes.length;
  const res = project.productionParams?.resolution ?? "1k";
  const imageModel = project.productionParams?.imageModelId ?? "agnes-image";
  const videoModel = project.productionParams?.videoModelId ?? "wan-2.6";

  let total = 0;
  // 角色三视图 Anchor First
  total += charCount * 3 * estimatePoints(imageModel, 1, res);
  // 场景定稿
  total += sceneCount * estimatePoints(imageModel, 1, res);
  // 分镜关键帧
  total += shotCount * estimatePoints(imageModel, 1, res);
  // 逐镜视频
  total += shotCount * estimatePoints(videoModel, 1, res);
  // TTS（有对白的镜头）
  const dialogueShots = project.shots.filter((s) => s.dialogue.length > 0).length;
  total += dialogueShots * (DRAMA_TOOL_POINTS.tts ?? 5);
  // 口型同步
  total += dialogueShots * (DRAMA_TOOL_POINTS.lipsync ?? 15);
  // 剪辑合成
  total += DRAMA_TOOL_POINTS.concat ?? 10;

  return total;
}

export const DRAMA_CONFIRM_POINTS_THRESHOLD = 200;
