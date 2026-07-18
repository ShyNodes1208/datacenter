# TASK-0007 后端基础规格独立审核

## 1. 审核元数据

| 字段 | 值 |
|---|---|
| Task ID | TASK-0007 |
| 审核类型 | 实施前独立规格审核 |
| Reviewer | Codex Reviewer |
| Owner | Codex Backend |
| 分支 | `feature/task-0007-backend-foundation` |
| 待审核 HEAD | `d0dbdc6168c6dc48c1cf76df53fef1aef599a6bf` |
| main 基线 | `d3bfc520477952a2315d8000eacfbdff28687a4c` |
| 审核日期 | 2026-07-18 |
| 最终结论 | **NEEDS_CHANGES** |

本轮只审核规格。除本报告外，没有修改任务规格、状态、锁、产品/架构基线、代码、测试、脚本、依赖、迁移或数据库，也没有合并 `main`。

## 2. 审核材料与 Git 前置检查

Reviewer 完整阅读了 `AGENTS.md`、权威工作流、任务模板、当前任务与模块锁、TASK-0007、产品与架构基线、TASK-0006 规格、TASK-0006 最终复审与第二次合并门禁、全部 Change Request，以及当前后端、后端测试、脚本、配置和 `.gitignore`；并检查了 `d3bfc52..d0dbdc6` 的完整 diff。

`git fetch origin --prune` 成功。审核开始时：

- 当前分支是 `feature/task-0007-backend-foundation`；
- HEAD 与 `origin/feature/task-0007-backend-foundation` 均为 `d0dbdc6168c6dc48c1cf76df53fef1aef599a6bf`；
- `origin/main` 与 merge-base 均为 `d3bfc520477952a2315d8000eacfbdff28687a4c`，分支合法建立在当前 main 上；
- 工作区干净；
- diff 恰好为 `tasks/TASK-0007-BACKEND-FOUNDATION.md`（新增）、`tasks/current-task.md` 和 `tasks/MODULE-LOCKS.md`，共三个任务文件；
- 无 `src/`、`tests/`、`scripts/`、依赖、数据库、迁移或 TASK-0007 实现变化；TASK-0006 脚手架未被修改；
- TASK-0006 已 `COMPLETED` 并合并 main；current-task 指向 TASK-0007；DRAFT 合法；实施 Owner 与 Reviewer 独立；三项规格准备锁为 `CLAIMED`，且没有提前认领 `src/backend` 或 `tests/backend` 实施锁。

## 3. Findings

### BF-SR-001 — MAJOR — 完整业务 Schema 提前固化

- 文件/位置：`tasks/TASK-0007-BACKEND-FOUNDATION.md:81-86, 116-124, 172-174, 276-310, 598-605`
- 问题：任务同时声明不实现机房、机柜、服务器、位置和操作记录业务，却要求建立 Room、Cabinet、Server、ServerPosition、AuditRecord 的完整实体、关系、索引和初始迁移。认证与 SQLite/WAL 骨架只需要 User/Role 最小模型及本任务必要迁移；其余五个实体和业务 Schema 不参与当前三个认证端点。把“全部 FR/NFR（数据持久化基础）”作为追踪来源也不能证明这些表是当前认证 AC 的必要条件。架构基线虽曾把六实体列入 TASK-0007 建议范围，但同一基线第 22 节又把各业务模型文件列为 TASK-0009 至 TASK-0013 的修改对象；按权威防过度开发门禁，任务规格仍须证明当前必要性，而不能仅以未来方便为理由。
- 风险：在业务 Service、API 和约束尚未实施验证前固化字段、关系、删除行为和索引，后续任务被迫迁移或背负错误 Schema；迁移、数据兼容和审核面无必要扩大。
- 最小修复方向：TASK-0007 仅保留 SQLite/EF 基础、User 最小模型、认证所需 DbContext 和认证迁移；Room、Cabinet、Server、ServerPosition、AuditRecord 及其迁移分别留给对应业务任务。若 Architect 坚持六实体必须现在落地，需逐项给出不可延迟的当前 AC 依据和复杂方案裁决，而不是泛化映射“全部 FR/NFR”。

### BF-SR-002 — MAJOR — Antiforgery 没有可执行的令牌引导闭环

