# TASK-0004 MVP 产品基线独立复审报告

## 1. Review metadata

| 项目 | 内容 |
|---|---|
| Task ID | TASK-0004 |
| Review type | 独立修复复审（READY_FOR_RETEST） |
| Reviewer | Codex Reviewer |
| Owner / 修复者 | Claude + DeepSeek Product Manager |
| Review date | 2026-07-17（Asia/Shanghai） |
| Branch | `docs/task-0004-product-baseline` |
| Review start HEAD | `fb968685ceafaf5fcda6ac7fd0b88f8ec99314cd` |
| Review start remote | `origin/docs/task-0004-product-baseline` = `fb968685ceafaf5fcda6ac7fd0b88f8ec99314cd` |
| Review start worktree | CLEAN |
| Previous verdict | NEEDS_CHANGES |

Reviewer 未参与原产品基线或本轮修复，复审期间未修改产品基线、任务状态、模块锁、首次审核报告或业务代码。

## 2. Reviewed commits and files

Reviewed commits:

- 原始产品基线：`c5bf8e896cc39f9520d02a25cb18b5be6d5b3393`
- 第一次审核：`bdb59c16cfb2a532549d78fcdf72461b7d4765e0`
- 本轮修复：`fb968685ceafaf5fcda6ac7fd0b88f8ec99314cd`

完整阅读和检查：

- `AGENTS.md`
- `docs/architecture/AGENT-WORKFLOW.md`
- `tasks/current-task.md`
- `tasks/MODULE-LOCKS.md`
- `tasks/TASK-0004-PRODUCT-BASELINE.md`
- `docs/product/MVP-PRODUCT-BASELINE.md`
- `reviews/product/MVP-PRODUCT-BASELINE-REVIEW-TASK-0004.md`
- `fb968685` 的完整提交差异（仅修改产品基线和 `current-task.md`）
- 工作流中的 Reviewer 独立性、范围变更、防过度规划/设计/开发和最终完成门禁

## 3. Previous findings retest matrix

| Finding | 原等级 | 复审状态 | 独立验证结论 |
|---|---|---|---|
| F-001 | MAJOR | PARTIALLY_RESOLVED | AC-021 至 AC-031 补充了多项正向、拒绝和边界行为，但仍未完整覆盖 FR 声明。FR-003/BR-007 的资产编号唯一性没有 AC；FR-007 声明名称、管理 IP、资产编号、所属系统、负责人、所在机房、位置状态、运行状态八类条件及组合查询，AC-012/AC-028 只覆盖名称、IP、机房与位置状态；FR-008/AS-07 的 U 位展示方向没有 AC；机房/机柜停用时禁止新增机柜或位置操作也没有 AC。新增 AC 本身可执行且没有技术实现细节，但不足以关闭原缺陷。 |
| F-002 | MAJOR | PARTIALLY_RESOLVED | 匿名访问已裁决为禁止，DBA/应用运维和只读角色已明确为只读，AC-020 扩展到全部列出的修改操作。但角色表称运维人员只执行位置操作，同时又称其“与机房管理员具有相同的修改权限”，与 NFR-007 将机房管理员、运维人员一并定义为全部修改操作的授权角色不一致；此外“所有页面访问均需登录”的裁决没有对应匿名读取拒绝 AC。角色、权限、匿名访问尚未形成一致可验收闭环。 |
| F-003 | MAJOR | PARTIALLY_RESOLVED | BR-027 至 BR-029 是业务规则且未扩大范围；BR-030 也意在表达业务保护。但 BR-030 的主判定“新值不得小于当前已用 U 数”不正确：例如仅 U40-U42 被占用时已用数为 3，将总数改为 38 并不小于 3，却仍会越界；其括号说明与 AC-031 又要求拒绝，规则内部矛盾。追踪矩阵还未把 BR-028/BR-029 映射到受其约束的 FR-004/FR-005，相关规则也缺少 AC。 |
| F-004 | MAJOR | PARTIALLY_RESOLVED | NFR-002/AC-018 已补齐二维视图、网络条件、计时起止和 3 秒阈值不可单方面调整，改进有效。但仍没有固定或约束客户端与服务端基准环境、测试重复次数/统计判定口径，也未说明 10000 台服务器在 200 个机柜间的基准分布；“具体计时口径由架构任务定义”使同一产品标准仍可产生不同测试结论。当前性能验收尚不能稳定复现。 |
| F-005 | MINOR | RESOLVED | 同位置移动被统一定义为提示无需移动、不执行、不写操作记录且不更新时间，不再存在相反结果。 |
| F-006 | MINOR | RESOLVED | 已删除“前端和后端”“所有规则在服务器端执行”等分层实现要求，改为权限差异可观察、关键规则不可由客户端绕过，具体实现交由架构任务决定。 |
| F-007 | MINOR | RESOLVED | 支持策略绑定验收时稳定版并记录确切版本；AC-019 列出核心页面、核心操作和功能阻塞判定，范围明确且可执行。 |

F-008 重新确认：未发现新增 3D、实时监控、完整 CMDB、审批、预测、额外页面、API、物理数据模型或业务实现，MVP 范围没有扩张。

F-009 重新确认：本轮 `pwsh` 可用，工作流脚本实际执行并达到 20/20 PASS；此前环境阻断已消失，不构成产品基线缺陷。

## 4. Independent requirement traceability assessment

