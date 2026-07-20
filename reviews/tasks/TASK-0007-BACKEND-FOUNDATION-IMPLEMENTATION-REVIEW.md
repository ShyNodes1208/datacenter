# TASK-0007 后端基础实现独立审核报告

## 审核信息

- Reviewer：Codex Reviewer（新的独立 Reviewer 会话）
- 审核时间：2026-07-20T14:26:54+08:00
- 当前分支：`feature/task-0007-backend-foundation`
- 审核开始 HEAD：`4cb75334db9588bf2979ba4b723420de0926d5da`
- 实现提交：`957ddab48e055409bf6c024d91ae20ad55813a32`
- 实现提交父提交：`b34123cbf92e101113946d66276258216c996bdb`
- 管理交接提交：`4cb75334db9588bf2979ba4b723420de0926d5da`
- 审核范围：`b34123cbf92e101113946d66276258216c996bdb..957ddab48e055409bf6c024d91ae20ad55813a32` 的完整实现，以及 `957ddab48e055409bf6c024d91ae20ad55813a32..4cb75334db9588bf2979ba4b723420de0926d5da` 的管理交接
- 最终结论：**PASS**
- Findings：**BLOCKER 0 / MAJOR 0 / MINOR 0 / NOTE 0**

本轮严格保持 Reviewer 独立性：未修改实现、测试、Migration、依赖、配置、TASK、current-task、MODULE-LOCKS、CR 或既有审核报告；唯一新增内容为本报告。本轮不执行状态迁移、锁释放或 main 合并。

## 规格基线与 CR 状态

已完整阅读 `AGENTS.md`、Reviewer 角色文件、权威工作流、产品与架构基线、TASK-0007、current-task、MODULE-LOCKS、CR-0005、CR-0006 及两份定点复审报告。有效基线为 TASK-0007 的 35 条 AC、16/5 文件预算、四项 8.0.29 依赖、四个认证 API、四个固定角色以及 Cookie、Antiforgery、SQLite/WAL、Bootstrap、测试隔离和防过度开发规则。

- CR-0005：APPROVED；`Microsoft.AspNetCore.Mvc.Testing` 固定为 `8.0.29`，定点复审 PASS，`CR5-RV-001` CLOSED。
- CR-0006：REJECTED；新增门禁不生效，`CR6-RV-001` CLOSED。本轮未运行其已拒绝的附加门禁。

## Git 前置门禁与提交边界

- `git fetch origin --prune`：PASS。
- 当前分支准确；审核开始本地与远端均为 `4cb75334db9588bf2979ba4b723420de0926d5da`。
- 审核开始工作区干净、暂存区为空、无未提交文件。
- TASK/current-task 均为 `READY_FOR_REVIEW`；Owner 为 Codex Backend；Reviewer 为 Codex Reviewer；Blocker 无。
- 19 项实施锁逐项为 `HANDED_OFF`，Owner 保持 Codex Backend；三项规格锁及全部 CR 临时文档锁为 `RELEASED`。
- 实现区间恰含 21 个文件：新增 16、修改 5、Migration 3；`git diff --check` PASS；无 tasks、reviews、docs、scripts、数据库/WAL/SHM、真实秘密或预算外文件。
- 管理交接区间只修改 `tasks/TASK-0007-BACKEND-FOUNDATION.md`、`tasks/current-task.md`、`tasks/MODULE-LOCKS.md`。

## 文件与依赖预算审核

- 文件预算：PASS，新增 16/16、修改 5/5、Migration 3/3；每个新增文件均映射到 TASK-0007 文件预算及 AC。
- 批准依赖仅为 `Microsoft.EntityFrameworkCore.Sqlite 8.0.29`、`Microsoft.EntityFrameworkCore.Design 8.0.29`、`Microsoft.AspNetCore.Mvc.Testing 8.0.29`、`dotnet-ef 8.0.29`。
- 无其他新增依赖、浮动版本、`latest` 或 `8.0.x`。
- Design 包为 `PrivateAssets=all` 且 IncludeAssets 合理；Mvc.Testing 是测试项目直接依赖；dotnet-ef 位于被跟踪的本地 Tool Manifest。