- 文件/位置：`tasks/TASK-0007-BACKEND-FOUNDATION.md:88-95, 122-123, 374-415`
- 问题：规格要求登录、注销和所有状态变更均验证 Antiforgery，但批准 API 只有 login/logout/me。AC-BF-21 写“从响应中获取 Antiforgery Token”，却没有定义哪个请求/响应签发令牌、匿名登录前如何取得令牌、令牌 cookie 与请求 token 的组合、请求头名称或客户端约定。登录本身是匿名 POST，因此在没有引导请求的情况下无法满足“登录也必须验证”。
- 风险：三个端点无法形成可测试流程；实现者只能自行发明端点或响应契约，造成 API 越界，或绕过登录 Antiforgery 使安全 AC 名义通过、实际失败。
- 最小修复方向：明确一个最小同源取 token 约定（可为一个匿名 GET 或既有 GET 的明确签发行为）、固定请求头名、cookie/token 获取步骤及 login/logout 测试序列；只增加闭环必需的最小契约，不扩展安全平台。

### BF-SR-003 — MAJOR — 四个预置账号的凭据来源和生产安全未定义

- 文件/位置：`tasks/TASK-0007-BACKEND-FOUNDATION.md:86-87, 111, 124, 320-339, 598-605`
- 问题：规格要求数据库中恰好四个已启用用户，并要求测试用“种子密码原文”验证，但只把凭据管理推迟到“实施时部署说明”。没有定义用户名和密码从何种不入 Git 的来源读取、缺失时是否失败、开发/测试/生产环境边界、是否禁止生产自动创建已知默认账号、初始化幂等性、已有用户处理，或哈希是在运行时生成还是固定进入迁移。随机盐哈希不应成为非确定迁移内容。
- 风险：默认密码或可逆线索进入 Git；生产启动时创建已知账号；重复启动产生重复用户或重置密码；迁移内容不确定，均属于高风险初始化缺口。
- 最小修复方向：明确仅从不入 Git 的受控配置/初始化命令读取凭据，缺失时安全失败；生产不得自动生成已知默认账户；初始化须幂等且不得覆盖现有密码；迁移只建结构，不嵌入密码哈希。测试凭据仅由测试夹具注入。无需新增用户管理或强制首次改密功能。

### BF-SR-004 — MAJOR — 授权验收没有当前作用对象

- 文件/位置：`tasks/TASK-0007-BACKEND-FOUNDATION.md:94-96, 181, 379-387, 417-445`
- 问题：当前只有 login、logout、me；其中 logout 是任何已认证角色都应能执行的会话操作，me 是读取操作。规格却要求管理员访问“需修改权限的端点”返回 200、只读角色返回 403，并要求触发 403/404，未指定实际端点。实现测试专用生产端点会越过三端点预算，不实现则 AC-BF-17、22、26 无法执行。
- 风险：Owner 被迫增加虚假 API、借用不恰当的 logout 验证业务修改权限，或提交无法验证的 AC；角色边界可能只通过代码目测而未经过真实授权管道。
- 最小修复方向：本任务验收授权策略的注册和独立授权评估结果；把真实修改端点的 200/403 集成验证留给首个业务写 API 任务。不要为测试污染生产 API。同步删除当前三端点无法自然触发的 404/业务 403 承诺，或给出本任务内真实且必要的作用对象。

### BF-SR-005 — MAJOR — 依赖预算分类和数量自相矛盾

- 文件/位置：`tasks/TASK-0007-BACKEND-FOUNDATION.md:126-128, 193-207, 463-469`
- 问题：最小范围称“运行时恰好 3 个 + 设计时恰好 1 个”，表格却把 `Microsoft.EntityFrameworkCore.Design` 放进“运行时恰好 3 个”，AC-BF-30 又要求 Web 项目恰好三个 PackageReference，其中 Design 以 `PrivateAssets=all` 标为设计时。包名本身准确，但分类和总数口径无法同时成立；`dotnet ef` 还是独立全局/本地工具，规格也未将其作为开发工具预算和可复现前置条件。测试项目已有三项测试依赖虽被提到，但“新增恰好一项”与“项目总依赖”口径需在验收命令中明确区分。
- 风险：依赖白名单会误判正确实现；Design 可能错误作为运行时资产发布；不同机器无法复现迁移命令；Owner 无法判断直接依赖总数的权威口径。
- 最小修复方向：分别列出后端运行时直接依赖、设计时 PackageReference、测试新增直接依赖、既有测试依赖和 `dotnet-ef` 开发工具；用准确的直接依赖集合验收，不以矛盾的“恰好”数字替代集合。并核实 Web SDK 共享框架下 `PasswordHasher<TUser>` 是否确需独立 PackageReference；若基线要求保留，也应如实分类并说明。

