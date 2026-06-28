# Tasks

## P0：交互范式升级

- [x] Task 1: 节点式无限画布核心引擎
  - [x] 1.1: 设计画布节点数据模型（CanvasNode / CanvasEdge / CanvasFlow 类型），包含 5 种节点类型（script/image/video/audio/text）的 schema 定义
  - [x] 1.2: 后端画布节点 CRUD API — `POST /sessions/:id/canvas/nodes`、`PATCH /sessions/:id/canvas/nodes/:nodeId`、`DELETE /sessions/:id/canvas/nodes/:nodeId`、`POST /sessions/:id/canvas/edges`
  - [x] 1.3: 前端集成 React Flow 节点画布，替代现有线性画布组件，实现自由拖拽/缩放/连线交互
  - [x] 1.4: 迁移现有画布数据 — 将 canvas_layout 的 CanvasItem 映射为节点式 CanvasNode，保持向后兼容
  - [x] 1.5: 节点类型选择器 UI — 双击空白处弹出节点创建菜单
  - [x] 1.6: 节点间数据流连线 — 支持输出端口拖拽连线到输入端口，一对多分支
  - [ ] 1.7: 验证：E2E 测试覆盖节点创建/连线/删除/分支场景

- [ ] Task 2: 可视化灯光控制工具
  - [ ] 2.1: 注册 `lighting` 工具到 tools.ts，分类 edit，计费系数 1.2
  - [ ] 2.2: 前端光源编辑层组件 — 叠加在选中图片上，支持点击添加光源点、拖拽移动、删除
  - [ ] 2.3: 光源参数面板 — 色温（暖白/冷白/暖黄）、强度（0-100%）、类型（点光/面光/聚光）
  - [ ] 2.4: 后端灯光参数 → prompt 编码函数 `encodeLightingPrompt(lights)` — 将光源位置/色温/强度映射为中文约束词
  - [ ] 2.5: 集成到 focus-edit/inpaint 提交流程 — 有灯光数据时自动附加约束词
  - [ ] 2.6: 验证：灯光参数正确编码为 prompt 约束词

- [ ] Task 3: 可视化摄像机控制工具
  - [ ] 3.1: 注册 `camera` 工具到 tools.ts，分类 edit，计费系数 1.0
  - [ ] 3.2: 前端摄像机控制 UI — 俯仰角/水平角/景别三滑块，叠加在选中图片上
  - [ ] 3.3: 后端摄像机参数 → 运镜描述词映射函数 `encodeCameraPrompt(camera)` — 俯仰→"仰拍/平拍/俯拍"、水平→"正面/侧面/背面"、景别→"特写/近景/中景/远景"
  - [ ] 3.4: 集成到视频生成提交流程 — 有摄像机参数时自动附加运镜描述词
  - [ ] 3.5: 验证：摄像机参数正确映射为运镜 prompt

## P1：专业控制工具补齐

- [ ] Task 4: 多机位 9 宫格工具
  - [ ] 4.1: 注册 `multi-cam-9` 工具到 tools.ts，分类 compose，计费系数 3.0（批量 9 张）
  - [ ] 4.2: 后端 Provider — 基于参考图生成 9 个不同机位 prompt（俯拍/仰拍/左45°/右45°/正面/背面/近景/远景/特写），批量调用图片生成
  - [ ] 4.3: 前端 3×3 宫格展示组件 — 9 宫格网格布局，点击单格可放大/下载/设为参考
  - [ ] 4.4: 验证：9 宫格生成 9 张不同机位图片

- [ ] Task 5: 25 宫格连贯分镜工具
  - [ ] 5.1: 注册 `multi-cam-25` 工具到 tools.ts，分类 compose，计费系数 6.0
  - [ ] 5.2: 后端 Provider — LLM 拆解场景为 25 个连贯镜头描述，批量生成图片
  - [ ] 5.3: 前端 5×5 宫格展示组件 — 25 宫格，支持点击放大和逐格导出
  - [ ] 5.4: 验证：25 宫格生成连贯分镜

- [ ] Task 6: 剧情推演四宫格工具
  - [ ] 6.1: 注册 `storyboard-evolve` 工具到 tools.ts，分类 compose，计费系数 2.0
  - [ ] 6.2: 后端 Provider — 给定关键帧 + VLM 推演前后画面 prompt，生成 4 张图（3秒前/当前/3秒后/5秒后）
  - [ ] 6.3: 前端 2×2 宫格展示组件，标注时间标签
  - [ ] 6.4: 验证：四宫格推演画面逻辑正确

- [ ] Task 7: 宫格切分器工具
  - [ ] 7.1: 注册 `grid-split` 工具到 tools.ts，分类 edit，计费系数 0.5
  - [ ] 7.2: 后端 Provider — 接收宫格图 + 行列数参数，调用 Sharp 切分为独立图片
  - [ ] 7.3: 前端交互 — 用户选择宫格图后指定行列数，一键切分
  - [ ] 7.4: 验证：9 宫格正确切分为 9 张独立图片

