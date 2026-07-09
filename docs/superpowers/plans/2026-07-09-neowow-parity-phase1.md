# NeoWOW 工作流产品层对齐 — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补齐 NeoWOW 产品壳层缺口：工作流列表页 `/workflows`、导航入口、访客草稿创建画布，使用户无需深链即可发现与管理工作流。

**Architecture:** 新增 Next.js 路由 `/workflows` 作为会话列表壳；复用现有 `imageSession` API（`list`/`create`/`delete`）与 `buildWorkflowUrl()` 深链；列表 UI 对标 NeoWOW `WorkflowList`（网格 + 搜索 + 新建入口）；访客模式复用 `studio-draft-session` 本地草稿，登录后 `ensure` 合并。

**Tech Stack:** Next.js App Router, React, Tailwind, 现有 `imageSession` API, E2E Playwright

## Global Constraints

- 禁止直接 push/合并到 `main`，须经 PR + CI
- 分支命名：`feature/neowow-workflows-list`
- 提交格式：`feat(scope): subject`
- 本地验证：`pnpm typecheck` + 相关 E2E
- 不提交密钥；不修改无关代码
- 中文 UI 文案

---

## File Structure

| 文件 | 职责 |
|------|------|
| `apps/web/src/app/workflows/page.tsx` | 路由入口 |
| `apps/web/src/app/workflows/workflows-page-client.tsx` | 列表页客户端逻辑 |
| `apps/web/src/components/workflows/WorkflowCard.tsx` | 单个工作流卡片 |
| `apps/web/src/components/workflows/CreateWorkflowButton.tsx` | 新建无限画布按钮 |
| `apps/web/src/lib/studio-navigation.ts` | 已有 `buildWorkflowUrl`，接入 UI |
| `apps/web/src/components/app-left-rail.tsx` | 增加「工作流」导航项 |
| `apps/web/e2e/workflows-list.spec.ts` | E2E smoke |

---

### Task 1: E2E 测试先行 — 工作流列表页 smoke

**Files:**
- Create: `apps/web/e2e/workflows-list.spec.ts`

**Interfaces:**
- Consumes: 现有 `registerViaEmail`, `gotoWorkflowAndWait` helpers
- Produces: `test("访问 /workflows 展示列表与新建入口")` 通过

- [ ] **Step 1: 写失败测试**

```typescript
import { test, expect } from "@playwright/test";
import { registerViaEmail } from "./helpers/auth";

test.describe("Workflows list page", () => {
  test("访问 /workflows 展示列表与新建入口", async ({ page }) => {
    await registerViaEmail(page);
    await page.goto("/workflows");
    await expect(page.getByTestId("workflows-page")).toBeVisible();
    await expect(page.getByTestId("create-workflow-button")).toBeVisible();
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd apps/web && pnpm exec playwright test e2e/workflows-list.spec.ts`
Expected: FAIL — `/workflows` 404 或 testid 不存在

---

### Task 2: 工作流列表页路由与客户端组件

**Files:**
- Create: `apps/web/src/app/workflows/page.tsx`
- Create: `apps/web/src/app/workflows/workflows-page-client.tsx`
- Create: `apps/web/src/components/workflows/WorkflowCard.tsx`
- Create: `apps/web/src/components/workflows/CreateWorkflowButton.tsx`

**Interfaces:**
- Consumes: `GET /api/v1/imageSession/list`, `POST /api/v1/imageSession/create`
- Produces: `WorkflowsPageClient` 渲染会话网格 + 新建按钮

- [ ] **Step 1: 创建 page.tsx**

```tsx
import { WorkflowsPageClient } from "./workflows-page-client";

export const metadata = { title: "工作流 · 无限画布" };

export default function WorkflowsPage() {
  return <WorkflowsPageClient />;
}
```

- [ ] **Step 2: 实现 workflows-page-client.tsx**

核心逻辑：
- `useEffect` 调用 `imageSession/list` 拉取 `kind=canvas` 会话
- 网格渲染 `WorkflowCard`（标题、更新时间、缩略图占位）
- 点击卡片 → `router.push(buildWorkflowUrl({ sessionId }))`
- 顶部 `CreateWorkflowButton` → `POST imageSession/create` → 跳转 `/workflow?sessionId=`

- [ ] **Step 3: WorkflowCard + CreateWorkflowButton**

`data-testid="workflow-card-{id}"`, `data-testid="create-workflow-button"`

- [ ] **Step 4: 运行 E2E 确认通过**

Run: `pnpm exec playwright test e2e/workflows-list.spec.ts`
Expected: PASS

- [ ] **Step 5: typecheck**

Run: `pnpm typecheck`
Expected: PASS

---

### Task 3: 左侧导航入口

**Files:**
- Modify: `apps/web/src/components/app-left-rail.tsx`

**Interfaces:**
- Consumes: 现有 nav items 结构
- Produces: `/workflows` 链接项，图标 + 「工作流」文案

- [ ] **Step 1: 在 AppLeftRail 增加工作流入口**

在 Studio/画布相关 nav 区域添加：
```tsx
<NavLink href="/workflows" data-testid="nav-workflows">
  工作流
</NavLink>
```

- [ ] **Step 2: 手动验证导航跳转**

---

### Task 4: 访客草稿模式（可选增强）

**Files:**
- Modify: `apps/web/src/app/workflows/workflows-page-client.tsx`
- Modify: `apps/web/src/lib/studio-draft-session.ts`（如需）

**Interfaces:**
- Consumes: `getOrCreateDraftSessionId`, `writeDraftSessionId`
- Produces: 未登录用户点击「新建」→ 本地 draft sessionId → `/workflow?sessionId=`

- [ ] **Step 1: 未登录时 CreateWorkflowButton 使用 draft session**

复用 `workflow-page-client.tsx` 同款逻辑，不调用 `imageSession/create`

- [ ] **Step 2: E2E 补充访客场景**（如 API 允许）

---

## Verification Checklist

- [ ] `/workflows` 页面可访问
- [ ] 列表展示用户 canvas 会话
- [ ] 点击「新建无限画布」进入 `/workflow?sessionId=...`
- [ ] 左侧栏有「工作流」入口
- [ ] `pnpm typecheck` 通过
- [ ] `workflows-list.spec.ts` E2E 通过

## Next Phases (out of scope for Phase 1)

- **Phase 2:** 工具节点注册表 + 高频生成节点（文生图/视频/扩图/高清）
- **Phase 3:** 模板画廊 + 分享/克隆
- **Phase 4:** 3D World / 音乐生成 / 唇形同步
