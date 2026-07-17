# TASK-0004 MVP 产品基线审核报告

## 1. Review metadata

| 项目 | 内容 |
|---|---|
| Task ID | TASK-0004 |
| Review type | 独立产品基线审核 |
| Reviewer | Codex Reviewer |
| Owner | Claude + DeepSeek Product Manager |
| Review date | 2026-07-17（Asia/Shanghai） |
| Branch | `docs/task-0004-product-baseline` |
| Baseline commit | `c5bf8e896cc39f9520d02a25cb18b5be6d5b3393` |
| Requirement Source | hangyu 提出的企业机房服务器落位可视化需求 |
| Review scope | 产品目标与 MVP 边界；FR/NFR/AC/BR/PAGE 一致性；可测试性；范围与过度规划；进入架构阶段的就绪度 |
| Independence | Reviewer 未参与被审核基线编写，未修改被审核文件 |

## 2. Reviewed files and commit

审核了以下文件及规则：

- `AGENTS.md`
- `docs/architecture/AGENT-WORKFLOW.md`
- `agents/codex-reviewer.md`
- `tasks/current-task.md`
- `tasks/MODULE-LOCKS.md`
- `tasks/TASK-0003-ANTI-OVERDEVELOPMENT-GUARDRAILS.md`
- `tasks/TASK-0004-PRODUCT-BASELINE.md`
- `docs/product/MVP-PRODUCT-BASELINE.md`
- `scripts/validate-agent-workflow.ps1`
- 既有 TASK-0002/TASK-0003 Review 与 Retest 报告（用于审核格式和门禁参考）

审核对象为提交 `c5bf8e8`。该提交相对父提交新增产品基线，并修改 `tasks/current-task.md` 与 `tasks/MODULE-LOCKS.md` 完成交审。审核开始时 HEAD 与 `origin/docs/task-0004-product-baseline` 均指向该提交，工作区干净。

## 3. Executive conclusion

**结论：NEEDS_CHANGES。**

产品目标、二维优先的 MVP 边界、核心落位流程和明确非目标总体清楚，未发现数据库、API、Three.js 或业务代码设计，也未发现把 backlog 当作当前交付的明显过度规划。但是，基线尚未形成可直接交给架构任务的完整、可验证闭环：多项已声明的核心行为没有 AC，角色权限边界仍把产品裁决留给架构，追踪矩阵存在错误映射，性能标准缺少可复现条件，并有一处移动规则自相矛盾。

本次共记录 **0 BLOCKER、4 MAJOR、3 MINOR、2 NOTE**。MAJOR 未关闭前，不应进入下一阶段的正式技术架构任务。

## 4. Findings

### F-001 — MAJOR — 核心功能声明未被验收标准完整覆盖

- **文件与位置：** `docs/product/MVP-PRODUCT-BASELINE.md` 第 67-84、564-823、885-910 节（尤其第 568、589、608、701、733、795、817 行）
- **问题描述：** 多个 FR 的 AC 只覆盖部分行为。FR-001/FR-002 声明查看和编辑，但 AC-001~003 主要验证创建；FR-003 名称/IP/资产编号唯一性及编辑未验收；FR-007 声明八类查询条件，AC-012 只验证名称和 IP；FR-008 的点击查看概要、方向和加载失败未验收；FR-011 声明有权限用户可人工更新运行状态，AC-016 只验证展示；FR-012 声明修改 U 位总数不得导致占用超限，AC-017 只验证删除保护。
- **风险：** 后续架构与开发无法判断哪些声明属于必交付行为；实现只满足现有 AC 仍可能遗漏核心 FR，违反“重要功能必须有可执行验收标准”和可追踪性门禁。
- **建议修改方向：** 由产品 Owner 为每个当前 MVP 必须行为补充可观察的正向、拒绝或边界 AC；若某行为并非 MVP 必须项，则从 FR/页面职责/成功标准中移除或明确推迟，保持最小范围。

### F-002 — MAJOR — 基础角色权限缺少产品裁决且与安全要求覆盖不一致

