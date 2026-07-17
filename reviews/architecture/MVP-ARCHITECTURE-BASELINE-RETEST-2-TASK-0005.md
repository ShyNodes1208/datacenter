# TASK-0005 MVP 技术架构与开发基线第二次独立复审报告

## 1. Review metadata

| 项目 | 内容 |
|---|---|
| Task ID | TASK-0005 |
| Review type | 第二次独立修复复审 |
| Reviewer | Codex Reviewer |
| Owner / 修复者 | Claude + DeepSeek Product Manager |
| Review date | 2026-07-17（Asia/Shanghai） |
| Branch | `docs/task-0005-architecture-baseline` |
| Review start HEAD | `0d6299e5436682a14fc04fe9ef85ef2b52b31b3d` |
| Review start remote | `origin/docs/task-0005-architecture-baseline` = `0d6299e5436682a14fc04fe9ef85ef2b52b31b3d` |
| Review start worktree | CLEAN |
| Previous verdict | NEEDS_CHANGES（0 BLOCKER / 4 MAJOR / 1 MINOR / 0 NOTE） |
| Final verdict | NEEDS_CHANGES |

Reviewer 未参与第二轮修复。本轮只新增本报告，未修改架构基线、产品基线、AGENTS、任务状态、模块锁、CR-0001、`.gitignore`、既有 Review 报告或业务代码。

## 2. Reviewed commits and files

Reviewed commits:

- 原始架构：`fc576de057873c5c238024c18b7db8f8ba41473e`
- 第一次审核：`bdd5a38d8f7e0ada4186fcfdd92d975b444cb7c0`
- 第一轮修复：`5a88157716118a4753d3d2694271de9b98a5fee8`
- 第一次复审：`bfc27351d5b6704ae38df456701ba82c6ceee3c2`
- 第二轮修复：`0d6299e5436682a14fc04fe9ef85ef2b52b31b3d`

完整阅读和检查了用户指定的全部架构、产品、任务、工作流、Change Request、首次审核和首次复审材料，以及提交 `0d6299e` 的完整 diff。

提交 `0d6299e` 仅修改：

- `docs/architecture/MVP-ARCHITECTURE-BASELINE.md`
- `tasks/CR-0001-WSL-DEV-ENVIRONMENT.md`
- `tasks/TASK-0005-MVP-ARCHITECTURE-BASELINE.md`

文件范围符合要求。产品基线、AGENTS、current-task、模块锁、`.gitignore`、业务代码和 Review 报告未被该修复提交修改。

## 3. A-001 至 A-009 最终复审矩阵

| Finding | 原等级 | 最终复审状态 | 独立验证结论 |
|---|---|---|---|
| A-001 | MAJOR | RESOLVED | `current-task.md`、TASK-0005 文件和架构文档均为 `READY_FOR_RETEST`；完整合法迁移历史已补齐；三项锁均为 `HANDED_OFF`；TASK-0006 未创建或启动。 |
| A-002 | MAJOR | RESOLVED | CR-0001 已批准，错误 Reviewer 引用已删除；Windows 宿主、WSL 2 本地开发、Cursor/Agent 运行边界及非生产约束在 AGENTS、CR 和架构中一致。 |
| A-003 | MAJOR | PARTIALLY_RESOLVED | 8.5 已单选 PasswordHasher、删除用户管理范围并定义 Antiforgery；但 16.1 仍保留“管理员创建”和“PasswordHasher 或 PBKDF2”，12.2 仍称 PBKDF2，形成当前架构冲突。Cookie 过期值仍留给 TASK-0007且仅为建议；未说明 Cookie 不保存密码/哈希；禁用账号后既有 Cookie 如何停止授权未定义。 |
| A-004 | MAJOR | RESOLVED | 三类位置操作均先取得等价 `BEGIN IMMEDIATE` 的写事务，再在事务内重读和逐区间校验、更新、审计、提交；失败回滚；`SQLITE_BUSY/LOCKED` 转业务拒绝且无无限重试；不再声称唯一索引防区间重叠。 |
| A-005 | MAJOR | PARTIALLY_RESOLVED | 无用 InMemory、Vue Test Utils、jsdom/happy-dom 已删除，依赖分类准确；但集成测试范围没有明确验证 Cookie 登录/注销、Antiforgery 成功与失败、禁用账号既有会话拒绝，尚不能验证 A-003 的安全基线。 |
| A-006 | MAJOR | RESOLVED | 配置与 `.gitignore` 仍一致，数据库/WAL/SHM 均忽略，示例配置可提交且要求无敏感值。 |
| A-007 | MAJOR | RESOLVED | Controllers 裁决、资源边界、不固化完整 API、不默认 CRUD、服务器不删除均无回归；8.5 不再新增用户管理功能。 |
| A-008 | MAJOR | RESOLVED | 认证骨架先于业务接口，依赖顺序和并行锁边界无回归，TASK-0006 未启动。 |
| A-009 | MINOR | RESOLVED | 单机柜渲染边界、摘要列表、U1 方向和排除 Canvas/SVG/虚拟列表/Grid Plan 均无回归。 |

