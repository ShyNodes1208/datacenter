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
- src/backend/Datacenter.Api/Models/（新建目录：User 实体、固定角色常量）
- src/backend/Datacenter.Api/Data/（新建目录：AppDbContext）
- src/backend/Datacenter.Api/Services/（新建目录：AuthService）
- src/backend/Datacenter.Api/Controllers/（新建目录：AuthController）
- src/backend/Datacenter.Api/Migrations/（EF Core 自动生成：初始迁移及关联文件）
- src/backend/Datacenter.Api/Auth/（新建目录：登录/用户信息 DTO、Bootstrap 初始化逻辑）
- .config/dotnet-tools.json（新建：仓库本地 .NET Tool Manifest，含 dotnet-ef 精确版本）
- tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj（添加测试包引用）
- tests/backend/Datacenter.Api.Tests/UnitTests/（新建目录：密码哈希和授权策略单元测试）
- tests/backend/Datacenter.Api.Tests/IntegrationTests/（新建目录：认证集成测试及测试夹具）
- 根目录 .gitignore（追加 `.data/` 目录排除规则）
- tasks/TASK-0007-BACKEND-FOUNDATION.md（本文件，实施时更新状态和证据）
- tasks/current-task.md（状态同步）
- tasks/MODULE-LOCKS.md（锁同步）

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
- tasks/CR-0003-TASK-0006-DEPENDENCY-VALIDATION-CORRECTION.md
- tasks/CR-0004-TASK-0006-COVERLET-VALIDATION-CORRECTION.md
- 任何业务实体（Room、Cabinet、Server、ServerPosition、AuditRecord）
- 任何业务 Service（RoomService、CabinetService、ServerService、PlacementService、AuditService）
- 任何业务 Controller（RoomsController、CabinetsController、ServersController、PlacementsController、AuditController、ServerStatusController）
- 任何业务页面或前端组件
- 任何 .db、.db-shm、.db-wal 数据库文件（仅创建于本地 `.data/` 目录，不得提交 Git）
- `src/backend/Datacenter.Api/appsettings.Development.json`（本地开发配置，已被 .gitignore 排除，不提交 Git）
- User CRUD API、角色管理 API、密码重置、自注册、用户导入

> 注：`appsettings.Development.json` 在本地文件系统已存在且已被 .gitignore 排除（`git ls-files` 返回退出码 1）。本任务不修改、不跟踪、不删除该文件。实施时通过 `appsettings.Development.example.json`（新建、跟踪）提供开发配置模板。

## 固定角色集合

本任务定义以下唯一固定角色集合（产品基线第 7.1 节）：

| 角色值 | 含义 |
|---|---|
| `机房管理员` | 所有操作权限 |
| `运维人员` | 所有操作权限（与管理员相同） |
| `DBA` | 只读查询 |
| `应用运维人员` | 只读查询 |
| `只读查看人员` | 只读查看 |

角色约束：
1. 上述 5 个值为唯一合法角色。不得使用其他角色字符串。
2. 不创建 Role 表、权限表或用户角色关联表。
3. 授权策略、Bootstrap 配置和 User.Role 都复用同一组角色常量（定义在 Models/Roles.cs 静态类中）。
4. EF Core 模型配置为 User.Role 添加 SQLite CHECK 约束，只允许上述 5 个值。
5. User.Role 不允许 NULL。
6. Bootstrap 配置发现未知角色时拒绝初始化，不得静默保存。
7. 未知角色应通过服务端校验和数据库约束被拒绝。
8. 不动态加载角色、不创建角色管理 API。

## 功能要求

### FR-BF-01：最小 User 实体
定义 EF Core User 实体，包含：唯一标识、登录名（唯一）、密码哈希、启用状态、角色（字符串，必须为固定角色集合中的值）、创建时间。配置 SQLite CHECK 约束限制 Role 为 5 个固定值，Role 不允许 NULL。不创建 Role 表、权限表、用户角色关联表或 RBAC Schema。

### FR-BF-02：固定角色常量定义
在 `Models/Roles.cs` 中定义静态类，包含 5 个角色常量字符串。授权策略、Bootstrap 配置、User.Role 校验和数据库 CHECK 约束全部引用该常量集合。禁止在代码中硬编码角色字符串。

### FR-BF-03：AppDbContext 与初始迁移
创建 AppDbContext，包含 Users DbSet。配置 User 实体约束：Username 唯一索引、Role 非空 CHECK 约束（仅允许 5 个固定值）。生成初始 EF Core 迁移，仅创建 Users 表结构。不包含 Room、Cabinet、Server、ServerPosition、AuditRecord 或其 DbSet、关系、索引或约束。

### FR-BF-04：SQLite 配置与 WAL 模式
配置 SQLite 数据库连接。数据库文件默认路径为项目工作目录下的 `.data/datacenter-dev.db`（不位于受 Git 管理的源码目录）。连接字符串在 `appsettings.json` 中提供模板，在 `appsettings.Development.json`（不入 Git）中配置实际路径。禁止 SMB、NFS、NAS 和任何网络共享路径。

### FR-BF-05：WAL 模式初始化与验证
应用启动时在 DbContext 初始化后执行 `PRAGMA journal_mode=WAL;`。查询返回值；若返回不是 `wal`，应用启动失败（抛出异常或非零退出）。不得静默继续。

### FR-BF-06：开发环境 Bootstrap 管理员（仅 Development）
提供仅在 `IHostEnvironment.IsDevelopment()` 为 true 时执行的最小 Bootstrap 机制：
1. 非 Development 环境（Production、Staging 等）完全跳过 Bootstrap 初始化。
2. Development 环境下，仅当通过用户机密或环境变量明确配置了 `BootstrapAdmin:Username` 和 `BootstrapAdmin:Password` 时才尝试创建管理员用户。
3. 用户名或密码任一缺失时：不创建用户，不失败启动，记录 Information 级别提示（不含密码）。
4. 配置的 Role 必须属于固定角色集合；未知角色拒绝初始化并记录错误。
5. 仅当目标用户不存在时创建（幂等，不覆盖已有用户的密码、角色或启用状态）。
6. 不每次启动重复创建。
7. 不将明文密码、哈希或真实凭据写入 Git、日志或迁移。
8. 不在日志中输出密码、密码哈希、Cookie 或 Token。
9. Testing 环境（`IWebHostEnvironment`）的用户由测试 Fixture 单独创建，不使用 Development Bootstrap。
10. 生产首次管理员创建责任明确留给部署任务。

### FR-BF-07：集成测试用户由测试夹具创建
集成测试所需用户由测试夹具在临时测试数据库中创建。测试凭据不入 Git（使用测试代码中的非敏感测试值）。测试数据库与开发数据库隔离。测试夹具不依赖 Bootstrap 配置或环境变量。

### FR-BF-08：密码哈希
使用 `Microsoft.AspNetCore.Identity.PasswordHasher<TUser>` 对用户密码进行哈希存储和验证。`PasswordHasher<TUser>` 由 ASP.NET Core 8 共享框架（`Microsoft.AspNetCore.App`）提供，不添加独立 `Microsoft.Extensions.Identity.Core` PackageReference。禁止明文存储密码。禁止自行实现密码哈希算法。

