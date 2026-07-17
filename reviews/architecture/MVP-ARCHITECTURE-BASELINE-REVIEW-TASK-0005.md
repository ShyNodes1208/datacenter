# TASK-0005 MVP 技术架构与开发基线独立审核报告

## 1. Review metadata

| 项目 | 内容 |
|---|---|
| Task ID | TASK-0005 |
| Review type | 独立技术架构基线审核 |
| Reviewer | Codex Reviewer |
| Owner | Claude + DeepSeek Product Manager |
| Review date | 2026-07-17（Asia/Shanghai） |
| Branch | `docs/task-0005-architecture-baseline` |
| Reviewed commit | `fc576de057873c5c238024c18b7db8f8ba41473e` |
| Review start HEAD | `fc576de057873c5c238024c18b7db8f8ba41473e` |
| Review start remote | `origin/docs/task-0005-architecture-baseline` = `fc576de057873c5c238024c18b7db8f8ba41473e` |
| Review start worktree | CLEAN |
| Product baseline | TASK-0004，COMPLETED，最终复审 PASS |
| Final verdict | NEEDS_CHANGES |

Reviewer 未参与 TASK-0005 架构基线编写。本轮未修改架构基线、产品基线、任务状态、模块锁、业务代码或既有 Review 报告，只新增本审核报告。

## 2. Reviewed files and commit

完整阅读和检查：

- `AGENTS.md`
- `docs/architecture/AGENT-WORKFLOW.md`
- `tasks/TASK-TEMPLATE.md`
- `tasks/current-task.md`
- `tasks/MODULE-LOCKS.md`
- `tasks/TASK-0004-PRODUCT-BASELINE.md`
- `tasks/TASK-0005-MVP-ARCHITECTURE-BASELINE.md`
- `docs/product/MVP-PRODUCT-BASELINE.md`
- `docs/architecture/MVP-ARCHITECTURE-BASELINE.md`
- TASK-0004 三份产品审核/复审报告
- 防过度规划、设计和开发门禁
- 提交 `fc576de` 的完整 diff

提交 `fc576de` 仅包含：

- 新增 `docs/architecture/MVP-ARCHITECTURE-BASELINE.md`
- 新增 `tasks/TASK-0005-MVP-ARCHITECTURE-BASELINE.md`
- 修改 `tasks/current-task.md`
- 修改 `tasks/MODULE-LOCKS.md`

未修改产品基线、业务代码、项目脚手架、依赖清单、数据库脚本、迁移、工作流规范或既有 Review 报告。

## 3. Executive conclusion

**NEEDS_CHANGES**

架构方向总体克制：Vue 3 + TypeScript + Vite、ASP.NET Core 8、EF Core 8、单实例本地 SQLite、Cookie Authentication、HTML/CSS 单机柜视图、内置日志和单体部署均适合 MVP，且没有提前引入微服务、缓存、消息队列、完整 RBAC、容器或云服务。

但当前基线尚不能安全进入 TASK-0006：正式工作流仍停留在 `DRAFT` / `CLAIMED`；开发流程直接违反仓库固定的“不使用 WSL”约束；Cookie 认证缺少账号来源、会话建立/注销和 Cookie 安全闭环；SQLite 未定义全部位置操作事务、竞争条件下最终一致性、备份及 SQLite 特有限制；依赖预算声称“完整上限”却遗漏已要求的框架和测试/开发依赖；配置规则与现有 `.gitignore` 相互矛盾；此外 CRUD/API 表述扩大或提前固化了产品/API 范围，后续任务拆分也存在锁冲突与安全落地顺序风险。

本次记录 **0 BLOCKER、8 MAJOR、1 MINOR、0 NOTE**。

## 4. Findings

### A-001 — MAJOR — TASK-0005 未达到正式交审状态且角色/锁记录不一致

