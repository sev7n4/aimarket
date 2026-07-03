# Checklist

## P0：交互范式升级

- [x] 节点式无限画布支持 5 种节点类型（script/image/video/audio/text）创建和展示
- [x] 节点间数据流连线功能正常，支持一对多分支
- [x] 现有 canvas_layout 数据可无损迁移为节点式 CanvasNode
- [x] E2E 覆盖节点创建/连线/删除/一对多分支（`canvas-node-crud.spec.ts`）
- [x] 灯光控制工具可在图片上添加/移动/删除光源点（`LightingOverlay` + `lighting-control`）
- [x] 灯光参数（色温/强度/类型）正确编码为 prompt 约束词（`encodeLightingPrompt` + focus-edit `lights`）
- [x] 摄像机控制工具可调整俯仰/水平/景别（`CameraOverlay` + `camera-control`）
- [x] 摄像机参数正确映射为运镜描述词（`encodeCameraPrompt` + 视频 job `cameraPresetId`）
- [x] 所有 P0 功能 TypeScript 编译零错误

## P1：专业控制工具补齐

- [x] multi-cam-9 工具可生成 9 张不同机位图片并以 3×3 宫格展示（`ToolGridResultPanel`）
- [x] multi-cam-25 工具可生成 25 张连贯分镜并以 5×5 宫格展示
- [x] storyboard-evolve 工具可推演 4 格前后画面（3秒前/当前/3秒后/5秒后）
- [x] grid-split 工具可将宫格图切分为独立图片
- [x] video-inpaint 工具可对视频关键帧进行局部编辑（首帧 mask + i2v 简化方案）
- [x] music-gen 工具可根据风格描述生成背景音乐
- [x] 音乐生成已接入 MV Skill 流水线（`drama-mv-v1` `bgm` → `music-gen` job → concat）
- [x] 所有 P1 新增工具已注册到 tools.ts 并有计费系数
- [x] 所有 P1 功能 TypeScript 编译零错误

## P2：Agent 生态与工作流复用

- [x] Agent 可通过 canvas_create_node 在画布创建节点
- [x] Agent 可通过 canvas_connect_nodes 建立节点间连线
- [x] Skill YAML Schema 已抽取为独立 npm 包（`@aimarket/skill-schema`）
- [x] Skill 校验器 CLI 可正确校验第三方 skill.yaml（`skill-validate` bin）
- [x] Skill 市场支持发布/浏览（`/marketplace` DB 版 + `/skills/marketplace` 内存版）
- [ ] 第三方 Skill 一键安装加载（当前为 localStorage / YAML 复制）
- [x] 画布节点组合可序列化为模板并保存（Drama `TemplateManager`）
- [x] 已保存模板可一键重跑产出结果
- [ ] 至少接入 2 个新视频模型真实生成（Kling/Seedance/Vidu/PixVerse Provider 仍为骨架）
- [x] 前端模型选择器包含新模型选项
- [x] 所有 P2 功能 TypeScript 编译零错误

## P3：长尾专业功能

- [x] turnaround-360 工具可生成 8 方向角色视图并以八角布局展示
- [ ] product-url-v1 Skill 可从 URL 生成产品宣传视频（YAML + scraper 有，executor 未跑通）
- [x] 10+ 运镜预设可正确映射到视频生成 prompt（`camera-presets.ts` + 首尾帧 UI）
- [x] 前端运镜预设选择器 UI 可用（`video-reference-slots` 大师运镜条）
- [x] 所有 P3 功能 TypeScript 编译零错误
