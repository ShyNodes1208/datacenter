# TASK-0005 MVP 技术架构与开发基线第一轮独立复审报告

## 1. Review metadata

| 项目 | 内容 |
|---|---|
| Task ID | TASK-0005 |
| Review type | 第一轮独立修复复审 |
| Reviewer | Codex Reviewer |
| Owner / 修复者 | Claude + DeepSeek Product Manager |
| Review date | 2026-07-17（Asia/Shanghai） |
| Branch | `docs/task-0005-architecture-baseline` |
| Review start HEAD | `5a88157716118a4753d3d2694271de9b98a5fee8` |
| Review start remote | `origin/docs/task-0005-architecture-baseline` = `5a88157716118a4753d3d2694271de9b98a5fee8` |
| Review start worktree | CLEAN |
| Previous verdict | NEEDS_CHANGES（0 BLOCKER / 8 MAJOR / 1 MINOR / 0 NOTE） |
| Final verdict | NEEDS_CHANGES |

Reviewer 未参与修复。本轮只新增本报告，未修改架构基线、产品基线、任务状态、模块锁、CR-0001、`.gitignore`、首次审核报告或业务代码。

## 2. Reviewed commits and files

Reviewed commits:

- 原架构提交：`fc576de057873c5c238024c18b7db8f8ba41473e`
- 第一次审核：`bdd5a38d8f7e0ada4186fcfdd92d975b444cb7c0`
- 本轮修复：`5a88157716118a4753d3d2694271de9b98a5fee8`

完整阅读和检查：`AGENTS.md`、权威工作流、防过度开发规则、产品基线、修复后架构基线、`current-task.md`、模块锁、TASK-0005 文件、CR-0001、首次审核报告、`.gitignore` 和 `5a881577` 完整 diff。

修复提交修改 7 个获准文件：`.gitignore`、`AGENTS.md`、架构基线、CR-0001、模块锁、TASK-0005 文件和 `current-task.md`。未修改产品基线、业务代码、脚手架、数据库/迁移文件或 Review 报告。

## 3. A-001 至 A-009 复审矩阵

| Finding | 原等级 | 复审状态 | 独立验证结论 |
|---|---|---|---|
| A-001 | MAJOR | PARTIALLY_RESOLVED | `current-task.md` 已为 `READY_FOR_RETEST` 且三项锁均 `HANDED_OFF`，但 TASK-0005 文件和架构文档仍为 `READY_FOR_REVIEW`，三处状态不一致；任务交接记录也遗漏原始 `DRAFT → READY → IN_PROGRESS → READY_FOR_REVIEW` 迁移，且架构裁决责任仍未明确归属于 Codex Architect。 |
| A-002 | MAJOR | PARTIALLY_RESOLVED | CR-0001 包含工作流要求的字段，AGENTS 与架构均改为 Windows 宿主 + WSL 2 本地开发，且明确不作为生产要求，旧“禁止 WSL”已删除。但 CR 错误声称 Reviewer 在 A-002 中“确认 WSL 2 是合理选择”；首次审核实际只认定其与当时固定环境冲突，并未作该确认。 |
| A-003 | MAJOR | PARTIALLY_RESOLVED | User、Claims、登录、注销、禁用状态、角色、Cookie 属性和匿名拒绝已补充；但密码仍在 `PasswordHasher<TUser>` 与手写 PBKDF2 之间二选一，未作单一裁决；CSRF 只依赖 SameSite=Lax，并把 antiforgery 评估推迟；“管理员通过系统界面创建账号”新增了未在产品基线批准的用户管理能力。 |
| A-004 | MAJOR | PARTIALLY_RESOLVED | 单实例、本地磁盘、WAL、网络共享禁用、三类短事务、资产编号部分唯一索引、备份与 SQLite 限制均已补齐；但 U 位采用区间记录，普通唯一约束无法阻止区间重叠，文档仍笼统依赖“唯一约束”。并发流程未明确先获取 SQLite 写事务（如 `BEGIN IMMEDIATE`）、事务内重读和把 `SQLITE_BUSY` 映射为业务拒绝。 |
| A-005 | MAJOR | PARTIALLY_RESOLVED | 依赖预算已按五类列出 Vite、TypeScript、Vitest、xUnit、Test SDK 等；但单元测试明确只测纯计算却仍依赖 EF Core InMemory，没有真实当前场景。`@vue/test-utils` 标为“如需”，`jsdom` 或 `happy-dom` 二选一，而测试策略又明确不测组件，预算仍含无用/未裁决依赖。 |
| A-006 | MAJOR | RESOLVED | 文档与 `.gitignore` 已一致；开发配置和 local 配置被忽略，示例配置可提交，SQLite 主文件/WAL/SHM 均被忽略。实际 `git check-ignore` 验证通过。 |
| A-007 | MAJOR | RESOLVED | Controllers 已裁决；架构只定义资源职责，完整路径/方法留给 TASK-0007；不再泛化 CRUD，服务器删除明确排除。除 A-003 的账号创建扩张外，原 API/服务器删除问题已解决。 |
| A-008 | MAJOR | RESOLVED | 认证骨架位于业务接口之前，业务任务包含角色授权；并行项被限定为前后端或不同文件，当前列出的父子路径不重叠；TASK-0006 未启动。 |
| A-009 | MINOR | RESOLVED | 明确机柜列表只显示摘要、仅渲染当前单机柜、不渲染 200×60U，保持 U1 顶部向下递增，并排除 Canvas、SVG、虚拟列表、`will-change` 和 Grid Plan；调整须实测失败并经 Change Request。 |

