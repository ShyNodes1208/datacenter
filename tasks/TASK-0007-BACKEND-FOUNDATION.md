# TASK-0007：后端 SQLite 基础与最小认证骨架

## 基本信息

- Task ID：TASK-0007
- Task Name：后端 SQLite 基础与最小认证骨架
- Status：DRAFT
- Owner：Codex Backend（AGENTS.md 第 3 节；实施 Owner）
- Reviewer：Codex Reviewer
- Branch：feature/task-0007-backend-foundation
- Requirement Source：hangyu 提出的企业机房服务器落位可视化需求
- Product Baseline：docs/product/MVP-PRODUCT-BASELINE.md（TASK-0004，COMPLETED，PASS）
- Architecture Reference：docs/architecture/MVP-ARCHITECTURE-BASELINE.md（TASK-0005，COMPLETED，PASS）
- Module Lock：待认领（实施时由 Codex Backend 在 READY → IN_PROGRESS 前认领 `src/backend/` 和 `tests/backend/` 实施路径）

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
- [ ] 其他前置条件：TASK-0007 规格已通过 Codex Reviewer 独立审核（当前 NEEDS_CHANGES，待本轮修正后复审）

## 允许修改

- src/backend/Datacenter.Api/Datacenter.Api.csproj（添加 NuGet 包引用）
- src/backend/Datacenter.Api/Program.cs（认证、授权、EF Core、Antiforgery、WAL 初始化中间件配置）
- src/backend/Datacenter.Api/appsettings.json（非敏感默认配置：日志级别、连接字符串模板）
- src/backend/Datacenter.Api/appsettings.Development.example.json（新建：开发配置模板，不含真实路径或凭据）
- src/backend/Datacenter.Api/Models/（新建目录：仅 User 实体）
- src/backend/Datacenter.Api/Data/（新建目录：AppDbContext）
- src/backend/Datacenter.Api/Services/（新建目录：AuthService）
- src/backend/Datacenter.Api/Controllers/（新建目录：AuthController）
- src/backend/Datacenter.Api/Migrations/（EF Core 自动生成：初始迁移及关联文件）
- src/backend/Datacenter.Api/Auth/（新建目录：登录/用户信息 DTO、Bootstrap 初始化逻辑）
- tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj（添加测试包引用）
- tests/backend/Datacenter.Api.Tests/UnitTests/（新建目录：密码哈希和授权策略单元测试）
- tests/backend/Datacenter.Api.Tests/IntegrationTests/（新建目录：认证集成测试及测试夹具）
- tasks/TASK-0007-BACKEND-FOUNDATION.md（本文件，实施时更新状态和证据）
- tasks/current-task.md（状态同步）
- tasks/MODULE-LOCKS.md（锁同步）
- .gitignore（仅在现有规则缺失 `.data/` 目录排除时最小同步；本轮只写规格不实际修改）

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
- reviews/（所有审核报告，包括 TASK-0007-BACKEND-FOUNDATION-SPEC-REVIEW.md）
- tasks/TASK-0004-PRODUCT-BASELINE.md
- tasks/TASK-0005-MVP-ARCHITECTURE-BASELINE.md
- tasks/TASK-0006-PROJECT-SCAFFOLD.md
- tasks/CR-0001-WSL-DEV-ENVIRONMENT.md
- tasks/CR-0002-TASK-0006-WORKFLOW-AND-DEVELOPER-ROLE.md
- tasks/CR-0003-TASK-0006-DEPENDENCY-VALIDATION-CORRECTION.md
- tasks/CR-0004-TASK-0006-COVERLET-VALIDATION-CORRECTION.md
- 任何业务实体（Room、Cabinet、Server、ServerPosition、AuditRecord）
- 任何业务 Service（RoomService、CabinetService、ServerService、PlacementService、AuditService）
- 任何业务 Controller（RoomsController、CabinetsController、ServersController、PlacementsController、AuditController、ServerStatusController）
- 任何业务页面或前端组件
- 任何 .db、.db-shm、.db-wal 数据库文件（仅创建于本地 `.data/` 目录，不得提交 Git）
- User CRUD API、角色管理 API、密码重置、自注册、用户导入

## 功能要求

### FR-BF-01：最小 User 实体
定义 EF Core User 实体，包含：唯一标识、登录名（唯一）、密码哈希、启用状态、角色（字符串，值为产品基线规定的固定角色集合：`机房管理员`、`运维人员`、`DBA/应用运维人员`、`只读查看人员`）、创建时间。不创建 Role 表、权限表、用户角色关联表或 RBAC Schema。

### FR-BF-02：AppDbContext 与初始迁移
创建 AppDbContext，包含 Users DbSet。配置 User 实体约束：Username 唯一索引。生成初始 EF Core 迁移，仅创建 Users 表结构。不包含 Room、Cabinet、Server、ServerPosition、AuditRecord 或其 DbSet、关系、索引或约束。

### FR-BF-03：SQLite 配置与 WAL 模式
配置 SQLite 数据库连接。数据库文件默认路径为项目工作目录下的 `.data/datacenter-dev.db`（不位于受 Git 管理的源码目录）。连接字符串在 `appsettings.json` 中提供模板，在 `appsettings.Development.json`（不入 Git）中配置实际路径。禁止 SMB、NFS、NAS 和任何网络共享路径。

### FR-BF-04：WAL 模式初始化与验证
应用启动时在 DbContext 初始化后执行 `PRAGMA journal_mode=WAL;`。查询返回值；若返回不是 `wal`，应用启动失败（抛出异常或非零退出）。不得静默继续。

### FR-BF-05：开发环境 Bootstrap 管理员
提供可选的最小开发 Bootstrap 机制：仅当通过 `appsettings.Development.json`、用户机密或环境变量明确配置了 `BootstrapAdmin:Username` 和 `BootstrapAdmin:Password` 时才尝试创建管理员用户；仅当目标用户不存在时创建（幂等，不覆盖已有用户）；不每次启动重复创建；不将明文密码、哈希或真实凭据写入 Git。未配置时不创建任何用户，不报错。

