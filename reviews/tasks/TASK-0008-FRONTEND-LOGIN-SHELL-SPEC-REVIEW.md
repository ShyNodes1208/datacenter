# TASK-0008 前端基础与登录壳规格审核

## 审核信息

- Reviewer：Codex Reviewer
- 审核时间：2026-07-20（Asia/Shanghai）
- 审核类型：U02 独立规格审核
- 当前分支：`feature/task-0008-frontend-login-shell`
- 审核基线 HEAD：`6b86d3f22689f1cb265738d3b4bedcf594080a05`
- 任务状态：`DRAFT`
- Owner：Codex Architect
- Reviewer：Codex Reviewer
- 最终结论：`NEEDS_CHANGES`

## Git 前置门禁

PASS。已执行 `git fetch origin --prune`；当前分支正确；本地 HEAD 与 `origin/feature/task-0008-frontend-login-shell` 均为 `6b86d3f22689f1cb265738d3b4bedcf594080a05`；工作区干净；暂存区为空；没有实施文件变化。

## 规格范围与基线一致性

范围主体与产品 NFR-007、AC-037 及架构 TASK-0008 一致：仅包含 Vue Router、`/login`、最小受保护 `/`、`useApi`、`useAuth`、登录/登出/身份恢复、路由守卫、四个认证 API 和必要测试。规格明确排除了 Room、Cabinet、Server、TASK-0009、用户/角色管理、JWT、Refresh Token、Pinia、Axios、UI 库、权限矩阵、动态菜单、通用 SDK、后端/数据库修改和未来抽象。

但实际联调拓扑与架构基线 TR-03 不闭合，详见 `T8-SR-001`。因此本项结论为 FAIL。

## TASK-0007 实际认证契约审核

PASS。

- `AuthController.cs:19-25` 实现匿名 `GET /api/auth/csrf`，令牌位于响应 Header `X-XSRF-TOKEN`，并由 `GetAndStoreTokens` 设置 Antiforgery Cookie。
- `AuthController.cs:28-58` 实现匿名 `POST /api/auth/login`，请求字段为 `username`、`password`，校验 Antiforgery，成功响应 `{id, username, role}`，失败返回 `{error: "..."}`。
- `AuthController.cs:60-70` 实现受认证保护的 `POST /api/auth/logout`，校验当前请求对应的 Antiforgery Token，成功为 204。
- `AuthController.cs:73-80` 实现受认证保护的 `GET /api/auth/me`。
- `Program.cs:28-36` 固定 Header 名为 `X-XSRF-TOKEN`；Antiforgery Cookie 未配置固定名称，实际名称由 ASP.NET Core 生成，前端无需且不得读取或猜测。
- `Program.cs:37-49` 配置 Cookie Authentication；认证 Cookie 名为 `Datacenter.Auth`，HttpOnly、SameSite=Lax、非持久、固定 8 小时、无滑动续期。
- `Program.cs:169-174` 将未认证行为转换为 401 JSON `{"error":"未认证"}`。
- 规格要求相对同源请求使用 `credentials: "same-origin"`，Cookie 由浏览器管理；密码、Cookie、CSRF Token 和认证状态均不写入持久存储。
- 登录前获取匿名 Token、登录后重新取得已认证身份 Token、登出前再次获取当前身份 Token的生命周期与实际后端一致。

## 页面、路由与状态审核

PASS。规格只定义 `/login` 和受保护 `/`；两个页面内容保持最小；明确匿名与已登录重定向、共享初始化 Promise、首次 `/me` 恢复、401 清理、登出回登录页、无自跳转/无限重定向及不持久化认证状态。`currentUser | null` 配合初始化加载状态足以区分初始化中、已认证和匿名三种状态，且没有要求通用状态管理框架。

## useApi 审核

PASS。职责限定为原生 `fetch`、相对 `/api`、同源 credentials、JSON/204、统一错误、Antiforgery Header、401 显式通知；明确无路由跳转、无限重试、缓存、业务 DTO、通用 SDK 或敏感日志。CSRF 令牌所有权在 `useAuth`，`useApi` 仅负责按调用要求附加 Header，不与身份状态形成反向依赖。

## useAuth 审核