- **文件及位置：** `tasks/current-task.md:9,17`；`tasks/TASK-0005-MVP-ARCHITECTURE-BASELINE.md:7,10,176,183`；`tasks/MODULE-LOCKS.md:26-28`
- **问题描述：** 当前任务和任务文件仍为 `DRAFT`，三项锁仍为 `CLAIMED`，交接记录只有 `IDLE → DRAFT`。权威工作流要求开发交审时先完成合法的 `DRAFT → READY → IN_PROGRESS → READY_FOR_REVIEW` 迁移，并把锁转为 `HANDED_OFF`。任务文件还写“Module Lock：待认领”，与登记表的 `CLAIMED` 冲突。架构裁决按项目角色应由 Codex Architect 负责，当前 Owner 却为 Product Manager，且未记录技术裁决者或例外。
- **风险：** Reviewer 在 Owner 仍被记录为编写中且持有修改权时接手，违反独立交审和模块占用门禁；架构裁决责任边界不清。
- **最小修复方向：** 由正确的架构责任角色确认并记录裁决；补齐合法状态迁移、交接证据和提交/推送证据，将当前状态改为 `READY_FOR_REVIEW`，三项锁改为 `HANDED_OFF`，同步任务文件中的 Module Lock 信息。无需释放锁。

### A-002 — MAJOR — 本地开发基线直接违反固定 Windows/PowerShell 环境

- **文件及位置：** `docs/architecture/MVP-ARCHITECTURE-BASELINE.md:321,508-516`；`AGENTS.md:11-16`
- **问题描述：** 架构要求 WSL 2 Ubuntu、Cursor WSL、CLI 在 WSL、仓库位于 Linux 文件系统、.NET 安装在 WSL，并以“WSL 不可用”作为排除 LocalDB 的理由。`AGENTS.md` 明确规定 Windows、PowerShell、不使用 Linux、不使用 WSL，且所有命令必须能在 Windows PowerShell 运行。
- **风险：** TASK-0006 会建立违反项目固定环境的脚手架，Windows-only 开发者无法按基线执行，后续构建/测试证据失去权威性。
- **最小修复方向：** 删除全部 WSL/Linux 开发要求，改为 Windows + PowerShell + Windows 安装的 Node/npm/.NET/pwsh；确保所有列出的命令和工作目录可直接在 Windows PowerShell 执行。数据库选择理由应保持技术和需求导向，不依赖 WSL。

### A-003 — MAJOR — Cookie 认证尚未形成完整且安全的最小方案

- **文件及位置：** `docs/architecture/MVP-ARCHITECTURE-BASELINE.md:285-292,488-498,638-664,772,807`
- **问题描述：** 文档仅说明 User 表、PBKDF2、角色字符串和 Cookie 中间件。未裁决账号如何创建/初始化及后续如何维护；未明确密码哈希的随机盐、工作因子/迭代参数和验证机制；未描述登录验证后建立包含用户与角色声明的认证票据、注销如何使会话失效；未固定 Cookie 的 `HttpOnly`、`Secure`、`SameSite`、有效期/滑动过期和 CSRF 最小边界。TR-03 直接建议生产 `SameSite=None`，却未同时要求 `Secure`，且与生产同源静态托管基线不一致。
- **风险：** TASK-0007 无法据此实现可登录、可注销、可安全授权的确定方案；不同实现可能产生明文等价弱哈希、不可注销会话、跨站请求风险或首个管理员无法建立的问题。
- **最小修复方向：** 定义最小账号来源（例如受控种子账号及首次部署凭据注入/变更规则，不提交密码）、User 与单角色关系、采用受支持密码哈希器或明确盐和参数、登录签发 ClaimsPrincipal/Cookie、注销清除会话，以及 `HttpOnly`、HTTPS 下 `Secure`、适合单站点部署的 SameSite、有效期和基本 CSRF 策略。保持自定义最小认证，不引入 Identity Server、LDAP/AD/SSO 或完整 RBAC。

### A-004 — MAJOR — SQLite 最终一致性、事务和运维边界不完整