### FR-BF-06：生产环境不自动创建已知默认账户
生产环境默认不自动创建任何已知用户。不将默认密码写入 Git。不将固定密码哈希写进迁移。不因缺少 Bootstrap 配置导致启动失败。生产管理员初始化方式留给部署任务。

### FR-BF-07：集成测试用户由测试夹具创建
集成测试所需用户由测试夹具在临时测试数据库中创建。测试凭据不入 Git（使用测试代码中的非敏感测试值）。测试数据库与开发数据库隔离。

### FR-BF-08：密码哈希
使用 `Microsoft.AspNetCore.Identity.PasswordHasher<TUser>` 对用户密码进行哈希存储和验证。`PasswordHasher<TUser>` 由 ASP.NET Core 8 共享框架（`Microsoft.AspNetCore.App`）提供，不添加独立 `Microsoft.Extensions.Identity.Core` PackageReference。禁止明文存储密码。禁止自行实现密码哈希算法。

### FR-BF-09：CSRF Token 端点
实现 `GET /api/auth/csrf`。可由匿名用户调用。生成 Antiforgery Cookie 和请求令牌。响应通过自定义 Header `X-XSRF-TOKEN` 返回请求令牌值。不返回敏感信息。

### FR-BF-10：登录端点
实现 `POST /api/auth/login`。必须携带有效 Antiforgery Token（通过 `X-XSRF-TOKEN` 请求头提交；先调用 `GET /api/auth/csrf` 获取 token/cookie 对）。接收 JSON `{"username": "...", "password": "..."}`。验证用户存在且启用 → 验证密码哈希 → 创建 ClaimsPrincipal（含用户标识、登录名、角色声明）→ 建立认证 Cookie 会话。成功返回 200 及最小用户信息（用户标识、登录名、角色，不含密码哈希）。登录失败返回 401，错误消息不区分"用户不存在"和"密码错误"（统一错误消息）。

### FR-BF-11：登出端点
实现 `POST /api/auth/logout`。必须认证。必须验证 Antiforgery Token。清除认证 Cookie（`HttpContext.SignOutAsync`）。重复登出或已无有效会话时仍返回 200（幂等）。成功返回 200。

### FR-BF-12：当前用户信息端点
实现 `GET /api/auth/me`。必须认证。返回已认证用户的最小身份信息：用户标识、登录名、角色。不返回密码哈希、内部配置或任何敏感字段。未认证返回 401。

### FR-BF-13：Cookie 认证中间件配置
配置 Cookie 认证：认证 Cookie 名称 `.AspNetCore.Cookies`、`HttpOnly = true`、`SameSite = Lax`、开发环境 `Secure` 可关闭。会话有效期固定 8 小时（架构基线第 8.5 节已批准），`SlidingExpiration = false`。Claims 只包含用户唯一标识、登录名和角色。禁止在 Cookie/Claims 中保存密码、密码哈希、初始化凭据、数据库连接信息或其他敏感秘密。

### FR-BF-14：OnValidatePrincipal 禁用账号会话失效
实现 `CookieAuthenticationEvents.OnValidatePrincipal`：每个携带认证 Cookie 的请求到达时，根据 Cookie 中用户标识查询数据库验证用户仍存在且启用。若用户不存在或已禁用，调用 `RejectPrincipal()` 并 `SignOutAsync()`，拒绝当前请求。

### FR-BF-15：Antiforgery 中间件配置
配置 ASP.NET Core 内置 Antiforgery 中间件。Antiforgery Token 通过自定义请求头 `X-XSRF-TOKEN` 提交。所有状态变更请求（POST/PUT/PATCH/DELETE）必须验证 Token。登录、注销均须验证。只读请求（GET/HEAD）不要求 Token。`SameSite=Lax` 作为纵深防御补充，不替代服务端防伪验证。

### FR-BF-16：角色授权策略
定义授权策略：`CanModify` 策略要求 `机房管理员` 或 `运维人员` 角色；`ReadOnly` 策略要求 `DBA/应用运维人员` 或 `只读查看人员` 角色。在 Program.cs 中注册策略。

### FR-BF-17：全局授权过滤器
配置全局 `AuthorizeFilter` 或等效机制：除 `GET /api/auth/csrf` 和 `POST /api/auth/login` 外，所有端点要求已认证用户。匿名访问受保护端点返回 401。

### FR-BF-18：统一错误响应
使用 ASP.NET Core 内置 ProblemDetails 或架构基线规定的 `{"error": "..."}` JSON 结构（优先评估内置 ProblemDetails 是否更简单；若架构基线硬性要求自定义结构则使用后者）。当前认证端点实际需要的错误响应：400（请求格式错误）、401（未认证或认证失败）、500（未处理异常，不泄露堆栈或敏感信息）。不提前承诺业务 403/404。

### FR-BF-19：认证事件日志
使用 ASP.NET Core 内置 `ILogger<T>` 记录认证事件到控制台。登录成功记录 Information 级别（含用户标识）。登录失败记录 Warning 级别（含登录名，不含密码）。不记录 Cookie、密码哈希、Antiforgery Token 或敏感配置。不通过不同日志等级或客户端响应泄露账号是否存在。

## 非功能要求

1. 所有密码使用 `PasswordHasher<TUser>` 哈希存储，禁止明文或自定义哈希算法。
2. Cookie Claims 中只包含用户唯一标识、登录名和角色。禁止在 Cookie 中保存密码、密码哈希、初始化凭据、数据库连接信息或其他敏感秘密。
3. 登录失败响应不得区分"用户不存在"和"密码错误"（统一 401 错误消息）。
4. `dotnet build` 必须 0 errors、0 warnings；不得通过 NoWarn 或关闭警告隐藏问题。
5. 数据库文件及 WAL/SHM 文件由 `.gitignore` 排除（`*.db`、`*.db-shm`、`*.db-wal`、`.data/` 目录）。
6. `appsettings.Development.json` 不得提交 Git（`.gitignore` 已有规则）。
7. 不引入 ASP.NET Core Identity 完整框架（UserManager、RoleManager、SignInManager 等）。
8. 不引入 JWT、OAuth 2.0、OpenID Connect、LDAP、AD、SSO 或任何外部认证协议。
9. 不引入未在复杂度预算中列出的 NuGet 包。
10. 不创建 User CRUD API、角色管理 API、密码重置、自注册或用户导入功能。
11. `PasswordHasher<TUser>` 使用 ASP.NET Core 共享框架内置实现，不添加独立 PackageReference。
12. 不创建本任务不需要的 AuditRecord 表或任何持久化审计表。业务操作审计留给上架/移动/下架任务。
13. 不创建 Role 表、权限表或用户角色关联表。
14. 集成测试数据库与开发数据库完全隔离，使用独立临时文件。