PASS。规格仅管理模块级共享内存用户、初始化态、共享 `restore()`、login、logout、CSRF 顺序和 401 清理；明确不保存密码、不持久化身份、不管理或读取 Cookie、不做动态权限/刷新 Token、不使用状态库。模块内 `ref` 和共享初始化 Promise 已避免多组件各自创建不一致状态。

## 依赖预算审核

FAIL，详见 `T8-SR-004`。

- 当前 `package.json` 只有 Vue 生产依赖，lockfileVersion 为 3；当前 lock 文件中没有 `vue-router`。
- 规格只允许新增 `vue-router` 精确版本 `4.6.3`，并将 `package.json`、`package-lock.json` 都列入修改预算；没有 Axios、Pinia、UI 库或新增测试框架。
- 当前已有 Vitest、Node 测试环境及锁文件中的 Vue SSR 运行依赖，测试能力方向与规格一致。
- 但现有工程文件和 lock 文件中不存在 `vue-router 4.6.3` 的包元数据或 peer dependency 证据，规格也未记录与当前 Vue 版本的兼容性依据；按本轮“无法从现有工程证明不得猜测”的门禁，不能判定该精确版本预算已闭合。

## 文件预算审核

FAIL，详见 `T8-SR-001`。

列出的 12 个路径均精确，计数为新增 8、修改 4，A/M 分类一致；没有目录级路径、后端、数据库、Migration、TASK-0009 或未来占位文件。三个测试文件覆盖方向与 AC 有映射，package 与 lock 文件也对应依赖变化。但现有后端 `Program.cs` 没有 SPA 静态托管，现有 `vite.config.ts` 也没有 `/api` proxy；在要求相对 `/api` 且不依赖真实外部服务的前提下，U15 的实际联调无法由预算内文件建立同源路径。故预算遗漏至少一个必要运行配置变化，不能闭合。

## 12 条 AC 矩阵

| AC | 要求 | 可验证性 | 范围一致性 | 结论 |
|---|---|---|---|---|
| AC-01 | 安装 Router 且仅两条页面路由 | 可由依赖、代码、构建和路由测试验证 | 一致 | PASS |
| AC-02 | 登录页四项最小渲染 | 可由 SSR 页面测试验证 | 一致 | PASS |
| AC-03 | 首页三项最小渲染 | 可由 SSR 页面测试验证 | 一致 | PASS |
| AC-04 | useApi 的请求、响应、错误、401、缓存/重试约束 | 可测试，但合并多个独立行为 | 一致 | FAIL |
| AC-05 | 内存状态、恢复和 401 清理 | 可测试，但合并多个独立行为 | 一致 | FAIL |
| AC-06 | 四步登录、导航和失败展示 | 可测试，但合并多个独立行为 | 一致 | FAIL |
| AC-07 | 登出顺序、204/401 清理和导航 | 可测试，但合并多个独立行为 | 一致 | FAIL |
| AC-08 | 两向守卫、一次初始化和无循环 | 可测试，但合并多个独立行为 | 一致 | FAIL |
| AC-09 | Antiforgery 生命周期及旧令牌禁用 | 可由顺序测试验证 | 一致 | PASS |
| AC-10 | 多类敏感信息不持久化/不记录且不读 Cookie | 可测试，但合并多个独立行为 | 一致 | FAIL |
| AC-11 | 文件、依赖、构建和测试门禁 | 可由 Git/npm 验证，但合并多个独立门禁 | 一致 | FAIL |
| AC-12 | 排除多类范围且后端 28/28 回归 | 可由范围审查和测试验证，但合并多个独立门禁 | 一致 | FAIL |

AC 结果：PASS 4，FAIL 8。未满足“12 条 AC 全部 PASS”的规格放行条件，详见 `T8-SR-002`。

## 测试规格审核

FAIL。

规格明确覆盖登录页渲染、登录成功/失败、匿名/已登录守卫、`/me` 恢复、401 清理、登出、Antiforgery 顺序、不持久化敏感数据、前端 Build/Test 和 TASK-0007 28/28 回归；使用已有 Vitest、Node、SSR 和 memory history，不增加框架，不要求真实外部服务，并要求行为断言而非纯字符串检查。

但“至少一个前后端实际联调验证单元”虽列为 U15，却没有可执行的同源启动/代理配置与验证命令，API mock 与实际联调边界没有落到可执行联调方案。测试规格因此受 `T8-SR-001` 阻断。