### FR-BF-09：CSRF Token 端点
实现 `GET /api/auth/csrf`。匿名和已认证用户均可调用。不要求 Antiforgery。生成 Antiforgery Cookie 和请求令牌。响应通过自定义 Header `X-XSRF-TOKEN` 返回请求令牌值。不返回敏感信息。

### FR-BF-10：登录端点
实现 `POST /api/auth/login`。必须携带有效 Antiforgery Token（通过 `X-XSRF-TOKEN` 请求头提交；先调用 `GET /api/auth/csrf` 获取 token/cookie 对）。接收 JSON `{"username": "...", "password": "..."}`。验证用户存在且启用 → 验证密码哈希 → 创建 ClaimsPrincipal（含用户唯一标识、登录名、角色声明）→ 建立认证 Cookie 会话。成功返回 200 及最小用户信息（用户标识、登录名、角色，不含密码哈希）。登录失败返回 401，错误消息不区分"用户不存在"和"密码错误"（统一 ProblemDetails type/title/detail）。

**重要：** 登录成功后身份从匿名变为已认证，客户端必须再次调用 `GET /api/auth/csrf` 获取与新身份关联的 Antiforgery 令牌对；登录前的旧匿名 Token 不得用于后续已认证状态变更请求。

### FR-BF-11：登出端点
实现 `POST /api/auth/logout`。
1. 必须已认证。
2. 必须携带有效 Antiforgery Token（通过 `X-XSRF-TOKEN` 请求头提交；必须使用登录后重新获取的 Token）。
3. 成功时清除认证 Cookie（`HttpContext.SignOutAsync`），返回 204 No Content。
4. 注销成功后再调用：因认证 Cookie 已失效，返回 401。
5. 缺失或错误 Antiforgery Token：返回 Antiforgery 验证失败错误。
6. 无效或过期认证 Cookie：返回 401。
7. 不承诺匿名幂等成功。不返回 User 实体或敏感信息。

### FR-BF-12：当前用户信息端点
实现 `GET /api/auth/me`。必须认证。返回已认证用户的最小身份信息：用户标识、登录名、角色。不返回密码哈希、内部配置或任何敏感字段。未认证返回 401。

### FR-BF-13：Cookie 认证中间件配置
配置 Cookie 认证：
- Cookie 名称：`Datacenter.Auth`
- `HttpOnly = true`
- `SameSite = Lax`
- `SecurePolicy`：Production/Staging 环境 `Always`；Development 环境 `SameAsRequest`
- `SlidingExpiration = false`
- `IsPersistent = false`（非持久 Cookie，浏览器会话结束后消失）
- 服务端认证 Ticket 最大有效期：`ExpireTimeSpan = 8 hours`
- 8 小时理由：内部管理系统；覆盖单个标准工作日；不允许无限会话；不启用滑动续期（架构基线第 8.5 节已批准固定 8 小时）
- Claims 只包含：用户唯一标识、登录名、角色
- 禁止在 Cookie/Claims 中保存：密码哈希、启用状态快照、配置、Token、数据库连接信息或其他敏感秘密

### FR-BF-14：OnValidatePrincipal 禁用账号会话失效
实现 `CookieAuthenticationEvents.OnValidatePrincipal`：
1. 每个携带认证 Cookie 的请求到达时，根据 Cookie 中用户唯一标识查询数据库验证用户仍存在且启用。
2. 若用户不存在或已禁用：调用 `RejectPrincipal()` 并 `SignOutAsync()`，拒绝当前请求。
3. 若数据库查询失败（异常、超时、不可用）：fail closed — 拒绝当前请求，不继续授权，不依赖旧 Cookie Claims 放行。
4. 后端数据库中的 User 状态和角色为最终依据。角色 Claim 不能绕过当前数据库状态检查。
5. MVP 低流量内部系统接受每请求查询成本。

### FR-BF-15：Antiforgery 中间件配置与生命周期
配置 ASP.NET Core 内置 Antiforgery 中间件。Antiforgery Token 通过自定义请求头 `X-XSRF-TOKEN` 提交。

**Antiforgery 生命周期（唯一裁决）：**
1. 匿名用户调用 `GET /api/auth/csrf` → 获取 Antiforgery Cookie + `X-XSRF-TOKEN` 请求令牌。
2. 客户端使用该匿名 Token 调用 `POST /api/auth/login`。
3. 登录成功、身份从匿名变为已认证后：客户端必须再次调用 `GET /api/auth/csrf`，获取与新身份关联的新 Antiforgery Cookie + 新 `X-XSRF-TOKEN` 请求令牌。
4. 后续 `POST /api/auth/logout` 和所有未来状态变更请求必须使用登录后重新获取的新 Token。
5. 登录前的旧匿名 Token 不得用于已认证状态变更请求，必须被拒绝。
6. 只读请求（GET/HEAD）不要求 Token。
7. `SameSite=Lax` 作为纵深防御补充，不替代服务端防伪验证。

### FR-BF-16：角色授权策略
定义授权策略：`CanModify` 策略要求 `机房管理员` 或 `运维人员` 角色；`ReadOnly` 策略要求 `DBA` 或 `应用运维人员` 或 `只读查看人员` 角色。在 Program.cs 中注册策略并引用 `Roles` 常量类。

### FR-BF-17：全局授权过滤器
配置全局 `AuthorizeFilter` 或等效机制：除 `GET /api/auth/csrf` 和 `POST /api/auth/login` 外，所有端点要求已认证用户。匿名访问受保护端点返回 401。

### FR-BF-18：统一错误响应（ProblemDetails）
使用 ASP.NET Core 内置 `ProblemDetails` 作为唯一错误响应模型。所有错误响应的 `Content-Type` 为 `application/problem+json`。

当前认证端点错误契约：
- **400 Bad Request**：请求格式错误（JSON 解析失败、字段缺失、Antiforgery Token 缺失或无效）→ `ValidationProblemDetails` 或等效内置结构
- **401 Unauthorized**：未认证、登录认证失败（用户不存在、密码错误、用户禁用，统一 type/title/detail，不泄露具体原因）→ `ProblemDetails`
- **500 Internal Server Error**：未处理异常 → `ProblemDetails`，不含堆栈、内部异常消息或敏感信息

不提前承诺业务 403/404（当前端点无自然触发场景）。不创建自定义 `ErrorResponse` DTO 或业务错误码注册中心。

### FR-BF-19：认证事件日志
使用 ASP.NET Core 内置 `ILogger<T>` 记录认证事件到控制台。登录成功记录 Information 级别（含用户标识）。登录失败记录 Warning 级别（含登录名，不含密码）。不记录 Cookie、密码哈希、Antiforgery Token 或敏感配置。不通过不同日志等级或客户端响应泄露账号是否存在。

## 非功能要求

