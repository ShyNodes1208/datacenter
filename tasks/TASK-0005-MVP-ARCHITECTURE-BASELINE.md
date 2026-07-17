# TASK-0005：机房服务器落位图 MVP 技术架构与开发基线

## 基本信息

- Task ID：TASK-0005
- Task Name：机房服务器落位图 MVP 技术架构与开发基线
- Status：COMPLETED
- Owner：Claude + DeepSeek Product Manager
- Reviewer：Codex Reviewer
- Branch：docs/task-0005-architecture-baseline
- Requirement Source：hangyu 提出的企业机房服务器落位可视化需求
- Product Baseline：docs/product/MVP-PRODUCT-BASELINE.md（TASK-0004，COMPLETED，PASS）
- Architecture Reference：docs/architecture/MVP-ARCHITECTURE-BASELINE.md（本任务产出）
- Module Lock：RELEASED（TASK-0005 三项锁已释放；任务完成）

## Reviewer 独立性检查

- Owner 与 Reviewer 不同：是（Claude + DeepSeek Product Manager ≠ Codex Reviewer）
- 修复者与最终 Reviewer 不同：N/A：本任务为新建基线，非修复任务
- 例外原因：N/A
- hangyu 批准记录：N/A
- 补偿性复审方式：N/A

## 前置条件

- [x] 产品基线已批准：TASK-0004 已 COMPLETED，审核 PASS
- [x] Owner/Reviewer 独立性已检查：是
- [x] 模块父子路径冲突已检查：docs/architecture/、tasks/current-task.md、tasks/MODULE-LOCKS.md 无活跃占用
- [x] 其他前置条件：无

## 允许修改

- docs/architecture/MVP-ARCHITECTURE-BASELINE.md
- docs/architecture/（新增架构文档）
- tasks/TASK-0005-MVP-ARCHITECTURE-BASELINE.md
- tasks/current-task.md
- tasks/MODULE-LOCKS.md
- tasks/CR-0001-WSL-DEV-ENVIRONMENT.md（新增 Change Request）
- AGENTS.md（第 2 节：经 CR-0001 批准的开发环境更新）
- .gitignore（A-006 审核修复：配置规则一致性）

## 禁止修改

- docs/product/MVP-PRODUCT-BASELINE.md（产品基线）
- reviews/（所有审核报告）
- src/（无业务代码）
- tests/（无业务代码）
- scripts/validate-agent-workflow.ps1（工作流校验脚本）
- agents/
- docs/architecture/AGENT-WORKFLOW.md
- tasks/TASK-TEMPLATE.md
- tasks/TASK-EXAMPLE.md
- tasks/TASK-0001-REVIEW-AGENT-WORKFLOW.md
- tasks/TASK-0002-FIX-AGENT-WORKFLOW.md
- tasks/TASK-0003-ANTI-OVERDEVELOPMENT-GUARDRAILS.md
- tasks/TASK-0004-PRODUCT-BASELINE.md
- tasks/blocked/
- tasks/completed/
- README.md

## 功能要求

1. 定义 MVP 系统边界：包含 Web 前端、后端 API、数据持久化、认证和角色校验。
2. 确定技术栈基线：Vue 3 + TypeScript + Vite（前端）、.NET 8 + ASP.NET Core Web API（后端）、SQLite + EF Core 8（数据）。
3. 明确前后端职责边界：哪些校验在前端（仅用户体验）、哪些在后端（安全强制）。
4. 确定最小数据持久化方向：SQLite 单文件、WAL 模式、EF Core 8、本地磁盘。
5. 定义最小领域边界：6 个实体（Room、Cabinet、Server、ServerPosition、User、AuditRecord），无 DDD 分层。
6. 定义项目目录基线：`src/frontend/`、`src/backend/`、`tests/frontend/`、`tests/backend/`。
7. 定义配置和敏感信息规则：appsettings 分层、.gitignore 排除 .db 和 .local.json。
8. 定义本地开发流程：启动命令、构建命令、测试命令、环境检查。
9. 定义测试基线：xUnit 后端单元测试和集成测试、Vitest 前端测试、核心 BR 必须覆盖。
10. 定义日志和错误处理：ILogger、统一错误 JSON 响应、审计记录不可变。
11. 定义性能验收支撑方式：不重新定义基准，只描述执行方式。
12. 拆分后续开发任务：11 个可独立审核的开发任务（TASK-0006 至 TASK-0016）。