- **文件与位置：** `docs/product/MVP-PRODUCT-BASELINE.md` 第 146-161、877-881、909-910、962-963 行
- **问题描述：** 四个角色已列出，但“运维人员根据授权”“DBA/应用运维查看所负责服务器”未定义可判定边界；匿名只读是否允许被留给架构决定。NFR-007 要求未登录或只读用户的所有创建、编辑和位置修改均被拒绝，AC-020 却仅验证位置操作。TC-06/TC-07 仍直接影响身份与权限范围。
- **风险：** 权限和数据可见性属于产品规则；让架构自行决定会造成不同页面、接口与验收口径不一致，也可能产生不必要的权限体系设计或安全缺口。
- **建议修改方向：** 产品 Owner 明确 MVP 的最小权限矩阵（至少按角色列出查看、基础信息修改、位置修改范围）及匿名访问结论，并让 AC 覆盖所有声明的修改类别；无需引入完整 RBAC。

### F-003 — MAJOR — 需求追踪矩阵存在错误映射和缺失规则

- **文件与位置：** `docs/product/MVP-PRODUCT-BASELINE.md` 第 477-540、912-934 行
- **问题描述：** FR-001 映射到 BR-001，但 BR-001 是“同一机房内机柜编号唯一”，并非机房规则；机房名称唯一、机房/机柜停用限制没有对应 BR。FR-012 包含编辑 U 位总数保护，但矩阵只映射 BR-017/BR-018，未映射或定义该编辑保护规则。BR-025 的触发场景写为查看状态，却规定人工维护/更新行为。
- **风险：** Architect 无法依据矩阵可靠确定规则归属，容易遗漏状态约束或把错误规则带入模型与接口设计；当前“FR、BR、PAGE、AC 已闭环”的结论不成立。
- **建议修改方向：** 逐项复核 FR→BR→PAGE→AC 映射；为已批准且确属 MVP 的机房唯一性、停用限制和 U 位总数编辑保护建立准确 BR，删除错误关联，并同步对应 AC。

### F-004 — MAJOR — 性能验收标准不可复现且 NFR 与 AC 范围不一致

- **文件与位置：** `docs/product/MVP-PRODUCT-BASELINE.md` 第 837-841、908、946、973 行
- **问题描述：** NFR-002 使用未定义的“正常网络条件”，未规定客户端/服务端测试环境、数据分布、计时起止、并发或统计口径。NFR 要求“常用列表页面和机柜二维视图”加载并渲染不超过 3 秒，AC-018 只列三个列表页面，遗漏二维机柜视图和“渲染”。此外风险缓解允许架构任务调整性能指标，会使已批准产品验收线可被技术任务单方面改变。
- **风险：** 性能测试无法稳定复现或判断通过/失败，架构选型也缺少稳定约束。
- **建议修改方向：** 产品 Owner 固定最小可测口径和页面范围；技术环境细节可由架构补充，但不得改变产品阈值，除非按 Change Request 重新裁决。

### F-005 — MINOR — 同位置移动的规则互相矛盾

- **文件与位置：** `docs/product/MVP-PRODUCT-BASELINE.md` 第 393、410 行
- **问题描述：** 步骤 5 称移动到同一机柜同一位置“允许”且视为无变更，异常分支又要求提示“无需移动”并不执行移动。两者无法同时作为单一预期行为。
- **风险：** 是否生成操作记录、是否更新位置时间及接口结果会出现不同实现。
- **建议修改方向：** 选择一个最小且明确的产品行为，并补充是否写操作记录的验收预期。

### F-006 — MINOR — 产品基线混入不必要的实现层约束

- **文件与位置：** `docs/product/MVP-PRODUCT-BASELINE.md` 第 160、479、989 行
- **问题描述：** 文档规定权限差异同时体现在“前端”和“后端”，并规定所有 BR “在服务器端执行”；自检却声称未指定前后端实现方案。安全规则需要不可绕过是合理产品结果，但指定服务器端及前后端双重行为属于实现分层约束。
- **风险：** 提前限制架构方案，并使防过度规划自检结论不准确。
- **建议修改方向：** 改为技术中立的可观察结果（例如修改权限和关键业务校验不可由客户端绕过），具体执行层交由架构任务决定。

