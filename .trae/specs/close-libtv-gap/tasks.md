# Tasks

## P0：交互范式升级

- [x] Task 1: 节点式无限画布核心引擎
  - [x] 1.1: 设计画布节点数据模型（CanvasNode / CanvasEdge / CanvasFlow 类型），包含 5 种节点类型（script/image/video/audio/text）的 schema 定义
  - [x] 1.2: 后端画布节点 CRUD API — `POST /sessions/:id/canvas/nodes`、`PATCH /sessions/:id/canvas/nodes/:nodeId`、`DELETE /sessions/:id/canvas/nodes/:nodeId`、`POST /sessions/:id/canvas/edges`
  - [x] 1.3: 前端集成 React Flow 节点画布，替代现有线性画布组件，实现自由拖拽/缩放/连线交互
  - [x] 1.4: 迁移现有 canvas_layout 数据 — 将 canvas_layout 的 CanvasItem 映射为节点式 CanvasNode，保持向后兼容
  - [x] 1.5: 节点类型选择器 UI — 双击空白处弹出节点创建菜单
  - [x] 1.6: 节点间数据流连线 — 支持输出端口拖拽连线到输入端口，一对多分支
  - [x] 1.7: 验证：E2E 测试覆盖节点创建/连线/删除/分支场景

- [x] Task 2: 可视化灯光控制工具
  - [x] 2.1: 注册 `lighting` / `lighting-control` 工具到 tools.ts，分类 edit/compose，计费系数 1.2
  - [x] 2.2: 前端光源编辑层组件 — `LightingOverlay` 叠加在选中图片上，支持点击添加光源点、拖拽移动、删除
  - [x] 2.3: 光源参数面板 — 色温（暖/中性/冷）、强度（0-100%）、类型（点光/面光/聚光）
  - [x] 2.4: 后端灯光参数 → prompt 编码函数 `encodeLightingPrompt(lights)`
  - [x] 2.5: 集成到 focus-edit 提交流程 — `lights` 参数自动附加约束词
  - [x] 2.6: 验证：灯光参数正确编码为 prompt 约束词（`test-libtv-prompt-encoding.ts`）

- [x] Task 3: 可视化摄像机控制工具
  - [x] 3.1: 注册 `camera` / `camera-control` 工具到 tools.ts，分类 edit/compose，计费系数 1.2
  - [x] 3.2: 前端摄像机控制 UI — `CameraOverlay` 景别/运镜/俯仰/水平滑块
  - [x] 3.3: 后端摄像机参数 → 运镜描述词映射函数 `encodeCameraPrompt(camera)`
  - [x] 3.4: 集成到视频生成提交流程 — `camera` / `cameraPresetId` 自动附加运镜描述词
  - [x] 3.5: 验证：摄像机参数正确映射为运镜 prompt（`test-libtv-prompt-encoding.ts`）

## P1：专业控制工具补齐

- [x] Task 4: 多机位 9 宫格工具
  - [x] 4.1: 注册 `multi-cam-9` 工具到 tools.ts，分类 compose，计费系数 3.0
  - [x] 4.2: 后端 Provider — 9 固定机位 prompt 批量生图
  - [x] 4.3: 前端 3×3 宫格展示 — `ToolGridResultPanel` + `MultiCamGrid`
  - [x] 4.4: 验证：右键菜单入口 + job 完成后宫格弹层

- [x] Task 5: 25 宫格连贯分镜工具
  - [x] 5.1: 注册 `multi-cam-25` 工具到 tools.ts，计费系数 6.0
  - [x] 5.2: 后端 Provider — LLM 拆解 25 镜头 + 批量生图
  - [x] 5.3: 前端 5×5 宫格展示 — `ToolGridResultPanel`
  - [x] 5.4: 验证：右键菜单 + 宫格弹层

- [x] Task 6: 剧情推演四宫格工具
  - [x] 6.1: 注册 `storyboard-evolve` 工具到 tools.ts，计费系数 2.0
  - [x] 6.2: 后端 Provider — 4 时间点推演生图
  - [x] 6.3: 前端 2×2 宫格 — `StoryboardEvolveGrid` + 右键入口
  - [x] 6.4: 验证：宫格弹层展示时间标签

- [x] Task 7: 宫格切分器工具
  - [x] 7.1: 注册 `grid-split` 工具到 tools.ts，计费系数 0.5
  - [x] 7.2: 后端 Provider — Sharp 切分
  - [x] 7.3: 前端交互 — `GridSplitPanel` 行列选择
  - [x] 7.4: 验证：Studio 工具条 + 面板流程

- [x] Task 8: 视频精准编辑工具
  - [x] 8.1: 注册 `video-inpaint` 工具到 tools.ts，计费系数 2.0
  - [x] 8.2: 前端视频关键帧提取 + mask 绘制 UI — `VideoInpaintEditor`
  - [x] 8.3: 后端 Provider — 关键帧 inpaint + i2v 简化传播
  - [x] 8.4: 验证：支持关键帧时间戳选择（`timestampSec` 滑块 + provider 读取）

