# TASK-0007 后端基础规格第一次修正复审

## 1. 复审元数据

| 字段 | 值 |
|---|---|
| Task ID | TASK-0007 |
| 复审类型 | 第一次规格修正后的独立复审 |
| Reviewer | Codex Reviewer |
| 实施 Owner | Codex Backend |
| 分支 | `feature/task-0007-backend-foundation` |
| 待复审 HEAD | `f51c9baaa6c6cd5bfaf6dc0c57c61abea32b5974` |
| 第一次审核提交 | `cc44f8b5db141a06cb820c468e4b830390cb8c3e` |
| 第一次审核结论 | NEEDS_CHANGES；BLOCKER 0 / MAJOR 7 / MINOR 2 / NOTE 0 |
| 复审日期 | 2026-07-18 |
| 最终结论 | **NEEDS_CHANGES** |

本轮只复审规格。除本报告外，没有修改任务规格、current-task、模块锁、`.gitignore`、基线、TASK-0006、既有报告、代码、测试、脚本、依赖、Tool Manifest、迁移或数据库，也没有启动实施或合并 main。

## 2. 材料、Git 与隔离检查

Reviewer 独立完整阅读了指定的工作流、模板、任务/锁、修订规格、第一次审核报告、产品/架构基线、TASK-0006、当前脚手架/测试/脚本/配置/`.gitignore`，并检查 `cc44f8b..f51c9ba` 完整 diff 和 Change Request/防过度开发规则；未以修正方的 CLOSED 声明代替复审。

`git fetch origin --prune` 成功。复审开始时：当前分支正确；HEAD 与远端任务分支均为 `f51c9baaa6c6cd5bfaf6dc0c57c61abea32b5974`；工作区干净；merge-base 仍为 main 基线 `d3bfc52`。修正 diff 只修改 `tasks/TASK-0007-BACKEND-FOUNDATION.md` 和 `tasks/current-task.md`；没有修改 `MODULE-LOCKS.md`，也没有任何 `src/`、`tests/`、`scripts/`、csproj/依赖、数据库、迁移或实现变化。TASK-0007 尚未认领实施锁、尚未进入实现。

## 3. BF-SR-001 至 BF-SR-009 状态

| Finding | 状态 | 复审结论 |
|---|---|---|
| BF-SR-001 | **CLOSED** | Room、Cabinet、Server、ServerPosition、AuditRecord 及其 DbSet、关系、索引、迁移和 AC 已移除；仅保留 Users 结构 |
| BF-SR-002 | **OPEN** | 已增加 csrf 端点和 header，但登录后 token 身份生命周期仍允许两种互不等价方案 |
| BF-SR-003 | **OPEN** | 已移除四个固定用户，但 Bootstrap 没有明确强制仅在 Development 执行 |
| BF-SR-004 | **CLOSED** | 改为 `IAuthorizationService` 独立策略评估；无测试专用生产端点和提前业务 API |
| BF-SR-005 | **OPEN** | NuGet 分类已修正；`dotnet-ef` 仍是本地/全局任选，迁移不可复现 |
| BF-SR-006 | **OPEN** | 主要文件已列出，但 Tool Manifest、现有 Development 配置和 `.gitignore` 仍未与预算统一 |
| BF-SR-007 | **OPEN** | DTO 已明确，但错误模型仍二选一，logout 契约自相矛盾 |
| BF-SR-008 | **CLOSED** | WAL 非 wal 启动失败；测试临时文件、隔离、清理及禁止 InMemory/`:memory:` 已明确 |
| BF-SR-009 | **CLOSED** | 预勾选、校验输出和 CR 文件名已修正 |

## 4. Findings

### BF-RT1-001 — MAJOR — Antiforgery 登录后 token 生命周期仍未裁决

