/** 画布焦点编辑：与 API `focusPointEntrySchema` 对齐 */
export type FocusEditIntent = "edit" | "replace";

/** 物体语义类别 */
export type ObjectCategory =
  | "text"
  | "person"
  | "face"
  | "small-object"
  | "medium-object"
  | "large-object"
  | "background"
  | "unknown";

export interface FocusPointChip {
  pointId: string;
  objectName: string;
  /** 归一化坐标 0–1，相对源图 */
  x: number;
  y: number;
  itemId: string;
  /** 该焦点对应的短 prompt（chip 内编辑） */
  chipPrompt?: string;
  /** 对象替换时上传的参考图 assetId */
  replaceAssetId?: string;
  replaceAssetUrl?: string;
  /** 推断的物体类别 */
  category?: ObjectCategory;
  /** 该焦点与其他焦点的关系描述（多点依赖推理） */
  relation?: string;
}

/* ── 关键词表（中英文） ── */

const TEXT_KEYWORDS =
  /字|文字|标题|标签|水印|签名|文本|letter|word|text|title|label/i;
const PERSON_KEYWORDS =
  /人|人物|女孩|男孩|男人|女人|老人|小孩|person|man|woman|girl|boy/i;
const FACE_KEYWORDS = /脸|面部|眼睛|嘴巴|鼻子|face|eye|mouth|nose/i;
const BACKGROUND_KEYWORDS =
  /天空|背景|地面|地板|墙壁|草地|sky|background|ground|wall|floor/i;
const SIZE_PREFIX = /^\[([SML])\]/;

/** 根据物体名称推断语义类别 */
export function inferObjectCategory(objectName: string): ObjectCategory {
  const str = objectName.trim();

  // 通过前缀 [S]/[M]/[L] 显式指定大小
  const sizeMatch = SIZE_PREFIX.exec(str);
  if (sizeMatch) {
    const s = sizeMatch[1];
    if (s === "S") return "small-object";
    if (s === "M") return "medium-object";
    if (s === "L") return "large-object";
  }

  if (TEXT_KEYWORDS.test(str)) return "text";
  if (FACE_KEYWORDS.test(str)) return "face";
  if (PERSON_KEYWORDS.test(str)) return "person";
  if (BACKGROUND_KEYWORDS.test(str)) return "background";

  return "unknown";
}

/** 根据物体类别推荐默认 cropSize */
export function recommendCropSize(category: ObjectCategory): number {
  const map: Record<ObjectCategory, number> = {
    text: 64,
    face: 96,
    "small-object": 96,
    person: 192,
    "medium-object": 192,
    "large-object": 256,
    background: 256,
    unknown: 128,
  };
  return map[category];
}

/** 根据物体类别推荐默认 intent */
export function recommendIntent(category: ObjectCategory): FocusEditIntent {
  if (category === "text" || category === "face") return "edit";
  return "replace";
}

export const MAX_FOCUS_POINTS = 10;

export const CROP_SIZE_OPTIONS = [
  { value: 64, label: "精细（64px）", hint: "适合小物体、文字" },
  { value: 128, label: "标准（128px）", hint: "推荐默认" },
  { value: 192, label: "宽松（192px）", hint: "适合中等物体" },
  { value: 256, label: "宽泛（256px）", hint: "适合大物体" },
];

export const DEFAULT_CROP_SIZE = 128;

export interface FocusEditSession {
  itemId: string;
  points: FocusPointChip[];
  intent: FocusEditIntent;
  cropSize: number;
}