| 检查项 | 结果 | 说明 |
|---|---|---|
| FR 编号 | PASS | FR-001 至 FR-012 连续、唯一 |
| NFR 编号 | PASS | NFR-001 至 NFR-007 连续、唯一 |
| AC 编号 | PASS | AC-001 至 AC-031 连续、唯一 |
| BR 编号 | PASS | BR-001 至 BR-030 连续、唯一；文档排列不是数字顺序，但编号无缺失或重复 |
| PAGE 编号 | PASS | PAGE-001 至 PAGE-009 连续、唯一 |
| AC 可回溯到 FR/NFR | PASS（形式） | 31 项 AC 均标明至少一个 FR/NFR |
| FR/NFR 至少关联一个 AC | PASS（形式） | 12 项 FR 和 7 项 NFR 均有关联 AC |
| FR 声明行为被 AC 完整覆盖 | FAIL | 见 F-001、F-002、F-003 |
| FR→BR 映射准确完整 | FAIL | BR-030 自相矛盾，BR-028/BR-029 对位置操作的映射缺失 |
| FR→PAGE→AC 闭环 | PARTIAL | 页面编号和主要页面映射有效，但未覆盖全部声明行为 |
| 错误引用 | FAIL | BR-030 的“已用 U 数”条件与其括号说明、AC-031 不一致 |

AC-021 至 AC-031 均采用可观察结果，没有数据库、API、框架或前后端分层细节；彼此没有完全重复。其主要问题是覆盖仍不完整，而不是单项不可测试。BR-027 至 BR-030 均属于当前 MVP 已声明对象的业务规则，没有扩展产品范围；其中 BR-030 表达错误，BR-028/BR-029 的 FR/AC 映射不完整。

## 5. MVP scope and overdevelopment assessment

- 2D 仍是主要操作界面，3D 仅在非目标/backlog 中出现。
- 九个 PAGE 均可追踪到当前落位管理需求，没有增加大屏、报表中心或未来阶段页面。
- 没有 API 契约、物理数据库模型、技术栈选型、新依赖或业务代码。
- 新增 AC/BR 均围绕原 FR 的缺口，没有新增功能域。
- 性能条款没有指定架构方案，但当前测试口径仍不足；该问题属于验收完整性，不属于过度设计。

专项结论：MVP 范围与最小实现门禁通过，未发现过度规划、过度设计或过度开发；不得以此抵消尚未关闭的 MAJOR 追踪和一致性问题。

## 6. Validation commands and results

| 验证项 | 命令 | 结果 |
|---|---|---|
| 工作流校验 | `pwsh -NoLogo -NoProfile -File ./scripts/validate-agent-workflow.ps1` | PASS=20，FAIL=0，TOTAL=20，退出码 0 |
| 工作区 whitespace | `git diff --check` | PASS，退出码 0 |
| 修复提交 whitespace | `git diff fb968685^ fb968685 --check` | PASS，退出码 0 |
| 开始前工作区 | `git status --porcelain=v1` | CLEAN |
| 分支 | `git branch --show-current` | `docs/task-0004-product-baseline` |
| 本地/远端起始一致性 | 比较 `git rev-parse HEAD` 与 `git rev-parse origin/docs/task-0004-product-baseline` | PASS，均为 `fb968685ceafaf5fcda6ac7fd0b88f8ec99314cd` |
| 修复提交文件范围 | `git diff-tree --no-commit-id --name-status -r fb968685` | `docs/product/MVP-PRODUCT-BASELINE.md`、`tasks/current-task.md` |
| 编号检查 | PowerShell 正则统计定义和引用 | FR 12、NFR 7、AC 31、BR 30、PAGE 9；连续且唯一 |

复审期间 Reviewer 仅新增本报告，没有修改任何受保护文件。

## 7. Remaining findings

### R-001 — MAJOR — FR/AC 覆盖仍不完整

证据与影响见 F-001。必须由产品 Owner 在不扩大 MVP 的前提下，对仍属 MVP 的资产编号唯一性、查询条件、U 位方向、停用状态限制补充最小可执行 AC，或从 FR/规则中明确移除非必交付声明。

### R-002 — MAJOR — 角色权限与匿名访问尚未闭环

证据与影响见 F-002。必须统一运维人员是否拥有基础信息创建/编辑权限，并为“所有页面均需登录”提供读取访问拒绝的可执行验收条件。

### R-003 — MAJOR — BR-030 规则错误且停用规则追踪缺失

证据与影响见 F-003。必须按“新 U 位总数不得低于任何当前占用的最高结束 U 位”等等价业务结果消除矛盾，并补齐 BR-028/BR-029 到相关 FR 和 AC 的准确映射。

### R-004 — MAJOR — 性能条件仍不可稳定复现

证据与影响见 F-004。产品基线至少应固定可比较的基准环境边界、数据分布以及重复/统计通过口径；可以允许架构选择测量工具，但不能把决定验收结果的口径留空。

剩余问题统计：BLOCKER 0、MAJOR 4、MINOR 0、NOTE 0。

## 8. Final verdict

**NEEDS_CHANGES**

F-001 至 F-004 未全部 RESOLVED，且仍有 4 个 MAJOR，因此不满足 PASS 条件。TASK-0004 当前不得关闭，不得进入 TASK-0005。应由产品 Owner 仅修复 R-001 至 R-004，保持 TASK-0004 工作流和模块锁约束，之后再次交由同一独立 Reviewer 复审。

完成门禁状态：工作流校验和 whitespace 校验已通过；Reviewer 独立性与范围门禁已通过；缺陷关闭、任务关闭、模块锁释放不通过。提交和推送信息由本报告提交后的最终交接记录提供。