## 范围与非目标

- 最小实现范围：
  - 1 个 User 实体（Models/User.cs）
  - 1 个 AppDbContext（Data/AppDbContext.cs），仅含 Users DbSet
  - 1 个初始 EF Core 迁移（Migrations/，含 migration.cs、Designer.cs、ModelSnapshot.cs 共 3 个自动生成文件）
  - 1 个 AuthService（Services/AuthService.cs）
  - 1 个 AuthController（Controllers/AuthController.cs），4 个端点
  - 最小请求/响应 DTO（Auth/LoginRequest.cs、Auth/UserInfoResponse.cs）
  - 开发 Bootstrap 初始化逻辑（Auth/BootstrapExtensions.cs）
  - Program.cs 完整中间件配置
  - 1 个配置文件更新（appsettings.json）+ 1 个 example 模板新建（appsettings.Development.example.json）
  - 1 个测试夹具（IntegrationTests/AuthTestFixture.cs）
  - 1 个集成测试文件（IntegrationTests/AuthIntegrationTests.cs）
  - 1 个单元测试文件（UnitTests/AuthUnitTests.cs）
  - 后端运行时 NuGet 包：恰好 1 个新增
  - 后端设计时 NuGet 包：恰好 1 个
  - 后端测试新增 NuGet 包：恰好 1 个
  - 开发工具：dotnet-ef（本地 Tool Manifest 或全局工具，不计入 PackageReference）

- 明确不实现范围：
  - 机房、机柜、服务器、位置操作、操作记录等业务功能
  - Room、Cabinet、Server、ServerPosition、AuditRecord 实体
  - 业务 Service 和 Controller
  - 前端登录页面、前端任何组件
  - 完整 RBAC 权限引擎
  - ASP.NET Core Identity 完整框架
  - JWT、LDAP、AD、SSO
  - 多数据库兼容层、仓储模式
  - CQRS、MediatR、AutoMapper、FluentValidation、Serilog
  - Docker、Redis、消息队列
  - 用户 CRUD、角色管理、密码重置、自注册
  - 健康检查端点
  - OpenAPI/Swagger

- 推迟到未来的内容：
  - Room、Cabinet、Server、ServerPosition 实体 → TASK-0009 至 TASK-0011
  - AuditRecord 实体 → TASK-0013
  - 业务 Service 和 Controller → TASK-0009+
  - 前端登录页面和路由守卫 → TASK-0008
  - 真实业务端点的 403 验证 → 对应业务任务
  - 生产管理员初始化 → 部署任务
  - 性能测试数据填充 → TASK-0016

## 需求追踪矩阵

| 实现项 | Requirement Source | 要求类型与编号 | 验收标准编号 |
|---|---|---|---|
| User 实体 + AppDbContext + 初始迁移 | hangyu 机房落位可视化需求 | NFR-007（认证数据基础） | AC-BF-01, AC-BF-02, AC-BF-03 |
| SQLite 连接 + WAL 模式初始化与验证 | hangyu 机房落位可视化需求 | NFR-001（数据一致性）, NFR-002（响应时间） | AC-BF-04, AC-BF-05 |
| 开发 Bootstrap 管理员（可选、幂等、不入 Git） | hangyu 机房落位可视化需求 | NFR-007（基本操作安全） | AC-BF-06, AC-BF-07 |
| PasswordHasher<TUser> 密码哈希 | hangyu 机房落位可视化需求 | NFR-007（基本操作安全） | AC-BF-08, AC-BF-19 |
| CSRF Token 端点（GET /api/auth/csrf） | hangyu 机房落位可视化需求 | NFR-007（基本操作安全） | AC-BF-09 |
| Cookie 认证登录/登出/me | hangyu 机房落位可视化需求 | NFR-007（基本操作安全） | AC-BF-10 至 AC-BF-14 |
| Cookie 安全属性（HttpOnly/SameSite/过期） | hangyu 机房落位可视化需求 | NFR-007（基本操作安全） | AC-BF-15, AC-BF-16 |
| OnValidatePrincipal 禁用账号会话失效 | hangyu 机房落位可视化需求 | NFR-007（基本操作安全） | AC-BF-17 |
| Antiforgery Token 闭环验证 | hangyu 机房落位可视化需求 | NFR-007（基本操作安全） | AC-BF-18, AC-BF-20 |
| 角色授权策略注册与独立评估 | hangyu 机房落位可视化需求 | NFR-007（基本操作安全） | AC-BF-21 |
| 统一错误响应 | hangyu 机房落位可视化需求 | NFR-004（校验反馈） | AC-BF-22 |
| ILogger<T> 认证事件日志 | hangyu 机房落位可视化需求 | 架构基线第 15 节（日志） | AC-BF-23 |
| 配置文件分层 + example 模板 | hangyu 机房落位可视化需求 | 架构基线第 12 节（配置规则） | AC-BF-24 |
| 集成测试（WebApplicationFactory + SQLite 临时文件） | hangyu 机房落位可视化需求 | NFR-001, NFR-005（测试基础） | AC-BF-25 至 AC-BF-28 |
| 单元测试（密码哈希 + 授权策略） | hangyu 机房落位可视化需求 | 架构基线第 14.2 节 | AC-BF-19, AC-BF-21 |
| 构建 0 errors 0 warnings | hangyu 机房落位可视化需求 | 架构基线第 14 节 | AC-BF-29 |