1. 所有密码使用 `PasswordHasher<TUser>` 哈希存储，禁止明文或自定义哈希算法。
2. Cookie Claims 中只包含用户唯一标识、登录名和角色。禁止在 Cookie 中保存密码、密码哈希、初始化凭据、数据库连接信息或其他敏感秘密。
3. 登录失败响应不得区分"用户不存在"和"密码错误"（统一 401 ProblemDetails type/title/detail）。
4. `dotnet build` 必须 0 errors、0 warnings；不得通过 NoWarn 或关闭警告隐藏问题。
5. 数据库文件及 WAL/SHM 文件由 `.gitignore` 排除（`*.db`、`*.db-shm`、`*.db-wal`、`.data/` 目录）。
6. `appsettings.Development.json` 不得提交 Git（`.gitignore` 已有规则；本任务通过新建 tracked `appsettings.Development.example.json` 提供模板）。
7. 不引入 ASP.NET Core Identity 完整框架（UserManager、RoleManager、SignInManager 等）。
8. 不引入 JWT、OAuth 2.0、OpenID Connect、LDAP、AD、SSO 或任何外部认证协议。
9. 不引入未在复杂度预算中列出的 NuGet 包。
10. 不创建 User CRUD API、角色管理 API、密码重置、自注册或用户导入功能。
11. `PasswordHasher<TUser>` 使用 ASP.NET Core 共享框架内置实现，不添加独立 PackageReference。
12. 不创建本任务不需要的 AuditRecord 表或任何持久化审计表。业务操作审计留给上架/移动/下架任务。
13. 不创建 Role 表、权限表或用户角色关联表。
14. 集成测试数据库与开发数据库完全隔离，使用独立临时文件。
15. `OnValidatePrincipal` 数据库查询失败时必须 fail closed（拒绝请求，不降级授权）。

## 范围与非目标

- 最小实现范围：
  - 1 个 User 实体（Models/User.cs）+ 1 个固定角色常量（Models/Roles.cs）
  - 1 个 AppDbContext（Data/AppDbContext.cs），仅含 Users DbSet，含 Role CHECK 约束
  - 1 个初始 EF Core 迁移（Migrations/，含 migration.cs、Designer.cs、ModelSnapshot.cs 共 3 个自动生成文件）
  - 1 个 AuthService（Services/AuthService.cs）
  - 1 个 AuthController（Controllers/AuthController.cs），4 个端点
  - 最小请求/响应 DTO（Auth/LoginRequest.cs、Auth/UserInfoResponse.cs）
  - 开发 Bootstrap 初始化逻辑（Auth/BootstrapExtensions.cs，仅 Development 环境执行）
  - 1 个本地 Tool Manifest（.config/dotnet-tools.json，含 dotnet-ef 8.0.x）
  - Program.cs 完整中间件配置
  - 1 个配置文件更新（appsettings.json）+ 1 个 example 模板新建（appsettings.Development.example.json）
  - 1 次 .gitignore 修改（追加 `.data/` 目录排除）
  - 1 个测试夹具（IntegrationTests/AuthTestFixture.cs）
  - 1 个集成测试文件（IntegrationTests/AuthIntegrationTests.cs）
  - 1 个单元测试文件（UnitTests/AuthUnitTests.cs）
  - 后端运行时 NuGet 包：恰好 1 个新增
  - 后端设计时 NuGet 包：恰好 1 个
  - 后端测试新增 NuGet 包：恰好 1 个

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
  - 生产初始化 CLI 或用户管理页面
  - dotnet-ef 全局工具安装

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
| User 实体 + 固定角色常量 + AppDbContext + 初始迁移 | hangyu 机房落位可视化需求 | NFR-007（认证数据基础） | AC-BF-01, AC-BF-02, AC-BF-03, AC-BF-04 |
| SQLite 连接 + WAL 模式初始化与验证 | hangyu 机房落位可视化需求 | NFR-001（数据一致性）, NFR-002（响应时间） | AC-BF-05, AC-BF-06 |
| Bootstrap 管理员（仅 Development、可选、幂等、不入 Git） | hangyu 机房落位可视化需求 | NFR-007（基本操作安全） | AC-BF-07, AC-BF-08, AC-BF-09 |
| PasswordHasher<TUser> 密码哈希 | hangyu 机房落位可视化需求 | NFR-007（基本操作安全） | AC-BF-10, AC-BF-20 |
| CSRF Token 端点 + Antiforgery 完整生命周期 | hangyu 机房落位可视化需求 | NFR-007（基本操作安全） | AC-BF-11, AC-BF-12, AC-BF-21 |
| Cookie 认证登录/登出/me | hangyu 机房落位可视化需求 | NFR-007（基本操作安全） | AC-BF-13 至 AC-BF-16 |
| Cookie 安全属性（HttpOnly/SameSite/SecurePolicy/非持久/8h） | hangyu 机房落位可视化需求 | NFR-007（基本操作安全） | AC-BF-17, AC-BF-18 |
| OnValidatePrincipal 禁用账号会话失效 + DB 失败 fail closed | hangyu 机房落位可视化需求 | NFR-007（基本操作安全） | AC-BF-19 |
| 角色授权策略注册与独立评估 + 未知角色拒绝 | hangyu 机房落位可视化需求 | NFR-007（基本操作安全） | AC-BF-22, AC-BF-23 |
| 统一 ProblemDetails 错误响应 | hangyu 机房落位可视化需求 | NFR-004（校验反馈） | AC-BF-24 |
| ILogger<T> 认证事件日志 | hangyu 机房落位可视化需求 | 架构基线第 15 节（日志） | AC-BF-25 |
| 配置文件分层 + example 模板 | hangyu 机房落位可视化需求 | 架构基线第 12 节（配置规则） | AC-BF-26 |
| 集成测试（WebApplicationFactory + SQLite 临时文件） | hangyu 机房落位可视化需求 | NFR-001, NFR-005（测试基础） | AC-BF-27 至 AC-BF-30 |
| 单元测试（密码哈希 + 授权策略 + 角色约束） | hangyu 机房落位可视化需求 | 架构基线第 14.2 节 | AC-BF-20, AC-BF-22, AC-BF-23 |
| 构建 0 errors 0 warnings | hangyu 机房落位可视化需求 | 架构基线第 14 节 | AC-BF-31 |

## 复杂度预算

### 依赖预算

#### 后端运行时直接依赖（新增 1 个）

| 包 | 版本 | 类别 | 用途 | 删除成本 |
|---|---|---|---|---|
| `Microsoft.EntityFrameworkCore.Sqlite` | 8.0.x | 运行时 | SQLite EF Core 提供程序 | 更换数据库（中） |

`PasswordHasher<TUser>` 已由 ASP.NET Core 8 共享框架（`Microsoft.AspNetCore.App`）提供，不添加独立 PackageReference。

#### 后端设计时依赖（新增 1 个）

| 包 | 版本 | 类别 | 用途 | 删除成本 |
|---|---|---|---|---|
| `Microsoft.EntityFrameworkCore.Design` | 8.0.x | 设计时 | EF Core 迁移工具，`PrivateAssets=all`，不发布为运行时资产 | 改用 dotnet ef 全局工具（低） |

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

| 工具 | 版本 | 清单路径 | 用途 |
|---|---|---|---|
| `dotnet-ef` | 8.0.x | `.config/dotnet-tools.json` | 生成迁移。通过仓库本地 Tool Manifest 管理。`dotnet tool restore` 恢复；`dotnet tool run dotnet-ef` 执行 |