- **文件及位置：** `docs/architecture/MVP-ARCHITECTURE-BASELINE.md:259-265,297-345,590-596,792`
- **问题描述：** 单实例、本地磁盘、禁止 NFS/SMB、WAL 和不建多数据库层均已明确，但只有“移动”明确单事务。上架和下架同样需要位置、容量与 AuditRecord 原子提交。文档没有说明资产编号唯一索引如何处理可空值，也没有说明并发上架/移动在“查询空闲后写入”的竞争窗口中如何由后端短事务和数据库约束/写锁最终拒绝冲突。还未规定迁移前备份、常规最小备份/恢复原则，以及避免 SQLite 不适用的 Schema、Sequence、数据库生成并发令牌。测试反而把关系规则单元测试放在 EF Core InMemory，不能验证 SQLite 唯一性和事务语义。
- **风险：** 两个并发位置操作可能都通过预检查；失败时位置与审计可能部分提交；迁移失败缺少可恢复点；InMemory 测试可能产生假阳性。
- **最小修复方向：** 明确上架、移动、下架均使用短事务，事务内重新校验并处理 SQLite 写竞争；资产编号可空唯一性和当前在架位置/U 位冲突由 SQLite 可实现的索引/约束与事务策略最终保证，并映射可识别业务错误。规定本地文件备份、迁移前备份和恢复验证的最小原则；声明不使用 Schema、Sequence 或数据库生成并发令牌。关系/事务集成测试使用真实 SQLite，纯计算才使用无数据库单元测试。

### A-005 — MAJOR — 依赖预算自称完整但遗漏必需运行时、开发和测试依赖

- **文件及位置：** `docs/architecture/MVP-ARCHITECTURE-BASELINE.md:102-119,526-552,558-596,695-708`；`tasks/TASK-0005-MVP-ARCHITECTURE-BASELINE.md:70,127`
- **问题描述：** 第 18 节宣称三个包是“MVP 完整依赖预算上限”，但架构同时要求 Vue、Vite、TypeScript、Vue 插件、Vitest、前端测试运行器、xUnit、Microsoft.NET.Test.Sdk、EF Core 测试能力及 `dotnet ef`。预算没有区分前端运行时/开发依赖、后端运行时/设计时依赖、后端测试依赖；`Microsoft.EntityFrameworkCore.Design` 也被放在“新增运行时依赖”节内。`npx vitest run` 还可能临时下载未锁定版本。
- **风险：** TASK-0006/0007/0008 无法判断哪些依赖已批准；按三包上限会无法构建测试，按正文自行补包又违反依赖门禁。
- **最小修复方向：** 按五类列出最小直接依赖预算和用途：前端运行时、前端开发、后端运行时、后端设计时、后端测试。包含脚手架和测试实际需要的最小包/运行器，并使用 package script 执行已锁定 Vitest。继续明确排除 Axios、Pinia、AutoMapper、MediatR、FluentValidation、Serilog 和 UI 组件库。

### A-006 — MAJOR — 配置基线与仓库现状矛盾，敏感配置规则不可执行

- **文件及位置：** `docs/architecture/MVP-ARCHITECTURE-BASELINE.md:482-505`；`.gitignore:17-25`；`tasks/TASK-0005-MVP-ARCHITECTURE-BASELINE.md:36-56`
- **问题描述：** 架构规定 `appsettings.Development.json` 提交 Git，并声称 `appsettings.*.local.json` 被忽略；实际 `.gitignore` 恰好忽略 `appsettings.Development.json`，却没有忽略 `appsettings.*.local.json`。TASK-0005 又禁止修改 `.gitignore`，因此文档声称的配置基线无法由后续脚手架直接落实。数据库路径配置还放在被忽略文件中，没有定义可提交的示例配置如何提供。
- **风险：** TASK-0006 会在提交规则、开发默认配置和敏感信息保护之间无所适从，可能漏提交必要模板或误提交本地秘密。
- **最小修复方向：** 选择一种与仓库一致的最小方案：明确哪些非敏感示例文件提交、哪些本地覆盖忽略，并在获准任务中同步 `.gitignore`；不要把秘密或真实凭据放进示例。确保 SQLite 数据文件及 WAL/SHM 文件继续排除。

### A-007 — MAJOR — CRUD 和 API 细节超出产品/任务边界并造成追踪漂移