## 复杂度预算

### 依赖预算

#### 后端运行时直接依赖（新增 1 个）

| 包 | 类别 | 用途 | 删除成本 |
|---|---|---|---|
| `Microsoft.EntityFrameworkCore.Sqlite` | 运行时 | SQLite EF Core 提供程序 | 更换数据库（中） |

`PasswordHasher<TUser>` 已由 ASP.NET Core 8 共享框架（`Microsoft.AspNetCore.App`）提供，不添加独立 PackageReference。

#### 后端设计时依赖（新增 1 个）

| 包 | 类别 | 用途 | 删除成本 |
|---|---|---|---|
| `Microsoft.EntityFrameworkCore.Design` | 设计时 | EF Core 迁移工具，`PrivateAssets=all`，不发布为运行时资产 | 改用 dotnet ef 全局工具（低） |

#### 后端测试新增直接依赖（新增 1 个）

| 包 | 类别 | 用途 | 删除成本 |
|---|---|---|---|
| `Microsoft.AspNetCore.Mvc.Testing` | 测试 | 集成测试 WebApplicationFactory | 替换为手动自托管（中） |

#### 测试项目既有依赖（非本任务新增）

以下依赖由 TASK-0006 已存在，本任务不新增：
- `xunit`
- `Microsoft.NET.Test.Sdk`
- `xunit.runner.visualstudio`

#### 开发工具依赖

| 工具 | 类别 | 用途 |
|---|---|---|
| `dotnet-ef` | 开发工具 | 生成迁移。通过本地 Tool Manifest（`dotnet new tool-manifest` + `dotnet tool install dotnet-ef`）或全局工具安装，不计入项目 PackageReference |

#### 明确禁止的依赖

所有 csproj 中不得出现：AutoMapper、MediatR、FluentValidation、Serilog、Swashbuckle、coverlet.collector、FluentAssertions、Moq、NSubstitute、`Microsoft.AspNetCore.Identity` 完整包、`Microsoft.AspNetCore.Identity.EntityFrameworkCore`、JWT 相关包、SQLite 以外数据库 Provider。

### 允许新增抽象

0。Service 层直接使用 DbContext。不新增接口、基类、工厂、仓储模式或插件机制。

### 文件预算

#### 新增文件（预计最多 18 个）

**Models（1 个）：**
- `src/backend/Datacenter.Api/Models/User.cs`

**Data（1 个）：**
- `src/backend/Datacenter.Api/Data/AppDbContext.cs`

**Migrations（3 个，EF Core 自动生成）：**
- `src/backend/Datacenter.Api/Migrations/<timestamp>_InitialCreate.cs`
- `src/backend/Datacenter.Api/Migrations/<timestamp>_InitialCreate.Designer.cs`
- `src/backend/Datacenter.Api/Migrations/AppDbContextModelSnapshot.cs`

**Services（1 个）：**
- `src/backend/Datacenter.Api/Services/AuthService.cs`

**Controllers（1 个）：**
- `src/backend/Datacenter.Api/Controllers/AuthController.cs`

**Auth DTO 与初始化（3 个）：**
- `src/backend/Datacenter.Api/Auth/LoginRequest.cs`
- `src/backend/Datacenter.Api/Auth/UserInfoResponse.cs`
- `src/backend/Datacenter.Api/Auth/BootstrapExtensions.cs`

**配置（1 个）：**
- `src/backend/Datacenter.Api/appsettings.Development.example.json`

**测试夹具（1 个）：**
- `tests/backend/Datacenter.Api.Tests/IntegrationTests/AuthTestFixture.cs`

**测试文件（2 个）：**
- `tests/backend/Datacenter.Api.Tests/IntegrationTests/AuthIntegrationTests.cs`
- `tests/backend/Datacenter.Api.Tests/UnitTests/AuthUnitTests.cs`

**任务文件（3 个，规格阶段已创建）：**
- `tasks/TASK-0007-BACKEND-FOUNDATION.md`
- `tasks/current-task.md`（更新）
- `tasks/MODULE-LOCKS.md`（更新）

实施阶段新增文件总计 ≤ 15 个（不含 3 个任务管理文件）。每个文件单一职责。AuthController 不直接接收或返回 EF User 实体。迁移文件允许合法自动生成。

#### 修改现有文件（4 个）

- `src/backend/Datacenter.Api/Datacenter.Api.csproj`（添加 PackageReference）
- `src/backend/Datacenter.Api/Program.cs`（完整中间件管道配置）
- `src/backend/Datacenter.Api/appsettings.json`（连接字符串模板、日志配置）
- `tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj`（添加 Mvc.Testing）

#### .gitignore

- 实施时确认 `*.db`、`*.db-shm`、`*.db-wal`、`.data/` 已在 `.gitignore` 中排除。若 `.data/` 缺失则追加。本轮只写规格不实际修改。

#### 超过上限必须 Change Request

### 允许修改的数据模型

仅 User 实体为新建。不创建 Room、Cabinet、Server、ServerPosition、AuditRecord 实体。不修改脚手架已有数据模型。

### 允许修改的 API 契约

仅 AuthController 的 4 个端点：`GET /api/auth/csrf`、`POST /api/auth/login`、`POST /api/auth/logout`、`GET /api/auth/me`。不定义业务资源 API 契约。

### 复杂方案采用理由

N/A：本任务使用 ASP.NET Core 内置 Cookie 认证中间件 + EF Core SQLite + 共享框架内置 PasswordHasher，均属 .NET 生态标准方案。无复杂方案。

## 架构裁决引用

以下技术裁决直接引自架构基线（TASK-0005，MVP-ARCHITECTURE-BASELINE.md），本任务不重新裁决：