## U01～U17 时间盒审核

| 单元 | 结论 | 审核意见 |
|---|---|---|
| U01 | PASS | 单一规格创建目标，文件受控 |
| U02 | PASS | 单一独立规格审核报告 |
| U03 | PASS | 每轮仅修正一个或一组紧密相关 Finding |
| U04 | PASS | 单一独立复审；状态迁移明确由 Architect 后续单独执行 |
| U05 | PASS | Router 与入口接入范围可控 |
| U06 | PASS | 仅静态登录表单 |
| U07 | PASS | 已限定 fetch 与错误契约，不含认证状态；无需再拆 CSRF 身份生命周期 |
| U08 | PASS | 仅 `/me` 与共享内存恢复 |
| U09 | PASS | 仅登录流程 |
| U10 | PASS | 仅登出流程 |
| U11 | PASS | 仅两向认证守卫 |
| U12 | PASS | 仅最小受保护首页壳 |
| U13 | FAIL | 同时补 useApi 与 useAuth 两套 composable 测试，覆盖请求、错误、401、恢复、登录、登出、CSRF、敏感信息，正常实现和排错明显超过 10 分钟 |
| U14 | FAIL | 同时覆盖两个页面、登录成功/失败、两向跳转、守卫、初始化及错误展示，目标和测试面过多 |
| U15 | FAIL | 现有工程没有同源托管或 Vite proxy，且无启动/验证命令；无法在当前预算与 10 分钟内独立完成 |
| U16 | PASS | 只运行既定前端构建/测试、后端回归和工作流命令，失败即停；正常命令执行可控制在 10 分钟 |
| U17 | FAIL | 将显式暂存、提交、推送、证据登记、锁交接和状态迁移混合为一个单元，涉及 Git 与三份受锁状态文档，明显不是单一目标且容易超过 10 分钟 |

时间盒结果：13 PASS，4 FAIL。最小拆分要求见 `T8-SR-003`；U15 同时受 `T8-SR-001` 阻断。

## 防过度开发审核

PASS。规格采用模块内 `ref`、原生 `fetch` 和两条静态路由，明确禁止业务页面、TASK-0009、通用框架、未来抽象、后端修改、扩大认证能力和动态权限。除已列 Finding 所需的预算闭合修正外，没有发现提前开发内容。

## 状态和锁审核

PASS。TASK-0008 与 current-task 均为 `DRAFT`；Owner 为 Codex Architect，Reviewer 为 Codex Reviewer；三项规格锁仅覆盖任务文档、current-task 和 MODULE-LOCKS，均为 CLAIMED by Codex Architect；没有 TASK-0008 实施锁；TASK-0007 锁历史未被修改。本轮不执行状态迁移，审核后仍保持 DRAFT。

## Findings

### T8-SR-001

- 等级：MAJOR
- 对应章节或 AC：当前前后端基线、精确文件预算、测试要求、U15；AC-11
- 文件和行号：`tasks/TASK-0008-FRONTEND-LOGIN-SHELL.md:138-138, 201-201`；`src/frontend/vite.config.ts:1-7`；`src/backend/Datacenter.Api/Program.cs:96-102`
- 问题：规格要求相对 `/api` 的同源 Cookie 请求和至少一次四 API 实际联调，却排除 `vite.config.ts` 并声称可通过“后端同源托管或现有运行方式”验证。实际后端只映射 Controllers，没有托管前端；Vite 也没有 `/api` proxy。规格未给出可执行启动/联调命令。
- 风险：实施者在 12 文件预算内无法完成 U15 和相关测试门禁；可能被迫越界修改配置、改为跨域、跳过联调或临时手工方案，Cookie/CSRF 行为无法可靠验收。
- 最小修正方向：由 Architect 选择并写明当前最小同源联调方式。若采用架构基线 TR-03 的 Vite proxy，应将 `vite.config.ts` 纳入精确文件预算、给出目标后端地址及启动/验证命令，并同步计数和 AC；不得扩大为通用代理层。
- 是否影响文件预算：是
- 是否影响依赖预算：否
- 是否阻止进入 U04：是
- 是否需要正式 CR：否；属于 DRAFT 内规格闭合修正，除非 Architect 选择改变已批准部署/架构契约