## 4. WSL Change Request assessment

CR-0001 具备 Change Request ID、发现者、原任务、原因、产品/技术/文件/测试影响、风险、Claude/Architect 裁决、Requirement Source 和批准状态。它将 Windows 固定为宿主、WSL 2 固定为本地开发环境，保留 `pwsh` 工作流，并明确生产部署另行裁决；AGENTS 与架构一致且不再含禁止 WSL 的旧约束。

剩余问题是 CR 对首次 Reviewer 结论的事实性引用错误。该错误不改变 Architect 已批准的技术裁决，但必须更正，故 A-002 为 PARTIALLY_RESOLVED，并记录为 R-002 MINOR。

## 5. Authentication and CSRF assessment

已形成的闭环：User 表、受控首个管理员来源、不自注册、启用状态、单角色字段、ClaimsPrincipal、`SignInAsync`、`SignOutAsync`、后端角色授权、匿名读写拒绝、HttpOnly、SameSite=Lax、生产 Secure、过期策略，并继续排除完整 Identity UI、Identity Server、LDAP、AD、SSO 和复杂 RBAC。

仍未通过：

1. `PasswordHasher<TUser>` 与自行 `Rfc2898DeriveBytes` 同时保留，且依赖预算实际加入前者，导致实现和依赖不确定。
2. SameSite=Lax 只能作为纵深防御，不能替代状态变更请求的服务端防伪验证。架构没有要求所有 Cookie 认证的 POST/PUT/PATCH/DELETE 使用 Antiforgery Token（或等价双提交/自定义请求头并由服务端严格验证），反而推迟到 TASK-0008“评估”。
3. “管理员通过系统界面创建账号”意味着新增页面/API/CRUD，产品基线没有用户管理功能。最小认证只需受控部署种子/配置，不应顺势扩大产品范围。

结论：**FAIL，A-003 PARTIALLY_RESOLVED；R-001 MAJOR。**

## 6. SQLite concurrency assessment

已通过：单实例、本地磁盘、WAL、禁止 SMB/NFS/NAS、前端不直连、无多数据库层；三类位置操作均为短事务；资产编号非空唯一使用部分唯一索引；迁移前备份、安全在线备份和恢复验证已定义；排除 Schema、Sequence 和数据库生成并发令牌。

未通过：ServerPosition 以 StartU/EndU 区间存储时，常规 UNIQUE 不能发现 `10-11` 与 `11-12` 这种区间重叠。可实施的最小方案必须明确：先获取写事务/写锁，事务内重新读取当前机柜在架区间，检查重叠，写入并提交；捕获 `SQLITE_BUSY` 或提交时最终冲突并转为可识别业务拒绝。当前“事务内校验 + 写锁和唯一约束”的表述没有明确获取写事务的时机，也没有 `SQLITE_BUSY` 处理，仍可能被实现为默认延迟事务中的事务外或锁前读取。

结论：**FAIL，A-004 PARTIALLY_RESOLVED；R-003 MAJOR。**

## 7. Dependency and testing assessment

分类和主要依赖已完整：前端运行时含 Vue/Router；开发依赖含 Vite、Vue plugin、TypeScript、Vitest；后端运行时/设计时含 SQLite、Identity Core、EF Design；测试含 xUnit、Test SDK、runner、ASP.NET 测试主机。

但测试策略明确单元测试仅为纯数学/输入逻辑，不需要 DbContext，仍预算 `Microsoft.EntityFrameworkCore.InMemory` 属无用依赖。前端明确“不测试 Vue 组件”，却保留 `@vue/test-utils（如需）` 和 `jsdom 或 happy-dom`，既无当前场景又未作单一选择。依赖预算必须只列当前真实需要的直接依赖；未来需要时再走任务预算/Change Request。

未新增 Axios、Pinia、AutoMapper、MediatR、FluentValidation、Serilog 或 UI 组件库。

结论：**FAIL，A-005 PARTIALLY_RESOLVED；R-004 MAJOR。**

## 8. Configuration and gitignore assessment

执行：

```powershell
git check-ignore -v --no-index appsettings.Development.json appsettings.Test.local.json app.db app.db-wal app.db-shm appsettings.Development.example.json
```

结果：

- `appsettings.Development.json` → `appsettings.Development.json`
- `appsettings.Test.local.json` → `appsettings.*.local.json`
- `app.db` → `*.db`
- `app.db-wal` → `*.db-wal`
- `app.db-shm` → `*.db-shm`
- 示例 `appsettings.Development.example.json` 未匹配忽略规则，可提交
- 命令退出码 0

文档要求示例不含真实路径/凭据，敏感本地配置和数据库文件不会提交。结论：**PASS，A-006 RESOLVED。**