| 裁决事项 | 架构基线出处 |
|---|---|
| SQLite 数据库选型 | 第 9.1 节 |
| WAL 模式必须启用 | 第 9.1 节 |
| 数据库文件本地磁盘，禁止网络共享路径 | 第 9.1 节 |
| Cookie 认证（非 JWT） | 第 8.5 节 |
| PasswordHasher<TUser>（非完整 Identity） | 第 8.5 节 |
| 账号来源：受控部署初始化预置 | 第 8.5 节 |
| Cookie 安全约束（HttpOnly/SameSite/Secure/8h/无滑动） | 第 8.5 节 |
| OnValidatePrincipal 禁用账号会话失效 | 第 8.5 节 |
| Antiforgery 强制验证 | 第 8.5 节 |
| ASP.NET Core Controllers（非 Minimal API） | 第 8.1 节 |
| 错误响应 JSON 结构 | 第 8.4 节 |
| ILogger<T> 控制台日志 | 第 15 节 |
| 配置文件分层与 Git 排除 | 第 12 节 |
| 排除 ASP.NET Core Identity 完整框架 | 第 5.1 和 8.5 节 |
| Service 层直接使用 DbContext（无仓储接口） | 第 9.3 节 |
| 测试策略：xUnit + SQLite 集成测试 + Mvc.Testing | 第 14 节 |
| User 实体最小数据：标识、登录名、密码哈希、启用状态、角色 | 第 8.5 节 |
| 固定角色集合：机房管理员、运维人员、DBA/应用运维人员、只读查看人员 | 第 7.1 节 |

> 注：架构基线第 9.3 节所列 6 个实体中，Room、Cabinet、Server、ServerPosition、AuditRecord 分别留给 TASK-0009 至 TASK-0013。架构基线第 22 节也已将各业务模型文件列为对应任务的修改对象。本任务仅实现认证必需的 User 实体，符合防过度开发门禁。

## API 端点契约

### GET /api/auth/csrf

- 认证：匿名
- Antiforgery：不要求
- 请求：无请求体
- 成功响应：200 OK
  - 设置 Antiforgery Cookie
  - 响应头 `X-XSRF-TOKEN`：请求令牌值
- 错误响应：N/A（无业务失败路径；服务端异常返回 500）

### POST /api/auth/login

- 认证：匿名
- Antiforgery：必须验证（请求头 `X-XSRF-TOKEN`）
- 请求：
  ```json
  {"username": "string", "password": "string"}
  ```
- 成功响应：200 OK
  ```json
  {"userId": "string", "username": "string", "role": "string"}
  ```
  设置认证 Cookie `.AspNetCore.Cookies`
- 错误响应：
  - 400：请求格式错误（JSON 解析失败、字段缺失）
  - 401：认证失败（用户不存在、密码错误、用户禁用）。错误消息不区分具体原因

### POST /api/auth/logout

- 认证：必须
- Antiforgery：必须验证（请求头 `X-XSRF-TOKEN`）
- 请求：无请求体
- 成功响应：200 OK（幂等；已无有效会话时仍返回 200）
  - 清除认证 Cookie
- 错误响应：
  - 400：Antiforgery Token 缺失或无效
  - 401：未认证

### GET /api/auth/me

- 认证：必须
- Antiforgery：不要求（GET 请求）
- 请求：无请求体
- 成功响应：200 OK
  ```json
  {"userId": "string", "username": "string", "role": "string"}
  ```
- 错误响应：
  - 401：未认证

### 通用约束

- 所有响应 `Content-Type: application/json`（除 204 等无体响应外）
- 错误响应体为 `{"error": "人类可读消息"}` 或 ProblemDetails JSON
- 500 响应不返回异常堆栈、内部状态或敏感信息
- 密码哈希不得出现在任何 API 响应中

## 验收标准

### AC-BF-01：User 实体存在且可编译
- 命令：验证 `src/backend/Datacenter.Api/Models/User.cs` 存在且 `dotnet build` 通过
- 期望：User 实体包含唯一标识、登录名、密码哈希、启用状态、角色、创建时间字段。不存在 Room、Cabinet、Server、ServerPosition、AuditRecord 实体文件。编译 0 errors。
- 验证方式：文件存在性检查 + `dotnet build`

### AC-BF-02：AppDbContext 仅含 Users DbSet，迁移可生成
- 命令：
  ```powershell
  dotnet ef migrations add InitialCreate --project src/backend/Datacenter.Api/Datacenter.Api.csproj
  ```
- 期望：退出码 0。生成 Migrations/ 目录包含 migration.cs、Designer.cs、ModelSnapshot.cs。迁移仅创建 Users 表，不包含 Rooms、Cabinets、Servers、ServerPositions、AuditRecords 表。
- 验证方式：命令执行 + 迁移文件内容审查

### AC-BF-03：Users 表含 Username 唯一索引
- 命令：
  ```powershell
  sqlite3 .data/datacenter-dev.db ".schema Users"
  ```
- 期望：输出中包含 Users 表定义和 Username 列 UNIQUE 约束。
- 验证方式：sqlite3 schema 输出审查

### AC-BF-04：WAL 模式已启用
- 命令：应用启动后执行 `sqlite3 .data/datacenter-dev.db "PRAGMA journal_mode;"`
- 期望：输出 `wal`。
- 验证方式：sqlite3 命令 + 应用启动日志确认

### AC-BF-05：WAL 初始化失败时应用启动失败
- 命令：模拟 WAL 设置失败（如使用只读数据库文件），启动应用
- 期望：应用启动失败（进程非零退出或抛出异常），不得静默继续。
- 验证方式：集成测试中验证启动行为

### AC-BF-06：Bootstrap 管理员开发环境幂等创建
- 命令：
  1. 配置 `BootstrapAdmin:Username` 和 `BootstrapAdmin:Password`（通过用户机密或环境变量）
  2. 首次启动应用
  3. 查询 Users 表确认管理员已创建，密码已哈希
  4. 再次启动应用
  5. 确认用户数量不变（幂等，不重复创建）
- 期望：管理员仅创建一次。已有用户不被覆盖。
- 验证方式：集成测试

### AC-BF-07：未配置 Bootstrap 时不创建用户且不报错
- 命令：不配置任何 Bootstrap 设置，启动应用
- 期望：应用正常启动。Users 表为空。无错误日志或启动失败。
- 验证方式：集成测试