- **文件及位置：** `docs/architecture/MVP-ARCHITECTURE-BASELINE.md:160-164,238-248,780-791,809-811`；`tasks/TASK-0005-MVP-ARCHITECTURE-BASELINE.md:47,159,248-251`
- **问题描述：** 产品基线明确服务器删除不属于 MVP，但架构将 `/api/servers` 和 TASK-0011 定义为 Server CRUD；Room/Cabinet 也用 CRUD 泛化产品仅明确的创建、查看、编辑及特定保护规则。文档一方面声称本任务不设计 API 路径/方法，另一方面已经固定 `/api/...` 路径、查询字符串、Service 方法名和 endpoint 文件结构。已知限制又把“完整 API 契约”留给 TASK-0007，边界自相矛盾。
- **风险：** 后续实现可能新增服务器删除等未批准行为，或把未经审核的示例路径当成正式契约；TASK-0007 的 Architect 契约裁决空间被提前占用。
- **最小修复方向：** 将 CRUD 改为逐项列出产品已批准操作，明确服务器不删除；架构层只保留资源/职责边界和必须的业务结果，不固定路径、查询参数、方法名或 endpoint 文件名。由 TASK-0007 按 Architect 管理的 API 契约任务统一裁决并追踪到 FR/AC。

### A-008 — MAJOR — 后续任务拆分存在安全顺序和模块锁冲突

- **文件及位置：** `docs/architecture/MVP-ARCHITECTURE-BASELINE.md:804-818`
- **问题描述：** TASK-0007 同时包含 6 个实体、DbContext、初始迁移、Cookie 认证、登录和种子账号，范围偏大。更关键的是，TASK-0009 至 TASK-0014 会创建修改端点，而完整四角色/匿名拒绝被推迟到 TASK-0015；这会让中间任务缺少 NFR-007 验收边界。建议并行的 TASK-0010/TASK-0011 都声明修改 `src/backend/`，TASK-0014/TASK-0015 也都修改后端及服务器列表/认证相关前端，按父子路径锁规则必然冲突。
- **风险：** 独立任务无法在提交时满足安全验收；并行执行会违反模块锁；大型 TASK-0007 难以独立审核和定位缺陷。
- **最小修复方向：** 把最小认证/授权基础设施安排在任何受保护业务端点之前，并使每个业务任务同时满足匿名及角色拒绝；细化预计修改路径或改为串行依赖，确保并行项无父子路径重叠；必要时把 TASK-0007 的数据骨架与认证骨架拆开，但不要增加任务之外的功能。

### A-009 — MINOR — 二维视图渲染边界和性能调整门禁仍不够明确

- **文件及位置：** `docs/architecture/MVP-ARCHITECTURE-BASELINE.md:192-225,770,812`
- **问题描述：** 单机柜路由和 60 个 div 暗示只渲染当前机柜，但文档未明确“机柜列表只显示摘要、U 位网格只渲染当前选中的一个机柜”，也未明确禁止一次渲染 200×60 U 位。TR-02 预先建议 `will-change` 或虚拟滚动，且未要求实测失败和 Change Request，与第 17 节“不提前优化”不一致。
- **风险：** 前端任务可能误解为列表内展开全部机柜，或未经性能证据增加虚拟列表复杂度。
- **最小修复方向：** 明确列表仅摘要、网格仅当前单机柜；MVP 不引入 Canvas、SVG、虚拟列表或 `will-change` 优化。只有 AC-018 实测失败且 Change Request 获批后才调整架构。

## 5. Product-to-architecture traceability

| 检查项 | 结论 | 说明 |
|---|---|---|
| FR-001 至 FR-012 编号覆盖 | PASS（形式） | 第 21 节逐项列出 12 个 FR |
| NFR-001 至 NFR-007 编号覆盖 | PASS（形式） | 第 21 节逐项列出 7 个 NFR |
| 业务含义保持 | FAIL | Server CRUD 暗含产品明确排除的服务器删除；见 A-007 |
| 30 条 BR 技术落脚 | PARTIAL | 声称全部在 Service，但事务/数据库最终约束对 BR-007、BR-010/011、上架/下架不完整；见 A-004 |
| 37 条 AC 支撑 | PARTIAL | 认证、SQLite、配置和测试缺口使 AC-020、AC-032、AC-035/036、AC-037 等无法稳定落地 |
| 登录、角色、位置记录、二维视图、性能 | PARTIAL | 均有架构章节，但认证闭环与二维渲染边界不完整 |
| 新功能 | FAIL | 泛化 CRUD 可能新增服务器删除；其余非目标总体保持 |

总体结论：编号级追踪完整，但语义和可实现性追踪不完整，不能满足 AC-ARCH-01 至 AC-ARCH-04。

## 6. Authentication and authorization assessment