### BF-SR-006 — MAJOR — 十二个新增文件预算不能容纳批准实现

- 文件/位置：`tasks/TASK-0007-BACKEND-FOUNDATION.md:35-51, 116-130, 215-236, 281-310`
- 问题：允许新增文件只列 12 个，却遗漏 EF 迁移通常生成的 migration、Designer 和 ModelSnapshot 文件；也没有登录请求 DTO、当前用户响应 DTO、初始化逻辑/选项、Antiforgery 契约及测试宿主/数据库 fixture 的位置。AuthController 若直接接收/返回 User 实体会暴露密码哈希等内部字段；若使用 DTO，则越过文件预算。单个集成测试文件承担临时 SQLite 生命周期、WebApplicationFactory 替换配置、种子、cookie、antiforgery、日志和至少十二项行为也未获合理预算。规格还说“2 个 appsettings 更新”，实际存在的确为 `appsettings.json` 与已跟踪的 `appsettings.Development.json`，但后者同时被规格要求不得提交，形成修改范围与 Git 验收冲突。
- 风险：实现必然越界、把多种职责塞进超大文件，或直接暴露 EF 实体；迁移文件无法合法提交，测试隔离和清理易不稳定。
- 最小修复方向：先按缩减后的实际范围重算文件预算；显式允许迁移生成文件、最小请求/响应 DTO、初始化组件和必要测试 fixture。不要规定不真实的固定文件数；以允许职责/目录和禁止暴露敏感字段为门禁。澄清已跟踪 development 配置是要移除跟踪并以 example 替代，还是保持非敏感受控配置，不能同时“修改”且“git ls-files 无输出”。

### BF-SR-007 — MAJOR — API 契约和错误验收不完整且部分超前

- 文件/位置：`tasks/TASK-0007-BACKEND-FOUNDATION.md:88-98, 341-392, 424-430`
- 问题：登录请求只在 AC 示例中出现，三端点没有集中定义请求/成功响应字段、内容类型、logout 幂等语义、禁用用户登录/后续请求状态码、`/me` 未认证契约及 DTO 边界。统一错误 AC 要求 400/401/403/404，却没有当前端点对应的自然 403/404 场景；功能要求还承诺 500，但 AC 没验证客户端不泄露异常。登录失败日志要求记录用户名，与“不通过日志泄露账号是否存在”的约束没有明确日志模板/等价行为边界。
- 风险：前端 TASK-0008 无稳定契约；实现者自行决定安全相关状态码和响应字段；为了满足状态码数量提前建立完整业务错误体系，或 500 泄露内部异常。
- 最小修复方向：为三个认证端点定义最小 DTO 与状态码/幂等契约，禁止返回 User 实体和 PasswordHash；只验收当前可触发的错误，500 仅要求统一非敏感响应和服务端日志，业务 403/404 留给对应业务 API。

### BF-SR-008 — MINOR — SQLite/WAL 和测试数据库生命周期仍有歧义

- 文件/位置：`tasks/TASK-0007-BACKEND-FOUNDATION.md:84-85, 289-318, 437-450, 481-494`
- 问题：规格正确限定本地磁盘和 WAL，但没有明确 PRAGMA 返回值非 `wal` 时启动失败，也未明确迁移与应用启动顺序。测试既允许“内存或临时文件 SQLite”，又要求每个类/方法独立临时文件和 WAL；SQLite 内存数据库的连接生命周期与 WAL 语义不同。测试并行、WebApplicationFactory 覆盖连接字符串和清理 WAL/SHM 的责任未定义。
- 风险：开发库被测试误用；并行测试共享文件；PRAGMA 失败仍继续启动；内存模式让 WAL AC 假通过。
- 最小修复方向：规定 WAL 初始化返回非 `wal` 即启动失败；认证集成测试使用独立临时文件 SQLite，通过测试宿主覆盖配置并清理 db/wal/shm；不使用 EF InMemory，WAL 验证也不使用 SQLite `:memory:`。

### BF-SR-009 — MINOR — 规格状态和验收命令存在错误陈述