## 非功能要求

1. 不引入完整 UI 组件库、状态管理库、对象映射框架或中介器框架。
2. 不设计数据库集群、高可用、分库分表或多数据库兼容层。
3. 不引入消息队列、分布式缓存、搜索引擎或容器编排。
4. 不设计完整 RBAC 权限引擎、LDAP/AD/SSO 集成。
5. 不引入 ELK、OpenTelemetry、分布式追踪或监控平台。
6. 所有架构裁决必须有明确理由和排除分析。
7. 架构基线必须在技术层面可追踪到产品基线的全部 FR 和 NFR。

## 范围与非目标

- 最小实现范围：1 个架构基线文档 + 1 个任务文件 + current-task.md 和 MODULE-LOCKS.md 更新。
- 明确不实现范围：业务功能代码、项目脚手架、数据库迁移、API Controller、Vue 页面、任何 `src/` 或 `tests/` 下的代码文件。
- 推迟到未来的内容：3D 架构设计、微服务拆分、多数据库支持、完整 CI/CD、容器化部署方案。

## 需求追踪矩阵

| 实现项 | Requirement Source | 要求类型与编号 | 验收标准编号 |
|---|---|---|---|
| MVP 系统边界定义（第 4 节） | hangyu 机房落位可视化需求 | FR-001~012（全部） | AC-ARCH-01 |
| 技术栈基线（第 5 节） | hangyu 机房落位可视化需求 | NFR-002, NFR-003, NFR-006 | AC-ARCH-02 |
| 数据持久化方向（第 9 节） | hangyu 机房落位可视化需求 | NFR-001, NFR-005 | AC-ARCH-03 |
| 前后端职责边界（第 7-8 节） | hangyu 机房落位可视化需求 | FR-001~012, NFR-001, NFR-004, NFR-007 | AC-ARCH-01, AC-ARCH-04 |
| 最小领域边界（第 10 节） | hangyu 机房落位可视化需求 | FR-001~012 | AC-ARCH-05 |
| 项目目录基线（第 11 节） | hangyu 机房落位可视化需求 | 全部 FR, NFR | AC-ARCH-14 |
| 配置和密钥规则（第 12 节） | hangyu 机房落位可视化需求 | NFR-007 | AC-ARCH-14 |
| 本地开发流程（第 13 节） | hangyu 机房落位可视化需求 | NFR-002 | AC-ARCH-06 |
| 测试基线（第 14 节） | hangyu 机房落位可视化需求 | NFR-001, NFR-004, NFR-005 | AC-ARCH-07 |
| 日志和错误处理（第 15 节） | hangyu 机房落位可视化需求 | NFR-004, NFR-005 | AC-ARCH-14 |
| 安全与权限边界（第 16 节） | hangyu 机房落位可视化需求 | FR-012, NFR-007 | AC-ARCH-08 |
| 性能验收支撑（第 17 节） | hangyu 机房落位可视化需求 | NFR-002 | AC-ARCH-09 |
| 明确不实现内容（第 19 节） | hangyu 机房落位可视化需求 | 全部 FR, NFR | AC-ARCH-10 |
| 依赖预算（第 18 节） | hangyu 机房落位可视化需求 | 全部 FR, NFR | AC-ARCH-11 |
| 后续开发任务拆分（第 22 节） | hangyu 机房落位可视化需求 | 全部 FR, NFR | AC-ARCH-12 |

每个实现至少映射一个 FR 或 NFR。

## 复杂度预算

- 允许新增依赖：0（纯文档任务，不引入任何运行时或设计时依赖）
- 允许新增抽象：0（不创建任何接口、基类或抽象层）
- 允许修改的数据模型：N/A：本任务不编写代码，不设计物理数据模型
- 允许修改的 API 契约：N/A：本任务不设计 API 路径或方法签名
- 预计修改文件或目录范围：
  - docs/architecture/MVP-ARCHITECTURE-BASELINE.md（新增）
  - tasks/TASK-0005-MVP-ARCHITECTURE-BASELINE.md（新增，本文件）
  - tasks/current-task.md（更新）
  - tasks/MODULE-LOCKS.md（更新）