- 文件/位置：`tasks/TASK-0007-BACKEND-FOUNDATION.md:107-126, 364-400, 537-545`
- 问题：匿名 `GET /api/auth/csrf`、cookie/header 传递和登录验证已定义，但 AC-BF-20 第 3 步仍写“获取新 token（或复用登录前的 token 对）”。ASP.NET Core Antiforgery token 会关联当前身份；匿名身份登录为已认证身份后，旧请求 token 与新身份可能不再有效。这两个方案不是可互换实现选择。规格也没有明确登录后必须再次 GET csrf 并随新的请求 token 保留对应 antiforgery cookie。
- 风险：实现者选择复用匿名 token 后 logout 失败，或测试只覆盖某一环境下偶然可用的行为；BF-SR-002 的闭环仍不确定。
- 最小修复方向：唯一裁决为登录成功后再次调用 `GET /api/auth/csrf`，保留返回的 antiforgery cookie，并用新 `X-XSRF-TOKEN` 请求令牌执行 logout；删除“或复用”分支。明确测试客户端使用 cookie container 自动保存两类 cookie，前端不读取 antiforgery cookie。

### BF-RT1-002 — MAJOR — Bootstrap 未被强制限制在 Development 环境

- 文件/位置：`tasks/TASK-0007-BACKEND-FOUNDATION.md:95-102, 454-467, 758-764`
- 问题：标题称“开发环境 Bootstrap”，但行为只以用户名/密码配置存在为条件，并允许环境变量；没有规定先检查 `IHostEnvironment.IsDevelopment()`，也没有 AC 在 Production 环境即使配置了 Bootstrap 值也不得创建用户。`生产环境默认不自动创建`不能排除生产误配环境变量触发创建。
- 风险：生产部署误带配置时自动创建已知管理员，违反 BF-SR-003 的核心安全条件。
- 最小修复方向：明确 Bootstrap 逻辑仅在 `Development` 环境注册/执行；增加 Production + 已配置 Bootstrap 值仍不创建用户的可执行验证。生产首次管理员由后续部署任务的受控初始化负责，当前任务无需实现生产工具。

### BF-RT1-003 — MAJOR — `dotnet-ef` 仍允许不可复现的工具选择

- 文件/位置：`tasks/TASK-0007-BACKEND-FOUNDATION.md:159-175, 253-258, 269-319, 623-636`
- 问题：规格仍允许“本地 Tool Manifest 或全局工具”任选，没有锁定唯一版本或调用方式；构建命令直接使用 `dotnet ef`。若采用本地 manifest，`.config/dotnet-tools.json` 未列入允许修改范围、明确文件清单或 AC；若采用全局工具，版本取决于机器。
- 风险：迁移生成结果和命令在 Owner/Reviewer 机器间不可复现，且本地 manifest 实现会越过文件预算。
- 最小修复方向：唯一选择仓库本地 Tool Manifest，锁定与 EF Core/.NET 8 兼容的批准版本；把 `.config/dotnet-tools.json` 纳入允许范围、文件预算、Git 跟踪和 `dotnet tool restore`/版本验证命令。不得安装到全局环境。

### BF-RT1-004 — MAJOR — API 错误模型与 logout 幂等契约仍自相矛盾

- 文件/位置：`tasks/TASK-0007-BACKEND-FOUNDATION.md:113-135, 391-418, 555-558`
- 问题：规格同时允许自定义 `{"error":"..."}` 或 ProblemDetails，让 Owner 决定 API 契约；架构基线第 8.4/15.2 节已经规定 `error` JSON，当前规格无权保留二选一。logout 又同时要求“必须认证”和“已无有效会话时仍 200”，但全局认证过滤器会让无有效会话请求先返回 401；同一请求无法同时满足两者。AC-BF-22 只要求“JSON”，无法验证唯一错误模型。
- 风险：TASK-0008 无稳定错误契约；不同端点可能混用模型；logout 的测试期望不可同时满足。
- 最小修复方向：统一采用架构基线的最小 `{"error":"..."}` 契约并逐类验证。logout 保持受保护：有效会话重复调用的首个调用 200，之后无会话调用 401；若确需匿名幂等 200，必须明确改变授权规则并给出当前依据，不能两者兼得。