- `Microsoft.EntityFrameworkCore.Sqlite`、`Microsoft.EntityFrameworkCore.Design` 和 `dotnet-ef` 必须使用同一 EF Core 8 补丁版本（如 8.0.14），除非有明确兼容性理由。
- 本地 Tool Manifest 必须提交 Git。实施前由 Owner 根据当前 NuGet 源的最新 EF Core 8 补丁版本确定精确版本号。
- 不要求用户全局安装 dotnet-ef。
- 迁移命令示例：`dotnet tool run dotnet-ef migrations add InitialCreate --project src/backend/Datacenter.Api/Datacenter.Api.csproj`

#### 明确禁止的依赖

所有 csproj 中不得出现：AutoMapper、MediatR、FluentValidation、Serilog、Swashbuckle、coverlet.collector、FluentAssertions、Moq、NSubstitute、`Microsoft.AspNetCore.Identity` 完整包、`Microsoft.AspNetCore.Identity.EntityFrameworkCore`、`Microsoft.Extensions.Identity.Core`、JWT 相关包、SQLite 以外数据库 Provider。

### 允许新增抽象

0。Service 层直接使用 DbContext。不新增接口、基类、工厂、仓储模式或插件机制。

### 文件预算

#### 新增文件（共 18 个，含迁移自动生成和 Tool Manifest）

编号 | 文件 | 类别
---|---|---
1 | `src/backend/Datacenter.Api/Models/User.cs` | 实体
2 | `src/backend/Datacenter.Api/Models/Roles.cs` | 固定角色常量
3 | `src/backend/Datacenter.Api/Data/AppDbContext.cs` | DbContext
4 | `src/backend/Datacenter.Api/Migrations/<timestamp>_InitialCreate.cs` | 迁移（自动生成）
5 | `src/backend/Datacenter.Api/Migrations/<timestamp>_InitialCreate.Designer.cs` | 迁移（自动生成）
6 | `src/backend/Datacenter.Api/Migrations/AppDbContextModelSnapshot.cs` | 迁移（自动生成）
7 | `src/backend/Datacenter.Api/Services/AuthService.cs` | 认证逻辑
8 | `src/backend/Datacenter.Api/Controllers/AuthController.cs` | 认证端点
9 | `src/backend/Datacenter.Api/Auth/LoginRequest.cs` | 登录请求 DTO
10 | `src/backend/Datacenter.Api/Auth/UserInfoResponse.cs` | 用户信息响应 DTO
11 | `src/backend/Datacenter.Api/Auth/BootstrapExtensions.cs` | Bootstrap 初始化
12 | `src/backend/Datacenter.Api/appsettings.Development.example.json` | 开发配置模板
13 | `.config/dotnet-tools.json` | 本地 Tool Manifest
14 | `tests/backend/Datacenter.Api.Tests/IntegrationTests/AuthTestFixture.cs` | 测试夹具
15 | `tests/backend/Datacenter.Api.Tests/IntegrationTests/AuthIntegrationTests.cs` | 集成测试
16 | `tests/backend/Datacenter.Api.Tests/UnitTests/AuthUnitTests.cs` | 单元测试
17 | `tasks/TASK-0007-BACKEND-FOUNDATION.md` | 任务文件（规格阶段）
18 | `tasks/current-task.md` | 任务文件（更新）

AuthController 不直接接收或返回 EF User 实体。LoginRequest 和 UserInfoResponse 可合入单个 DTO 文件。BootstrapExtensions 是独立文件。迁移文件是 EF Core 自动生成的合法文件。

#### 修改现有文件（共 5 个）

| 文件 | 修改内容 |
|---|---|
| `src/backend/Datacenter.Api/Datacenter.Api.csproj` | 添加 Sqlite 和 Design PackageReference |
| `src/backend/Datacenter.Api/Program.cs` | 完整中间件管道配置 |
| `src/backend/Datacenter.Api/appsettings.json` | 连接字符串模板、日志配置 |
| `tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj` | 添加 Mvc.Testing PackageReference |
| `.gitignore`（仓库根目录） | 追加 `.data/` 目录排除规则 |

`tasks/MODULE-LOCKS.md` 在规格阶段和状态迁移时更新（不计入实施文件预算）。

> 注：`src/backend/Datacenter.Api/appsettings.Development.json` 在本地文件系统已存在且已被 .gitignore 排除（`git ls-files` 返回退出码 1）。本任务不修改、不跟踪、不删除该文件。实施时通过新建 tracked `appsettings.Development.example.json` 提供开发配置模板，开发者自行复制为本地 Development 配置。

#### 文件预算上限

- 新增文件最多 **19 个**（含 17 个实施文件 + 任务文件）
- 修改现有文件最多 **5 个**
- 超过上限必须 Change Request

### 允许修改的数据模型

仅 User 实体为新建。不创建 Room、Cabinet、Server、ServerPosition、AuditRecord 实体。不修改脚手架已有数据模型。

### 允许修改的 API 契约

仅 AuthController 的 4 个端点：`GET /api/auth/csrf`、`POST /api/auth/login`、`POST /api/auth/logout`、`GET /api/auth/me`。不定义业务资源 API 契约。

### 复杂方案采用理由

N/A：本任务使用 ASP.NET Core 内置 Cookie 认证中间件 + EF Core SQLite + 共享框架内置 PasswordHasher + 内置 ProblemDetails + 内置 Antiforgery，均属 .NET 生态标准方案。唯一新增基础设施是本地 Tool Manifest（dotnet-ef），用于可复现的迁移生成。无复杂方案。

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
| ILogger<T> 控制台日志 | 第 15 节 |
| 配置文件分层与 Git 排除 | 第 12 节 |
| 排除 ASP.NET Core Identity 完整框架 | 第 5.1 和 8.5 节 |
| Service 层直接使用 DbContext（无仓储接口） | 第 9.3 节 |
| 测试策略：xUnit + SQLite 集成测试 + Mvc.Testing | 第 14 节 |
| User 实体最小数据：标识、登录名、密码哈希、启用状态、角色 | 第 8.5 节 |
| 固定角色集合 | 第 7.1 节（产品基线）；本任务额外拆分 DBA/应用运维人员为两个独立角色以增强最小权限区分 |

> 注：架构基线第 9.3 节所列 6 个实体中，Room、Cabinet、Server、ServerPosition、AuditRecord 分别留给 TASK-0009 至 TASK-0013。架构基线第 22 节也已将各业务模型文件列为对应任务的修改对象。本任务仅实现认证必需的 User 实体，符合防过度开发门禁。
>
> 本任务错误响应模型采用 ASP.NET Core 内置 ProblemDetails（`application/problem+json`），替代架构基线第 8.4 节的自定义 `{"error":"..."}` JSON 结构。选择理由：使用框架内置能力、不新增自定义错误平台、满足最简单可行方案。自定义错误模型的额外复杂度（需维护解析器、格式约定和文档）无当前需求支撑。

## API 端点契约

### GET /api/auth/csrf

- 认证：匿名或已认证均可
- Antiforgery：不要求
- 请求：无请求体
- 成功响应：200 OK
  - 设置/更新 Antiforgery Cookie
  - 响应头 `X-XSRF-TOKEN`：请求令牌值
  - 响应体可为空