- 复杂方案采用理由：N/A：本任务使用最简单的架构基线文档结构

## 验收标准

- [x] AC-ARCH-01：架构覆盖全部 12 项 FR。文档第 21 节追踪关系表将每项 FR 映射到至少一个架构落脚点。
- [x] AC-ARCH-02：架构覆盖全部 7 项 NFR。文档第 21 节追踪关系表将每项 NFR 映射到至少一个架构落脚点。
- [x] AC-ARCH-03：架构未修改产品基线的任何 BR、FR、NFR 或 AC 的业务含义。
- [x] AC-ARCH-04：文档第 7 节和第 8 节明确区分前端职责和后端职责，BR 校验归属明确。
- [x] AC-ARCH-05：文档第 9 节和第 10 节确定 SQLite 为数据存储方案，6 个实体职责和关系清晰，选择理由和排除项完整。
- [x] AC-ARCH-06：文档第 13 节给出前端启动、后端启动、构建和测试的可执行命令及工作目录。
- [x] AC-ARCH-07：文档第 14 节定义后端单元测试、后端集成测试和前端测试的框架与覆盖范围，至少 12 条核心 BR 被列出为必测项。
- [x] AC-ARCH-08：文档第 16 节与产品基线 NFR-007、AC-020、AC-037 的角色矩阵一致，匿名访问全页面拒绝。
- [x] AC-ARCH-09：文档第 17 节未重新定义产品基线的数据规模、硬件边界、网络条件、计时范围、重复次数、统计口径或 3 秒阈值，仅描述执行方式。
- [x] AC-ARCH-10：文档第 19 节明确列出不实现的功能、架构能力和运维能力。
- [x] AC-ARCH-11：文档第 18 节列出所有已批准的运行时依赖和明确不引入的依赖类型，每个依赖有理由。
- [x] AC-ARCH-12：文档第 22 节将后续开发拆分为至少 8 个独立任务，每个任务有范围摘要、前置依赖和预计修改目录。
- [x] AC-ARCH-13：未包含任何业务代码文件、数据库迁移文件、API Controller、Vue 页面或项目脚手架。
- [x] AC-ARCH-14：未出现 MVP 范围扩张（如 3D、实时监控、微服务、消息队列、完整 RBAC、CMDB 同步等）。
- [x] AC-ARCH-15：工作流校验 20/20 PASS、退出码 0；`git diff --check` PASS。

## 构建命令

```powershell
# N/A：纯文档任务，无构建产物
```

## 构建结果

- 命令：N/A
- 退出码：N/A
- 摘要/证据：N/A：纯文档任务，无代码构建

## 测试命令

```powershell
# N/A：纯文档任务，无测试代码
```

## 测试结果

- 命令：N/A
- 退出码：N/A
- 摘要/证据：N/A：纯文档任务，无可执行测试

## 开发完成证据

- 修改文件：
  - docs/architecture/MVP-ARCHITECTURE-BASELINE.md（新增）
  - tasks/TASK-0005-MVP-ARCHITECTURE-BASELINE.md（新增，本文件）
  - tasks/current-task.md（更新）
  - tasks/MODULE-LOCKS.md（更新）
- 验收证据：架构基线覆盖全部 12 FR 和 7 NFR（第 21 节追踪矩阵）；前后端职责明确（第 7、8 节）；SQLite 方向确定（第 9 节）；6 个实体边界清晰（第 10 节）；11 个后续任务已拆分（第 22 节）
- 模块锁状态：RELEASED（TASK-0005 三项锁已释放；最终复审 PASS）
- 已知限制：API 仅定义资源边界和产品已批准操作，完整路径和方法签名由 TASK-0007 定义；实体仅定义职责和关系，完整字段列表由 TASK-0007 定义
- 关闭日期：2026-07-17
- 最终状态：COMPLETED
- 最终复审报告：reviews/architecture/MVP-ARCHITECTURE-BASELINE-RETEST-3-TASK-0005.md
- 最终复审提交：030098ad42fe4129739fbb915a49a605683ea8d7

