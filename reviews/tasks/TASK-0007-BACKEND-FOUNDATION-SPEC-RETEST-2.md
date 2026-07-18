# TASK-0007 后端基础规格第二次复审

## 1. 复审元数据

| 字段 | 值 |
|---|---|
| Task ID | TASK-0007 |
| 复审类型 | 第二轮规格修正后的独立复审 |
| Reviewer | Codex Reviewer |
| 分支 | `feature/task-0007-backend-foundation` |
| 待复审 HEAD | `9091a4d086a5c236ec5e611e976b1e144826d99a` |
| 上次复审提交 | `a84624c269dec95c9725dc4d90cd356131216bb4` |
| 上次复审结论 | NEEDS_CHANGES；BLOCKER 0 / MAJOR 5 / MINOR 3 / NOTE 0 |
| 复审日期 | 2026-07-18 |
| 最终结论 | **NEEDS_CHANGES** |

本轮只审核规格。除本报告外，没有修改任务规格、current-task、模块锁、`.gitignore`、`.config`、csproj、appsettings、基线、历史报告、代码、测试、脚本、依赖、Tool Manifest、Migration 或数据库，也没有启动实施或合并 main。

## 2. 材料、Git 与修改隔离

Reviewer 完整阅读了指定材料、两份历史审核报告、产品与架构基线、当前配置/项目文件、权威状态/锁/Reviewer/Change Request/防过度开发规则，并独立检查 `a84624c..9091a4d` 完整 diff。

`git fetch origin --prune` 成功。复审开始时：分支正确；HEAD 与远端任务分支均为 `9091a4d086a5c236ec5e611e976b1e144826d99a`；工作区干净。修正 diff 恰好修改：

- `tasks/TASK-0007-BACKEND-FOUNDATION.md`
- `tasks/current-task.md`
- `tasks/MODULE-LOCKS.md`

无 `src/`、`tests/`、`scripts/`、csproj、appsettings、依赖、Tool Manifest、Migration、数据库或实现变化；无 `src/backend`、`tests/backend` 实施锁；TASK-0007 仍为 DRAFT，尚未编码。

## 3. 上轮 Findings 状态

| Finding | 状态 | 独立复审结论 |
|---|---|---|
| BF-RT1-001 | **CLOSED** | Antiforgery 已唯一规定登录后重新取 token，旧匿名 token 拒绝，AC-BF-21 可执行 |
| BF-RT1-002 | **CLOSED** | Bootstrap 强制 `IsDevelopment()`，Production/Staging/Testing 不执行，Fixture 独立 |
| BF-RT1-003 | **OPEN** | 已唯一选择本地 Tool Manifest，但三项版本仍为 `8.0.x`，明确留给 Owner 实施时决定 |
| BF-RT1-004 | **OPEN** | logout 冲突已关闭；ProblemDetails 是未获批准的架构/API 契约变更 |
| BF-RT1-005 | **OPEN** | 已从 CLAIMED 改为 HANDED_OFF，但 DRAFT + HANDED_OFF 不属于权威工作流合法组合 |
| BF-RT1-006 | **OPEN** | 未知角色约束已补足，但把基线一个组合角色拆成两个角色属于未批准产品范围变更 |
| BF-RT1-007 | **OPEN** | Tool Manifest/`.gitignore` 已列入，但文件总数口径仍互相矛盾 |
| BF-RT1-008 | **OPEN** | Secure/非持久/fail-closed 已补足，但旧角色 Claim 未明确与数据库当前角色同步或拒绝 |

此前 BF-SR-001、BF-SR-004、BF-SR-008、BF-SR-009 未发生回归：没有业务实体/迁移或测试专用业务端点；WAL/测试隔离和命令/CR 文件名修正仍保留。

## 4. Findings

### BF-RT2-001 — MAJOR — EF Core 与 dotnet-ef 仍没有精确版本

- 文件/位置：`tasks/TASK-0007-BACKEND-FOUNDATION.md:305-340, 699-709, 811, 824`
- 问题：`Microsoft.EntityFrameworkCore.Sqlite`、`Microsoft.EntityFrameworkCore.Design` 和 `dotnet-ef` 均写为 `8.0.x`；第 339 行明确让 Owner 根据实施时“最新补丁版本”决定。示例 `8.0.14` 不是裁决。AC-BF-33 同样只检查 `8.0.x`。
- 风险：三项版本在不同时间或机器上可能解析为不同补丁版本，迁移生成不可复现；直接违反本轮“精确、唯一版本”门禁。
- 最小修复方向：在规格中写入一个具体且相同的 `8.0.N` 补丁版本，分别用于 Sqlite、Design 和 manifest 中的 dotnet-ef；AC-BF-33 精确比对该版本。版本选择须由 Architect 在规格阶段裁决，不能留给实施 Owner。

### BF-RT2-002 — MAJOR — 五角色集合篡改已批准的四角色产品基线

