# 腾讯云 TCR 个人版开通与 AIMarket 对接

个人版 **不收费**，registry 为 `ccr.ccs.tencentyun.com`。与 `deploy.yml` 默认 Variables 一致。

官方文档：[个人版快速入门](https://cloud.tencent.com/document/product/1141/63910)

## 一、开通服务（控制台）

1. 登录 [腾讯云控制台](https://console.cloud.tencent.com/)。
2. 顶部搜索 **容器镜像服务** 或打开 <https://console.cloud.tencent.com/tcr>。
3. 首次进入按提示 **开通服务** 并完成 **服务授权**（访问其他云产品资源，按向导点同意即可）。

## 二、初始化个人版登录密码（必读：地域与入口）

### 为什么找不到「个人版卡片」？

腾讯云已 [合并个人版/企业版控制台](https://cloud.tencent.com/document/product/1141/63580)：

| 常见误操作 | 实际含义 |
|------------|----------|
| 点 **新建 / 创建实例** | 这是 **企业版**（付费），不是个人版 |
| 地域选 **上海 / 北京 / 南京** 等 | 控制台 **不展示** 个人版实例卡片 |
| 从「命名空间 → 新建」进，但顶部未选个人版 | 可能提示个人版不可用 |

**个人版实例卡片只出现在：左侧「实例管理」+ 地域「广州（ap-guangzhou）」。**

你的 CVM 在南京/华南其他地域仍可 **跨地域拉取** 广州个人版镜像，只是 **管理界面必须切到广州**。

### 正确步骤

1. 打开 <https://console.cloud.tencent.com/tcr>（中国站 `cloud.tencent.com`，不是国际站）。
2. 左侧点 **实例管理**（不要点「创建实例」大按钮）。
3. 页面 **左上角地域** 切换为 **广州**（务必确认，不是「华南」默认的其他子地域）。
4. 在实例列表中应看到一张 **个人版** 卡片（通常已存在，无需「新建」）。
5. 点击 **初始化密码**，设置 **固定登录密码**（全地域共用；忘记可在 **更多 → 重置登录密码** 修改）。
6. 点击 **登录实例**，记下：
   - **Registry**：`ccr.ccs.tencentyun.com`
   - **Username**：你的 **腾讯云账号 ID**（纯数字，在「账号信息」或登录指引里显示，即 UIN）

## 三、创建命名空间

1. 左侧 **命名空间**（可能在「资源中心」下）。
2. 页面 **顶部实例类型** 下拉选 **个人版实例**（不是某个企业版实例名）。
3. 再点 **新建**，名称填：`aimarket`（须与 GitHub Variable `TCR_NAMESPACE` 一致；全局不可与他人重复，若占用可改为 `aimarket-sev7n4` 并同步改 GitHub Variable）。
4. 访问级别选 **私有**（推荐）。

无需手动创建 `aimarket-api` / `aimarket-web` 仓库；首次 GHA `docker push` 会自动创建。

## 四、本地验证登录（可选但建议）

在已安装 Docker 的电脑上：

```bash
# 将 1234567890 换成你的腾讯云账号 ID（UIN）
docker login ccr.ccs.tencentyun.com --username=1234567890
# 输入步骤二设置的固定密码，出现 Login Succeeded 即可
```

在 **生产 CVM** 上同样执行一次，确认服务器能访问 TCR：

```bash
ssh -i ~/.ssh/tencent_cloud_deploy root@119.29.173.89
docker login ccr.ccs.tencentyun.com --username=<你的账号ID>
```

## 五、配置 GitHub Actions Secrets

仓库：`sev7n4/aimarket` → **Settings** → **Environments** → **production** → **Environment secrets** → **Add secret**

| Secret 名称 | 值 |
|-------------|-----|
| `TCR_USERNAME` | 腾讯云 **账号 ID**（UIN，与 docker login `--username` 相同） |
| `TCR_PASSWORD` | 步骤二设置的 **个人版固定密码** |

已有 Secret 保持不变：`TENCENT_CLOUD_IP`、`TENCENT_CLOUD_USER`、`TENCENT_CLOUD_SSH_KEY`。

### 可选：Repository Variables

**Settings** → **Secrets and variables** → **Actions** → **Variables**

| Variable | 建议值 | 说明 |
|----------|--------|------|
| `TCR_REGISTRY` | `ccr.ccs.tencentyun.com` | 不配则 workflow 默认此值 |
| `TCR_NAMESPACE` | `aimarket` | 须与控制台命名空间一致 |

## 六、合并代码并触发部署

1. 合并到 `main` 后自动 Deploy（构建在 `ubuntu-latest`，仅推 TCR），或手动：

```bash
gh workflow run "Deploy to Tencent Cloud (AIMarket)" -f branch=main
```

2. 在 Actions 日志中确认：
   - `Build and push` 推 TCR 成功（耗时可能较长）
   - `Deploy on server` 出现 `Pull images from TCR` 且 `Pull elapsed` 通常 &lt;120s
   - `Verify deployment` 通过
3. 合并节奏见 [DEPLOY_MERGE_POLICY.md](./DEPLOY_MERGE_POLICY.md)。

## 七、镜像地址对照

| 用途 | 地址 |
|------|------|
| 生产拉取 | `ccr.ccs.tencentyun.com/aimarket/aimarket-api:<git-sha>` |
| 生产拉取 | `ccr.ccs.tencentyun.com/aimarket/aimarket-web:<git-sha>` |
| GHCR 备份 | 手动运行 `ghcr-backup.yml`，从 TCR 复制到 `ghcr.io/...`（服务器不拉） |

## 八、常见问题

**Q：实例管理里没有个人版，只有「创建企业版实例」？**  
A：几乎一定是地域没选 **广州**。切到广州后刷新；仍没有则检查：① 主账号登录（子账号需 CAM 权限）② 已完成 [步骤一](#一开通服务控制台) 开通与授权 ③ 账号已实名认证。

**Q：命名空间里「个人版不可用」？**  
A：先完成广州地域 **初始化密码**；创建命名空间时顶部必须选 **个人版实例**，不要选企业版实例。

**Q：误开了企业版怎么办？**  
A：个人版与企业版并存。部署只用 `ccr.ccs.tencentyun.com`，不要填 `*.tencentcloudcr.com`，企业版按量计费；未使用的企業版实例可在控制台删除以免产生费用。

**Q：推送成功但控制台看不到镜像？**  
A：个人版为共享服务，偶有队列延迟；可刷新或重新 push。见 [个人版 FAQ](https://cloud.tencent.com/document/product/1141/57780)。

**Q：GHA 报 Missing TCR_USERNAME？**  
A：Secret 必须加在 **Environment `production`**，不是 Repository secrets（若 workflow 使用 environment）。

**Q：服务器 pull 401/403？**  
A：检查 `TCR_PASSWORD` 是否为个人版固定密码；用户名必须是 **账号 ID**，不是子用户名或邮箱。

## 九、手动回滚（SSH）

```bash
cd /opt/aimarket
export TCR_REGISTRY=ccr.ccs.tencentyun.com
export TCR_NAMESPACE=aimarket
export IMAGE_TAG=<上一版成功的 git sha>
docker login ccr.ccs.tencentyun.com -u <账号ID> -p '<密码>'
bash deploy/deploy-remote.sh
```