### AC-BF-08：密码哈希存储且可验证
- 命令：查询 Users 表 PasswordHash 列；执行单元测试使用 PasswordHasher 验证
- 期望：PasswordHash 非空，不为明文。相同密码验证返回 Success，不同密码返回 Failed。
- 验证方式：sqlite3 查询 + 单元测试

### AC-BF-09：CSRF Token 端点返回 Token 和 Cookie
- 命令：发送 `GET /api/auth/csrf`（无认证）
- 期望：200 OK。响应头 `X-XSRF-TOKEN` 非空。设置 Antiforgery Cookie。
- 验证方式：集成测试

### AC-BF-10：缺少 Antiforgery Token 的登录被拒绝
- 命令：不携带 `X-XSRF-TOKEN` 请求头，发送 `POST /api/auth/login`
- 期望：400 Bad Request。登录操作不执行，不签发认证 Cookie。
- 验证方式：集成测试

### AC-BF-11：正确凭据登录成功
- 命令：
  1. `GET /api/auth/csrf` → 获取 token 和 cookie
  2. `POST /api/auth/login`（携带 token + 正确凭据）
- 期望：200 OK。响应体含 userId、username、role，不含 passwordHash。设置认证 Cookie（`.AspNetCore.Cookies`，HttpOnly、SameSite=Lax）。
- 验证方式：集成测试

### AC-BF-12：错误密码登录失败且不区分原因
- 命令：对同一步骤分别使用错误密码和不存在用户名发送 `POST /api/auth/login`
- 期望：两次均返回 401。响应体错误消息完全相同（不泄露"用户不存在"vs"密码错误"）。
- 验证方式：集成测试

### AC-BF-13：禁用用户登录被拒绝
- 命令：创建测试用户并设为禁用（Enabled=0），尝试登录
- 期望：401 Unauthorized。错误消息与错误密码场景一致。
- 验证方式：集成测试

### AC-BF-14：未认证访问 /me 返回 401
- 命令：不携带认证 Cookie，发送 `GET /api/auth/me`
- 期望：401 Unauthorized。
- 验证方式：集成测试

### AC-BF-15：认证 Cookie 含 HttpOnly 和 SameSite=Lax
- 命令：登录成功后检查 Set-Cookie 响应头
- 期望：`.AspNetCore.Cookies` 含 `HttpOnly` 和 `SameSite=Lax` 属性。
- 验证方式：集成测试

### AC-BF-16：Cookie 固定有效期无滑动续期
- 命令：登录成功后检查 Cookie 过期时间；多次请求后再次检查
- 期望：过期时间距登录时间约 8 小时。多次请求后过期时间不变（无 SlidingExpiration）。
- 验证方式：集成测试

### AC-BF-17：禁用用户既有会话被拒绝
- 命令：
  1. 以测试用户登录，取得认证 Cookie
  2. 在测试数据库中将该用户 Enabled 设为 0
  3. 使用原 Cookie 请求 `GET /api/auth/me`
- 期望：401。认证 Cookie 被清除。用户不得获得原有角色权限。
- 验证方式：集成测试

### AC-BF-18：无效 Antiforgery Token 的状态变更被拒绝
- 命令：携带有效认证 Cookie 但错误 `X-XSRF-TOKEN` 值，发送 `POST /api/auth/logout`
- 期望：400 Bad Request。登出操作不执行。数据库状态不变。
- 验证方式：集成测试

### AC-BF-19：单元测试覆盖密码哈希行为
- 命令：`dotnet test --filter "FullyQualifiedName~UnitTests"`
- 期望：测试覆盖以下行为：
  - 相同密码哈希后验证返回 Success
  - 不同密码验证返回 Failed
  - 相同密码两次哈希产生不同哈希值（随机盐）
- 验证方式：dotnet test

### AC-BF-20：完整 Antiforgery 闭环
- 命令：
  1. `GET /api/auth/csrf` → 获取 token + Antiforgery cookie
  2. `POST /api/auth/login`（携带 token）→ 登录成功获取认证 cookie
  3. 从 csrf 响应获取新 token（或复用登录前的 token 对）
  4. `POST /api/auth/logout`（携带 token + 认证 cookie）→ 200
  5. 使用原认证 cookie 请求 `GET /api/auth/me` → 401
- 期望：全流程按上述状态码通过。
- 验证方式：集成测试

### AC-BF-21：角色授权策略注册且可独立评估
- 命令：通过 `IServiceProvider` 获取 `IAuthorizationService`，分别以 `机房管理员`、`运维人员`、`DBA/应用运维人员`、`只读查看人员` 和匿名主体评估 `CanModify` 和 `ReadOnly` 策略
- 期望：
  - `机房管理员` 和 `运维人员`：`CanModify` 成功、`ReadOnly` 失败
  - `DBA/应用运维人员` 和 `只读查看人员`：`CanModify` 失败、`ReadOnly` 成功
  - 匿名主体：两个策略均失败
- 验证方式：单元测试（不创建测试专用生产 Controller 或端点）

### AC-BF-22：当前认证端点错误响应格式一致
- 命令：触发 400（无效 JSON）、401（未认证）、401（错误密码）并检查响应
- 期望：所有错误响应为 JSON 格式。400 返回错误消息。401 消息不泄露内部信息。500 不返回堆栈。
- 验证方式：集成测试

### AC-BF-23：认证事件写入日志且不泄露敏感信息
- 命令：执行登录成功和失败操作，检查日志输出
- 期望：登录成功含用户标识（Information）。登录失败含登录名（Warning），不含密码。日志中无 Cookie、密码哈希、Token 或敏感配置。
- 验证方式：集成测试中捕获日志

### AC-BF-24：appsettings.Development.example.json 存在且不含真实值
- 命令：
  ```powershell
  test -f src/backend/Datacenter.Api/appsettings.Development.example.json
  git ls-files --error-unmatch src/backend/Datacenter.Api/appsettings.Development.example.json
  ```
- 期望：退出码 0。文件内容含连接字符串占位符，不含真实路径或凭据。文件被 Git 跟踪。
- 验证方式：文件存在 + 内容审查 + git ls-files