## 4. Workflow assessment

- 三份当前状态完全一致：`READY_FOR_RETEST`。
- `READY_FOR_REVIEW` 仅作为初次历史迁移存在。
- 交接历史覆盖 `DRAFT → READY → IN_PROGRESS → READY_FOR_REVIEW → CHANGES_REQUESTED → IN_FIX → READY_FOR_RETEST` 以及第二轮修复循环。
- TASK-0005 三项锁均为 `HANDED_OFF`，无 TASK-0005 `CLAIMED` 或 `RELEASED` 残留。
- Reviewer 接手条件满足；TASK-0006 尚未创建或启动。

结论：**PASS，A-001 RESOLVED。**

## 5. WSL Change Request assessment

CR-0001 为 `APPROVED`，字段符合权威 Change Request 规则。它明确 Windows 为宿主、WSL 2 Ubuntu 24.04 为本地开发/构建/测试/Agent 环境，Cursor 在 Windows 连接 WSL，Claude Code + DeepSeek 和 Codex CLI 在 WSL 运行，不依赖远程或独立 Linux 服务器，生产部署另行裁决。AGENTS、CR 和架构一致，无仍生效的禁止 WSL 或纯 Windows 执行冲突，也未修改产品功能或生产拓扑。

结论：**PASS，A-002 RESOLVED。**

## 6. Authentication and Antiforgery assessment

8.5 的第二轮修订方向正确：

- 所有账号仅通过受控部署初始化写入 SQLite，凭据来自不进入 Git 的安全配置；不提供用户管理页面/API/CRUD、角色配置、密码重置、导入或自注册；未来需 Change Request。
- 单一采用 `PasswordHasher<TUser>`，不自行实现哈希，禁止明文，不引入完整 Identity UI/数据模型。
- 登录检查存在、启用状态和密码，失败不泄露账号存在性；通过必要用户/角色 Claims 和 `SignInAsync` 建立 Cookie；注销使用 `SignOutAsync`。
- HttpOnly、SameSite=Lax、生产 Secure、滑动/绝对过期概念已定义。
- 使用 ASP.NET Core Antiforgery；服务端签发、前端请求头提交、服务端强制验证；登录、注销及全部 POST/PUT/PATCH/DELETE 状态变更均覆盖；失败不产生状态变化；GET 可不要求。
- 角色矩阵和后端最终授权边界正确，匿名页面/API 均拒绝。

但文档其他当前章节仍与 8.5 冲突：

- 12.2 写“用户密码使用 PBKDF2 哈希存储”，没有引用唯一的 PasswordHasher 裁决。
- 16.1 仍写“账号来源（种子数据/管理员创建）”和“PasswordHasher 或 PBKDF2”，恢复了已删除的产品范围扩张与哈希二义性，并把已明确的 Antiforgery 降格为“CSRF 基础策略”。
- Cookie 的滑动 30 分钟、绝对 8 小时仍是“建议”且留给 TASK-0007，未形成确定基线；也未明确 Cookie/Claims 不包含密码或密码哈希。
- 仅登录时检查启用状态。若账号在部署初始化/维护中被禁用，既有 Cookie 仍可仅凭 Claims 继续授权；未定义每次请求重查启用状态、会话版本/安全戳或等价最小失效机制。

因此认证方案仍不能被唯一实现，且 16.1 文本仍表述未批准的管理员用户创建。结论：**FAIL，A-003 PARTIALLY_RESOLVED。**

## 7. SQLite transaction and concurrency assessment

架构已完整定义上架、移动、下架的统一流程：读取前先获取等价 `BEGIN IMMEDIATE` 的写事务；事务内重读服务器状态、当前位置、机房/机柜状态和目标区间；逐区间检查重叠；同事务更新位置、容量和 AuditRecord；成功提交、失败回滚。

无法取得写事务时，`SQLITE_BUSY/SQLITE_LOCKED` 转换为稳定可识别的业务拒绝，不执行隐藏无限重试；事务内发现占用则拒绝并回滚。最终保护由 SQLite 单写入者、写事务和事务内重读共同形成，明确不依赖普通唯一索引检测区间重叠。资产编号非空唯一仍由后端与部分唯一索引共同保证；没有分布式锁、队列、重试框架、多实例协调、SQL、Migration 或数据库代码。

结论：**PASS，A-004 RESOLVED。**

## 8. Dependency and testing assessment

依赖预算已删除 `Microsoft.EntityFrameworkCore.InMemory`、`@vue/test-utils`、`jsdom`、`happy-dom` 及未裁决 DOM 环境。前端仅以 Vitest 测试无需 DOM 的逻辑，不挂载组件；未引入 Playwright/Cypress。后端纯逻辑单元测试仅使用 xUnit，无数据库 Provider；集成测试使用隔离临时 SQLite，并保留 xUnit、Test SDK、runner、MVC Testing 和运行时 SQLite Provider。