### T8-SR-002

- 等级：MAJOR
- 对应章节或 AC：验收标准 AC-04～AC-08、AC-10～AC-12
- 文件和行号：`tasks/TASK-0008-FRONTEND-LOGIN-SHELL.md:171-179`
- 问题：8 条 AC 各自合并多个可独立失败的行为。例如 AC-04 同时覆盖 URL、fetch、credentials、JSON/204、错误、401、缓存和重试；AC-11 同时覆盖文件预算、依赖、构建和测试。它们不满足本次门禁要求的“每条单一”。
- 风险：单条 AC 可能部分通过却无法给出唯一 PASS/FAIL，文件、测试和实现证据难以一一追踪，也允许实现者在复合标准内部遗漏安全行为。
- 最小修正方向：在保持当前产品/技术范围不变的前提下，把独立行为拆成原子 AC，或重新划分为每条只有一个可观察结果；同步文件映射、测试映射和 AC 总数。不得删除 Cookie/CSRF/401/持久化安全门禁。
- 是否影响文件预算：是（AC 映射需同步，路径未必增加）
- 是否影响依赖预算：否
- 是否阻止进入 U04：是
- 是否需要正式 CR：否；DRAFT 内规格质量修正

### T8-SR-003

- 等级：MAJOR
- 对应章节或 AC：5～10 分钟执行单元 U13、U14、U17
- 文件和行号：`tasks/TASK-0008-FRONTEND-LOGIN-SHELL.md:199-203`
- 问题：U13 混合两套 composable 的广泛测试；U14 混合页面、登录、跳转、守卫和错误测试；U17 混合暂存、提交、推送、证据登记、锁交接和状态迁移。它们不是单一目标，正常实现、验证和排错明显可能超过 10 分钟。
- 风险：执行单元无法独立停止，容易跨越时间盒、把实现/测试/Git/工作流操作混在同一会话，并降低失败定位能力。
- 最小修正方向：至少将 U13 拆为 useApi 测试与 useAuth 测试；U14 拆为页面/错误测试与路由守卫测试；U17 拆为实现文件验证与提交推送、以及由有权角色执行的证据登记/锁交接/状态迁移。每单元仍须禁止自动进入下一单元。
- 是否影响文件预算：否
- 是否影响依赖预算：否
- 是否阻止进入 U04：是
- 是否需要正式 CR：否；DRAFT 内执行计划修正

### T8-SR-004

- 等级：MINOR
- 对应章节或 AC：精确依赖预算；AC-01、AC-11
- 文件和行号：`tasks/TASK-0008-FRONTEND-LOGIN-SHELL.md:140-145`；`src/frontend/package.json:13-15`；`src/frontend/package-lock.json:1-12`
- 问题：当前工程能证明尚未安装 vue-router、使用 npm lockfileVersion 3，也能证明目标是精确版本；但现有工程和 lock 文件无法证明尚未出现的 `vue-router 4.6.3` 与当前 Vue 版本的 peer compatibility，规格未记录版本选择的可核验依据。
- 风险：实施阶段安装后才发现 peer/version 或 Node 工具链不兼容，会触发临时规格变更或超时排错。
- 最小修正方向：在规格中补充可复核的官方包元数据/兼容性依据（包括 peer dependency 范围），保持精确版本 4.6.3；本轮不得安装依赖。
- 是否影响文件预算：否
- 是否影响依赖预算：是
- 是否阻止进入 U04：是
- 是否需要正式 CR：否；若核验后必须改变批准版本，再由 Architect 判断是否需要 CR

## Finding 统计

- BLOCKER：0
- MAJOR：3
- MINOR：1
- NOTE：0

## 最终结论与许可

- 最终结论：`NEEDS_CHANGES`
- 允许进入 U03：是
- 允许进入 U04：否
- 允许开始实现：否
- TASK-0008 状态：继续 `DRAFT`
- current-task 状态：继续 `DRAFT`
- 规格锁：三项继续 `CLAIMED` by Codex Architect
- Change Request：当前 Findings 均可在 DRAFT 内最小修正，通常不需要正式 CR；若修正改变已批准架构或新增未批准依赖，则按权威工作流另行判断。

