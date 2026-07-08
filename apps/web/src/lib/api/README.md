# Web API 客户端（按域拆分）

自 P6-5 起，`api-client.ts` 仅为 **兼容 re-export**；新代码请直引子模块：

```ts
import { fetchSession } from "@/lib/api/sessions";
import { uploadAsset } from "@/lib/api/assets";
import { getToken } from "@/lib/api/core";
```

## 模块

| 文件 | 域 |
|------|-----|
| `core.ts` | `request` / token / `assetUrl` |
| `auth.ts` | 注册、登录、短信、微信 |
| `user.ts` | 用户资料、积分、Provider 配置 |
| `sessions.ts` | 会话 CRUD、消息、分享 |
| `canvas.ts` | 画布 layout / bundle |
| `generation.ts` | 模型、生成、视频、Job、润色 |
| `assets.ts` | 素材上传 / 登记 |
| `studio.ts` | 工具、BrandKit、埋点、Provider 状态 |
| `workspace.ts` | 工作区、评审 |
| `drama.ts` | Drama 全流程 |
| `agent.ts` | Agent / Skill run |
| `inspiration.ts` | 灵感广场 |
| `billing.ts` | 套餐、订单、签到 |
| `admin.ts` | 管理后台 |
| `marketplace.ts` | 技能市场 |
| `commerce.ts` | 电商 Hero 绑定 |
| `notices.ts` | 站内通知 |

`index.ts` 聚合全部导出；`@/lib/api-client` 与之等价。