## 实现专项审核

### 数据库和 Migration

PASS。生产模型只有 `User`、`Roles` 和 `AppDbContext`；DbContext 只有 Users DbSet。User 字段、Username 唯一索引、Role NOT NULL 和四角色 CHECK 均准确。不存在 Role/权限/用户角色关联表或 Room、Cabinet、Server、Placement、Audit 等业务实体/表。Migration、Designer、Snapshot 相互一致且只创建批准的 Users 结构。数据库父目录会创建，非法/网络路径和创建失败使启动失败；WAL 返回非 `wal` 或执行异常均使启动失败，不静默降级。连接配置不含真实秘密。

### Bootstrap

PASS。仅 Development 执行；非 Development 完全跳过。用户名或密码缺失时记录非敏感 Information 并正常跳过；未知角色拒绝启动。目标用户不存在时使用 `PasswordHasher<User>` 创建；同一数据库跨两个应用实例重启幂等，且不覆盖已有哈希、角色或启用状态。日志和 example 配置均无真实密码、哈希或凭据；无额外管理 API。

### Cookie 与认证

PASS。恰有四个端点：`GET /api/auth/csrf`、`POST /api/auth/login`、`POST /api/auth/logout`、`GET /api/auth/me`。认证 Cookie 为 `Datacenter.Auth`、HttpOnly、SameSite=Lax；Development 为 SameAsRequest，其他环境为 Always；非持久、固定 8 小时 Ticket、SlidingExpiration=false。Claims 仅含用户 ID、用户名和角色。登录的不存在用户、错误密码与禁用用户返回完全相同 401；匿名 `/me` 和二次 logout 返回 401；logout 要求认证与有效 Antiforgery。不存在 JWT、Refresh Token 或额外认证机制。

### OnValidatePrincipal

PASS。每个带 Cookie 请求从最小 ID Claim 查询数据库；用户不存在、禁用、Role 与 Cookie 不一致均 RejectPrincipal 并 SignOut。数据库异常被捕获后 fail-closed；不会信任旧 Role、转成认证成功或向响应泄露内部信息。

### Antiforgery

PASS。CSRF 端点返回 `X-XSRF-TOKEN` 请求令牌并设置内置 Antiforgery Cookie；请求头名准确。匿名 Token 可登录，但身份变化后旧 Token 无法 logout；重新获取的认证 Token 可 logout。缺失和无效 Token 返回统一 JSON 400；无测试后门或绕过。

### 错误契约与日志安全

PASS。模型绑定/畸形 JSON、Antiforgery 400、认证 401 和真实依赖故障 500 均为 `application/json` 的 `{"error":"..."}`；当前范围无自然 403。响应不含 ProblemDetails、HTML、堆栈、数据库内部信息或敏感值。认证成功记录非敏感用户 ID，失败记录用户名；捕获日志未包含密码、密码哈希、Antiforgery Token、Cookie 或连接字符串。数据库诊断仅写服务端日志，未进入客户端错误响应。

### 测试质量

PASS。测试基于真实 ASP.NET Core 管道和临时文件 SQLite，而非字符串检查或测试专用端点。WAL 非 wal 通过只读连接和锁定场景确定性触发；父路径普通文件跨平台触发目录失败；Bootstrap 重启使用两个独立应用实例；Ticket 测试解包实际认证 Ticket并检查无续签；500 由真实数据库依赖故障触发；日志断言覆盖批准事件和全部敏感值；Fixture 验证独立数据库及 db/wal/shm/目录清理；匿名/认证 Token 生命周期走真实 CookieContainer。测试不依赖外部服务、执行顺序或开发数据库，未见恒真断言或降低 AC。

## AC-BF-01 至 AC-BF-35 独立矩阵