### AC-BF-25：集成测试使用独立临时 SQLite 文件
- 命令：审查测试夹具代码
- 期望：AuthTestFixture 为每个测试类或方法创建独立临时 SQLite 文件（如 `Path.GetTempFileName()` 或 GUID 文件名）。通过 WebApplicationFactory 覆盖连接字符串。不使用开发数据库 `.data/datacenter-dev.db`。不使用 EF InMemory。不使用 SQLite `:memory:` 模式验证 WAL。测试结束后清理 db/wal/shm 文件。
- 验证方式：代码审查

### AC-BF-26：集成测试覆盖全部认证行为
- 命令：审查集成测试列表
- 期望：测试覆盖 CSRF Token 获取、缺少/错误 Token 拒绝、正确登录、错误密码/不存在用户统一响应、禁用用户拒绝、Cookie 属性、/me 认证要求、登出后拒绝、禁用会话拒绝、Bootstrap 幂等、WAL 启用验证、测试数据库隔离。
- 验证方式：代码审查

### AC-BF-27：集成测试不依赖外部服务或真实数据库
- 命令：无网络环境下运行 `dotnet test`
- 期望：全部集成测试通过。不连接外部数据库、LDAP、AD。测试数据库为临时文件。
- 验证方式：断网环境测试

### AC-BF-28：集成测试和单元测试全部通过
- 命令：`dotnet test tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj --no-build`
- 期望：退出码 0。所有测试通过（具体测试数量由覆盖行为自然决定，不预设数字下限）。
- 验证方式：dotnet test 输出

### AC-BF-29：dotnet build 0 errors 0 warnings
- 命令：`dotnet build Datacenter.sln --no-restore`
- 期望：退出码 0，无 error、无 warning。禁止 `<NoWarn>`、`#pragma warning disable` 抑制警告。
- 验证方式：构建输出审查

### AC-BF-30：工作流校验 20/20 PASS，git diff --check PASS
- 命令：`pwsh -NoLogo -NoProfile -File ./scripts/validate-agent-workflow.ps1`
- 期望：退出码 0，输出 `PASS=20 FAIL=0 TOTAL=20`。
- 命令：`git diff --check`
- 期望：退出码 0。

### AC-BF-31：依赖白名单检查
- 命令：审查所有 .csproj 和配置文件
- 期望：
  - Web API csproj 运行时 PackageReference：仅 `Microsoft.EntityFrameworkCore.Sqlite`
  - Web API csproj 设计时 PackageReference：仅 `Microsoft.EntityFrameworkCore.Design`（`PrivateAssets=all`）
  - 无 `Microsoft.Extensions.Identity.Core` PackageReference（共享框架已提供 PasswordHasher）
  - 测试 csproj 新增 PackageReference：仅 `Microsoft.AspNetCore.Mvc.Testing`（TASK-0006 既有 xUnit 三件套不变）
  - 所有 csproj 中不存在 AutoMapper、MediatR、FluentValidation、Serilog、Swashbuckle、coverlet.collector、FluentAssertions、Moq、NSubstitute、Identity 完整包、JWT 包
- 验证方式：csproj 文件审查

### AC-BF-32：提交后工作区干净，本地远端哈希一致，数据库和敏感配置未被跟踪
- 命令：`git status --porcelain`
- 期望：无输出（工作区干净）。
- 命令：`test "$(git rev-parse HEAD)" = "$(git rev-parse origin/feature/task-0007-backend-foundation)"`
- 期望：退出码 0（本地与远端哈希一致）。
- 命令：`git ls-files .data/ src/backend/Datacenter.Api/appsettings.Development.json`
- 期望：无输出（数据库目录和开发配置文件未被 Git 跟踪）。

## 构建命令

