# TASK-0007：后端基础、SQLite 与最小认证骨架

## 基本信息

- Task ID：TASK-0007
- Task Name：后端基础、SQLite 与最小认证骨架
- Status：DRAFT
- Owner：Codex Backend（AGENTS.md 第 3 节；实施 Owner）
- Reviewer：Codex Reviewer
- Branch：feature/task-0007-backend-foundation
- Requirement Source：hangyu 提出的企业机房服务器落位可视化需求
- Product Baseline：docs/product/MVP-PRODUCT-BASELINE.md（TASK-0004，COMPLETED，PASS）
- Architecture Reference：docs/architecture/MVP-ARCHITECTURE-BASELINE.md（TASK-0005，COMPLETED，PASS）
- Module Lock：待认领（实施时由 Codex Backend 在 READY → IN_PROGRESS 前认领）

## Reviewer 独立性检查

- Owner 与 Reviewer 不同：是（Codex Backend ≠ Codex Reviewer）
- 修复者与最终 Reviewer 不同：N/A：本任务为新建，非修复
- 例外原因：N/A
- hangyu 批准记录：N/A
- 补偿性复审方式：N/A

## 前置条件

- [x] 产品基线已批准：TASK-0004 COMPLETED，PASS
- [x] 架构基线已批准：TASK-0005 COMPLETED，PASS
- [x] 项目脚手架已完成：TASK-0006 COMPLETED，PASS；已合并 main
- [x] Owner/Reviewer 独立性已检查：是
- [ ] 模块父子路径冲突已检查：由 Codex Backend 在 READY → IN_PROGRESS 前执行
- [x] 其他前置条件：TASK-0007 规格已通过 Codex Reviewer 独立审核

## 允许修改

- src/backend/Datacenter.Api/Datacenter.Api.csproj（添加 NuGet 包引用）
- src/backend/Datacenter.Api/Program.cs（认证、授权、EF Core、Antiforgery 中间件配置）
- src/backend/Datacenter.Api/appsettings.json（非敏感默认配置：日志、连接字符串模板）
- src/backend/Datacenter.Api/appsettings.Development.json（开发环境连接字符串、日志级别）
- src/backend/Datacenter.Api/appsettings.Development.example.json（新建：开发配置模板，不含真实路径）
- src/backend/Datacenter.Api/Models/（新建目录：6 个实体类）
- src/backend/Datacenter.Api/Data/（新建目录：AppDbContext）
- src/backend/Datacenter.Api/Services/（新建目录：AuthService）
- src/backend/Datacenter.Api/Controllers/（新建目录：AuthController）
- src/backend/Datacenter.Api/Migrations/（EF Core 自动生成：初始迁移）
- tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj（添加测试包引用）
- tests/backend/Datacenter.Api.Tests/UnitTests/（新建目录：密码哈希单元测试）
- tests/backend/Datacenter.Api.Tests/IntegrationTests/（新建目录：认证集成测试）
- tasks/TASK-0007-BACKEND-FOUNDATION.md（本文件，实施时更新状态和证据）
- tasks/current-task.md（状态同步）
- tasks/MODULE-LOCKS.md（锁同步）
- .gitignore（仅在现有规则缺失数据库或配置排除时最小同步）

## 禁止修改

- docs/product/MVP-PRODUCT-BASELINE.md（产品基线）
- docs/architecture/MVP-ARCHITECTURE-BASELINE.md（架构基线）
- docs/architecture/AGENT-WORKFLOW.md（工作流规范）
- AGENTS.md
- agents/
- src/frontend/（前端代码）
- tests/frontend/（前端测试）
- Datacenter.sln
- scripts/validate-agent-workflow.ps1
- scripts/verify-project.ps1（TASK-0006 产出；非本任务修改范围）
- README.md
- reviews/（所有审核报告）
- tasks/TASK-0004-PRODUCT-BASELINE.md
- tasks/TASK-0005-MVP-ARCHITECTURE-BASELINE.md
- tasks/TASK-0006-PROJECT-SCAFFOLD.md
- tasks/CR-0001-WSL-DEV-ENVIRONMENT.md
- tasks/CR-0002-TASK-0006-WORKFLOW-AND-DEVELOPER-ROLE.md
- tasks/CR-0003-TASK-0006-VERIFICATION-FIXES.md
- tasks/CR-0004-TASK-0006-COVERLET-GATE-FIX.md
- 任何业务 Service（RoomService、CabinetService、ServerService、PlacementService、AuditService）
- 任何业务 Controller（RoomsController、CabinetsController、ServersController、PlacementsController、AuditController、ServerStatusController）
- 任何业务页面或前端组件
- 任何 .db、.db-shm、.db-wal 数据库文件（仅创建于本地开发环境，不提交 Git）