| AC | 规格要求 | 实现证据 | 测试/命令证据 | Reviewer 结论 |
|---|---|---|---|---|
| AC-BF-01 | User 与四角色常量 | `Models/User.cs`、`Models/Roles.cs` | build 0 errors | PASS |
| AC-BF-02 | Role NOT NULL + 四值 CHECK | `AppDbContext.OnModelCreating`、Migration | `WalModeAndRoleConstraintAreEnforced` | PASS |
| AC-BF-03 | DbContext 仅 Users；三迁移文件 | DbContext、Migration/Designer/Snapshot | tool restore；内容审查 | PASS |
| AC-BF-04 | Username 唯一 | 唯一索引配置与 Migration | 迁移内容审查 | PASS |
| AC-BF-05 | WAL 启用 | `InitializeDatabaseAsync` | `WalModeAndRoleConstraintAreEnforced` | PASS |
| AC-BF-06 | WAL 失败终止启动 | 非 wal/异常均抛出 | `WalModeReturningNonWalCausesApplicationStartupFailure` | PASS |
| AC-BF-07 | 路径验证、目录失败终止 | `NormalizeSqliteConnectionString` | 网络共享及普通文件父路径测试 | PASS |
| AC-BF-08 | Development Bootstrap 幂等 | `BootstrapAdminAsync` | 两项 Bootstrap 幂等/重启测试 | PASS |
| AC-BF-09 | 缺配置正常跳过 | 缺值 Information + return | `MissingBootstrapConfigurationStartsAndUnknownRoleIsRejected` | PASS |
| AC-BF-10 | 非 Development 跳过 | `IsDevelopment` 门禁 | Production 分支测试 | PASS |
| AC-BF-11 | PasswordHasher 哈希 | Bootstrap/AuthService | `PasswordHasherUsesSaltAndVerifiesPasswords` | PASS |
| AC-BF-12 | CSRF header + cookie | `AuthController.Csrf` | `CsrfEndpointReturnsTokenAndCookie` | PASS |
| AC-BF-13 | 无 Token 登录 400 JSON | 登录显式验证 | `LoginWithoutAntiforgeryTokenReturnsJsonBadRequest` | PASS |
| AC-BF-14 | 正确登录与最小响应/Cookie | `AuthController.Login` | `LoginMeAndCookiePropertiesAreCorrect` | PASS |
| AC-BF-15 | 错误原因统一 | AuthService + 单一 401 消息 | `InvalidCredentialsAndDisabledUserReturnIdenticalUnauthorizedErrors` | PASS |
| AC-BF-16 | 禁用用户拒绝 | `!user.Enabled` | 同上禁用用户分支 | PASS |
| AC-BF-17 | 匿名 `/me` 401 JSON | 全局 AuthorizeFilter + `[Authorize]` | `AnonymousMeReturnsJsonUnauthorized` | PASS |
| AC-BF-18 | HttpOnly + SameSite=Lax | Cookie options | Cookie 头断言 | PASS |
| AC-BF-19 | 非持久、8h、无滑动 | Cookie options + AuthenticationProperties | 实际 Ticket 解包与三次请求无续签 | PASS |
| AC-BF-20 | 角色变化/DB 故障拒绝 | `OnValidatePrincipal` | 角色变化重登及数据库故障测试 | PASS |
| AC-BF-21 | 密码哈希单测 | PasswordHasher 使用 | UnitTests 7/7 | PASS |
| AC-BF-22 | 登录前后 Token 不可互换 | 内置绑定身份的 Antiforgery | `AnonymousTokenCannotLogoutAuthenticatedUserButNewTokenCan` | PASS |
| AC-BF-23 | 两授权策略 | `AddAuthorization` | 4 角色 + 匿名理论测试 | PASS |
| AC-BF-24 | 未知角色双层拒绝 | Roles 集合 + CHECK + Bootstrap 校验 | DB 插入及 Bootstrap 启动失败测试 | PASS |
| AC-BF-25 | 400/401/500 统一 JSON | 模型响应、认证事件、异常中间件 | 畸形 JSON、匿名、依赖故障测试 | PASS |
| AC-BF-26 | 认证日志无敏感值 | AuthController 日志 | `AuthenticationLogsContainApprovedEventsWithoutSensitiveValues` | PASS |
| AC-BF-27 | example 占位且被跟踪 | example JSON | `git ls-files --error-unmatch` PASS | PASS |
| AC-BF-28 | 临时 SQLite 隔离清理 | `AuthTestFixture` | 双 Fixture 与 db/wal/shm 清理测试 | PASS |
| AC-BF-29 | 完整认证行为覆盖 | 20 项 IntegrationTests | IntegrationTests 20/20 | PASS |
| AC-BF-30 | 无外部服务/真实开发库 | GUID 临时本地 SQLite | 全部集成测试独立通过 | PASS |
| AC-BF-31 | 后端测试全通过 | 测试项目 | 总测试 28/28，0 failed/0 skipped | PASS |
| AC-BF-32 | build 0 errors/warnings | 无 NoWarn；生成迁移仅含 EF 标准 obsolete pragma | build 0 errors/0 warnings | PASS |
| AC-BF-33 | workflow 20/20 + diff check | 管理状态有效 | PASS=20 FAIL=0；diff check 0 | PASS |
| AC-BF-34 | 四项精确依赖/Tool Manifest | 两 csproj + dotnet-tools.json | tool restore PASS；静态审查 | PASS |
| AC-BF-35 | Git 清洁、同步、无 DB/敏感配置 | ignore 规则与跟踪清单 | 审核开始本地远端一致且干净；最终提交后复核 | PASS |