### F-007 — MINOR — 浏览器兼容标准使用移动目标且范围过宽

- **文件与位置：** `docs/product/MVP-PRODUCT-BASELINE.md` 第 869-873、909 行
- **问题描述：** “最新版”未绑定验收日期或明确版本，AC-019 又以“所有页面正常显示和交互、无布局错乱”作为绝对描述，没有核心交互清单或允许差异。
- **风险：** 同一构建在不同验收时间可能得出不同结论，兼容性测试边界不一致。
- **建议修改方向：** 固定支持策略（例如验收时稳定版及版本记录）并用核心页面/核心流程定义可判定范围。

### F-008 — NOTE — 当前未发现明显 MVP 范围扩张

- **文件与位置：** `docs/product/MVP-PRODUCT-BASELINE.md` 第 45-65、106-140、976-995、997-1019 行
- **问题描述：** 3D、实时监控、完整 CMDB、审批、预测等均明确排除或仅列入 backlog；未定义 API 路径、数据库物理结构、Three.js 配置或实现代码。后续任务建议是非约束性输入，没有形成当前实现要求。
- **风险：** 当前无新增风险；后续仍需确保 backlog 不被架构任务提前实现。
- **建议修改方向：** 保持现有边界，并在后续任务继续执行 Requirement Source→FR/NFR→AC 门禁。

### F-009 — NOTE — 仓库 PowerShell 校验脚本受当前执行环境阻断

- **文件与位置：** `scripts/validate-agent-workflow.ps1`；当前执行环境
- **问题描述：** 已尝试以 `pwsh -NoLogo -NoProfile -File ./scripts/validate-agent-workflow.ps1` 执行，但当前环境没有 `pwsh`（退出码 127）。随后尝试调用 Windows PowerShell 入口，WSL 互操作层返回 `UtilBindVsockAnyPort ... socket failed 1`（退出码 1），脚本未实际开始执行。
- **风险：** 本次 Reviewer 无法独立确认提交后的工作流校验结果；提交中声称的“20/20 PASS”只能作为 Owner 交接证据，不能替代 Reviewer 重跑。
- **建议修改方向：** 修订后在项目规定的 Windows PowerShell 环境重跑脚本并附退出码 0 的证据；该环境问题本身不要求修改产品基线。

## 5. Requirement traceability assessment

| 检查项 | 结果 | 说明 |
|---|---|---|
| 所有 AC 可回溯到 FR/NFR | PASS | AC-001 至 AC-020 均列出至少一个 FR/NFR |
| 所有 FR/NFR 至少关联一个 AC | PASS（形式） | 12 个 FR 与 7 个 NFR 均有关联 AC |
| FR 的全部声明行为被 AC 覆盖 | FAIL | 见 F-001、F-002、F-004 |
| FR→BR 映射准确完整 | FAIL | 见 F-003 |
| FR→PAGE 映射形成页面闭环 | PARTIAL | 核心页面均有映射，但权限与部分编辑/状态行为没有可验收闭环 |
| 核心位置操作闭环 | PASS（主体流程） | 上架、移动、下架、容量和操作记录主体路径齐备；同位置移动仍有 F-005 |

矩阵实现了编号层面的全覆盖，但“存在链接”不等于“行为被完整验收”。因此追踪性总体评价为 **不通过，需修订**。

## 6. MVP scope and overdevelopment assessment

- 产品目标与 MVP 核心边界清晰：围绕机房、机柜、服务器、U 位占用、二维展示和位置追踪。
- 2D 为当前入口，3D 明确排除；未提前实现或详细设计未来能力。
- 9 个页面均能对应当前 FR，没有发现大屏、驾驶舱或额外 3D 页面。
- 业务对象字段总体保持落位管理所需规模；未出现物理数据库模型或 API 契约。
- 第 21 节列出后续任务顺序略有规划性质，但明确由 Architect 决定，未形成当前范围要求，不构成缺陷。
- F-006 所述实现层措辞应移除，以保持产品基线技术中立。