## 功能要求

1. 定义全部 6 个 EF Core 实体类（Room、Cabinet、Server、ServerPosition、User、AuditRecord），包含架构基线第 9.3 和 10.1 节定义的全部属性和关系约束。
2. 创建 AppDbContext，配置 6 个 DbSet、唯一索引、关系映射和实体约束。
3. 生成并验证初始 EF Core 迁移，创建完整数据库 Schema。
4. 配置 SQLite 数据库连接，启用 WAL 模式，数据库文件位于 `src/backend/datacenter-dev.db`。
5. 在应用启动时执行 `PRAGMA journal_mode=WAL;` 并验证 WAL 模式已生效。
6. 实现 User 实体种子数据：4 个预置用户，每个角色一人（机房管理员、运维人员、DBA/应用运维人员、只读查看人员）。
7. 使用 `Microsoft.AspNetCore.Identity.PasswordHasher<TUser>` 对种子用户密码进行哈希存储。禁止明文存储。
8. 实现登录端点：验证账号存在且启用 → 验证密码哈希 → 创建 ClaimsPrincipal（含用户标识和角色声明）→ 建立 Cookie 会话 → 返回用户信息。登录失败返回统一错误，不区分"用户不存在"和"密码错误"。
9. 实现登出端点：清除认证 Cookie，后续受保护请求返回 401。
10. 实现当前用户信息端点：返回已认证用户的标识、登录名和角色。
11. 配置 Cookie 认证中间件：HttpOnly=true、SameSite=Lax、开发环境 Secure 可关闭、固定 8 小时过期、SlidingExpiration=false。
12. 实现 OnValidatePrincipal：每个请求查询数据库验证用户仍存在且启用；已禁用用户拒绝 Principal 并 SignOut。
13. 配置 ASP.NET Core Antiforgery 中间件：所有状态变更请求（POST/PUT/PATCH/DELETE）必须验证 Antiforgery Token。
14. 配置角色授权策略：`机房管理员` 和 `运维人员` 策略用于修改端点；`DBA/应用运维人员` 和 `只读查看人员` 策略用于只读端点。
15. 配置全局授权过滤器：除登录端点外，所有端点要求已认证用户。
16. 实现统一错误响应 JSON 结构 `{ "error": "..." }` 和 HTTP 状态码约定（400/401/403/404/500）。
17. 使用 ASP.NET Core 内置 `ILogger<T>` 记录认证事件（登录成功/失败）到控制台。
18. 配置 `appsettings.Development.example.json` 作为开发环境配置模板（不含真实连接路径或凭据）。

## 非功能要求

1. 所有密码使用 `PasswordHasher<TUser>` 哈希存储，禁止明文或自定义哈希算法。
2. Cookie 中只包含用户唯一标识、登录名和角色声明。禁止在 Cookie/Claims 中保存密码、密码哈希、初始化凭据、数据库连接信息或其他敏感秘密。
3. 登录失败响应不得区分"用户不存在"和"密码错误"，防止用户名枚举。
4. `dotnet build` 必须 0 errors、0 warnings；不得通过 NoWarn 或关闭警告隐藏问题。
5. 数据库文件及 WAL/SHM 文件由 `.gitignore` 排除（`*.db`、`*.db-shm`、`*.db-wal`）。
6. `appsettings.Development.json` 不得提交 Git（`.gitignore` 已有规则）。
7. 不引入 ASP.NET Core Identity 完整框架（UserManager、RoleManager、SignInManager 等）。
8. 不引入 JWT、OAuth 2.0、OpenID Connect、LDAP、AD、SSO 或任何外部认证协议。
9. 不引入未在复杂度预算中列出的 NuGet 包或 npm 包。
10. 不实现用户管理页面或 API（用户 CRUD、角色配置、密码重置、用户导入）。所有账号通过受控部署初始化预置。
11. 不实现自注册。

## 范围与非目标

