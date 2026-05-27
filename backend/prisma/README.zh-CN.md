# Prisma Schema 详解与数据库连接指南

## 一、schema.prisma 是什么？

`schema.prisma` 是 **Prisma ORM** 的核心配置文件，用于定义数据库表结构、关系和连接信息。它相当于数据库的“蓝图”，Prisma 会根据这个文件自动生成数据库迁移和类型安全的查询客户端。

## 二、文件结构解析

```prisma
// 1. 生成器配置：指定生成 Prisma Client 的方式
generator client {
  provider = "prisma-client-js"  // 使用 JavaScript/TypeScript 客户端
}

// 2. 数据源配置：定义数据库连接信息
datasource db {
  provider = "postgresql"  // 数据库类型：PostgreSQL
  url      = env("DATABASE_URL")  // 从环境变量读取连接字符串
}

// 3. 数据模型定义：对应数据库表结构
model KnowledgeBase {  // 知识库表
  id          String   @id @default(uuid())  // 主键，自动生成 UUID
  name        String   // 知识库名称（必填）
  description String?  // 描述（可选）
  visibility  String   @default("private")  // 可见性，默认私有
  cozeBotId   String?  // 关联 Coze Bot ID（可选）
  documents     Document[]  // 关联的文档列表（一对多）
  conversations Conversation[]  // 关联的对话列表（一对多）
  createdAt DateTime @default(now())  // 创建时间，默认当前时间
  updatedAt DateTime @updatedAt  // 更新时间，自动更新
}

// 其他模型结构类似...
```

## 三、数据库连接步骤

### 1. 安装 PostgreSQL（本地开发）

#### macOS 安装
```bash
# 使用 Homebrew 安装
brew install postgresql

# 启动服务
brew services start postgresql

# 创建数据库
createdb ai_knowledge

# 创建用户（可选）
createuser -s postgres
```

#### Docker 安装（推荐）
```bash
# 拉取镜像并启动容器
docker run -d \
  --name postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=123456 \
  -e POSTGRES_DB=ai_knowledge \
  -p 5432:5432 \
  postgres:16-alpine
```

### 2. 配置环境变量

在 `backend/.env` 文件中添加数据库连接字符串：
```env
# 本地安装（无密码）
DATABASE_URL="postgresql://postgres@localhost:5432/ai_knowledge"

# 本地安装（有密码）
DATABASE_URL="postgresql://postgres:123456@localhost:5432/ai_knowledge"

# Docker 安装
DATABASE_URL="postgresql://postgres:123456@localhost:5432/ai_knowledge"
```

### 3. 初始化数据库

```bash
# 生成 Prisma Client
npx prisma generate

# 推送 schema 到数据库（创建表）
npx prisma db push

# 或创建迁移文件（生产环境推荐）
npx prisma migrate dev --name init
```

### 4. 验证连接

```bash
# 打开 Prisma Studio（可视化数据库管理工具）
npx prisma studio
```

浏览器访问 `http://localhost:5555`，即可看到数据库表和数据。

## 四、常用 Prisma 命令

| 命令 | 作用 |
|------|------|
| `npx prisma generate` | 根据 schema 生成类型安全的 Prisma Client |
| `npx prisma db push` | 将 schema 直接推送到数据库（开发环境） |
| `npx prisma migrate dev --name <name>` | 创建迁移文件并应用到数据库（生产环境） |
| `npx prisma migrate deploy` | 应用迁移文件到生产环境数据库 |
| `npx prisma studio` | 启动可视化数据库管理工具 |
| `npx prisma db seed` | 执行数据填充脚本 |
| `npx prisma format` | 格式化 schema.prisma 文件 |

## 五、数据模型详解

### 字段类型

| Prisma 类型 | 对应 PostgreSQL 类型 | 说明 |
|------------|---------------------|------|
| `String` | `varchar` | 字符串 |
| `Int` | `integer` | 整数 |
| `DateTime` | `timestamp` | 日期时间 |
| `Boolean` | `boolean` | 布尔值 |
| `Float` | `double precision` | 浮点数 |

### 字段属性

| 属性 | 作用 |
|------|------|
| `@id` | 标记为主键 |
| `@default(uuid())` | 默认值为 UUID |
| `@default(now())` | 默认值为当前时间 |
| `@updatedAt` | 自动更新为当前时间 |
| `?` | 标记为可选字段 |

### 关系定义

#### 一对多关系
```prisma
model KnowledgeBase {
  id          String   @id @default(uuid())
  documents   Document[]  // 一个知识库对应多个文档
}

model Document {
  id              String  @id @default(uuid())
  knowledgeBaseId String  // 外键
  knowledgeBase   KnowledgeBase @relation(fields: [knowledgeBaseId], references: [id])  // 关联知识库
}
```

#### 一对一关系
```prisma
model User {
  id    String @id @default(uuid())
  profile Profile?  // 一个用户对应一个个人资料
}

model Profile {
  id     String @id @default(uuid())
  userId String @unique  // 唯一外键
  user   User @relation(fields: [userId], references: [id])  // 关联用户
}
```

#### 多对多关系
```prisma
model Post {
  id         String @id @default(uuid())
  categories Category[]  // 一篇文章对应多个分类
}

model Category {
  id    String @id @default(uuid())
  posts Post[]  // 一个分类对应多篇文章
}
```

## 六、常见问题

### 1. 连接数据库失败

**可能原因**：
- PostgreSQL 服务未启动
- 连接字符串配置错误
- 数据库用户权限不足

**解决方法**：
```bash
# 检查 PostgreSQL 服务状态（macOS）
brew services list

# 重启服务
brew services restart postgresql

# 测试连接
psql -U postgres -d ai_knowledge
```

### 2. Prisma Client 生成失败

**可能原因**：
- Node.js 版本过低
- 依赖安装不完整
- schema 文件语法错误

**解决方法**：
```bash
# 清理依赖并重新安装
rm -rf node_modules package-lock.json
npm install

# 重新生成
npx prisma generate
```

### 3. 数据库迁移冲突

**可能原因**：
- 手动修改了数据库表结构
- 多个开发人员同时修改 schema

**解决方法**：
```bash
# 重置数据库（开发环境）
npx prisma migrate reset

# 或手动解决冲突后重新生成迁移
npx prisma migrate dev --name fix-conflict
```

## 七、生产环境注意事项

1. **使用迁移文件**：生产环境必须使用 `prisma migrate deploy`，禁止使用 `prisma db push`
2. **环境变量安全**：数据库连接字符串应使用环境变量，不要硬编码到代码中
3. **权限控制**：生产环境数据库用户应使用最小权限原则，避免使用超级用户
4. **备份策略**：定期备份数据库，防止数据丢失
5. **性能优化**：合理创建索引，优化查询语句

## 八、下一步操作

1. 安装并启动 PostgreSQL 数据库
2. 配置 `backend/.env` 文件中的 `DATABASE_URL`
3. 运行 `npx prisma generate` 生成 Prisma Client
4. 运行 `npx prisma db push` 创建数据库表
5. 运行 `npx prisma studio` 验证数据库连接