专项结论：**未发现明显过度规划或过度开发；存在轻微实现方案越界措辞，但不是当前 NEEDS_CHANGES 的唯一原因。**

## 7. Validation results

| 验证项 | 命令/方法 | 结果 |
|---|---|---|
| 分支确认 | `git branch --show-current` | PASS：`docs/task-0004-product-baseline` |
| 基线提交确认 | `git rev-parse HEAD` | PASS：`c5bf8e896cc39f9520d02a25cb18b5be6d5b3393` |
| 远端基线一致 | 比较 HEAD 与 `origin/docs/task-0004-product-baseline` | PASS（审核开始时一致） |
| 基线提交文件范围 | `git diff --name-status c5bf8e8^ c5bf8e8` | PASS：仅产品基线、current-task、MODULE-LOCKS |
| 基线提交 whitespace | `git diff --check c5bf8e8^ c5bf8e8` | PASS |
| 工作流校验 | `pwsh -NoLogo -NoProfile -File ./scripts/validate-agent-workflow.ps1` | BLOCKED BY ENVIRONMENT：`pwsh` 不存在，退出码 127 |
| Windows PowerShell 回退 | `powershell.exe ... validate-agent-workflow.ps1` | BLOCKED BY ENVIRONMENT：WSL 互操作 socket 失败，退出码 1 |
| 需求编号与矩阵静态核对 | 人工逐项核对 FR/NFR/AC/BR/PAGE | FAIL：见 F-001 至 F-004 |
| 受保护文件完整性（写报告前） | `git status --short` 与基线哈希/差异核对 | PASS：写报告前工作区干净，受保护文件未修改 |

## 8. Final verdict

**NEEDS_CHANGES**

当前产品基线**不可以进入下一阶段的正式技术架构任务**。应由产品 Owner 仅针对 F-001 至 F-007 修订产品基线及追踪/验收内容，按工作流进入 `IN_FIX` 和 `READY_FOR_RETEST`，再由同一独立 Reviewer 复审。无需扩大 MVP，也不应在修订中新增架构、数据库或 API 设计。

## 9. Completion report fields

| 字段 | 内容 |
|---|---|
| Task ID | TASK-0004 |
| 最终状态 | CHANGES_REQUESTED（审核结论；受保护任务状态文件未由 Reviewer 修改） |
| 当前分支 | `docs/task-0004-product-baseline` |
| Owner | Claude + DeepSeek Product Manager |
| Reviewer | Codex Reviewer |
| 修改文件 | `reviews/product/MVP-PRODUCT-BASELINE-REVIEW-TASK-0004.md` |
| 实现/审核内容 | 独立审核产品目标、范围、追踪性、可测试性、页面/角色/规则闭环及防过度规划 |
| 构建命令与结果 | N/A：纯文档审核，无业务代码或构建产物 |
| 测试命令与结果 | PowerShell 工作流校验因当前环境阻断；静态追踪审核发现缺陷 |
| 验收证据 | 本报告 F-001 至 F-009 及第 7 节 |
| 审核结论 | NEEDS_CHANGES |
| 缺陷与修复/复审结果 | 0 BLOCKER / 4 MAJOR / 3 MINOR / 2 NOTE；尚未修复，等待复审 |
| Change Request | N/A：未发现需扩大当前批准范围的事项 |
| 提交说明 | `review: assess task-0004 product baseline` |
| 提交哈希 | 提交后填写于最终回复；报告不自引用提交哈希 |
| 推送结果 | 推送后填写于最终回复 |
| 本地哈希 | 提交后填写于最终回复 |
| 远端哈希 | 推送后填写于最终回复 |
| 模块锁释放证据 | N/A：NEEDS_CHANGES，TASK-0004 锁按工作流保持 HANDED_OFF |
| 已知限制 | Reviewer 无法在当前环境实际运行 PowerShell 校验脚本 |
| 最终完成条件 | 未满足：存在开放 MAJOR/MINOR，校验未独立重跑，任务不得 COMPLETED |