依赖本身已无明显无用或遗漏项。但测试范围只列“认证中间件和角色校验、匿名拒绝”，没有明确 Cookie 登录/注销、Antiforgery Token 成功/缺失/无效、禁用账号既有 Cookie 拒绝等安全集成测试。用户要求这些属于本轮 A-005 的必要验证基线。

结论：依赖预算 **PASS**，测试安全覆盖 **PARTIAL**；A-005 = PARTIALLY_RESOLVED。

## 9. Configuration and gitignore regression assessment

再次执行 `git check-ignore -v --no-index`：

- `appsettings.Development.json` → `appsettings.Development.json`
- `appsettings.Test.local.json` → `appsettings.*.local.json`
- `app.db` → `*.db`
- `app.db-wal` → `*.db-wal`
- `app.db-shm` → `*.db-shm`
- 示例配置未被忽略，可提交

配置规则与 `.gitignore` 一致，无敏感配置或数据库文件回归。A-006 仍为 RESOLVED。

## 10. API scope regression assessment

ASP.NET Core Controllers 裁决明确；当前只定义资源和产品已批准操作，具体契约留给 TASK-0007；没有默认完整 CRUD，服务器删除明确不实现。8.5 已删除用户管理页面/API，但 16.1 的“管理员创建”摘要仍构成文本范围冲突，已统一归入 A-003。A-007 原问题无回归。

## 11. Frontend and 2D view regression assessment

机柜列表仅摘要；U 位网格仅当前单机柜；不渲染 200×60U；U1 顶部向下递增；不引入 Canvas、SVG、虚拟列表、`will-change` 或 Grid Plan；只有 AC-018 失败且 Change Request 批准后才调整。A-009 无回归。

## 12. Product-to-architecture traceability

第 21 节仍逐项覆盖 FR-001 至 FR-012 和 NFR-001 至 NFR-007，产品基线未修改。除认证摘要中残留的“管理员创建”外，未增加服务器删除、批量导入、3D、监控或其他产品功能。无业务代码、脚手架、依赖安装、数据库、SQL 或 Migration；TASK-0006 未开始。

总体为 **PARTIAL**：功能/非功能编号闭环保持，但 A-003 的冲突摘要必须删除才能确认无产品范围扩张。

## 13. Overdevelopment assessment

单体、单实例 SQLite、Controllers、内置认证/Antiforgery、HTML/CSS 单机柜网格和最小测试依赖均保持克制；没有新增框架、抽象、基础设施或未来功能实现。残留管理员创建文本不是已实现设计，但属于未批准范围声明，需最小删除。除此之外无过度设计回归。

## 14. Validation commands and results

| 验证项 | 结果 |
|---|---|
| 审核前工作区 | CLEAN |
| 起始 HEAD | `0d6299e5436682a14fc04fe9ef85ef2b52b31b3d` |
| HEAD/远端 | PASS，完全一致 |
| 修复文件范围 | PASS，仅架构基线、CR-0001、TASK-0005 文件 |
| 工作流校验 | PASS=20，FAIL=0，TOTAL=20，退出码 0 |
| `git diff --check` | PASS，退出码 0 |
| `git diff 0d6299e^ 0d6299e --check` | PASS，退出码 0 |
| `git check-ignore` | PASS，退出码 0 |
| 产品基线 | 未修改 |
| 业务代码/脚手架/数据库/SQL/Migration | 均未新增 |
| Reviewer 受保护文件 | 未修改；仅新增本报告 |

## 15. Remaining findings

### R2-001 — MAJOR — 认证摘要仍与唯一认证裁决冲突，禁用会话与安全测试未闭环

- **文件/章节：** 架构基线 8.5、12.2、14.3、16.1、18.3
- **问题：** 12.2/16.1 保留 PBKDF2 和管理员创建；过期值未固定；Cookie 不含密码/哈希未明确；禁用账号既有 Cookie 未失效；Antiforgery/Cookie/禁用会话未列为集成测试。
- **风险：** TASK-0007 可实现出不同哈希/账号范围和不可撤销会话，TASK-0016 也缺少安全回归依据。
- **最小修复方向：** 全文统一引用 8.5 的 PasswordHasher 与受控初始化裁决；删除管理员创建/PBKDF2旧摘要；固定滑动与绝对过期值并禁止票据含密码/哈希；定义禁用账号使既有会话失效的最小后端检查；在 SQLite 集成测试中明确 Cookie 登录/注销、Antiforgery 成功/失败、四角色/匿名和禁用会话测试。无需新增依赖或功能。

剩余统计：BLOCKER 0、MAJOR 1、MINOR 0、NOTE 0。

## 16. Final verdict

**NEEDS_CHANGES**

A-003 和 A-005 尚未全部 RESOLVED，且仍有 1 个 MAJOR，因此不满足 PASS 条件。A-001、A-002、A-004、A-006 至 A-009 已通过复审。

TASK-0005 当前不得关闭，不得进入 TASK-0006。只需对 R2-001 做全文一致性和测试清单的最小修订，保持三项锁 `HANDED_OFF`，再交同一 Reviewer 复审。