- 最小实现范围：
  - 6 个实体类（Models/）
  - 1 个 AppDbContext（Data/）
  - 1 个初始 EF Core 迁移（Migrations/）
  - 1 个 AuthService（Services/）
  - 1 个 AuthController（Controllers/）
  - 3 个端点：POST /api/auth/login、POST /api/auth/logout、GET /api/auth/me
  - Program.cs 完整中间件配置（认证、授权、EF Core、Antiforgery、WAL 初始化）
  - 4 个种子用户（每个角色一人）
  - 2 个 appsettings 配置更新 + 1 个 example 模板新建
  - 后端直接运行时 NuGet 包：恰好 3 个（见复杂度预算）
  - 后端设计时 NuGet 包：恰好 1 个
  - 后端测试新增 NuGet 包：恰好 1 个
  - 后端单元测试：密码哈希验证（≥2 个测试）
  - 后端集成测试：认证流程完整覆盖（≥12 个测试）

- 明确不实现范围：
  - 机房、机柜、服务器业务功能（FR-001 至 FR-012）
  - 上架、移动、下架位置操作
  - 操作记录查询
  - 二维机柜视图
  - 前端登录页面（TASK-0008）
  - 前端任何页面或组件
  - 完整 RBAC 权限引擎
  - ASP.NET Core Identity 完整框架（UserManager、RoleManager、SignInManager）
  - JWT 认证
  - LDAP、AD、SSO 集成
  - 多数据库兼容层（无 repository interface、无数据库抽象）
  - MySQL 适配
  - CQRS 或 MediatR
  - AutoMapper 或 Mapster
  - FluentValidation
  - Serilog 或 NLog
  - Docker 或容器化
  - Redis 或分布式缓存
  - 消息队列
  - 用户管理 CRUD API
  - 角色管理 API
  - 密码重置
  - 自注册
  - 用户导入
  - 健康检查端点

- 推迟到未来的内容：
  - 业务 Service（RoomService、CabinetService、ServerService、PlacementService、AuditService）→ TASK-0009+
  - 业务 Controller（RoomsController、CabinetsController、ServersController、PlacementsController、AuditController、ServerStatusController）→ TASK-0009+
  - 前端登录页面和路由守卫 → TASK-0008
  - Vue Router、useAuth/useApi composables → TASK-0008
  - API 契约文档（OpenAPI/Swagger）→ 后续任务
  - 生产部署配置 → 后续任务
  - 性能测试数据填充脚本 → TASK-0016

## 需求追踪矩阵

| 实现项 | Requirement Source | 要求类型与编号 | 验收标准编号 |
|---|---|---|---|
| EF Core DbContext + 6 个实体 + 初始迁移 | hangyu 机房落位可视化需求 | 全部 FR/NFR（数据持久化基础） | AC-BF-01, AC-BF-02, AC-BF-03, AC-BF-04 |
| SQLite WAL 模式配置与初始化 | hangyu 机房落位可视化需求 | NFR-001（数据一致性）, NFR-002（响应时间） | AC-BF-02, AC-BF-05 |
| User 实体 + 种子数据（4 用户） | hangyu 机房落位可视化需求 | NFR-007（基本操作安全） | AC-BF-06, AC-BF-07 |
| PasswordHasher<TUser> 密码哈希 | hangyu 机房落位可视化需求 | NFR-007（基本操作安全） | AC-BF-07, AC-BF-08, AC-BF-19 |
| Cookie 认证登录/登出 | hangyu 机房落位可视化需求 | NFR-007（基本操作安全） | AC-BF-09, AC-BF-10, AC-BF-20 |
| 匿名拒绝（401） | hangyu 机房落位可视化需求 | NFR-007（基本操作安全）, AC-037 | AC-BF-11 |
| Cookie 安全属性（HttpOnly/SameSite/过期） | hangyu 机房落位可视化需求 | NFR-007（基本操作安全） | AC-BF-12, AC-BF-14 |
| OnValidatePrincipal 禁用账号会话失效 | hangyu 机房落位可视化需求 | NFR-007（基本操作安全） | AC-BF-13 |
| Antiforgery Token 验证 | hangyu 机房落位可视化需求 | NFR-007（基本操作安全） | AC-BF-15, AC-BF-21 |
| 角色授权策略（修改/只读） | hangyu 机房落位可视化需求 | NFR-007（基本操作安全） | AC-BF-16, AC-BF-22 |
| 统一错误响应结构 | hangyu 机房落位可视化需求 | NFR-004（校验反馈） | AC-BF-17 |
| ILogger<T> 认证事件日志 | hangyu 机房落位可视化需求 | 架构基线第 15 节（日志） | AC-BF-18 |
| 配置文件分层 + example 模板 | hangyu 机房落位可视化需求 | 架构基线第 12 节（配置规则） | AC-BF-23 |
| 集成测试（WebApplicationFactory + SQLite） | hangyu 机房落位可视化需求 | NFR-001, NFR-005（测试基础） | AC-BF-24 至 AC-BF-27 |
| 单元测试（密码哈希） | hangyu 机房落位可视化需求 | 架构基线第 14.2 节 | AC-BF-24 |
| 构建 0 errors 0 warnings | hangyu 机房落位可视化需求 | 架构基线第 14 节 | AC-BF-28 |