- [ ] Task 8: 视频精准编辑工具
  - [ ] 8.1: 注册 `video-inpaint` 工具到 tools.ts，分类 edit，计费系数 2.0
  - [ ] 8.2: 前端视频关键帧提取 + mask 绘制 UI
  - [ ] 8.3: 后端 Provider — 关键帧 inpaint + 相邻帧传播（简化方案：关键帧编辑后做 i2v）
  - [ ] 8.4: 验证：视频局部编辑效果传播到相邻帧

- [ ] Task 9: AI 音乐生成集成
  - [ ] 9.1: 后端音乐生成 Provider — 对接 Suno/Udio API（或自建音乐模型）
  - [ ] 9.2: 注册 `music-gen` 工具到 tools.ts，分类 compose，计费系数 1.5
  - [ ] 9.3: 前端音乐生成 UI — 风格描述 + BPM + 时长参数面板
  - [ ] 9.4: 接入 MV Skill — 将音乐生成作为 `drama-mv-v1` 的前置步骤
  - [ ] 9.5: 验证：音乐生成并混入 MV 成片

## P2：Agent 生态与工作流复用

- [ ] Task 10: Agent 操控画布节点 API
  - [ ] 10.1: 设计 Agent 画布工具 — `canvas_create_node` / `canvas_connect_nodes` / `canvas_update_node` / `canvas_delete_node`
  - [ ] 10.2: 后端 Agent Tool 定义 — 注册到 agent-core 的工具列表
  - [ ] 10.3: Agent Runner 集成 — plan 步骤执行时调用画布工具
  - [ ] 10.4: 验证：Agent 可创建/连线画布节点

- [ ] Task 11: Skill 开放生态 SDK
  - [ ] 11.1: 抽取 Skill YAML Schema 为独立 npm 包 `@aimarket/skill-schema`
  - [ ] 11.2: Skill 校验器 CLI — `npx @aimarket/skill-schema validate skill.yaml`
  - [ ] 11.3: Skill 市场发布/浏览 API — `POST /skills/publish`、`GET /skills/marketplace`
  - [ ] 11.4: Skill 市场前端 UI — 浏览/安装/管理第三方 Skill
  - [ ] 11.5: 验证：第三方 Skill 可发布并通过市场安装

- [ ] Task 12: 工作流模板保存/复用
  - [ ] 12.1: 画布节点序列化函数 — 将节点+连线+参数序列化为 JSON 模板
  - [ ] 12.2: 模板 CRUD API — 保存/列表/加载/删除模板
  - [ ] 12.3: 前端模板保存 UI — 选中节点组→"保存为模板"按钮
  - [ ] 12.4: 前端模板加载 UI — 模板列表→选择→替换素材→一键重跑
  - [ ] 12.5: 验证：模板保存后可一键重跑产出结果

- [ ] Task 13: 更多模型聚合
  - [ ] 13.1: Kling 3.0 接入 — Provider + 路由 + 参数映射
  - [ ] 13.2: Seedance 2.0 接入 — Provider + 路由 + 参数映射
  - [ ] 13.3: Vidu 接入 — Provider + 路由 + 参数映射
  - [ ] 13.4: PixVerse 接入 — Provider + 路由 + 参数映射
  - [ ] 13.5: 前端模型选择器更新 — 新增模型选项
  - [ ] 13.6: 验证：新模型可正常生成图片/视频

## P3：长尾专业功能

- [ ] Task 14: 360 度角度呈现
  - [ ] 14.1: 注册 `turnaround-360` 工具到 tools.ts
  - [ ] 14.2: 后端 Provider — 8 方向角色视图生成（正/左前/左/左后/背/右后/右/右前）
  - [ ] 14.3: 前端 8 向展示组件 — 圆形/八角形布局
  - [ ] 14.4: 验证：8 方向视图生成正确

- [ ] Task 15: 官网转产品片 Skill
  - [ ] 15.1: 创建 `product-url-v1` Skill YAML
  - [ ] 15.2: 后端 URL 爬取工具 — 提取产品名/卖点/图片
  - [ ] 15.3: LLM 卖点提炼 + 脚本生成步骤
  - [ ] 15.4: 验证：输入 URL 生成产品宣传视频

- [ ] Task 16: 大师运镜预设
  - [ ] 16.1: 定义 10+ 运镜预设数据（推/拉/摇/跟/升/降/环绕/甩/移/变焦）
  - [ ] 16.2: 运镜参数 → 视频生成 prompt 映射函数
  - [ ] 16.3: 前端运镜预设选择器 UI
  - [ ] 16.4: 验证：运镜预设正确映射到视频生成效果

# Task Dependencies
- Task 1 (节点式画布) → Task 10 (Agent 操控画布)、Task 12 (工作流模板)
- Task 2 (灯光控制) 和 Task 3 (摄像机控制) 可并行
- Task 4/5/6/7 (宫格工具) 可并行，且 Task 7 依赖 Task 4 或 5（宫格切分需要宫格图源）
- Task 8 (视频编辑) 和 Task 9 (音乐生成) 可并行
- Task 11 (Skill SDK) 独立，可与其他任务并行
- Task 13 (模型聚合) 独立，可与其他任务并行
- Task 14/15/16 (P3 长尾) 可并行