- 错误响应：N/A（无业务失败路径；服务端异常返回 500 ProblemDetails）

### POST /api/auth/login

- 认证：匿名
- Antiforgery：必须验证（请求头 `X-XSRF-TOKEN`；使用匿名身份调用 `GET /api/auth/csrf` 获取的 Token）
- 请求：
  ```json
  {"username": "string", "password": "string"}
  ```
- 成功响应：200 OK
  ```json
  {"userId": "string", "username": "string", "role": "string"}
  ```
  设置认证 Cookie `Datacenter.Auth`（HttpOnly、SameSite=Lax、Secure 按环境）
- 错误响应：
  - 400：请求格式错误或 Antiforgery Token 缺失/无效 → `application/problem+json`
  - 401：认证失败（用户不存在、密码错误、用户禁用）→ `application/problem+json`，type/title/detail 完全相同，不区分原因
- 登录成功后：客户端必须再次调用 `GET /api/auth/csrf` 获取与已认证身份关联的新 Antiforgery 令牌对

### POST /api/auth/logout

- 认证：必须
- Antiforgery：必须验证（请求头 `X-XSRF-TOKEN`；必须使用登录后重新获取的 Token）
- 请求：无请求体
- 成功响应：204 No Content
  - 清除认证 Cookie `Datacenter.Auth`（Set-Cookie 覆盖为空值/已过期）
- 错误响应：
  - 400：Antiforgery Token 缺失或无效 → `application/problem+json`
  - 401：未认证或认证 Cookie 已失效
- 注销成功后再次调用：因认证 Cookie 已失效 → 401（不承诺匿名幂等成功）

### GET /api/auth/me

- 认证：必须
- Antiforgery：不要求（GET 请求）
- 请求：无请求体
- 成功响应：200 OK
  ```json
  {"userId": "string", "username": "string", "role": "string"}
  ```
- 错误响应：
  - 401：未认证 → `application/problem+json`

### 通用约束

- 所有包含响应体的响应 `Content-Type` 为 `application/json`（成功）或 `application/problem+json`（错误）
- 500 响应不返回异常堆栈、内部状态或敏感信息
- 密码哈希不得出现在任何 API 响应、日志或客户端可见数据中

## 验收标准

### AC-BF-01：User 实体和 Roles 常量存在且可编译
- 命令：验证 `Models/User.cs` 和 `Models/Roles.cs` 存在；`dotnet build` 通过
- 期望：User 实体含唯一标识、登录名、密码哈希、启用状态、角色、创建时间字段。Roles 类含 5 个固定角色常量字符串。不存在 Room、Cabinet、Server、ServerPosition、AuditRecord 实体文件。编译 0 errors。
- 验证方式：文件存在性检查 + `dotnet build`

### AC-BF-02：User.Role 含 SQLite CHECK 约束，拒绝空值和未知角色
- 命令：
  ```powershell
  sqlite3 .data/datacenter-dev.db ".schema Users"
  ```
- 期望：Users 表 Role 列定义含 NOT NULL 和 CHECK 约束（仅允许 5 个固定角色值）。尝试通过原始 SQL 插入未知角色值时被拒绝。
- 验证方式：sqlite3 schema 审查 + 集成测试中验证非法角色插入失败

### AC-BF-03：AppDbContext 仅含 Users DbSet，迁移可生成
- 命令：
  ```powershell
  dotnet tool restore
  dotnet tool run dotnet-ef migrations add InitialCreate --project src/backend/Datacenter.Api/Datacenter.Api.csproj
  ```
- 期望：退出码 0。生成 Migrations/ 目录含 migration.cs、Designer.cs、ModelSnapshot.cs。迁移仅创建 Users 表（含 Username UNIQUE 和 Role CHECK 约束），不包含业务表。
- 验证方式：命令执行 + 迁移文件内容审查

### AC-BF-04：Users 表含 Username 唯一索引
- 命令：
  ```powershell
  sqlite3 .data/datacenter-dev.db ".schema Users"
  ```
- 期望：输出含 Username 列 UNIQUE 约束。
- 验证方式：sqlite3 schema 输出审查

### AC-BF-05：WAL 模式已启用
- 命令：应用启动后执行 `sqlite3 .data/datacenter-dev.db "PRAGMA journal_mode;"`
- 期望：输出 `wal`。
- 验证方式：sqlite3 命令 + 应用启动日志确认

### AC-BF-06：WAL 初始化失败时应用启动失败
- 命令：模拟 WAL 设置失败（如使用只读数据库文件），启动应用
- 期望：应用启动失败（进程非零退出或抛出异常），不得静默继续。
- 验证方式：集成测试中验证启动行为

### AC-BF-07：Development + 完整配置时 Bootstrap 幂等创建
- 命令：
  1. 设置 `ASPNETCORE_ENVIRONMENT=Development`
  2. 通过用户机密或环境变量配置 `BootstrapAdmin:Username` 和 `BootstrapAdmin:Password`，Role 为有效角色
  3. 首次启动应用 → 查询 Users 表确认管理员已创建，密码已哈希
  4. 再次启动 → 确认用户数量不变（幂等，不重复创建、不覆盖密码）
- 期望：管理员仅创建一次。已有用户不被覆盖。日志含 Information 级别提示。
- 验证方式：集成测试（WebApplicationFactory with Development environment）

### AC-BF-08：Development + 配置缺失时不创建用户且不报错
- 命令：设置 `ASPNETCORE_ENVIRONMENT=Development`，不配置任何 Bootstrap 值，启动应用
- 期望：应用正常启动。Users 表为空（或仅有测试夹具用户）。无错误日志或启动失败。
- 验证方式：集成测试

### AC-BF-09：非 Development 环境即使配置也不创建用户
- 命令：设置 `ASPNETCORE_ENVIRONMENT=Production`（或 Staging），配置完整 Bootstrap 值，启动应用
- 期望：应用正常启动。Users 表不包含 Bootstrap 用户。Bootstrap 逻辑完全跳过。
- 验证方式：集成测试（WebApplicationFactory with Production environment）

### AC-BF-10：密码哈希存储且可验证
- 命令：查询 Users 表 PasswordHash 列；执行单元测试使用 PasswordHasher 验证
- 期望：PasswordHash 非空，不为明文。相同密码验证返回 Success，不同密码返回 Failed。相同密码两次哈希产生不同哈希值（随机盐）。
- 验证方式：sqlite3 查询 + 单元测试

### AC-BF-11：CSRF Token 端点返回 Token 和 Cookie
- 命令：发送 `GET /api/auth/csrf`（无认证）
- 期望：200 OK。响应头 `X-XSRF-TOKEN` 非空。设置 Antiforgery Cookie。
- 验证方式：集成测试

### AC-BF-12：缺少 Antiforgery Token 的登录被拒绝
- 命令：不携带 `X-XSRF-TOKEN` 请求头，发送 `POST /api/auth/login`
- 期望：400 Bad Request（`application/problem+json`）。登录操作不执行，不签发认证 Cookie。
- 验证方式：集成测试

### AC-BF-13：正确凭据登录成功
- 命令：
  1. `GET /api/auth/csrf` → 获取匿名 token + Antiforgery cookie
  2. `POST /api/auth/login`（携带 token + 正确凭据）