## 复杂度预算

### 允许新增依赖

#### 后端运行时 NuGet 包（恰好 3 个）

| 包 | 用途 | 选择理由 | 删除成本 |
|---|---|---|---|
| `Microsoft.EntityFrameworkCore.Sqlite` | SQLite EF Core 提供程序 | 架构基线已批准 | 更换数据库（中） |
| `Microsoft.EntityFrameworkCore.Design` | EF Core 迁移工具（设计时） | 架构基线已批准 | 改用 dotnet ef 全局工具（低） |
| `Microsoft.Extensions.Identity.Core` | 提供 `PasswordHasher<TUser>` 独立哈希组件 | 架构基线已批准；不从完整 Identity 框架引入 | 替换为自定义密码哈希实现（低） |

认证和 Cookie 中间件、Antiforgery 中间件由 ASP.NET Core 共享框架提供，无需额外 NuGet 包。

#### 后端测试新增 NuGet 包（恰好 1 个）

| 包 | 用途 | 选择理由 | 删除成本 |
|---|---|---|---|
| `Microsoft.AspNetCore.Mvc.Testing` | 集成测试 ASP.NET Core 测试主机（WebApplicationFactory） | 架构基线已批准 | 替换为手动自托管（中） |

测试项目已有的 xUnit、Microsoft.NET.Test.Sdk、xunit.runner.visualstudio 保持不变。

### 允许新增抽象

0。Service 层直接使用 DbContext。不新增接口、基类、工厂、仓储模式或插件机制。

### 允许新增文件

- `src/backend/Datacenter.Api/Models/Room.cs`
- `src/backend/Datacenter.Api/Models/Cabinet.cs`
- `src/backend/Datacenter.Api/Models/Server.cs`
- `src/backend/Datacenter.Api/Models/ServerPosition.cs`
- `src/backend/Datacenter.Api/Models/User.cs`
- `src/backend/Datacenter.Api/Models/AuditRecord.cs`
- `src/backend/Datacenter.Api/Data/AppDbContext.cs`
- `src/backend/Datacenter.Api/Services/AuthService.cs`
- `src/backend/Datacenter.Api/Controllers/AuthController.cs`
- `src/backend/Datacenter.Api/appsettings.Development.example.json`
- `tests/backend/Datacenter.Api.Tests/UnitTests/PasswordHasherTests.cs`
- `tests/backend/Datacenter.Api.Tests/IntegrationTests/AuthIntegrationTests.cs`

### 允许修改的现有文件

- `src/backend/Datacenter.Api/Datacenter.Api.csproj`（添加 PackageReference）
- `src/backend/Datacenter.Api/Program.cs`（完整中间件管道配置）
- `src/backend/Datacenter.Api/appsettings.json`（连接字符串等非敏感默认配置）
- `src/backend/Datacenter.Api/appsettings.Development.json`（开发环境连接字符串、日志级别）
- `tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj`（添加 Mvc.Testing 包引用）

### 允许修改的数据模型

全部 6 个实体均为新建，按架构基线第 9.3 和 10.1 节定义。不修改任何已有数据模型。

### 允许修改的 API 契约

仅 AuthController 的 3 个端点（登录、登出、当前用户信息）。不定义业务资源 API 契约。

### 复杂方案采用理由

N/A：本任务使用 ASP.NET Core 内置 Cookie 认证中间件 + EF Core SQLite + PasswordHasher 独立组件，均属 .NET 生态标准方案。无复杂方案。

## 架构裁决引用

以下技术裁决直接引自架构基线（TASK-0005，MVP-ARCHITECTURE-BASELINE.md），本任务不重新裁决：

