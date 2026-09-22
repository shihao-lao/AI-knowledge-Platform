# 登录跳转测试

## 测试步骤

### 1. 启动后端

```bash
cd background
venv\Scripts\activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. 启动前端

```bash
npm run dev
```

### 3. 测试登录流程

1. 访问 http://localhost:3000/login
2. 输入测试账号：
   - 邮箱: test@example.com
   - 密码: Test1234
3. 点击"登录"按钮
4. 预期结果：自动跳转到 http://localhost:3000/knowledge-bases

### 4. 验证登录状态

登录成功后，访问以下页面应该正常显示：

- http://localhost:3000/knowledge-bases - 知识库列表
- http://localhost:3000/settings/profile - 个人设置（显示用户信息）

### 5. 验证认证保护

未登录时访问受保护页面应该跳转到登录页：

- 直接访问 http://localhost:3000/knowledge-bases
- 应该自动跳转到 http://localhost:3000/login?from=/knowledge-bases

## 已修复的问题

1. ✅ AuthGuard 组件现在正确识别公开页面
2. ✅ 登录成功后不再调用 router.refresh()
3. ✅ 登录后立即更新用户状态
4. ✅ 登录后正确跳转到目标页面

## 代码修改

### 1. components/auth-guard.tsx

- 添加 isPublicRoute 检查
- 公开页面直接渲染，不需要认证检查
- 只有受保护页面才检查认证状态

### 2. app/login/page.tsx

- 移除 router.refresh() 调用
- 登录成功后直接跳转

### 3. lib/hooks/use-auth.ts

- 登录后立即设置用户状态
- 不再异步获取用户信息

### 4. lib/api-client.ts

- 更新登录响应类型，包含 access_token

## 预期行为

### 登录成功流程

1. 用户输入邮箱和密码
2. 调用 POST /api/auth/login
3. 后端返回用户信息和 access_token
4. 前端立即更新用户状态
5. 跳转到 /knowledge-bases

### 认证保护流程

1. 用户访问受保护页面（如 /knowledge-bases）
2. AuthGuard 检查是否已登录
3. 如果未登录，跳转到 /login?from=/knowledge-bases
4. 用户登录成功后，跳转回原始页面

### 公开页面流程

1. 用户访问公开页面（如 /login, /register, /）
2. AuthGuard 直接渲染页面，不检查认证
3. 页面正常显示