- 文件/位置：`tasks/TASK-0007-BACKEND-FOUNDATION.md:85-105, 110-116, 197-198, 432, 501-512, 634-647`；`docs/product/MVP-PRODUCT-BASELINE.md:144-153`
- 问题：产品基线唯一批准的角色是四个，其中 `DBA/应用运维人员` 是一个完整角色名称。修正稿把它拆成 `DBA` 和 `应用运维人员` 两个角色，并明确称“额外拆分……以增强最小权限区分”。这新增了第五角色、修改 User.Role 允许值、CHECK 约束、授权策略和 API 返回值；没有 Change Request、Claude 产品裁决或 Architect 技术裁决。
- 风险：产品权限语义和数据模型漂移；后续前端、测试及已有 AC 将面对不同角色集合。按权威工作流，这是未批准产品范围与数据模型变更，不能进入 READY。
- 最小修复方向：恢复四个精确角色常量，包括完整字符串 `DBA/应用运维人员`；CHECK、Bootstrap、Claims、策略和 AC 全部复用四值集合。若确需拆分，必须先走书面 Change Request，Claude 裁决产品范围、Architect 评估技术影响并更新基线/追踪后再修改任务。

### BF-RT2-003 — MAJOR — ProblemDetails 替换架构基线错误契约未获批准

- 文件/位置：`tasks/TASK-0007-BACKEND-FOUNDATION.md:203-212, 432-436, 438-497, 649-652, 883`；`docs/architecture/MVP-ARCHITECTURE-BASELINE.md:302-316, 711-719`
- 问题：规格明确用 ProblemDetails 替代架构基线规定的 `{"error":"..."}`。给出“更简单”理由不能替代 Architect 管理的 API 契约变更审批，也没有 Change Request。并且 ASP.NET Core 的 antiforgery 拒绝、Cookie challenge、模型绑定和未处理异常不会仅因声明“内置 ProblemDetails”就自动形成完全一致的 `application/problem+json`；规格没有定义把这些管道失败统一映射到 ProblemDetails 的最小实现与验证路径。
- 风险：未经批准改变 TASK-0008 消费的错误契约；实现后不同失败源仍可能返回空体或不同结构，使 AC-BF-24 不可稳定通过。
- 最小修复方向：最小方案是遵循架构基线的单一 `error` JSON。若坚持 ProblemDetails，必须先由 Architect/Claude 按影响走 Change Request，并在批准规格中明确 antiforgery、认证 challenge/forbid、模型验证和 500 的统一映射方式及测试，不得只写结果口号。

### BF-RT2-004 — MAJOR — DRAFT + HANDED_OFF 不是权威工作流合法状态/锁组合

- 文件/位置：`tasks/TASK-0007-BACKEND-FOUNDATION.md:781-788`；`tasks/current-task.md:5-22`；`tasks/MODULE-LOCKS.md:41-43`；`docs/architecture/AGENT-WORKFLOW.md:25-36, 59-69`
- 问题：DRAFT 允许澄清/设计并禁止占用模块。HANDED_OFF 只在开发从 IN_PROGRESS 进入 READY_FOR_REVIEW，或修复从 IN_FIX 进入 READY_FOR_RETEST 时使用；没有 DRAFT + HANDED_OFF 组合。当前三项记录还在 HANDED_OFF 行填写了 `Released At`，但该字段只应在 RELEASED 时填写。工作流没有单独“规格复审”状态，这不授权复用实施交审锁语义。
- 风险：状态机和锁审计失真；Reviewer PASS 后无法从一个权威合法交接点批准 DRAFT→READY。20/20 脚本不检查该组合，不能覆盖此缺陷。
- 最小修复方向：保持 DRAFT 完成规格审核，但释放三项不应在 DRAFT 占用的规格锁并正确填写 Released At；用任务交接记录指定 Reviewer 只读接收，而不是伪造 HANDED_OFF。复审 PASS 后由 Architect 按 DRAFT→READY 条件批准；实施 Owner 再检查冲突、认领实施路径并进入 IN_PROGRESS。

### BF-RT2-005 — MAJOR — OnValidatePrincipal 没有处理数据库角色变化

- 文件/位置：`tasks/TASK-0007-BACKEND-FOUNDATION.md:177-183, 607-613`
- 问题：规格声称数据库角色是最终依据，但每请求逻辑只明确检查“用户存在且启用”，没有比较 Cookie 中角色与数据库当前 Role，也没有更新/重签 Claims 或在不一致时拒绝 Principal。AC-BF-19 只测试禁用与数据库失败，不测试角色变化。
- 风险：角色在受控初始化/未来管理流程中变化后，旧 Cookie 仍持有旧权限最长 8 小时，数据库并非真正最终依据。
- 最小修复方向：每次验证同时读取当前 Role；若与 Claim 不一致，最简单做法是 reject + signout 要求重新登录，或明确替换 principal 并续签。增加角色变化后旧高权限 Cookie 不再获授权的集成测试，不引入缓存或会话存储。

### BF-RT2-006 — MINOR — 文件预算有三个不一致口径