| 裁决事项 | 架构基线出处 |
|---|---|
| SQLite 数据库选型 | 第 9.1 节 |
| WAL 模式必须启用 | 第 9.1 节 |
| 数据库文件位置 `src/backend/datacenter-dev.db` | 第 12.3 节 |
| Cookie 认证（非 JWT） | 第 8.5 节 |
| PasswordHasher<TUser>（非完整 Identity） | 第 8.5 节 |
| 账号来源：受控部署初始化预置 | 第 8.5 节 |
| Cookie 安全约束（HttpOnly/SameSite/Secure/8h/无滑动） | 第 8.5 节 |
| OnValidatePrincipal 禁用账号会话失效 | 第 8.5 节 |
| Antiforgery 强制验证 | 第 8.5 节 |
| ASP.NET Core Controllers（非 Minimal API） | 第 8.1 节 |
| 统一错误响应 JSON 结构 | 第 8.4 节 |
| ILogger<T> 控制台日志 | 第 15 节 |
| 配置文件分层与 Git 排除 | 第 12 节 |
| 6 个实体及其关系和关键标识 | 第 9.3 和 10.1 节 |
| 排除 ASP.NET Core Identity 完整框架 | 第 5.1 和 8.5 节 |
| Service 层直接使用 DbContext（无仓储接口） | 第 9.3 节 |
| 测试策略：xUnit + SQLite 集成测试 + Mvc.Testing | 第 14 节 |

## 验收标准

### AC-BF-01：实体类完整且可编译
- 命令：验证 6 个实体文件存在且 `dotnet build` 通过
- 期望：`src/backend/Datacenter.Api/Models/` 下存在 Room.cs、Cabinet.cs、Server.cs、ServerPosition.cs、User.cs、AuditRecord.cs 共 6 个文件。每个实体包含架构基线第 10.1 节定义的全部属性和关键标识。项目编译 0 errors。
- 验证方式：文件存在性检查 + `dotnet build`

### AC-BF-02：AppDbContext 配置正确，初始迁移可生成
- 命令：
  ```powershell
  dotnet ef migrations add InitialCreate --project src/backend/Datacenter.Api/Datacenter.Api.csproj
  ```
- 期望：退出码 0，生成 Migrations/ 目录包含迁移文件。迁移包含全部 6 个表的创建（Rooms、Cabinets、Servers、ServerPositions、Users、AuditRecords）。
- 验证方式：命令执行 + 迁移文件内容检查

### AC-BF-03：数据库可创建且所有表存在
- 命令：
  ```powershell
  dotnet ef database update --project src/backend/Datacenter.Api/Datacenter.Api.csproj
  ```
- 期望：退出码 0，`src/backend/datacenter-dev.db` 文件创建。使用 `sqlite3` 查询 `.tables` 列出全部 6 个表。
- 验证方式：命令执行 + sqlite3 检查

### AC-BF-04：唯一索引和关系约束已创建
- 命令：
  ```powershell
  sqlite3 src/backend/datacenter-dev.db ".schema"
  ```
- 期望：输出中包含以下关键约束：
  - Rooms 表 Name 列 UNIQUE
  - Cabinets 表 (RoomId, CabinetNumber) 组合 UNIQUE
  - Servers 表 Name UNIQUE、ManagementIP UNIQUE
  - Servers 表 AssetNumber 部分唯一索引（WHERE AssetNumber IS NOT NULL）
  - Users 表 Username UNIQUE
  - ServerPositions 表 ServerId 外键、CabinetId 外键
  - AuditRecords 表 ServerId 外键、UserId 外键
- 验证方式：sqlite3 schema 输出 + 人工审查

### AC-BF-05：WAL 模式已启用
- 命令：
  ```powershell
  sqlite3 src/backend/datacenter-dev.db "PRAGMA journal_mode;"
  ```
- 期望：输出 `wal`。
- 验证方式：sqlite3 命令 + 应用启动后验证 WAL 模式生效（也可通过应用启动日志确认）

### AC-BF-06：种子用户已创建
- 命令：
  ```powershell
  sqlite3 src/backend/datacenter-dev.db "SELECT Username, Role FROM Users;"
  ```
- 期望：输出恰好 4 行，包含角色 `机房管理员`、`运维人员`、`DBA/应用运维人员`、`只读查看人员` 各一条。每个用户的 Enabled 为 1。
- 验证方式：sqlite3 查询

### AC-BF-07：种子用户密码已哈希，非明文存储
- 命令：
  ```powershell
  sqlite3 src/backend/datacenter-dev.db "SELECT Username, PasswordHash FROM Users;"
  ```
- 期望：每个用户的 PasswordHash 列非空，不以明文密码形式出现。所有哈希值互不相同。
- 验证方式：sqlite3 查询 + 人工审查

### AC-BF-08：PasswordHasher 可验证种子密码
- 命令：执行单元测试 `PasswordHashVerificationTest`
- 期望：使用 `PasswordHasher<TUser>` 对种子密码原文进行验证，返回 `Success`。
- 验证方式：dotnet test