- 期望：200 OK。响应体含 userId、username、role，不含 passwordHash。设置认证 Cookie `Datacenter.Auth`（HttpOnly、SameSite=Lax）。
- 验证方式：集成测试

### AC-BF-14：错误密码登录失败且不区分原因
- 命令：分别使用错误密码和不存在用户名发送 `POST /api/auth/login`
- 期望：两次均返回 401。`application/problem+json` 的 type/title/detail 完全相同（不泄露"用户不存在"vs"密码错误"）。
- 验证方式：集成测试

### AC-BF-15：禁用用户登录被拒绝
- 命令：创建测试用户并设为禁用（Enabled=0），尝试登录
- 期望：401。ProblemDetails type/title/detail 与错误密码场景一致。
- 验证方式：集成测试

### AC-BF-16：未认证访问 /me 返回 401
- 命令：不携带认证 Cookie，发送 `GET /api/auth/me`
- 期望：401（`application/problem+json`）。
- 验证方式：集成测试

### AC-BF-17：认证 Cookie 含 HttpOnly 和 SameSite=Lax
- 命令：登录成功后检查 Set-Cookie 响应头
- 期望：`Datacenter.Auth` Cookie 含 `HttpOnly` 和 `SameSite=Lax` 属性。
- 验证方式：集成测试（HttpClientHandler 检查 Cookie 属性）

### AC-BF-18：Cookie 非持久、服务端 8h 有效期、无滑动续期
- 命令：登录成功后检查 Set-Cookie 无 `expires`/`max-age`（非持久 Cookie）。多次请求后再次检查 Cookie 过期不变。
- 期望：Cookie 为非持久（浏览器会话结束消失）。服务端 Ticket `ExpireTimeSpan=8h`，`SlidingExpiration=false`。
- 验证方式：集成测试（HttpClientHandler 检查 Set-Cookie 头 + 多次请求验证无滑动续期）

### AC-BF-19：禁用用户既有会话被拒绝 + DB 失败 fail closed
- 命令：
  1. 以测试用户登录，取得认证 Cookie
  2. 在测试数据库中将该用户 Enabled 设为 0
  3. 使用原 Cookie 请求 `GET /api/auth/me`
- 期望：401。认证 Cookie 被清除。DB 查询失败（异常/不可用）时同样拒绝请求，不降级授权。
- 验证方式：集成测试

### AC-BF-20：单元测试覆盖密码哈希行为
- 命令：`dotnet test --filter "FullyQualifiedName~UnitTests"`
- 期望：测试覆盖：
  - 相同密码哈希后验证返回 Success
  - 不同密码验证返回 Failed
  - 相同密码两次哈希产生不同哈希值（随机盐）
- 验证方式：dotnet test

### AC-BF-21：完整 Antiforgery 生命周期（登录前后 Token 不可互换）
- 命令：
  1. `GET /api/auth/csrf` → 获取匿名 token_a + Antiforgery cookie_a
  2. `POST /api/auth/login`（携带 token_a + 正确凭据）→ 200，获取认证 Cookie
  3. 用 token_a（匿名 Token）+ 认证 Cookie 调用 `POST /api/auth/logout` → **必须被拒绝（400）**
  4. `GET /api/auth/csrf`（携带认证 Cookie）→ 获取已认证身份的新 token_b + Antiforgery cookie_b
  5. `POST /api/auth/logout`（携带 token_b + 认证 Cookie）→ **204 No Content**
  6. 用认证 Cookie 请求 `GET /api/auth/me` → 401
- 期望：步骤 3 拒绝（匿名 Token 不能用于已认证状态变更）。步骤 5 成功。全流程按上述状态码通过。
- 验证方式：集成测试（使用单个 HttpClientHandler/CookieContainer 自动管理 Cookie）

### AC-BF-22：角色授权策略注册且可独立评估
- 命令：通过 `IServiceProvider` 获取 `IAuthorizationService`，分别以 5 个角色和匿名主体评估 `CanModify` 和 `ReadOnly` 策略
- 期望：
  - `机房管理员` 和 `运维人员`：`CanModify` 成功、`ReadOnly` 失败
  - `DBA`、`应用运维人员` 和 `只读查看人员`：`CanModify` 失败、`ReadOnly` 成功
  - 匿名主体：两个策略均失败
- 验证方式：单元测试（不创建测试专用生产 Controller 或端点）

### AC-BF-23：未知角色被服务端和数据库拒绝
- 命令：
  1. 单元测试：尝试创建 Role 为无效值（如 "超级管理员"）的 User → 期望 EF Core 校验或 SQLite CHECK 约束拒绝
  2. Bootstrap 测试：配置 `BootstrapAdmin:Role` 为未知角色 → 期望启动时拒绝初始化并记录 Error 日志
- 期望：未知角色无法持久化到数据库。Bootstrap 拒绝未知角色配置。
- 验证方式：单元测试 + 集成测试

### AC-BF-24：当前认证端点错误响应为 ProblemDetails JSON
- 命令：分别触发 400（无效 JSON 或缺失 Token）、401（未认证）、401（错误密码），检查响应
- 期望：所有错误响应 `Content-Type: application/problem+json`。400 含 validation errors。401 type/title/detail 不泄露内部信息。500 不含堆栈。
- 验证方式：集成测试（检查响应头 Content-Type 和响应体结构）

### AC-BF-25：认证事件写入日志且不泄露敏感信息
- 命令：执行登录成功和失败操作，检查日志输出
- 期望：登录成功含用户标识（Information）。登录失败含登录名（Warning），不含密码。日志中无 Cookie、密码哈希、Token 或敏感配置。
- 验证方式：集成测试中捕获日志

### AC-BF-26：appsettings.Development.example.json 存在、含占位符、被 Git 跟踪
- 命令：
  ```powershell
  test -f src/backend/Datacenter.Api/appsettings.Development.example.json
  git ls-files --error-unmatch src/backend/Datacenter.Api/appsettings.Development.example.json
  ```
- 期望：退出码 0。文件内容含连接字符串占位符（如 `<your-db-path>`），不含真实路径或凭据。文件被 Git 跟踪。
- 验证方式：文件存在 + 内容审查 + git ls-files

### AC-BF-27：集成测试使用独立临时 SQLite 文件
- 命令：审查测试夹具代码
- 期望：AuthTestFixture 通过 WebApplicationFactory 覆盖连接字符串为独立临时 SQLite 文件（如 `Path.GetTempFileName()` 或 GUID 文件名）。不使用开发数据库 `.data/datacenter-dev.db`。不使用 EF InMemory。不使用 SQLite `:memory:` 模式验证 WAL。每个测试类使用独立数据库。测试结束后清理 db/wal/shm 文件。
- 验证方式：代码审查

### AC-BF-28：集成测试覆盖全部认证行为
- 命令：审查集成测试列表
- 期望：测试覆盖：CSRF Token 获取、缺少/错误 Token 拒绝、正确登录、错误密码/不存在用户统一响应、禁用用户拒绝、Cookie HttpOnly+SameSite、Cookie 非持久/8h/无滑动、/me 认证要求、登录前后 Token 不可互换、登出拒绝匿名 Token、登出成功 204、二次登出 401、禁用会话拒绝 + DB 失败、Bootstrap Development 幂等、Bootstrap 配置缺失跳过、Production 跳过 Bootstrap、WAL 启用验证、未知角色拒绝、测试数据库隔离。
- 验证方式：代码审查

