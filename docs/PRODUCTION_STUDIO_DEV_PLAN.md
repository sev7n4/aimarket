# 墨鱼π 制片工作台 — 开发计划（Phase A–D）

> 配套文档：[PRODUCTION_STUDIO_VISION.md](./PRODUCTION_STUDIO_VISION.md) · [PRD_PRODUCTION_STUDIO.md](./PRD_PRODUCTION_STUDIO.md)

---

## 1. 总览时间线

| Phase | 周期 | 主题 | 里程碑 |
|-------|------|------|--------|
| **A** | 0–3 月 | 追平 LibTV 主路径 | 分镜时间线 + 角色定稿 + 制片首页 |
| **B** | 3–6 月 | 节点流 + 模板 | 节点 DAG 可视化 + 复刻/MV Skill |
| **C** | 6–12 月 | 超越 LibTV | OpenAPI + 质检重试 + 协作审片 |
| **D** | 12–18 月 | 生态与商业 | Skill 市场 + 商业片轨 + 企业版 |

**假设团队规模**：2 全栈 + 1 前端偏重 + 0.5 运维（可按 Sprint 并行拆子任务）。

---

## 2. Phase A（0–3 月）— 追平主路径

### 2.1 目标

用户从首页进入 **制片模式**，完成「创意 → 五 Agent 规划 → 分镜时间线编辑 → 确认制作 → 成片」，全程在 Studio 内闭环。

### 2.2 Sprint 拆分（建议 6 × 2 周）

| Sprint | 周期 | 交付 | PRD ID |
|--------|------|------|--------|
| A-S1 | W1–2 | 品牌/首页制片入口；`studioMode=production` 路由 | PROD-A01, A02 |
| A-S2 | W3–4 | 多 Agent Plan SSE 全链路 UI；规划时间线 | PROD-A03, A04 |
| A-S3 | W5–6 | 分镜时间线画布 v1（横向镜头轨） | PROD-A05, A06 |
| A-S4 | W7–8 | 角色三视图定稿 UI + PATCH project | PROD-A07, A08 |
| A-S5 | W9–10 | 制作进度时间线 + 关键帧选优 + 单镜重试 | PROD-A09, A10 |
| A-S6 | W11–12 | 成片导出/发布灵感；E2E + 生产验收 | PROD-A11, A12 |

### 2.3 依赖

```
A-S1 路由/入口
  └─► A-S2 Plan SSE（依赖 plan/runs API 已存在）
        └─► A-S3 分镜时间线（依赖 project.shots 结构）
              └─► A-S4 角色定稿
                    └─► A-S5 制作态 UI
                          └─► A-S6 导出/E2E
```

### 2.4 验收标准（Phase A 出口）

- [ ] 新用户从首页「开始制片」→ 90s 内看到规划 SSE 进度  
- [ ] 规划完成后分镜时间线可拖拽排序、编辑对白/镜头描述  
- [ ] 角色卡支持三视图预览与定稿标记  
- [ ] 制作完成后画布展示 MP4，可下载并发布灵感  
- [ ] `pnpm typecheck` + `pnpm test:integration` + Studio E2E 全绿  

---

## 3. Phase B（3–6 月）— 节点流与模板

### 3.1 目标

将 `drama-short-v1` 流水线 **可视化为节点 DAG**；支持爆款复刻、MV 模板；灵感画廊升级为「制片模板」。

### 3.2 Sprint 拆分（建议 6 × 2 周）

| Sprint | 交付 | PRD ID |
|--------|------|--------|
| B-S1 | 节点 DAG 数据模型 + 只读渲染 | PROD-B01 |
| B-S2 | 节点状态 SSE 绑定 `skill-runs` | PROD-B02 |
| B-S3 | 人手改节点参数 → 局部重跑 | PROD-B03 |
| B-S4 | 链接/视频复刻 Skill + UI | PROD-B04 |
| B-S5 | MV / 创意片 Skill 壳 | PROD-B05 |
| B-S6 | 模板 Copy + 灵感→制片模板 | PROD-B06 |