### AC-BF-09：登录成功返回认证 Cookie 和用户信息
- 命令：向 `POST /api/auth/login` 发送 `{"username": "<admin>", "password": "<correct>"}`，使用种子用户凭据
- 期望：HTTP 200。响应体包含用户标识、登录名和角色（不含密码哈希）。响应 Set-Cookie 包含 `.AspNetCore.Cookies` 认证 Cookie。Cookie 属性含 HttpOnly、SameSite=Lax、Path=/。
- 验证方式：集成测试（HttpClient 检查响应头和响应体）

### AC-BF-10：登录失败返回 401 且不区分失败原因
- 命令：分别发送错误密码和不存在用户名
- 期望：两次请求均返回 HTTP 401。响应体 `{"error": "..."}` 中错误消息完全相同，不包含"用户不存在"或"密码错误"的区分信息。
- 验证方式：集成测试

### AC-BF-11：未认证用户访问受保护端点返回 401
- 命令：不携带认证 Cookie，向 `GET /api/auth/me` 发送请求
- 期望：HTTP 401。响应体含错误消息。
- 验证方式：集成测试

### AC-BF-12：认证 Cookie 设置 HttpOnly 和 SameSite=Lax
- 命令：登录成功后检查 Set-Cookie 响应头
- 期望：Cookie 包含 `HttpOnly` 标志、`SameSite=Lax`。JavaScript 不可访问认证 Cookie。
- 验证方式：集成测试（HttpClientHandler 检查 Cookie 属性）

### AC-BF-13：禁用用户既有会话被拒绝
- 命令：
  1. 以某用户登录，取得有效认证 Cookie
  2. 直接通过 SQLite 将该用户的 Enabled 设为 0（模拟管理员禁用）
  3. 使用原 Cookie 再次请求 `GET /api/auth/me`
- 期望：第三步返回 HTTP 401。认证 Cookie 被清除（Set-Cookie 覆盖为空值或已过期）。用户不得获得原有角色权限。
- 验证方式：集成测试

### AC-BF-14：Cookie 固定 8 小时过期且无滑动续期
- 命令：登录成功后检查 Set-Cookie 的 Expires/Max-Age 属性
- 期望：Cookie 过期时间距当前时间约 8 小时（容差 ±5 分钟）。多次请求后过期时间不变（无滑动续期）。
- 验证方式：集成测试

### AC-BF-15：状态变更请求无 Antiforgery Token 时被拒绝
- 命令：不携带 Antiforgery Token，向 `POST /api/auth/logout` 发送请求
- 期望：HTTP 400 或 401（取决于具体实现顺序，但请求被拒绝，登出操作不执行）。
- 验证方式：集成测试

### AC-BF-16：角色授权策略可区分修改和只读
- 命令：验证授权策略注册。`机房管理员` 和 `运维人员` 角色属于修改策略；`DBA/应用运维人员` 和 `只读查看人员` 属于只读策略。
- 期望：在 Program.cs 或 AuthController 中可见角色策略配置。`Authorize` 过滤器按角色限制端点访问。
- 验证方式：代码审查 + dotnet build

### AC-BF-17：错误响应使用统一 JSON 结构
- 命令：触发 400、401、403、404 错误并检查响应体
- 期望：每个错误响应体为 `{"error": "..."}` JSON 格式。HTTP 状态码分别对应 400、401、403、404。
- 验证方式：集成测试

### AC-BF-18：认证事件写入日志
- 命令：执行登录成功和登录失败操作，检查控制台输出
- 期望：控制台日志中包含登录成功（Information 级别）和登录失败（Warning 级别）事件记录。日志包含用户名（失败时包含）和时间戳。
- 验证方式：集成测试中捕获日志输出

### AC-BF-19：单元测试覆盖密码哈希和验证
- 命令：`dotnet test --filter "FullyQualifiedName~PasswordHash"`
- 期望：至少 2 个测试通过：
  1. 相同密码哈希后验证返回 Success
  2. 不同密码验证返回 Failed
- 验证方式：dotnet test + 测试输出

### AC-BF-20：登出后旧 Cookie 不能访问受保护资源
- 命令：
  1. 登录取得 Cookie
  2. 携带 Cookie 调用 `POST /api/auth/logout`（含有效 Antiforgery Token）
  3. 使用同一 Cookie 请求 `GET /api/auth/me`
- 期望：第三步返回 HTTP 401。已登出会话不能继续访问受保护资源。
- 验证方式：集成测试