### BF-RT1-005 — MAJOR — 规格复审未按权威锁规则正式交接

- 文件/位置：`tasks/TASK-0007-BACKEND-FOUNDATION.md:674-681`；`tasks/current-task.md:5-17`；`tasks/MODULE-LOCKS.md:41-43`；`docs/architecture/AGENT-WORKFLOW.md:25-36, 59-69`
- 问题：任务保持 DRAFT 本身适合继续澄清/设计，且权威状态机没有单独“规格复审”状态，因此不应伪造 READY_FOR_REVIEW/READY_FOR_RETEST；但 DRAFT 的禁止操作包含占用模块，而三项规格文件锁自初稿起一直为 `CLAIMED`，修正提交未将其交接为 `HANDED_OFF` 或释放。current-task 仍把 Product Manager 标为“规格修正阶段”Owner，同时声称待 Reviewer 复审。20/20 脚本只检查状态字符串合法和 Owner/Reviewer 不同，不验证任务级交接或锁语义。
- 风险：Reviewer 没有按唯一权威流程收到只读交接，CLAIMED Owner 仍可继续修改；若本轮 PASS 后直接 DRAFT→READY，会掩盖非法 DRAFT 占锁历史。
- 最小修复方向：保持 DRAFT 直到规格复审通过，不使用实施审查状态；在复审前停止修正并书面交接给 Reviewer。由于 DRAFT 不允许占用模块，最小方案是释放三项规格准备锁并记录释放/交接证据；若项目坚持将这些记录视为开发锁，则至少必须依第 4/5 节转为 `HANDED_OFF`，不能保持 `CLAIMED`。三文件须一致。

### BF-RT1-006 — MINOR — User 角色字符串缺少最小服务端/数据库约束

- 文件/位置：`tasks/TASK-0007-BACKEND-FOUNDATION.md:83-87, 128-129, 423-442`
- 问题：规格列出了四个准确角色且禁止 Role/RBAC 表，但只对 Username 建唯一索引，没有要求 User.Role 拒绝空值或未知字符串，也没有 AC 验证该约束。固定角色“集合”目前只是说明，不能防止未知角色持久化。
- 风险：部署初始化或未来受控写入可能产生未知角色，导致授权结果不可预测。
- 最小修复方向：用最小常量集合加服务端验证，并在 SQLite 模型中选择简单可执行的非空/允许值约束；增加未知角色被拒绝的验证，不引入 Role 表或动态权限模型。

### BF-RT1-007 — MINOR — 文件预算与实际配置状态仍不一致

- 文件/位置：`tasks/TASK-0007-BACKEND-FOUNDATION.md:267-321, 565-572, 615-621`；当前 `.gitignore:24-34`
- 问题：标题称最多 18 个，正文又称实施新增 ≤15；本地 Tool Manifest 尚未计入。`.gitignore` 当前已有 db 通配规则但缺 `.data/`，因此本任务必然修改 `.gitignore`，却“修改现有文件”只列 4 个。更重要的是 `src/backend/Datacenter.Api/appsettings.Development.json` 当前已被 Git 跟踪，而 AC-BF-32 要求无跟踪；规格没有把删除/停止跟踪该既有脚手架配置列为实施变更或说明保留内容如何迁入 example。
- 风险：正确实现会越过批准修改清单，或 AC-BF-32 必然失败；文件上限口径不能作为 Change Request 门禁。
- 最小修复方向：在裁决本地 Tool Manifest 后重列唯一总数；把 `.gitignore` 修改和现有 Development 配置的删除/停止跟踪明确列入允许范围及文件预算，并确保 example 不被过宽规则忽略。

### BF-RT1-008 — MINOR — Cookie/会话数据库失败行为和 SecurePolicy 证据不足

