# PR 模板参考

> 本文档定义提交信息规范和 PR 描述模板。

---

## 提交信息规范

**格式**: `{type}({scope}): {subject}`

| 字段 | 说明 | 示例 |
|------|------|------|
| type | 类型 | bugfix, feature, enhancement |
| scope | 影响范围 | auth, user, product, order, payment |
| subject | 主题 | 简短描述，首字母小写 |

**规范要求**：
- subject 使用祈使句
- 不超过 50 个字符
- 不以句号结尾
- 使用英文（中文可选）

---

## Commit Message 格式

**格式**: `{type}({scope}): {subject}`

**类型前缀**：
- `bugfix`: Bug修复
- `feature`: 新功能
- `enhancement`: 优化改进

**示例**：
```
bugfix(auth): fix login validation error
feature(user): add user profile page
enhancement(product): optimize search performance
```

---

## PR 标题格式

**格式**: `{type}: {subject}`

**示例**：
```
bugfix: fix login validation error
feature: add user profile page
enhancement: optimize search performance
```

---

## PR 描述模板

```markdown
## 问题描述
{问题描述}

## 修改内容
- {修改点1}
- {修改点2}

## 测试用例
- {test_case_id}

## 相关链接
- Issue: #{issue-id}
- 原始需求: {需求链接}
```

---

## 示例

**提交信息**：
```
bugfix(auth): fix login validation error
```

**PR 标题**：
```
bugfix: fix login validation error
```

**PR 描述**：
```markdown
## 问题描述
用户登录时密码验证逻辑错误，导致正确密码无法登录。

## 修改内容
- 修复 PasswordHash 比较逻辑
- 添加密码验证单元测试

## 测试用例
- E2E-AUTH-001: 登录功能测试

## 相关链接
- Issue: #123
- 原始需求: 无
```

---

## Commit Message 与 PR 标题的关系

Commit Message 和 PR 标题应该保持一致：

| Commit Message | PR 标题 |
|-------------|----------|
| `bugfix(auth): fix login validation error` | `bugfix: fix login validation error` |
| `feature(user): add user profile page` | `feature: add user profile page` |
| `enhancement(product): optimize search performance` | `enhancement: optimize search performance` |

**注意**：
- Commit Message 的 `{scope}` 部分是可选的
- PR 标题不包含 `{scope}` 部分