### AC-BF-21：有效 Antiforgery Token 允许状态变更操作
- 命令：
  1. 登录取得 Cookie
  2. 从响应中获取 Antiforgery Token
  3. 携带 Token 和 Cookie 调用 `POST /api/auth/logout`
- 期望：HTTP 200。登出操作成功执行。
- 验证方式：集成测试

### AC-BF-22：修改角色可访问需授权端点，只读角色被拒绝
- 命令：
  1. 以 `机房管理员` 登录，请求需修改权限的端点 → 200
  2. 以 `只读查看人员` 登录，请求需修改权限的端点 → 403
- 期望：管理员获得授权，只读角色返回 HTTP 403 `{"error": "权限不足"}`。
- 验证方式：集成测试

### AC-BF-23：appsettings.Development.example.json 存在且不含真实路径
- 命令：
  ```powershell
  test -f src/backend/Datacenter.Api/appsettings.Development.example.json
  ```
- 期望：退出码 0。文件内容包含连接字符串模板（如 `<your-db-path>` 或等效占位符），不含真实文件路径。文件被 Git 跟踪。
- 验证方式：文件存在 + 内容检查 + `git ls-files`

### AC-BF-24：全部测试通过
- 命令：`dotnet test tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj --no-build`
- 期望：退出码 0。单元测试 ≥ 2 个全部通过；集成测试 ≥ 12 个全部通过。总计 ≥ 14 个测试通过。
- 验证方式：dotnet test + 输出统计

### AC-BF-25：集成测试使用独立临时 SQLite 数据库
- 命令：检查集成测试代码
- 期望：每个测试类或测试方法使用独立的临时 SQLite 数据库文件（如 GUID 文件名）。不使用开发数据库文件。测试结束后清理临时文件。
- 验证方式：代码审查

### AC-BF-26：集成测试覆盖认证全流程
- 命令：代码审查集成测试列表
- 期望：测试覆盖至少以下场景：登录成功、错误密码、不存在用户、未认证访问拒绝、登出后拒绝、禁用用户拒绝、Antiforgery 缺少/无效/有效、Cookie 属性验证、角色授权区分。
- 验证方式：代码审查

### AC-BF-27：集成测试不依赖外部服务
- 命令：关闭所有外部服务和网络，运行 `dotnet test`
- 期望：全部集成测试通过。测试使用内存或临时文件 SQLite，不连接外部数据库、LDAP、AD 或任何外部认证服务。
- 验证方式：断网环境测试

### AC-BF-28：dotnet build 0 errors 0 warnings
- 命令：`dotnet build Datacenter.sln --no-restore`
- 期望：退出码 0，输出中不含 `error`（不区分大小写），不含 `warning`（不区分大小写）。禁止通过 `<NoWarn>`、`#pragma warning disable` 抑制警告。
- 验证方式：构建输出审查

### AC-BF-29：工作流校验 20/20 PASS，git diff --check PASS
- 命令：`pwsh -NoLogo -NoProfile -File ./scripts/validate-agent-workflow.ps1`
- 期望：退出码 0，输出 `PASS=20, FAIL=0, TOTAL=20`。
- 命令：`git diff --check`
- 期望：退出码 0。

### AC-BF-30：禁止依赖存在于依赖声明中
- 命令：检查所有 .csproj 文件
- 期望：
  - Web API 项目 csproj 恰好 3 个 PackageReference（Sqlite、Design、Identity.Core），且仅在 Design 上标记 `PrivateAssets=all` 或等效设计时排除
  - 测试项目 csproj 新增恰好 1 个 PackageReference（Mvc.Testing）
  - 所有 csproj 中无 AutoMapper、MediatR、FluentValidation、Serilog、Swashbuckle、coverlet.collector、FluentAssertions、Moq、NSubstitute
- 验证方式：csproj 文件审查

### AC-BF-31：提交后工作区干净，本地远端哈希一致，数据库未被 Git 跟踪
- 命令：`git status --porcelain`
- 期望：无输出（工作区干净）。
- 命令：`test "$(git rev-parse HEAD)" = "$(git rev-parse origin/feature/task-0007-backend-foundation)"`
- 期望：退出码 0（本地与远端哈希一致）。
- 命令：`git ls-files src/backend/datacenter-dev.db src/backend/*.db-shm src/backend/*.db-wal`
- 期望：无输出（数据库文件未被 Git 跟踪）。
- 命令：`git ls-files src/backend/Datacenter.Api/appsettings.Development.json`
- 期望：无输出（开发环境配置文件未被 Git 跟踪）。