- 文件/位置：`tasks/TASK-0007-BACKEND-FOUNDATION.md:351-396`
- 问题：标题称新增共 18；表格列 18 项却包含两个任务文件而遗漏 `tasks/MODULE-LOCKS.md`；上限又称最多 19（17 个实施文件 + “任务文件”单数）。按表实际业务/工具/测试新增文件为 16 个，不是 17；任务文件多数是修改而非新增。允许修改范围包含三项任务文件，但“修改现有文件共 5”只统计实施文件。
- 风险：超过预算的 Change Request 门禁无法客观判断，可能漏报新文件或把状态文件误算为实施新增。
- 最小修复方向：将“实施新增文件”“实施修改文件”“任务管理文件修改”分开准确计数；逐项列表总数与上限必须算术一致，MODULE-LOCKS 归任务管理修改，不把既有任务文件算新增。

### BF-RT2-007 — MINOR — SQLite 路径创建失败与测试并行边界未直接验收

- 文件/位置：`tasks/TASK-0007-BACKEND-FOUNDATION.md:119-122, 531-539, 668-675`
- 问题：规格规定 WAL 非 wal 时失败和每测试类独立临时文件，但没有明确 `.data`/父目录无法创建或路径不可写时启动失败；AC-BF-27 仅按测试类隔离，没有明确测试类并行时每个 fixture 路径唯一及互不清理对方文件。
- 风险：路径错误可能晚到数据库操作才失败且信息不清；并行测试可能文件/清理竞争。
- 最小修复方向：规定数据库父目录创建/打开失败即启动失败并有测试；每个 fixture 使用唯一目录/文件，拥有并只清理自身 db/wal/shm，允许测试类并行而不共享连接或路径。

## 5. 已满足部分

- Antiforgery：header 唯一；csrf 对匿名/已认证开放；login/logout 验证；me 不验证；登录后必须重新取 token；旧 token 测试拒绝；流程符合身份绑定方向。
- Bootstrap：仅 Development；Production/Staging/Testing 不执行；凭据只来自 User Secrets/环境变量；缺失跳过；已有用户不覆盖；生产初始化留部署任务；无新增 CLI/用户管理。
- logout：必须认证和新 antiforgery token；成功 204；二次调用 401；无匿名幂等分支。
- Cookie：名称、HttpOnly、SameSite、按环境 Secure、非持久、无滑动、Ticket 8 小时、最小 Claims、数据库失败 fail closed 均已明确；非持久 cookie 与 ticket 最大生命周期不矛盾。
- SQLite/WAL/Migration/测试：可配置本地 `.data`、网络共享禁止、WAL fail-fast、仅 Users migration、临时文件 SQLite、禁止 EF InMemory/`:memory:`、清理 db/wal/shm、无多数据库抽象均保留。
- appsettings.Development.json 当前确实未被 Git 跟踪且被 `.gitignore` 命中；example 规则不会被现有 ignore 误伤。
- 34 个 AC 编号连续唯一，不依赖未来业务端点或前端，不固定无意义测试数量；但 AC-BF-19、22/23、24、33 受开放 finding 影响，当前不能全部通过。

## 6. 验证结果

| 命令/检查 | 结果 | 退出码 |
|---|---|---:|
| `git fetch origin --prune` | 成功 | 0 |
| `pwsh -NoLogo -NoProfile -File ./scripts/validate-agent-workflow.ps1` | `PASS=20 FAIL=0 TOTAL=20` | 0 |
| `git diff --check a84624c..9091a4d` | 无输出，PASS | 0 |
| `git diff --check`（报告创建前） | 无输出，PASS | 0 |
| 本地/远端 9091a4d 一致 | PASS | 0 |
| 修正 diff 仅三个任务文件 | PASS | 0 |
| 无代码/测试/工具/依赖/迁移/数据库/实施锁 | PASS | 0 |

纯规格复审不运行构建/测试，不安装依赖，不创建 Tool Manifest、Migration 或数据库。

## 7. 最终决定

- 最终结论：**NEEDS_CHANGES**
- Findings：**BLOCKER 0 / MAJOR 5 / MINOR 2 / NOTE 0**
- 上轮状态：CLOSED 2（RT1-001/002）；OPEN 6（RT1-003/004/005/006/007/008）
- 精确版本：FAIL，仍为 `8.0.x`
- 角色约束：未知值约束可实现，但五角色违反四角色产品基线
- Antiforgery：生命周期本身通过
- Bootstrap：通过
- ProblemDetails/logout：logout 通过；ProblemDetails 未经 CR 且管道映射不完整
- Cookie：基础策略通过；数据库角色变化未闭环
- 文件预算：未通过，计数/分类不一致
- SQLite/WAL/Migration/测试隔离：主体通过，路径失败/并行边界需补充
- AC：34 条连续，但并非全部可执行通过
- 状态与锁：DRAFT 合理；DRAFT + HANDED_OFF 不合法
- Change Request：角色拆分和错误契约替换必须恢复基线或先获批准 CR
- 是否允许进入规格批准流程：**否**
- 是否允许进入实现：**否**

本报告应以 `review: retest task-0007 backend foundation spec round 2` 提交并推送当前任务分支。