- 文件/位置：`tasks/TASK-0007-BACKEND-FOUNDATION.md:119-123, 506-522`
- 问题：8 小时、无滑动、最小 Claims 和每请求查库均已裁决，但没有明确 OnValidatePrincipal 查询数据库失败时必须 fail closed，且 AC 只验证 HttpOnly/SameSite，没有验证生产 HTTPS 下 Secure。角色 Claim 不是长期真相的依据仅通过 Enabled 查询体现，未说明数据库故障不能回退信任旧票据。
- 风险：实现可能在数据库异常时继续接受旧 Cookie；生产 Cookie Secure 配置回归不被发现。
- 最小修复方向：规定验证数据库不可用/查询异常时当前请求失败且不继续授权；增加生产配置下 Secure cookie 的验证。保留每请求查库方案，内部低流量 MVP 可接受。

## 5. 其余复审结论

- 收缩范围：合格；当前仅 User、SQLite/WAL、认证/授权骨架，无业务实体或持久化审计。
- User/Role 边界：角色名称与产品基线完全一致，无 Role/权限/关联表、多角色、多租户或用户管理；但未知角色约束需补充。
- 授权策略：方向合格；`CanModify`/`ReadOnly` 可用 `IAuthorizationService` 验证，真实业务 403 留给后续任务。
- 依赖：运行时 Sqlite、设计时 Design、测试 Mvc.Testing、既有 xUnit 三件套分类正确；PasswordHasher 通过 Web SDK 共享框架、不新增 Identity PackageReference的方向可接受；开发工具仍未裁决。
- SQLite/WAL/测试隔离：本地可配置 `.data`、禁止网络共享、WAL fail-fast、临时文件 SQLite、禁止 EF InMemory/`:memory:`、清理 db/wal/shm 均明确；迁移仅 Users。首次空库无需备份，既有库迁移备份留部署流程。
- AC：32 个编号连续，已取消固定数量驱动和未来业务端点依赖；但 AC-BF-20、22、31、32 受上述开放 findings 影响，尚不能全部执行。
- 防过度开发：未发现新增业务 Schema、虚假端点、复杂 RBAC、用户管理、JWT、SSO、仓储抽象或其他未来实现。

## 6. 验证结果

| 命令/检查 | 结果 | 退出码 |
|---|---|---:|
| `git fetch origin --prune` | 成功 | 0 |
| `pwsh -NoLogo -NoProfile -File ./scripts/validate-agent-workflow.ps1` | `PASS=20 FAIL=0 TOTAL=20` | 0 |
| `git diff --check cc44f8b..f51c9ba` | 无输出，PASS | 0 |
| `git diff --check`（报告创建前） | 无输出，PASS | 0 |
| 本地/远端 f51c9ba 一致 | PASS | 0 |
| 修正 diff 仅两个任务文件 | PASS | 0 |
| src/tests/scripts/依赖/数据库/迁移/实现隔离 | PASS | 0 |

纯规格复审不运行构建或测试，也未安装依赖或创建迁移/数据库。

## 7. 最终决定与完成报告

- 最终结论：**NEEDS_CHANGES**
- Findings：**BLOCKER 0 / MAJOR 5 / MINOR 3 / NOTE 0**
- BF-SR 状态：CLOSED 4（001/004/008/009）；OPEN 5（002/003/005/006/007）
- 规格状态与锁：DRAFT 可继续规格修正；CLAIMED 规格锁未正式交 Reviewer，不满足 PASS 条件
- Change Request：N/A；上述修改仍是 DRAFT 规格收敛。若改变已批准架构/API 基线之外的事项，须另走 CR
- 构建/测试：N/A；纯规格复审
- 模块实施锁：未认领；TASK-0007 未进入实现
- 已知限制：修订后需由同一独立 Reviewer 复审开放 finding 及新 finding
- 是否允许进入实施：**否**；不得转 READY/IN_PROGRESS，不得认领 `src/backend` 或 `tests/backend`

本报告应以 `review: retest task-0007 backend foundation spec` 提交并推送当前任务分支。