```powershell
# 后端构建
cd <repo-root>
dotnet restore Datacenter.sln
dotnet build Datacenter.sln --no-restore

# 生成初始迁移（仅 Users 表）
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
| 2026-07-18 | Claude + DeepSeek Product Manager | IDLE | DRAFT | — | TASK-0006 已合并 main；创建 TASK-0007 规格初稿 |
| 2026-07-18 | Claude + DeepSeek Product Manager | DRAFT | DRAFT（待审核） | Codex Reviewer | 规格初稿提交审核（提交 d0dbdc6）；三项规格锁 CLAIMED |
| 2026-07-18 | Codex Reviewer | DRAFT（待审核） | DRAFT（NEEDS_CHANGES） | Claude + DeepSeek Product Manager | 规格审核 NEEDS_CHANGES（提交 cc44f8b；报告 reviews/tasks/TASK-0007-BACKEND-FOUNDATION-SPEC-REVIEW.md）；BLOCKER 0 / MAJOR 7 / MINOR 2 / NOTE 0；三项锁保持 CLAIMED |
| 2026-07-18 | Claude + DeepSeek Product Manager | DRAFT（NEEDS_CHANGES） | DRAFT（待复审） | Codex Reviewer | 本轮修正全部 9 项 finding；范围收缩为仅认证必需；Antiforgery 闭环完整；Bootstrap 替代硬编码种子用户；依赖/文件/测试预算重算；待 Reviewer 复审 |

## 审核结论

- Reviewer：Codex Reviewer
- 结论：NEEDS_CHANGES（规格审核报告：reviews/tasks/TASK-0007-BACKEND-FOUNDATION-SPEC-REVIEW.md，提交 cc44f8b）
- Findings：BLOCKER 0 / MAJOR 7 / MINOR 2 / NOTE 0
- 审核命令和证据：工作流 20/20 PASS；git diff --check PASS；diff 确认仅三个任务文件变化

## 缺陷清单

| 缺陷 ID | 等级 | 证据/复现 | 修复要求 | 状态 |
|---|---|---|---|---|
| BF-SR-001 | MAJOR | 规格要求 Room 等 5 个业务实体 + 完整 Schema | 移除非认证实体，仅保留 User；业务实体留给 TASK-0009+ | CLOSED（本轮修正） |
| BF-SR-002 | MAJOR | Antiforgery 无 Token 获取端点 | 新增 GET /api/auth/csrf；明确 X-XSRF-TOKEN 请求头 | CLOSED（本轮修正） |
| BF-SR-003 | MAJOR | 4 个预置账号凭据来源和生产安全未定义 | Bootstrap 管理员替代硬编码种子用户；测试用户由夹具创建 | CLOSED（本轮修正） |
| BF-SR-004 | MAJOR | 授权验收无当前端点可作用 | 改为 IAuthorizationService 策略评估测试；移除无法触发的 403/404 AC | CLOSED（本轮修正） |
| BF-SR-005 | MAJOR | 依赖分类和数量自相矛盾 | 按运行时/设计时/测试/工具分类；PasswordHasher 确认共享框架提供 | CLOSED（本轮修正） |
| BF-SR-006 | MAJOR | 文件预算遗漏迁移文件、DTO、夹具 | 重算为 ≤15 个新增实施文件 + 迁移自动生成 3 文件 | CLOSED（本轮修正） |
| BF-SR-007 | MAJOR | API 契约和错误验收不完整 | 定义 4 端点完整 DTO 与状态码；仅验收当前可触发的错误 | CLOSED（本轮修正） |
| BF-SR-008 | MINOR | WAL/测试数据库生命周期歧义 | WAL 非 wal 即启动失败；测试用临时文件 SQLite；禁止 :memory: | CLOSED（本轮修正） |
| BF-SR-009 | MINOR | 预勾选审核通过 + 工作流输出字符串 + CR 文件名 | 取消预勾选；AC 输出格式修正为 "PASS=20 FAIL=0 TOTAL=20"；CR 文件名已修正为实际文件名 | CLOSED（本轮修正） |

## 缺陷修复记录

| 缺陷 ID | 修复者 | 修改说明 | 回归证据 | 提交 |
|---|---|---|---|---|
| BF-SR-001 | Claude + DeepSeek Product Manager | 移除 Room/Cabinet/Server/ServerPosition/AuditRecord 及关联 AC/功能要求/迁移/追踪矩阵；仅保留 User | 见本轮提交 | 待提交 |
| BF-SR-002 | Claude + DeepSeek Product Manager | 新增 GET /api/auth/csrf；明确 X-XSRF-TOKEN 请求头名称；定义完整 Antiforgery 闭环测试序列 | 见本轮提交 | 待提交 |
| BF-SR-003 | Claude + DeepSeek Product Manager | 替换 4 硬编码种子用户为可选幂等 Bootstrap；测试用户由 AuthTestFixture 创建；生产不自动创建已知账户 | 见本轮提交 | 待提交 |
| BF-SR-004 | Claude + DeepSeek Product Manager | 角色授权改为 IAuthorizationService 策略评估单元测试；移除 AC-BF-17/AC-BF-22 的 403/404 触发要求 | 见本轮提交 | 待提交 |
| BF-SR-005 | Claude + DeepSeek Product Manager | 运行时仅 Sqlite；设计时 Design(PrivateAssets)；测试新增 Mvc.Testing；开发工具 dotnet-ef；确认 PasswordHasher 共享框架提供 | 见本轮提交 | 待提交 |
| BF-SR-006 | Claude + DeepSeek Product Manager | 文件预算重算：≤15 个实施文件 + 3 个迁移文件 + 3 个任务文件；含 DTO/Auth/Bootstrap/测试夹具 | 见本轮提交 | 待提交 |
| BF-SR-007 | Claude + DeepSeek Product Manager | 定义 4 端点完整请求/响应 DTO 与状态码；仅定义当前可触发错误；500 不泄露堆栈 | 见本轮提交 | 待提交 |
| BF-SR-008 | Claude + DeepSeek Product Manager | WAL 非 wal 启动失败；测试固定使用临时文件 SQLite；禁止 :memory:；AuthTestFixture 覆盖连接字符串并清理 | 见本轮提交 | 待提交 |
| BF-SR-009 | Claude + DeepSeek Product Manager | 取消"规格已通过"预勾选；AC-BF-30 输出格式修正；CR-0003/CR-0004 文件名修正 | 见本轮提交 | 待提交 |

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

- Change Request ID：N/A：本轮为 DRAFT 规格修正，在现有批准流程内修复审核发现的问题
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

- TASK-0007 不包含任何业务实体（Room、Cabinet、Server、ServerPosition、AuditRecord）。这些实体及其迁移分别留给 TASK-0009 至 TASK-0013。
- 不包含业务 Service 或 Controller。
- 本任务不创建 AuditRecord 表。操作审计在位置操作任务（TASK-0013）中实现。
- 用户管理（CRUD、角色变更、密码重置）不在 MVP 范围。开发环境通过可选 Bootstrap 机制创建管理员；生产初始化留给部署任务。
- 前端登录页面由 TASK-0008 实现。CSRF Token 获取和 Antiforgery 流程由前端 TASK-0008 集成。
- 认证 Cookie 固定 8 小时过期，不提供"记住我"或"滑动续期"（架构基线第 8.5 节已批准）。
- 当前端点不产生业务 403/404。真实业务端点的角色授权验证留给对应业务任务。
- 不实现 OpenAPI/Swagger 文档。
- MVP 数据规模下单实例 SQLite 满足需求；不实现多实例。
- 架构基线中审计事件通过 AuditRecord 表写入的规定（第 15.3 节）留给位置操作任务。本任务仅记录认证事件日志到控制台。
- `PasswordHasher<TUser>` 由 ASP.NET Core 共享框架提供，架构基线第 18.3 节原列 `Microsoft.Extensions.Identity.Core` 为依赖；经实施前验证确认共享框架已包含，本任务不添加冗余 PackageReference。

## 最终完成条件

- [ ] 独立 Reviewer 验收或复审通过
- [ ] 验收标准全部通过（AC-BF-01 至 AC-BF-32）
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
> 规格已按 Codex Reviewer 审核报告（cc44f8b）全面修正（BF-SR-001 至 BF-SR-009 全部 CLOSED）。
> 下一步：交由 Codex Reviewer 做规格复审。