## 交接记录

| 时间 | 发起者 | 原状态 | 新状态 | 接收者 | 证据/说明 |
|---|---|---|---|---|---|
| 2026-07-17 | Claude + DeepSeek Product Manager | IDLE | DRAFT | — | TASK-0004 COMPLETED；创建 TASK-0005 草案 |
| 2026-07-17 | Claude + DeepSeek Product Manager | DRAFT | READY | — | 架构基线完成；15 条 AC 可验证；工作流 20/20 PASS |
| 2026-07-17 | Claude + DeepSeek Product Manager | READY | IN_PROGRESS | — | 模块冲突检查通过；三项锁 CLAIMED |
| 2026-07-17 | Claude + DeepSeek Product Manager | IN_PROGRESS | READY_FOR_REVIEW | Codex Reviewer | 架构基线交审（提交 fc576de）；三项锁 HANDED_OFF |
| 2026-07-17 | Codex Reviewer | READY_FOR_REVIEW | CHANGES_REQUESTED | Claude + DeepSeek Product Manager | 初次审核 bdd5a38：8 MAJOR / 1 MINOR（A-001~A-009） |
| 2026-07-17 | Claude + DeepSeek Product Manager | CHANGES_REQUESTED | IN_FIX | — | 确认 A-001 至 A-009 修复范围；重新 CLAIMED |
| 2026-07-17 | Claude + DeepSeek Product Manager | IN_FIX | READY_FOR_RETEST | Codex Reviewer | 第一轮修复（提交 5a88157）；CR-0001 已记录；三项锁 HANDED_OFF |
| 2026-07-17 | Codex Reviewer | READY_FOR_RETEST | CHANGES_REQUESTED | Claude + DeepSeek Product Manager | 第一次复审 bfc2735：4 MAJOR / 1 MINOR（R-001~R-005） |
| 2026-07-17 | Claude + DeepSeek Product Manager | CHANGES_REQUESTED | IN_FIX | — | 确认 R-001 至 R-005 修复范围；重新 CLAIMED |
| 2026-07-17 | Claude + DeepSeek Product Manager | IN_FIX | READY_FOR_RETEST | Codex Reviewer | 第二轮修复完成；A-001~A-005 全部 RESOLVED；三项锁 HANDED_OFF |
| 2026-07-17 | Codex Reviewer | READY_FOR_RETEST | CHANGES_REQUESTED | Claude + DeepSeek Product Manager | 第二次复审 1bec2cf：1 MAJOR（R2-001） |
| 2026-07-17 | Claude + DeepSeek Product Manager | CHANGES_REQUESTED | IN_FIX | — | 确认 R2-001 修复范围；重新 CLAIMED |
| 2026-07-17 | Claude + DeepSeek Product Manager | IN_FIX | READY_FOR_RETEST | Codex Reviewer | 第三轮修复（3ca1ad4）：认证基线最终化；三项锁 HANDED_OFF |
| 2026-07-17 | Codex Reviewer | READY_FOR_RETEST | COMPLETED | — | 最终复审 030098a：**PASS**；0 BLOCKER / 0 MAJOR / 0 MINOR / 0 NOTE；全部 RESOLVED |

## 审核结论

- Reviewer：Codex Reviewer
- 结论：**PASS**（最终复审，提交 030098ad42fe4129739fbb915a49a605683ea8d7）
- 最终复审报告：reviews/architecture/MVP-ARCHITECTURE-BASELINE-RETEST-3-TASK-0005.md
- 审核命令和证据：工作流 20/20 PASS；`git diff --check` PASS；A-001~A-009 + R2-001 全部 RESOLVED

## 缺陷清单

| 缺陷 ID | 等级 | 证据/复现 | 修复要求 | 状态 |
|---|---|---|---|---|
|  |  |  |  |  |

## 缺陷修复记录

| 缺陷 ID | 修复者 | 修改说明 | 回归证据 | 提交 |
|---|---|---|---|---|
|  |  |  |  |  |

## 复审结果

