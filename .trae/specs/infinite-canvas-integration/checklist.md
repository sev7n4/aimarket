# Checklist

## Phase 1（P0）：无限画布引擎统一

- [ ] `ViewportTransform { x, y, k }` 类型已定义
- [ ] `CanvasNodeData` / `CanvasConnection` / `CanvasNodeType` 类型已定义
- [ ] `InfiniteCanvas` 组件支持 CSS transform 平移/缩放（0.05x-5x），以鼠标中心缩放
- [ ] `CanvasGrid` 支持 dots/lines/blank 三种背景模式，跟随视口变化
- [ ] `CanvasNode` 支持拖拽/缩放/选中/多选，React.memo 优化
- [ ] `CanvasNode` 支持 Batch 图片组（BatchFrame 层叠卡片）
- [ ] `CanvasConnections` 支持贝塞尔连线创建/删除/选中/拖拽中虚线
- [ ] `CanvasMiniMap` 支持节点类型颜色区分、点击/拖动导航
- [ ] `CanvasZoomControls` 支持 range 滑块（5%~500%）+ 重置视图
- [ ] `CanvasAgentOp` 8 种操作类型已定义
- [ ] `applyCanvasAgentOps` 纯函数可正确应用所有 8 种 Op
- [ ] `design-canvas.tsx` 底层渲染已切换为 InfiniteCanvas
- [ ] `DesignCanvasProps` 接口保持兼容（现有调用方无需改动）
- [ ] `alternateCanvasContent` 兼容层保留（不破坏现有 Drama 功能）
- [ ] `CanvasItem` → `CanvasNodeData` 双向转换正确
- [ ] 旧项目数据可无损迁移
- [ ] 现有素材生成流程不受影响
- [ ] 所有 Phase 1 新增代码 TypeScript 编译零错误

## Phase 2（P1）：Drama 节点化

- [ ] `CanvasNodeType` 包含 script / shot / character / scene 四种 Drama 类型
- [ ] Drama 节点默认尺寸已定义（Script 400×300, Shot 360×260, Character 340×280, Scene 360×240）
- [ ] `ScriptNodeContent` 渲染标题/梗概/三幕，双击可编辑
- [ ] `ShotNodeContent` 渲染缩略图/对白/摄影参数角标，双击可编辑
- [ ] `CharacterNodeContent` 渲染三视图缩略图/promptAnchor/锁定角标
- [ ] `SceneNodeContent` 渲染场景图/氛围标签/location
- [ ] `dramaPlanToCanvasOps()` 可将 DramaProjectData 正确映射为 CanvasAgentOp[]
- [ ] 自动布局：script 在左, character/scene 在中, shot 在右
- [ ] 自动连线：script→shot, character→shot, scene→shot
- [ ] Drama 规划完成后画布自动创建所有节点和连线
- [ ] `drama-studio-panel.tsx` 已重构为右侧动态属性面板
- [ ] 选中 Drama 节点时右侧面板展示对应编辑界面
- [ ] `alternateCanvasContent` 替换逻辑已移除
- [ ] Drama 时间线/制作进度/成片播放器已迁移为画布节点渲染
- [ ] 所有 Phase 2 新增代码 TypeScript 编译零错误

## Phase 3（P1）：Agent 对话式操控

- [ ] `CanvasAgentOp` 包含 5 种 Drama 专用 Op（plan_drama / generate_character_sheet / generate_shot_image / generate_shot_video / run_drama_production）
- [ ] `applyCanvasAgentOps` 可正确处理 Drama 专用 Op
- [ ] `dramaToolToOps()` 可将 9 个 Drama 工具名映射为 CanvasAgentOp[]
- [ ] `CanvasAssistantPanel` 支持消息列表/输入框/工具确认卡片
- [ ] 22 个基础画布工具 + 9 个 Drama 专用工具 JSON Schema 已定义
- [ ] `runOnlineAgentLoop()` 实现 function calling 循环（MAX_STEPS=6）
- [ ] 首轮 tool_choice="required"，后续 tool_choice="auto"
- [ ] 工具确认模式：写操作暂停等待用户 approve/reject
- [ ] 后端 `POST /api/agent/tool-response` 代理接口可用
- [ ] 前端 `requestToolResponse` 通过后端代理调用 LLM
- [ ] 流式响应可实时更新 assistant 消息
- [ ] 编译式规划输出通过 dramaPlanToCanvasOps 转换为 Op
- [ ] 编译式和对话式 Agent 使用同一套 Op 抽象
- [ ] Agent 面板与 Drama 属性面板共存（Tab 切换）
- [ ] 用户可通过对话框让 Agent 创建/修改/删除画布节点
- [ ] Agent 可通过 `drama_plan` 一键生成完整规划
- [ ] Agent 可通过 `drama_generate_shot_image` 等工具生成分镜内容
- [ ] 所有 Phase 3 新增代码 TypeScript 编译零错误

## Phase 4（P2）：专业能力补齐

- [ ] `MultiCamGrid` 支持 3×3 / 5×5 宫格渲染
- [ ] 9 宫格工具可生成 9 张不同机位图片
- [ ] 25 宫格工具可生成 25 张连贯分镜
- [ ] `LightingOverlay` 可在图片上添加/移动/删除光源点
- [ ] 灯光参数（色温/强度/类型）正确编码为 prompt 约束词
- [ ] `CameraOverlay` 可调整俯仰/水平/景别
- [ ] 摄像机参数正确映射为运镜描述词
- [ ] 画布节点组合可保存为模板
- [ ] 已保存模板可一键重跑
- [ ] 预置模板可用（短剧标准流程 / MV 制作 / 广告 TVC）
- [ ] video-inpaint 可对视频关键帧局部编辑
- [ ] 音乐生成可产出 30-60 秒背景音乐
- [ ] 音乐生成已接入 MV Skill
- [ ] 所有 Phase 4 新增代码 TypeScript 编译零错误
