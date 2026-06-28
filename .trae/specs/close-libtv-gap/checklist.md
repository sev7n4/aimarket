# Checklist

## P0：交互范式升级

- [x] 节点式无限画布支持 5 种节点类型（script/image/video/audio/text）创建和展示
- [x] 节点间数据流连线功能正常，支持一对多分支
- [x] 现有 canvas_layout 数据可无损迁移为节点式 CanvasNode
- [ ] 灯光控制工具可在图片上添加/移动/删除光源点
- [ ] 灯光参数（色温/强度/类型）正确编码为 prompt 约束词
- [ ] 摄像机控制工具可调整俯仰/水平/景别
- [ ] 摄像机参数正确映射为运镜描述词
- [ ] 所有 P0 功能 TypeScript 编译零错误

## P1：专业控制工具补齐

- [ ] multi-cam-9 工具可生成 9 张不同机位图片并以 3×3 宫格展示
- [ ] multi-cam-25 工具可生成 25 张连贯分镜并以 5×5 宫格展示
- [ ] storyboard-evolve 工具可推演 4 格前后画面（3秒前/当前/3秒后/5秒后）
- [ ] grid-split 工具可将宫格图切分为独立图片
- [ ] video-inpaint 工具可对视频关键帧进行局部编辑
- [ ] music-gen 工具可根据风格描述生成背景音乐
- [ ] 音乐生成已接入 MV Skill 流水线
- [ ] 所有 P1 新增工具已注册到 tools.ts 并有计费系数
- [ ] 所有 P1 功能 TypeScript 编译零错误

## P2：Agent 生态与工作流复用

- [ ] Agent 可通过 canvas_create_node 在画布创建节点
- [ ] Agent 可通过 canvas_connect_nodes 建立节点间连线
- [ ] Skill YAML Schema 已抽取为独立 npm 包
- [ ] Skill 校验器 CLI 可正确校验第三方 skill.yaml
- [ ] Skill 市场支持发布/浏览/安装第三方 Skill
- [ ] 画布节点组合可序列化为模板并保存
- [ ] 已保存模板可一键重跑产出结果
- [ ] 至少接入 2 个新视频模型（Kling 3.0 / Seedance 2.0 等）
- [ ] 前端模型选择器包含新模型选项
- [ ] 所有 P2 功能 TypeScript 编译零错误

## P3：长尾专业功能

- [ ] turnaround-360 工具可生成 8 方向角色视图
- [ ] product-url-v1 Skill 可从 URL 生成产品宣传视频
- [ ] 10+ 运镜预设可正确映射到视频生成 prompt
- [ ] 前端运镜预设选择器 UI 可用
- [ ] 所有 P3 功能 TypeScript 编译零错误
