# 代码分析参考

> 本文档定义按模块定位代码的策略和分析步骤。

---

## 按模块定位

| 模块 | 搜索关键词 | 起始位置 |
|------|------------|----------|
| auth | login, auth, signin, token, password | backend/api/auth, frontend/src/auth |
| user | user, profile, account | backend/api/user, frontend/src/user |
| product | product, item, inventory | backend/api/product, frontend/src/product |
| order | order, cart, checkout | backend/api/order, frontend/src/order |
| payment | payment, refund, balance | backend/api/payment, frontend/src/payment |

---

## 分析步骤

1. **确定搜索范围**: 根据 Step 1 确定的模块，限定搜索目录
2. **搜索关键词**: 使用 SearchCodebase 搜索相关代码
3. **定位文件**: 使用 Grep 定位具体文件
4. **理解上下文**: 使用 Read 理解代码逻辑

---

## 分析内容

- 定位问题代码
- 理解上下文
- 确定修改范围
- 识别依赖关系

---

## 示例

```
问题: "登录失败"
→ 模块: auth
→ 搜索: "login" in backend/api/auth
→ 定位: backend/api/auth/handler.go
→ 分析: LoginHandler 函数

问题: "商品价格显示错误"
→ 模块: product
→ 搜索: "price" in backend/api/product
→ 定位: backend/api/product/service.go
→ 分析: GetProductPrice 方法
```