矩阵结论：**35/35 PASS，0 FAIL，0 DEFERRED**。

## 防过度开发专项

PASS。仅四个认证 API；仅 User/Roles/AppDbContext；无业务实体、业务 Controller、通用 Repository、Unit of Work、事件总线、插件系统、JWT、Refresh Token、权限表、角色表、用户角色关联表、测试专用生产端点、TASK-0008 内容或无关重构。无未批准依赖和抽象；当前实现是满足 TASK-0007 的最小方案。

## 独立验证结果

| 验证 | 结果 |
|---|---|
| `dotnet tool restore` | PASS；退出码 0；dotnet-ef 8.0.29 |
| `dotnet restore Datacenter.sln` | PASS；退出码 0 |
| `dotnet build Datacenter.sln --no-restore` | PASS；退出码 0；0 errors、0 warnings |
| UnitTests 过滤测试 | PASS；7/7；failed 0；skipped 0 |
| IntegrationTests 过滤测试 | PASS；20/20；failed 0；skipped 0 |
| 全部后端测试 | PASS；28/28；failed 0；skipped 0 |
| 工作流校验 | PASS；PASS=20 FAIL=0 TOTAL=20 |
| `git diff --check` | PASS；退出码 0 |

构建和测试只产生被忽略的 bin/obj/test 临时输出；未运行 CR-0006 附加门禁、`scripts/build.ps1`、`scripts/test.ps1`、新分析器、覆盖率门禁、性能测试、Migration 重生成或数据库更新命令。

## Findings

无。BLOCKER 0 / MAJOR 0 / MINOR 0 / NOTE 0。

## 最终决定

TASK-0007 完整实现审核结论为 **PASS**。35 条 AC 全部有独立证据，文件与依赖预算准确，安全和错误契约通过，测试证据充分，防过度开发检查通过，READY_FOR_REVIEW 与 19 项 HANDED_OFF 锁准确。

- 是否允许进入任务完成状态迁移步骤：**是**。须在下一独立步骤按权威工作流先完成锁释放、状态关闭、提交推送和最终哈希/清洁核对。
- 是否允许直接合并 main：**否**。不得跳过权威工作流的完成状态迁移和锁释放。
- 本报告不执行 `READY_FOR_REVIEW → COMPLETED`，不修改锁或任务管理文件。