- 最终 Reviewer：Codex Reviewer
- 复审结论：**PASS**（最终复审报告：reviews/architecture/MVP-ARCHITECTURE-BASELINE-RETEST-3-TASK-0005.md）
- 关闭缺陷及证据：
  - A-001 至 A-009：全部 RESOLVED（最终复审确认）
  - R2-001：RESOLVED（最终复审确认）
  - 问题统计：BLOCKER 0 / MAJOR 0 / MINOR 0 / NOTE 0
  - 最终报告明确允许关闭 TASK-0005
  - 最终报告明确允许在正式关闭后进入 TASK-0006

## 防过度开发检查

- 是否存在验收标准以外的实现：否（纯文档任务，无代码实现）
- 是否提前实现未来需求：否（3D、实时监控、CMDB、微服务等均在"明确不实现"中排除）
- 是否新增未批准依赖：否（0 个新增依赖）
- 是否存在无实际需求的抽象：否（无仓储接口、无 DDD 分层、无 Common/SharedKernel/Infrastructure 目录）
- 是否存在无关重构：否（纯新建文档，无既有代码可重构）
- 是否采用最简单可行方案：是（单体应用、SQLite、Cookie Auth、HTML/CSS 二维视图、手动映射、内置日志）
- Reviewer 结论：**PASS**（Codex Reviewer 最终复审确认：无业务代码、无项目脚手架、无运行时依赖安装、无数据库/SQL/Migration、无用户管理功能、无服务器删除、无批量导入、无 3D/监控/缓存/消息队列/微服务、无多数据库兼容层、无产品范围扩张、无未经批准的抽象）

## Change Request

- Change Request ID：N/A
- 发现者：N/A
- 原任务：N/A
- 变更原因：N/A
- 产品范围影响：N/A
- 技术影响：N/A
- 文件影响：N/A
- 测试影响：N/A
- 风险：N/A
- Claude 裁决：N/A
- Architect 裁决：N/A
- 更新后的 Requirement Source：N/A
- 批准状态：N/A

## Git 提交与推送

- 架构基线提交说明：docs: define task-0005 mvp architecture baseline（提交 fc576de）
- TASK-0005 正式关闭提交：ccda1c0fdd2e3c480c4585d0044a2957a34a1bf3
- 关闭提交说明：chore: close task-0005 architecture baseline
- 关闭提交推送结果：成功
- 关闭时本地分支哈希：ccda1c0fdd2e3c480c4585d0044a2957a34a1bf3
- 关闭时远端任务分支哈希：ccda1c0fdd2e3c480c4585d0044a2957a34a1bf3
- 关闭时本地与远端：一致

## 已知限制

- API 端点仅定义资源分组，完整 API 契约（路径、方法、请求/响应体）由 TASK-0007 定义。
- 实体仅定义职责、关键标识和关系，完整字段列表和数据库列映射由 TASK-0007 定义。
- 前端 CSS 方案（纯 CSS / Tailwind / CSS Modules）由 TASK-0008 决定。
- API 风格已在 TASK-0005 确定为 ASP.NET Core Controllers；TASK-0007 负责按该裁决实现后端基础和认证骨架。

## 最终完成条件

- [x] 独立 Reviewer 验收或复审通过（Codex Reviewer 最终复审 PASS，提交 030098a）
- [x] 验收标准全部通过（AC-ARCH-01 至 AC-ARCH-15）
- [x] 所有缺陷关闭（A-001~A-009 + R2-001 全部 RESOLVED；BLOCKER/MAJOR/MINOR/NOTE 清零）
- [x] 构建和测试通过或有批准的 N/A（纯文档任务，N/A）
- [x] 工作流校验和 `git diff --check` 通过（20/20 PASS，退出码 0）
- [x] 模块锁已释放（TASK-0005 三项锁 RELEASED）
- [x] 已提交并推送（关闭提交 ccda1c0，已推送当前分支）
- [x] 工作区干净
- [x] 本地与远端哈希一致（ccda1c0fdd2e3c480c4585d0044a2957a34a1bf3）
- [x] Reviewer 的防过度开发专项检查通过（PASS）
- [x] 状态由 Reviewer 转为 `COMPLETED`（最终复审 030098a 明确允许关闭 TASK-0005）