- 文件/位置：`tasks/TASK-0007-BACKEND-FOUNDATION.md:24-31, 457-461`
- 问题：DRAFT 规格在审核前已勾选“规格已通过 Codex Reviewer”；AC-BF-29 期望字符串写为 `PASS=20, FAIL=0, TOTAL=20`，实际校验器输出 `PASS=20 FAIL=0 TOTAL=20`。此外禁改清单中的 CR-0003/CR-0004 文件名与仓库实际文件名不一致。
- 风险：审核证据循环自证；自动匹配可能误报；禁改路径不能准确识别真实文件。
- 最小修复方向：审核通过项在真实 PASS 后再勾选；验收期望采用校验器实际输出；修正 CR 文件名。

## 4. 范围、架构与拆分结论

当前规格不适合作为一个独立任务直接实施。建议保留一个 TASK-0007，不为形式过度拆分，但将其收敛为：SQLite/EF Core 基础、User/Role 最小模型、Cookie 认证、login/logout/me、完整 Antiforgery 闭环和认证测试。Room、Cabinet、Server、ServerPosition、AuditRecord 及其迁移应进入各自业务任务。

如果收敛后认证与 SQLite 基础仍因初始化和安全闭环导致审核面过大，才进一步拆为“SQLite/EF 基础”和“最小认证骨架”两个任务；当前首选是先删除五个提前业务实体，而不是立即增加任务数量。

认证技术方向本身可行：Cookie、`PasswordHasher<TUser>`、固定 8 小时无滑动、`OnValidatePrincipal` 每请求查库均已由架构基线明确批准；本轮不以个人偏好推翻这些裁决。问题在于 Antiforgery 与初始化的关键操作契约没有落到可执行规格。

AuditRecord 是 MVP 最终产品要求，但仅对上架/移动/下架位置变化有验收依据；TASK-0007 没有位置操作，因此当前落表不是本任务必要条件。SQLite 应保持单实例、本地磁盘、WAL、无多数据库抽象；迁移只包含本任务必要结构。架构基线中的迁移前备份原则适用于部署/既有数据库变更，本任务首次创建开发/测试数据库无需伪造备份流程。

## 5. 验证结果

| 检查 | 结果 | 退出码 |
|---|---|---:|
| `git fetch origin --prune` | 成功 | 0 |
| `pwsh -NoLogo -NoProfile -File ./scripts/validate-agent-workflow.ps1` | `PASS=20 FAIL=0 TOTAL=20` | 0 |
| `git diff --check origin/main..HEAD` | 无输出，PASS | 0 |
| `git diff --check`（报告创建前） | 无输出，PASS | 0 |
| 分支/HEAD/远端一致 | PASS | 0 |
| 纯规格三文件 diff | PASS | 0 |
| TASK-0006 脚手架隔离 | PASS | 0 |

本轮按要求不运行前后端构建或测试：待审核提交是纯规格提交，且 TASK-0006 脚手架没有变化。

## 6. 最终决定与完成报告

- 审核结论：**NEEDS_CHANGES**
- Findings：**BLOCKER 0 / MAJOR 7 / MINOR 2 / NOTE 0**
- 任务范围：当前过大；完整六实体迁移不是认证骨架必要条件
- 是否提前实现业务实体：规格要求提前实现五个非认证业务实体及 AuditRecord Schema；尚未实际写代码
- 认证方案：技术方向已批准，但契约和初始化不完整
- Antiforgery：不闭环，必须修正后才可实现
- 默认用户安全：不满足实施门槛
- SQLite/迁移：技术方向可行；迁移范围过大，测试/WAL细节需收敛
- 依赖预算：分类和数量不准确
- 文件与复杂度预算：不可执行
- API：三个端点数量合理，但契约和错误范围不完整
- 测试：核心认证行为清单合理；角色写权限、403/404 缺少真实作用对象
- Change Request：N/A；本轮是 DRAFT 规格审核，要求由规格 Owner/Architect 在现有批准流程内修正；若要改变架构基线裁决则须按权威流程处理
- 构建命令与结果：N/A；纯规格审核且脚手架无变化
- 测试命令与结果：N/A；未要求构建/测试，已执行工作流与 Git 校验
- 模块锁释放证据：N/A；任务仍为 DRAFT，三项规格准备锁保持现状，本报告不修改锁
- 已知限制：本报告未验证未来修订稿；修订后需由同一独立 Reviewer 复审全部 findings
- 最终完成条件：未满足；不得进入实现，不得转 READY/IN_PROGRESS，不得认领 `src/backend` 或 `tests/backend` 实施锁

本报告提交说明应为 `review: assess task-0007 backend foundation spec`，并推送到当前任务分支。