## 9. API scope assessment

Controllers 技术裁决明确，未引入额外框架。资源表逐项列出产品批准操作，服务器删除明确不实现；具体路径、HTTP 方法、参数和响应契约留给 Architect 管理的 TASK-0007。FR、BR、AC 含义未因 API 架构改变。

唯一范围问题来自认证章节新增“管理员通过系统界面创建账号”，它没有页面、FR 或 AC 支撑，已归入 R-001。除此之外 A-007 原问题 RESOLVED。

## 10. Frontend and 2D view assessment

机柜列表只显示摘要；单机柜页面仅渲染当前选中机柜的 U 位；明确禁止同时渲染 200×60U；U1 顶部且向下递增；跨 U 位连续合并；空闲/占用可辨；不提前引入 Canvas、SVG、虚拟列表、Grid Plan 或性能优化。结论：**PASS，A-009 RESOLVED。**

## 11. Workflow assessment

| 检查项 | 结果 |
|---|---|
| `current-task.md` | PASS：`READY_FOR_RETEST` |
| 架构文档 | FAIL：仍为 `READY_FOR_REVIEW` |
| TASK-0005 文件 | FAIL：仍为 `READY_FOR_REVIEW` |
| 三项锁 | PASS：全部 `HANDED_OFF` |
| Reviewer 接手 | PARTIAL：锁正确，但状态不一致 |
| 交接迁移 | FAIL：未记录初次 DRAFT→READY→IN_PROGRESS→READY_FOR_REVIEW |
| TASK-0006 | PASS：未启动 |

结论：A-001 PARTIALLY_RESOLVED；状态和迁移记录需最小同步，不释放锁。

## 12. Remaining findings

### R-001 — MAJOR — 认证方案仍有哈希二义性、无服务端 CSRF 防伪并扩大账号管理范围

- **文件/章节：** 架构基线 8.5、16.1、18.3
- **最小修复：** 单一选择 `PasswordHasher<TUser>` 或手写 PBKDF2，并同步依赖预算；所有 Cookie 认证状态变更请求强制 Antiforgery Token 或等价服务端验证；删除管理员 UI 创建账号，保留受控部署初始化方式。

### R-002 — MINOR — CR-0001 错误引用 Reviewer 结论

- **文件/章节：** `tasks/CR-0001-WSL-DEV-ENVIRONMENT.md` 变更原因
- **最小修复：** 删除“Reviewer 确认 WSL 合理”的错误表述，只保留 hangyu/Architect 的批准依据和实际开发环境事实。

### R-003 — MAJOR — SQLite U 位区间并发流程仍不可直接实现

- **文件/章节：** 架构基线 8.3、9.1
- **最小修复：** 明确获取写事务、事务内重读和区间重叠校验、写入提交、`SQLITE_BUSY`/最终冲突映射；不得声称普通唯一约束可解决区间重叠。

### R-004 — MAJOR — 依赖预算保留无当前用途和未裁决依赖

- **文件/章节：** 架构基线 14.1/14.2、18.2/18.5
- **最小修复：** 删除 EF Core InMemory；在不测试组件的当前策略下删除 Vue Test Utils 和 DOM 模拟依赖，或先给出真实必测场景并单一裁决 DOM 实现。

### R-005 — MAJOR — 复审状态与历史迁移记录不一致

- **文件/章节：** 架构文档信息、TASK-0005 基本信息/交接、`current-task.md`
- **最小修复：** 三处统一为 `READY_FOR_RETEST`；补齐真实的初次合法状态迁移证据。保持三项锁 `HANDED_OFF`。

剩余统计：BLOCKER 0、MAJOR 4、MINOR 1、NOTE 0。

## 13. Validation results

| 验证项 | 结果 |
|---|---|
| 审核前工作区 | CLEAN |
| 起始 HEAD | `5a88157716118a4753d3d2694271de9b98a5fee8` |
| HEAD/远端 | PASS，完全一致 |
| 工作流校验 | PASS=20，FAIL=0，TOTAL=20，退出码 0 |
| `git diff --check` | PASS，退出码 0 |
| 修复提交 `git diff 5a881577^ 5a881577 --check` | PASS，退出码 0 |
| 产品基线 | 未修改 |
| 业务代码/脚手架/数据库/迁移 | 均未新增 |
| Reviewer 受保护文件 | 未修改；只新增本报告 |

工作流脚本仅确认 `current-task.md` 的状态值合法，不检查三份状态一致性或完整迁移历史，因此 20/20 不能关闭 R-005。

## 14. Final verdict

**NEEDS_CHANGES**

A-001 至 A-005 未全部 RESOLVED，且仍有 4 个 MAJOR、1 个 MINOR；Cookie 认证没有明确服务端 CSRF 防伪，密码哈希有二义性，SQLite 区间并发流程不完整，依赖预算仍含无用项。因此不满足 PASS 条件。

TASK-0005 不得关闭，不得进入 TASK-0006。修复应仅覆盖 R-001 至 R-005，不引入用户管理产品功能、额外框架或新依赖；完成后保持锁为 `HANDED_OFF` 并再次交同一 Reviewer 复审。