### 3.3 验收标准

- [ ] 制作中可展开节点流，看到 writer→…→export 各步状态  
- [ ] 修改单镜 motionPrompt 后可从该节点重跑  
- [ ] 从灵感模板一键 Copy 到新 Session 并开始规划  

---

## 4. Phase C（6–12 月）— 超越 LibTV

### 4.1 目标

对外开放 **moyu-skills OpenAPI**；内置导演质检与自动重拍；Workspace 协作审片。

### 4.2 Sprint 拆分（建议 8 × 2 周）

| Sprint | 交付 | PRD ID |
|--------|------|--------|
| C-S1 | OpenAPI 鉴权 + Session CRUD | PROD-C01 |
| C-S2 | Plan/Produce 外部调用 + Webhook | PROD-C02 |
| C-S3 | 导演质检 Agent + 评分模型 | PROD-C03 |
| C-S4 | 质检失败自动重拍策略 | PROD-C04 |
| C-S5 | 时间轴多轨剪辑 v1 | PROD-C05 |
| C-S6 | Workspace 审片评论 | PROD-C06 |
| C-S7 | 版本对比 / 回滚 | PROD-C07 |
| C-S8 | 文档 + SDK 示例 | PROD-C08 |

### 4.3 验收标准

- [ ] 外部 Agent 通过 API 完成一次短剧 Plan + Produce  
- [ ] 质检分低于阈值自动触发单镜重试（无需用户点）  
- [ ] Workspace 成员可在分镜上留言，制片人可确认版本  

---

## 5. Phase D（12–18 月）— 生态与商业

### 5.1 目标

Skill/模板市场；商业制片轨（30–60s 电商片）；企业计费与 SLA。

### 5.2 里程碑

| 季度 | 交付 | PRD ID |
|------|------|--------|
| D-Q1 | 商业片 Skill + 商品镜头联动 | PROD-D01, D02 |
| D-Q2 | Skill 市场上架/分成 | PROD-D03 |
| D-Q3 | 企业 Workspace + SSO | PROD-D04 |
| D-Q4 | 多区域部署 / 专属模型路由 | PROD-D05 |

---

## 6. 技术债务与并行项

| 项 | 说明 | 建议 Sprint |
|----|------|-------------|
| 更新 `docs/PRODUCT.md` / `docs/PRD.md` 定位段落 | 与本文档对齐 | A-S1 |
| Phase 7 plan 收尾 | 多 Agent merge-patch | A-S2 |
| 灵感坏链清理自动化 | 已有 workflow | 维护 |
| 视频 Provider 稳定性 | 生产监控 | 全程 |

---

## 7. 质量门禁（每个 PR）

```bash
pnpm install --frozen-lockfile
pnpm typecheck
# API 终端
cd apps/api && pnpm exec tsx --env-file=.env src/index.ts
pnpm test:integration
# 改 Studio UI 时
pnpm --filter web test:e2e
```

合并要求：`lint-typecheck` · `docker-build` · `Integration Tests` · `E2E Tests`（见 `.cursorrules`）。

---

## 8. 指标看板（建议）

| 指标 | Phase A | Phase B | Phase C |
|------|---------|---------|---------|
| 周成片交付数 | 基线 +50% | +100% | +200% |
| Plan→Produce 转化率 | ≥40% | ≥55% | ≥65% |
| 一次成片成功率 | ≥30% | ≥45% | ≥60% |
| 外部 API 调用占比 | — | — | ≥10% |

---

## 9. Sprint 启动清单

1. 从 [PRD_PRODUCTION_STUDIO.md](./PRD_PRODUCTION_STUDIO.md) 勾选本 Sprint 功能 ID  
2. 创建分支 `feature/prod-{id}-{简述}`  
3. 按 PRD「代码映射」列改文件  
4. 本地验证 + PR + CI  
5. 合并后触发生产 Deploy workflow  