角色矩阵与产品基线一致：机房管理员和运维人员可读写，DBA/应用运维人员和只读查看人员只读，匿名无权；前端显隐不替代后端授权也已明确。没有引入完整 RBAC、LDAP、AD、SSO 或 Identity Server。

但账号来源、受控初始化、密码哈希参数、登录票据、注销失效、Cookie 安全属性、会话期限与 CSRF 未闭环，结论为 **FAIL（MAJOR，A-003）**。当前不能作为 TASK-0007 的可实现安全基线。

## 7. SQLite assessment

通过项：单后端实例、本地文件、禁止 NFS/SMB、WAL、前端不直连、不建多数据库层、MySQL 仅为 Change Request 条件。

未通过项：上架/下架短事务、并发 U 位最终拒绝、可空资产编号唯一约束、迁移前备份/恢复、Schema/Sequence/并发令牌限制和 SQLite 真实集成测试未完整定义。结论为 **FAIL（MAJOR，A-004）**。

## 8. Frontend and 2D view assessment

Vue 3、TypeScript、Vite、Vue Router、composables、fetch 和 HTML/CSS div 网格是满足 MVP 的最简组合。U1 顶部、向下递增、连续占用合并、空闲/占用双重视觉标记均已说明，未引入 Canvas/SVG。

缺少“只渲染当前单机柜、列表只摘要”的明确边界，并提前提到虚拟滚动/`will-change`，结论为 **PARTIAL（MINOR，A-009）**。

## 9. Dependency budget assessment

结论：**FAIL（MAJOR，A-005）**。三项“完整上限”与 Vue/Vite/TypeScript/xUnit/Vitest 等已批准要求矛盾，且未按运行时、开发时、设计时和测试依赖分类。审核未要求引入 Axios、Pinia、AutoMapper、MediatR、FluentValidation、Serilog 或 UI 组件库。

## 10. Testing and performance assessment

- 产品 NFR-002 / AC-018 的 1 个机房、200 个 60U 机柜、10000 台 1U 服务器、每柜 50 台、网络/硬件、预热 1 次、测量 5 次、中位数不超过 3 秒且至少 4 次不超过 3 秒均保持一致。
- 没有设定 100% 覆盖率，也没有提前实现缓存或索引优化。
- 测试层次形式上区分 Vitest、xUnit 单元、SQLite 集成和手工 E2E。
- 核心规则清单覆盖 U 位范围/冲突、上架、移动、下架、停用机房/机柜、资产编号和角色；匿名读取/修改拒绝未被明确列为独立测试，且 InMemory 不适合验证 SQLite 唯一性/事务。
- `dotnet test` 两行没有过滤器或独立项目，不能实际区分单元与集成命令；`npx vitest` 可能绕过锁定依赖。

性能口径 **PASS**；测试可执行性与数据库真实性 **PARTIAL**，其修复纳入 A-004、A-005。

## 11. Workflow assessment

| 检查项 | 结果 |
|---|---|
| TASK-0005 状态值合法 | PASS（`DRAFT` 是合法值） |
| 已达到正式审核状态 | FAIL（应为 `READY_FOR_REVIEW`） |
| 模块锁适合 Reviewer 接手 | FAIL（仍为 `CLAIMED`，应为 `HANDED_OFF`） |
| Owner / Reviewer 独立 | PASS（身份不同） |
| 架构裁决责任角色 | FAIL（未记录 Codex Architect 的技术裁决责任） |
| TASK-0004 保持关闭 | PASS |
| TASK-0006 未启动 | PASS |

总体结论：**FAIL（MAJOR，A-001）**。

## 12. Overdevelopment assessment

正面确认：单体、单实例 SQLite、内置日志、手动映射、无 repository 抽象、无 DDD、无缓存/队列/搜索/容器/云服务/完整 RBAC，主体方案保持简单。

问题：提前固定 API 路径、查询参数、Service 方法、endpoint 文件并使用超范围 CRUD；为未证实的 60U 渲染问题预留虚拟滚动；允许后续自行选择 Tailwind 会新增未预算依赖。删除这些内容不影响当前 FR/NFR，属于应收敛的额外设计。总体结论：**PARTIAL**，主要由 A-007（MAJOR）和 A-009（MINOR）覆盖。