### AC-BF-29：集成测试不依赖外部服务或真实数据库
- 命令：无网络环境下运行 `dotnet test`
- 期望：全部集成测试通过。不连接外部数据库、LDAP、AD。测试数据库为临时文件。
- 验证方式：断网环境测试

### AC-BF-30：集成测试和单元测试全部通过
- 命令：`dotnet test tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj --no-build`
- 期望：退出码 0。所有测试通过（具体测试数量由覆盖行为自然决定）。
- 验证方式：dotnet test 输出

### AC-BF-31：dotnet build 0 errors 0 warnings
- 命令：`dotnet build Datacenter.sln --no-restore`
- 期望：退出码 0，无 error、无 warning。禁止 `<NoWarn>`、`#pragma warning disable` 抑制警告。
- 验证方式：构建输出审查

### AC-BF-32：工作流校验 20/20 PASS，git diff --check PASS
- 命令：`pwsh -NoLogo -NoProfile -File ./scripts/validate-agent-workflow.ps1`
- 期望：退出码 0，输出 `PASS=20 FAIL=0 TOTAL=20`。
- 命令：`git diff --check`
- 期望：退出码 0。

### AC-BF-33：依赖白名单和 Tool Manifest 检查
- 命令：审查所有 .csproj 和 `.config/dotnet-tools.json`
- 期望：
  - Web API csproj 运行时 PackageReference：仅 `Microsoft.EntityFrameworkCore.Sqlite`（8.0.x）
  - Web API csproj 设计时 PackageReference：仅 `Microsoft.EntityFrameworkCore.Design`（8.0.x，`PrivateAssets=all`）
  - 无 `Microsoft.Extensions.Identity.Core` PackageReference
  - 测试 csproj 新增 PackageReference：仅 `Microsoft.AspNetCore.Mvc.Testing`（TASK-0006 既有 xUnit 三件套不变）
  - `.config/dotnet-tools.json` 存在且含 `dotnet-ef`（8.0.x），被 Git 跟踪
  - `dotnet tool restore` 退出码 0
  - 所有 csproj 中无 AutoMapper、MediatR、FluentValidation、Serilog、Swashbuckle、coverlet.collector、FluentAssertions、Moq、NSubstitute、Identity 完整包、JWT 包
- 验证方式：文件审查 + 命令执行

### AC-BF-34：提交后工作区干净，本地远端哈希一致，数据库和敏感配置未被跟踪
- 命令：`git status --porcelain`
- 期望：无输出（工作区干净）。
- 命令：`test "$(git rev-parse HEAD)" = "$(git rev-parse origin/feature/task-0007-backend-foundation)"`
- 期望：退出码 0（本地与远端哈希一致）。
- 命令：`git ls-files .data/ .config/dotnet-tools.json`
- 期望：`.data/` 无输出；`.config/dotnet-tools.json` 有输出（被跟踪）。
- 命令：`git ls-files src/backend/Datacenter.Api/appsettings.Development.json`
- 期望：无输出（开发配置文件未被 Git 跟踪）。

## 构建命令

```powershell
# 恢复本地工具
cd <repo-root>
dotnet tool restore

# 后端构建
dotnet restore Datacenter.sln
dotnet build Datacenter.sln --no-restore

# 生成初始迁移（仅 Users 表，含 Role CHECK 约束）
dotnet tool run dotnet-ef migrations add InitialCreate --project src/backend/Datacenter.Api/Datacenter.Api.csproj

# 应用迁移创建数据库
dotnet tool run dotnet-ef database update --project src/backend/Datacenter.Api/Datacenter.Api.csproj
```

## 构建结果

- 命令：
- 退出码：
- 摘要/证据：

## 测试命令

