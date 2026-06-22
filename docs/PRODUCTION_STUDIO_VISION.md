# 墨鱼π 制片工作台 — 产品愿景与重新定位

> 对标并超越 LibTV 的战略文档。工程代号 AIMarket；对外品牌 **墨鱼π**。  
> 详细 PRD 见 [PRD_PRODUCTION_STUDIO.md](./PRD_PRODUCTION_STUDIO.md)；开发排期见 [PRODUCTION_STUDIO_DEV_PLAN.md](./PRODUCTION_STUDIO_DEV_PLAN.md)。

---

## 1. 为什么重新定位

| 维度 | 原定位（出图宝） | 新定位（墨鱼π 制片工作台） |
|------|------------------|---------------------------|
| 核心命题 | 电商出图 + 宣传短视频 | **可交付的 AI 影视工作台** |
| 主用户 | 淘宝/抖音卖家 | 创作者 + 商业运营 + **外部 Agent** |
| 创作范式 | 对话 + 滚动画布 | **Plan → 分镜时间线 → 节点执行 → 成片交付** |
| 对标 | 椒图 AI | **LibTV**（节点工作流 + Skill API） |
| 差异化 | 电商垂直 | **Agent 制片 + 质检重试 + 商业交付轨** |

**保留子品牌叙事**：电商场景继续使用 Slogan「商品图到短视频，一套做完上架」，作为 **商业制片轨** 入口，不再作为全站唯一定位。

---

## 2. 一句话与北极星

**对外 Slogan（主）**：Agent 制片，画布交付。

**对外 Slogan（电商子轨）**：商品图到短视频，一套做完上架。

**北极星指标**：周活跃 **成片交付数**（用户下载/发布 MP4），而非裸生成次数。

**次北极星**：一次成片成功率（规划 → 制作 → MP4，无需人工救场）。

---

## 3. 能力三层模型

```
L3 生态层（超越 LibTV）
├── OpenAPI + moyu-skills（对标 libtv-skills）
├── 导演质检 / 角色一致性自动重拍
├── Skill / 模板市场
└── 团队协作审片（Workspace）

L2 制片层（追平 LibTV）
├── 节点工作流 / 分镜时间线
├── 角色三视图定稿
├── 时间轴剪辑（多轨）
├── 爆款复刻 / MV Skill
└── 项目模板 + Copy

L1 基建层（已有，需产品化贯通）
├── generation_jobs + SSE
├── drama 多 Agent Plan + drama-short-v1 Skill
├── scroll-canvas + Studio Dock
└── 积分 / Workspace / 灵感画廊
```

---

## 4. 产品架构（一条主路径，两条垂类）

```
墨鱼π Studio（统一壳 /studio）
│
├── 创意制片轨（默认）          ← 对标 LibTV
│   ├── 短剧 / 漫剧（60–180s）
│   ├── 单支创意片 / MV（规划中）
│   └── 链接复刻（Phase B）
│
├── 商业制片轨                  ← 超越 LibTV
│   ├── 电商宣传片（30–60s）
│   ├── 商品多镜头 / 主图联动
│   └── 上架素材包导出
│
└── Agent 入口（Phase C）
    ├── OpenAPI Session
    └── moyu-skills（OpenClaw / MCP）
```

**Studio 模式枚举（目标态）**：

| `studioMode` | 说明 | 对应现网 |
|--------------|------|----------|
| `production` | 制片（短剧/创意片） | `drama` + orchestration |
| `commerce` | 商业（电商套图/宣传片） | `mode=ecommerce` |
| `canvas` | 自由画布探索 | `kind=canvas` |

---

## 5. 与 LibTV 对标矩阵（18 个月目标）

| 维度 | LibTV | 墨鱼π 目标 |
|------|-------|-----------|
| 节点工作流 | 人手搭节点 | **Agent 生成 DAG + 人手改** |
| 规划 | 隐式 / 单轮 | **五 Agent 链 + SSE 可见** |
| 一次成片 | 宣传「一次搞定」 | **量化成功率 + 质检自动重试** |
| Agent API | OpenAPI + libtv-skills | **OpenAPI + 质检/重试字段** |
| 电商商业片 | 弱 | **品类第一（商业轨）** |
| 团队协作 | 弱 | **Workspace 审片** |
| 模板 | Copy 项目 | 灵感画廊 → **制片模板市场** |

---

## 6. 现有资产复用（不重写）

| 现网模块 | 制片工作台中的角色 |
|----------|-------------------|
| `apps/api/src/lib/drama/*` | Plan + Produce 核心引擎 |
| `packages/agent-skills/skills/drama-short-v1.yaml` | 制作流水线（节点运行时） |
| `studio-orchestration-provider.tsx` | 制片态全局状态机 |
| `studio-canvas-with-orchestration.tsx` | 画布 + Drama 面板挂载点 |
| `scroll-canvas` / `design-canvas` | 升级为分镜时间线画布 |
| `generation_jobs` + SSE | 所有节点执行单元 |
| `inspiration` | 模板市场前端 |
| `Workspace` | 团队制片与审片 |

---

## 7. 风险与原则

1. **节点流 = Skill 的可视化**，不维护两套执行引擎。  
2. **Plan 与 Produce 分离**（已具备）：Plan 用多 Agent；Produce 用 `skill-runs`。  
3. **先分镜时间线，后完整 ComfyUI 式编辑器**（Phase A 不做全节点编辑器）。  
4. **电商轨不砍**，作为商业制片差异化，与 LibTV 错位竞争。

---

## 8. 文档索引

| 文档 | 用途 |
|------|------|
| [PRD_PRODUCTION_STUDIO.md](./PRD_PRODUCTION_STUDIO.md) | 功能 ID、线框、API、代码映射 |
| [PRODUCTION_STUDIO_DEV_PLAN.md](./PRODUCTION_STUDIO_DEV_PLAN.md) | Phase A–D Sprint 排期 |
| [DRAMA_PROD.md](./DRAMA_PROD.md) | 短剧生产运维 |
| [spec/AGENT_ORCHESTRATION.md](./spec/AGENT_ORCHESTRATION.md) | Agent / Skill 技术规格 |
| `.cursor/plans/drama-multi-agent-plan-phase7.plan.md` | Phase 7 多 Agent 实现计划 |