## 构建命令

```powershell
# 后端构建
cd <repo-root>
dotnet restore Datacenter.sln
dotnet build Datacenter.sln --no-restore

# 生成初始迁移
dotnet ef migrations add InitialCreate --project src/backend/Datacenter.Api/Datacenter.Api.csproj

# 应用迁移创建数据库
dotnet ef database update --project src/backend/Datacenter.Api/Datacenter.Api.csproj
```

## 构建结果

- 命令：
- 退出码：
- 摘要/证据：

## 测试命令

```powershell
# 后端全部测试
cd <repo-root>
dotnet test tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj --no-build

# 仅单元测试
dotnet test tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj --no-build --filter "FullyQualifiedName~UnitTests"

# 仅集成测试
dotnet test tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj --no-build --filter "FullyQualifiedName~IntegrationTests"

# 工作流校验
pwsh -NoLogo -NoProfile -File ./scripts/validate-agent-workflow.ps1
```

## 测试结果

- 命令：
- 退出码：
- 摘要/证据：

## 开发完成证据

- 修改文件：
- 验收证据：
- 模块锁状态：
- 已知限制：

## 交接记录

| 时间 | 发起者 | 原状态 | 新状态 | 接收者 | 证据/说明 |
|---|---|---|---|---|---|
|  |  |  |  |  |  |

## 审核结论

- Reviewer：
- 结论：
- 审核命令和证据：

## 缺陷清单

| 缺陷 ID | 等级 | 证据/复现 | 修复要求 | 状态 |
|---|---|---|---|---|
|  |  |  |  |  |

## 缺陷修复记录

| 缺陷 ID | 修复者 | 修改说明 | 回归证据 | 提交 |
|---|---|---|---|---|
|  |  |  |  |  |

## 复审结果

- 最终 Reviewer：
- 复审结论：
- 关闭缺陷及证据：

## 防过度开发检查

- 是否存在验收标准以外的实现：
- 是否提前实现未来需求：
- 是否新增未批准依赖：
- 是否存在无实际需求的抽象：
- 是否存在无关重构：
- 是否采用最简单可行方案：
- Reviewer 结论：

## Change Request

- Change Request ID：
- 发现者：
- 原任务：
- 变更原因：
- 产品范围影响：
- 技术影响：
- 文件影响：
- 测试影响：
- 风险：
- Claude 裁决：
- Architect 裁决：
- 更新后的 Requirement Source：
- 批准状态：

## Git 提交与推送

- 提交说明：
- 提交哈希：
- 推送结果：
- 本地哈希：
- 远端哈希：

## 已知限制

- TASK-0007 不包含任何业务功能（机房、机柜、服务器、位置操作）。所有业务 Service 和 Controller 由 TASK-0009 及后续任务实现。
- 用户管理（创建、编辑、删除、角色变更、密码重置）不在 MVP 范围。用户仅通过种子数据预置。
- 不实现 OpenAPI/Swagger 文档。
- 不实现前端登录页面（TASK-0008）。
- 认证 Cookie 固定 8 小时过期，不提供"记住我"或滑动续期。
- MVP 数据规模（≤10000 服务器）下单实例 SQLite 满足需求；不实现多实例、读写分离或高可用。
- 初始种子用户密码通过安全的初始化配置提供；具体凭据管理方式见实施时部署说明。
- 本任务实现全部 6 个实体的完整数据模型（以满足初始迁移需要），但仅 AuthService 包含业务逻辑。其余 Service 类在后续任务中添加。

## 最终完成条件

- [ ] 独立 Reviewer 验收或复审通过
- [ ] 验收标准全部通过（AC-BF-01 至 AC-BF-31）
- [ ] 所有缺陷关闭
- [ ] 构建和测试通过或有批准的 N/A
- [ ] 工作流校验和 `git diff --check` 通过
- [ ] 模块锁已释放
- [ ] 已提交并推送
- [ ] 工作区干净
- [ ] 本地与远端哈希一致
- [ ] Reviewer 的防过度开发专项检查通过
- [ ] 状态由 Reviewer 转为 `COMPLETED`

---

> **文档结束**
>
> 本任务规格由 Claude + DeepSeek Product Manager 编写，基于已批准的产品基线（TASK-0004）和架构基线（TASK-0005）。
> Owner 为 Codex Backend，Reviewer 为 Codex Reviewer。
> 下一步：交由 Codex Reviewer 做规格审核。