## 13. Validation results

| 验证项 | 命令/方法 | 结果 |
|---|---|---|
| 审核前工作区 | `git status --porcelain=v1` | CLEAN |
| 分支 | `git branch --show-current` | `docs/task-0005-architecture-baseline` |
| HEAD | `git rev-parse HEAD` | `fc576de057873c5c238024c18b7db8f8ba41473e` |
| HEAD/远端一致 | 比较 HEAD 与 `origin/docs/task-0005-architecture-baseline` | PASS，完全一致 |
| 工作流校验 | `pwsh -NoLogo -NoProfile -File ./scripts/validate-agent-workflow.ps1` | PASS=20，FAIL=0，TOTAL=20，退出码 0 |
| 工作区 whitespace | `git diff --check` | PASS，退出码 0 |
| 提交 whitespace | `git diff fc576de^ fc576de --check` | PASS，退出码 0 |
| 提交文件范围 | `git diff-tree --no-commit-id --name-status -r fc576de` | PASS：仅 4 个允许文件 |
| 业务代码/脚手架/依赖/迁移/数据库脚本 | 提交文件清单与完整 diff | PASS：均未出现 |
| 产品基线完整性 | 提交文件清单 | PASS：未修改 |
| Reviewer 受保护文件 | 写报告前后差异核对 | PASS：Reviewer 只新增本报告 |

20/20 脚本只证明状态值和结构关键字存在，不证明 `DRAFT` 已合法进入审核状态，也不能发现上述架构语义缺口。

## 14. Final verdict

**NEEDS_CHANGES**

问题统计：BLOCKER 0、MAJOR 8、MINOR 1、NOTE 0。

当前不满足 PASS 条件：认证与角色方案不可完整实现、SQLite 一致性和运维边界不完整、依赖预算矛盾、二维视图边界存在 MINOR、工作流状态/锁错误，且有固定开发环境冲突和产品/API 范围漂移。TASK-0005 不得关闭，不得进入 TASK-0006。

最小修订应仅针对 A-001 至 A-009，不新增框架、依赖或产品功能；修复者按权威工作流重新认领后进入 `IN_FIX`，完成回归与交接后以 `READY_FOR_RETEST` / `HANDED_OFF` 交同一独立 Reviewer 复审。

## 15. Completion report fields

| 字段 | 内容 |
|---|---|
| Task ID | TASK-0005 |
| 最终状态 | CHANGES_REQUESTED（审核结论；Reviewer 未修改受保护状态文件） |
| 当前分支 | `docs/task-0005-architecture-baseline` |
| Owner | Claude + DeepSeek Product Manager（A-001 要求澄清架构裁决责任） |
| Reviewer | Codex Reviewer |
| 修改文件 | `reviews/architecture/MVP-ARCHITECTURE-BASELINE-REVIEW-TASK-0005.md` |
| 实现/审核内容 | 独立审核产品追踪、技术栈、SQLite、认证、二维视图、依赖、职责、开发部署、测试性能、任务拆分、工作流和防过度开发 |
| 构建命令与结果 | N/A：纯文档审核，无业务构建产物 |
| 测试命令与结果 | 工作流 20/20 PASS；`git diff --check` PASS；架构语义审核发现 9 项问题 |
| 验收证据 | 本报告第 4 至第 13 节 |
| 审核结论 | NEEDS_CHANGES |
| 缺陷与修复/复审结果 | 0 BLOCKER / 8 MAJOR / 1 MINOR / 0 NOTE；等待修复和复审 |
| Change Request | N/A：修复应收敛至现有产品和任务范围，无需扩展范围 |
| 提交说明 | `review: assess task-0005 mvp architecture baseline` |
| 提交哈希 | 报告提交后在最终回复记录 |
| 推送结果 | 推送后在最终回复记录 |
| 本地哈希 | 推送后在最终回复记录 |
| 远端哈希 | 推送后在最终回复记录 |
| 模块锁释放证据 | N/A：NEEDS_CHANGES，禁止释放 TASK-0005 锁 |
| 已知限制 | N/A：已完成要求范围内的文档、diff 和可执行校验审核 |
| 最终完成条件 | 未满足：存在开放 MAJOR/MINOR，工作流未正式交审，不允许进入 TASK-0006 |