- [x] Task 9: AI 音乐生成集成
  - [x] 9.1: 后端音乐生成 Provider — Suno API + mock fallback
  - [x] 9.2: 注册 `music-gen` 工具到 tools.ts，计费系数 1.5
  - [x] 9.3: 前端音乐生成 UI — `MusicGenPanel` 风格/BPM/时长
  - [x] 9.4: 接入 MV Skill — `drama-mv-v1` 流水线 `bgm` 步骤调用 `music-gen`
  - [ ] 9.5: 验证：音乐生成并混入 MV 成片

## P2：Agent 生态与工作流复用

- [x] Task 10: Agent 操控画布节点 API
  - [x] 10.1: 设计 Agent 画布工具 — `canvas_create_node` / `canvas_connect_nodes` / `canvas_update_node` / `canvas_delete_node`
  - [x] 10.2: 后端 Agent Tool 定义 — `agent/canvas-tools.ts` + MCP
  - [x] 10.3: Agent Runner 集成 — plan 步骤执行时调用画布工具
  - [ ] 10.4: 验证：Agent E2E 自动创建/连线画布节点

- [x] Task 11: Skill 开放生态 SDK
  - [x] 11.1: 抽取 Skill YAML Schema 为独立 npm 包 `@aimarket/skill-schema`
  - [x] 11.2: Skill 校验器 CLI — `skill-validate` bin
  - [x] 11.3: Skill 市场发布/浏览 API — `/skills/marketplace` + `/marketplace` DB 版
  - [x] 11.4: Skill 市场前端 UI — `/marketplace` 页面 + `MarketplaceGallery`
  - [ ] 11.5: 验证：第三方 Skill 一键安装并通过市场加载执行

- [x] Task 12: 工作流模板保存/复用
  - [x] 12.1: 画布节点序列化函数 — Drama 模板 JSON
  - [x] 12.2: 模板 CRUD API — `/drama/templates` + session 级 `/sessions/:id/templates`
  - [x] 12.3: 前端模板保存 UI — `TemplateManager`
  - [x] 12.4: 前端模板加载 UI — 列表 + 一键重跑
  - [x] 12.5: 验证：模板保存后可一键重跑（E2E `template-manager-panel`）

- [ ] Task 13: 更多模型聚合
  - [ ] 13.1: Kling 3.0 接入 — Provider 骨架，生成 API 待对接
  - [ ] 13.2: Seedance 2.0 接入 — Provider 骨架
  - [ ] 13.3: Vidu 接入 — Provider 骨架
  - [ ] 13.4: PixVerse 接入 — Provider 骨架
  - [x] 13.5: 前端模型选择器更新 — `model-picker` 动态列表含新模型 ID
  - [ ] 13.6: 验证：新模型可正常生成图片/视频

## P3：长尾专业功能

- [x] Task 14: 360 度角度呈现
  - [x] 14.1: 注册 `turnaround-360` 工具到 tools.ts
  - [x] 14.2: 后端 Provider — 8 方向批量生图
  - [x] 14.3: 前端 8 向展示 — `Turnaround360Viewer` + 宫格弹层 + 右键入口
  - [x] 14.4: 验证：Image/Shot/Character 右键可触发

- [ ] Task 15: 官网转产品片 Skill
  - [x] 15.1: 创建 `product-url-v1` Skill YAML
  - [x] 15.2: 后端 URL 爬取工具 — `url-scraper` Provider
  - [ ] 15.3: LLM 卖点提炼 + 脚本生成步骤 — executor 未支持 `shot_video_batch`/`music_gen`/`concat`
  - [ ] 15.4: 验证：输入 URL 生成产品宣传视频

- [x] Task 16: 大师运镜预设
  - [x] 16.1: 定义 12 种运镜预设数据（`camera-presets.ts`）
  - [x] 16.2: 运镜参数 → 视频生成 prompt 映射函数 `applyCameraPreset`
  - [x] 16.3: 前端运镜预设选择器 — `video-reference-slots` 大师运镜条 + `CameraPresetSelector` 组件
  - [x] 16.4: 验证：prompt 编码单测 + 首尾帧 UI 可点选

# Task Dependencies
- Task 1 (节点式画布) → Task 10 (Agent 操控画布)、Task 12 (工作流模板)
- Task 2 (灯光控制) 和 Task 3 (摄像机控制) 可并行
- Task 4/5/6/7 (宫格工具) 可并行，且 Task 7 依赖 Task 4 或 5（宫格切分需要宫格图源）
- Task 8 (视频编辑) 和 Task 9 (音乐生成) 可并行
- Task 11 (Skill SDK) 独立，可与其他任务并行
- Task 13 (模型聚合) 独立，可与其他任务并行
- Task 14/15/16 (P3 长尾) 可并行