```powershell
# 恢复本地工具
dotnet tool restore

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
| 2026-07-18 | Codex Reviewer | DRAFT（待审核） | DRAFT（NEEDS_CHANGES） | Claude + DeepSeek Product Manager | 规格审核 NEEDS_CHANGES（提交 cc44f8b；报告 SPEC-REVIEW.md）；BLOCKER 0 / MAJOR 7 / MINOR 2 / NOTE 0；三项锁保持 CLAIMED |
| 2026-07-18 | Claude + DeepSeek Product Manager | DRAFT（NEEDS_CHANGES） | DRAFT（待复审） | Codex Reviewer | 第一轮修正全部 9 项 BF-SR finding（提交 f51c9ba）；范围收缩为仅认证必需；三项锁 CLAIMED |
| 2026-07-18 | Codex Reviewer | DRAFT（待复审） | DRAFT（NEEDS_CHANGES） | Claude + DeepSeek Product Manager | 规格复审 NEEDS_CHANGES（提交 a84624c；报告 SPEC-RETEST.md）；BLOCKER 0 / MAJOR 5 / MINOR 3 / NOTE 0；三项锁应由 CLAIMED 转为 HANDED_OFF |
| 2026-07-18 | Claude + DeepSeek Product Manager | DRAFT（NEEDS_CHANGES） | DRAFT（HANDED_OFF） | Codex Reviewer | 第二轮修正全部 8 项 BF-RT1 finding（本轮提交）；三项规格锁 CLAIMED → HANDED_OFF；停止修改；待 Reviewer 独立复审 |

## 审核结论

- Reviewer：Codex Reviewer
- 第一次审核结论：NEEDS_CHANGES（SPEC-REVIEW.md，提交 cc44f8b；BLOCKER 0 / MAJOR 7 / MINOR 2 / NOTE 0）
- 第一次复审结论：NEEDS_CHANGES（SPEC-RETEST.md，提交 a84624c；BLOCKER 0 / MAJOR 5 / MINOR 3 / NOTE 0）
- 审核命令和证据：工作流 20/20 PASS；git diff --check PASS；diff 确认仅任务文件变化

## 缺陷清单

| 缺陷 ID | 等级 | 证据/复现 | 修复要求 | 状态 |
|---|---|---|---|---|
| BF-SR-001 | MAJOR | 规格要求 Room 等 5 个业务实体 + 完整 Schema | 移除非认证实体，仅保留 User | CLOSED（第一轮） |
| BF-SR-002 | MAJOR | Antiforgery 无 Token 获取端点 + 生命周期未裁决 | 新增 csrf 端点；唯一裁决登录前后 Token 不可互换 | CLOSED（第二轮 BF-RT1-001 修正） |
| BF-SR-003 | MAJOR | 4 个预置账号凭据和生产安全未定义 | Bootstrap 替代硬编码；仅 Development 环境执行 | CLOSED（第二轮 BF-RT1-002 修正） |
| BF-SR-004 | MAJOR | 授权验收无当前端点可作用 | IAuthorizationService 策略评估测试 | CLOSED（第一轮） |
| BF-SR-005 | MAJOR | 依赖分类和数量自相矛盾 + dotnet-ef 任选 | 按类别重算；唯一裁决本地 Tool Manifest + 精确版本 | CLOSED（第二轮 BF-RT1-003 修正） |
| BF-SR-006 | MAJOR | 文件预算遗漏迁移文件、DTO、夹具 + appsettings 跟踪状态不一致 | 完整重算含 Tool Manifest + .gitignore；澄清 Development 配置仅本地存在 | CLOSED（第二轮 BF-RT1-007 修正） |
| BF-SR-007 | MAJOR | API 契约和错误验收不完整 + logout 矛盾 | 唯一 ProblemDetails；logout 204 必须认证；二次调用 401 | CLOSED（第二轮 BF-RT1-004 修正） |
| BF-SR-008 | MINOR | WAL/测试数据库生命周期歧义 | WAL 非 wal 即启动失败；测试临时文件；禁止 :memory: | CLOSED（第一轮） |
| BF-SR-009 | MINOR | 预勾选 + 工作流输出 + CR 文件名 | 取消预勾选；修正字符串；修正 CR 文件名 | CLOSED（第一轮） |
| BF-RT1-001 | MAJOR | Antiforgery 登录后 token 生命周期仍可二选 | 唯一裁决：登录后必须重新 GET csrf；旧匿名 Token 必须拒绝；AC-BF-21 完整覆盖 | CLOSED（本轮） |
| BF-RT1-002 | MAJOR | Bootstrap 未强制限制 Development | 仅 IHostEnvironment.IsDevelopment() 时执行；Production 即使配置也不创建；AC-BF-09 验证 | CLOSED（本轮） |
| BF-RT1-003 | MAJOR | dotnet-ef 仍允许不可复现的工具选择 | 唯一裁决本地 Tool Manifest（.config/dotnet-tools.json）；8.0.x 精确版本；纳入文件预算和 AC | CLOSED（本轮） |
| BF-RT1-004 | MAJOR | API 错误模型二选一 + logout 契约矛盾 | 唯一 ProblemDetails；logout 204 必须认证；二次调用 401；AC-BF-24 验证 | CLOSED（本轮） |
| BF-RT1-005 | MAJOR | 规格锁未按权威规则正式交接 | 三项锁 CLAIMED → HANDED_OFF；交接记录完整；DRAFT 保持到复审通过 | CLOSED（本轮） |
| BF-RT1-006 | MINOR | User 角色字符串缺少服务端/DB 约束 | 固定 Roles 常量类；SQLite CHECK 约束；未知角色拒绝；AC-BF-02/AC-BF-23 验证 | CLOSED（本轮） |
| BF-RT1-007 | MINOR | 文件预算与实际配置状态不一致 | Tool Manifest 和 .gitignore 纳入预算；澄清 appsettings.Development.json 状态；总数重算 | CLOSED（本轮） |
| BF-RT1-008 | MINOR | Cookie/会话 DB 失败和 Secure Policy 证据不足 | OnValidatePrincipal fail closed；SecurePolicy 按环境；Cookie 非持久；AC-BF-18/19 验证 | CLOSED（本轮） |

## 缺陷修复记录

| 缺陷 ID | 修复者 | 修改说明 | 回归证据 | 提交 |
|---|---|---|---|---|
| BF-RT1-001 | Claude + DeepSeek Product Manager | 删除"或复用"分支；唯一裁决登录后重新 GET csrf；AC-BF-21 5 步骤验证旧 Token 拒绝 | 见本轮提交 | 待提交 |
| BF-RT1-002 | Claude + DeepSeek Product Manager | Bootstrap 增加 IHostEnvironment.IsDevelopment() 门禁；新增 AC-BF-09 Production 跳过验证；FR-BF-06 重写 | 见本轮提交 | 待提交 |
| BF-RT1-003 | Claude + DeepSeek Product Manager | 删除"或全局工具"；唯一 .config/dotnet-tools.json；EF Core 8.0.x 版本约束；Tool Manifest 纳入文件预算和 AC-BF-33 | 见本轮提交 | 待提交 |
| BF-RT1-004 | Claude + DeepSeek Product Manager | 唯一 ProblemDetails；logout 204 + 二次调用 401；删除幂等 200 匿名分支；AC-BF-24 重写为 ProblemDetails 结构验证 | 见本轮提交 | 待提交 |
| BF-RT1-005 | Claude + DeepSeek Product Manager | 三项锁 CLAIMED → HANDED_OFF；交接记录新增 HANDED_OFF 行；current-task 同步 | 见本轮提交 | 待提交 |
| BF-RT1-006 | Claude + DeepSeek Product Manager | 新增 Models/Roles.cs 常量类；User.Role CHECK 约束；AC-BF-02/AC-BF-23 验证未知角色拒绝 | 见本轮提交 | 待提交 |
| BF-RT1-007 | Claude + DeepSeek Product Manager | 文件预算统一重算为 19 新 + 5 修改；Tool Manifest + .gitignore 纳入；澄清 appsettings.Development.json 仅本地存在 | 见本轮提交 | 待提交 |
| BF-RT1-008 | Claude + DeepSeek Product Manager | OnValidatePrincipal DB 异常 fail closed；SecurePolicy 按环境；IsPersistent=false；AC-BF-18 非持久 Cookie 验证 | 见本轮提交 | 待提交 |

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
- 用户管理（CRUD、角色变更、密码重置）不在 MVP 范围。开发环境通过可选 Bootstrap（仅 Development）创建管理员；生产初始化留给部署任务。
- 前端登录页面由 TASK-0008 实现。CSRF Token 获取和 Antiforgery 生命周期由前端 TASK-0008 集成。
- 认证 Cookie 为非持久 Cookie（浏览器会话结束消失）+ 服务端 Ticket 8h 最大有效期，无滑动续期（架构基线第 8.5 节已批准固定 8 小时）。
- 当前端点不产生业务 403/404。真实业务端点的角色授权验证留给对应业务任务。
- 不实现 OpenAPI/Swagger 文档。
- MVP 数据规模下单实例 SQLite 满足需求；不实现多实例。
- `PasswordHasher<TUser>` 由 ASP.NET Core 共享框架提供，不添加独立 PackageReference（经实施前验证确认共享框架已包含）。
- 错误响应统一使用 ASP.NET Core 内置 ProblemDetails（`application/problem+json`），替代架构基线第 8.4 节的自定义 `{"error":"..."}` 结构。理由：使用框架内置能力，满足最简单可行方案。
- `appsettings.Development.json` 在本地文件系统已存在且已被 .gitignore 排除。本任务不修改、不跟踪、不删除该文件。开发者通过复制 `appsettings.Development.example.json` 创建本地配置。

## 最终完成条件

- [ ] 独立 Reviewer 验收或复审通过
- [ ] 验收标准全部通过（AC-BF-01 至 AC-BF-34）
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
> 规格已按 Codex Reviewer 两次审核报告（cc44f8b SPEC-REVIEW、a84624c SPEC-RETEST）全面修正。
> BF-SR-001 至 BF-SR-009 和 BF-RT1-001 至 BF-RT1-008 全部 CLOSED。
> 三项规格锁已转为 HANDED_OFF。下一步：交由 Codex Reviewer 做第二次规格复审。
