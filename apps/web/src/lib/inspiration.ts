export interface InspirationItem {
  id: string;
  title: string;
  category: string;
  gradient: string;
  aspect: "portrait" | "landscape" | "square";
  prompt: string;
}

export const inspirationItems: InspirationItem[] = [
  {
    id: "1",
    title: "产品摄影图",
    category: "电商",
    gradient: "from-amber-900/80 to-stone-900",
    aspect: "portrait",
    prompt: "将产品放在大理石台面上，柔和侧光，商业摄影质感",
  },
  {
    id: "2",
    title: "虚拟试衣",
    category: "服饰",
    gradient: "from-rose-900/80 to-zinc-900",
    aspect: "portrait",
    prompt: "让模特穿上这件外套，自然站姿，街拍风格",
  },
  {
    id: "3",
    title: "商品海报图制作",
    category: "营销",
    gradient: "from-orange-900/80 to-red-950",
    aspect: "landscape",
    prompt: "制作促销海报，突出新品上市与限时折扣",
  },
  {
    id: "4",
    title: "社媒配图",
    category: "新媒体",
    gradient: "from-fuchsia-900/80 to-purple-950",
    aspect: "square",
    prompt: "小红书风格封面，标题醒目，清新配色",
  },
  {
    id: "5",
    title: "电商详情图",
    category: "电商",
    gradient: "from-sky-900/80 to-slate-900",
    aspect: "portrait",
    prompt: "生成详情页卖点模块，突出核心功能与材质",
  },
  {
    id: "6",
    title: "超现实产品海报",
    category: "创意",
    gradient: "from-violet-900/80 to-indigo-950",
    aspect: "landscape",
    prompt: "超现实场景，产品悬浮，霓虹光效",
  },
  {
    id: "7",
    title: "产品精修白底图",
    category: "电商",
    gradient: "from-zinc-700/80 to-zinc-900",
    aspect: "square",
    prompt: "抠图并生成纯白底商品主图，边缘干净",
  },
  {
    id: "8",
    title: "美式证件照",
    category: "人像",
    gradient: "from-blue-900/80 to-slate-900",
    aspect: "portrait",
    prompt: "美式证件照风格，背景纯色，光线均匀",
  },
  {
    id: "9",
    title: "照片修复上色",
    category: "修复",
    gradient: "from-stone-700/80 to-stone-900",
    aspect: "landscape",
    prompt: "修复老照片划痕并自然上色",
  },
  {
    id: "10",
    title: "小红书海报",
    category: "新媒体",
    gradient: "from-pink-900/80 to-rose-950",
    aspect: "portrait",
    prompt: "小红书竖版海报，大字标题，生活感构图",
  },
  {
    id: "11",
    title: "电商主图",
    category: "电商",
    gradient: "from-emerald-900/80 to-teal-950",
    aspect: "square",
    prompt: "淘宝主图风格，产品居中，干净背景",
  },
  {
    id: "12",
    title: "影视分镜",
    category: "创意",
    gradient: "from-slate-800/80 to-black",
    aspect: "landscape",
    prompt: "电影分镜风格，戏剧光影，宽画幅",
  },
];
