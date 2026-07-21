# TASK-0008 前端基础与登录壳规格复审

## 复审信息

- Reviewer：Codex Reviewer（新的独立会话；未参与规格修正）
- 复审时间：2026-07-20 22:26:03 +08:00（Asia/Shanghai）
- 复审类型：U04 独立规格复审
- 当前分支：`feature/task-0008-frontend-login-shell`
- 复审基线 HEAD：`bf724b68241b96654995ebb28371decfdd5b1790`
- 初审报告：`reviews/tasks/TASK-0008-FRONTEND-LOGIN-SHELL-SPEC-REVIEW.md`
- 初审结论：`NEEDS_CHANGES`
- 最终结论：`PASS`

## Git 前置门禁

PASS。已执行 `git fetch origin --prune`；当前分支正确；复审开始时本地 HEAD 与 `origin/feature/task-0008-frontend-login-shell` 均为 `bf724b68241b96654995ebb28371decfdd5b1790`；工作区干净；暂存区为空。TASK-0008 与 current-task 均为 `DRAFT`，Owner 为 Codex Architect，Reviewer 为 Codex Reviewer，Blocker 为无；三项规格锁均为 `CLAIMED` by Codex Architect，没有 TASK-0008 实施锁或实施文件变化。

## 修复提交范围

| 提交 | 说明 | 文件范围 | 结论 |
|---|---|---|---|
| `2638a3747ec199b0cec33c68ce3cd9900e546ebc` | close integration specification gaps | 仅修改任务规格 | PASS |
| `f670c0ccd12808e2451d204f631d2ad04723b14f` | document router compatibility | 仅修改任务规格 | PASS |
| `84d6537459ef2d30acd7e6b0622e6db8ab6386fd` | atomize acceptance criteria | 仅修改任务规格 | PASS |
| `bf724b68241b96654995ebb28371decfdd5b1790` | split execution timeboxes | 仅修改任务规格 | PASS |

四个提交均只修改 `tasks/TASK-0008-FRONTEND-LOGIN-SHELL.md`；未修改 current-task、MODULE-LOCKS、实现、测试或依赖文件，未迁移状态、修改规格锁或提前实施。

## 初审 Findings 复审

### T8-SR-001 — CLOSED

规格固定前端相对 `/api`，开发期仅由 `src/frontend/vite.config.ts` 的 `/api` proxy 转发到默认 `http://localhost:5142`，可用 Vite 内置 `loadEnv` 读取 `VITE_API_PROXY_TARGET`；无新增配置依赖、CORS、Nginx、Docker或部署系统。全部 fetch 使用 `credentials: "include"`，vite 配置已计入文件预算。U15-A/U15-B 给出真实本地后端、Vite、浏览器和代理链路，分别验证 login/me 与 logout/401；失败立即停止且不在单元内修复，不依赖远程数据库或外部服务。与架构 TR-03 及 TASK-0007 的 `launchSettings.json` HTTP profile 一致。

### T8-SR-002 — CLOSED

AC 已重构为连续且无重复的 AC-01～AC-20。逐条均具备单一主要结果、独立 PASS/FAIL、明确实现证据、测试或命令证据、精确文件和有效微任务映射；20/20 PASS。13 个预算文件均至少被一条 AC 覆盖，无废弃 AC 引用；U04-A、U15-A、U15-B 映射正确，原子化未扩大范围。

### T8-SR-003 — CLOSED

当前共 30 个执行微任务。U04-A 独立处理精确依赖安装；U13-A～E 分别只覆盖 useApi 基础请求、useApi 错误/CSRF、useAuth 恢复/401、登录、登出；U14-A～E 分别只覆盖登录渲染、登录交互、受保护页、两向守卫、初始化等待/循环；U15-A/B 分别只覆盖真实 login/me 与 logout/401 联调；U17-A～D 分别只覆盖范围核验、纯实现提交推送、只读证据准备、原子交审管理提交。每项均有 5～10 分钟、允许文件、验证、失败/超时停止和禁止自动进入下一单元的边界，未混合实现与测试、测试编写与完整回归、实现提交与状态迁移。

U17-D 将完整证据登记、`IN_PROGRESS → READY_FOR_REVIEW`、13 项实施锁 `CLAIMED → HANDED_OFF` 作为权威工作流要求的唯一原子管理提交；U17-C 已先行只读准备证据，范围合理且不会制造状态、证据和锁不一致的中间态。

### T8-SR-004 — CLOSED

只读实测 Node `v24.18.0`、npm `11.16.0`。`npm view vue-router@4.6.3 version peerDependencies engines --json` 返回版本 `4.6.3`、peerDependencies `{ "vue": "^3.5.0" }`，未返回 engines；当前声明 Vue `^3.5.39` 且 lock 中实际版本满足。元数据没有与当前 Vite、TypeScript 的直接冲突证据。当前 package 与 lock 未含 vue-router，`npm ls vue-router --depth=0 --json` 为空。

规格要求唯一新增直接生产依赖准确为 dependencies 中的 `"vue-router": "4.6.3"`，由 U04-A 单独执行 npm 精确安装并正常更新 lock；禁止手改 lock、升级其他依赖和 `npm audit fix`。本轮未执行安装。

## AC-01～AC-20 复审矩阵

| AC | 原子性 | 可验证性 | 文件映射 | 微任务映射 | 范围一致性 | 结论 |
|---|---|---|---|---|---|---|
| AC-01 | PASS | PASS | PASS | U04-A | PASS | PASS |
| AC-02 | PASS | PASS | PASS | U05 | PASS | PASS |
| AC-03 | PASS | PASS | PASS | U06、U14-A | PASS | PASS |
| AC-04 | PASS | PASS | PASS | U12、U14-C | PASS | PASS |
| AC-05 | PASS | PASS | PASS | U07、U13-A | PASS | PASS |
| AC-06 | PASS | PASS | PASS | U07、U13-B | PASS | PASS |
| AC-07 | PASS | PASS | PASS | U07、U13-B | PASS | PASS |
| AC-08 | PASS | PASS | PASS | U08、U13-C | PASS | PASS |
| AC-09 | PASS | PASS | PASS | U08、U13-C | PASS | PASS |
| AC-10 | PASS | PASS | PASS | U07、U08、U13-B、U13-C | PASS | PASS |
| AC-11 | PASS | PASS | PASS | U09、U13-D、U15-A | PASS | PASS |
| AC-12 | PASS | PASS | PASS | U09、U13-D、U14-B | PASS | PASS |
| AC-13 | PASS | PASS | PASS | U10、U12、U13-E、U14-C、U15-B | PASS | PASS |
| AC-14 | PASS | PASS | PASS | U11、U14-D | PASS | PASS |
| AC-15 | PASS | PASS | PASS | U11、U14-D | PASS | PASS |
| AC-16 | PASS | PASS | PASS | U11、U14-E | PASS | PASS |
| AC-17 | PASS | PASS | PASS | U07～U10、U13-A～E | PASS | PASS |
| AC-18 | PASS | PASS | PASS | U15-A、U15-B | PASS | PASS |
| AC-19 | PASS | PASS | PASS | U04-A、U16、U17-A、U17-B、U17-D | PASS | PASS |
| AC-20 | PASS | PASS | PASS | U16、U17-A、U17-D | PASS | PASS |

结果：20/20 PASS；编号连续、无重复、无断号或废弃引用。

## 文件预算

PASS，13/13 闭合：新增 8、修改 5，数量、列表和统计一致。全部路径真实精确且 A/M 分类正确，每个文件均有 AC 和微任务映射；`package.json`、`package-lock.json`、`vite.config.ts` 均在修改预算。三个测试文件足以承载 U13/U14 拆分。无目录级模糊项、后端文件、TASK-0009 文件、部署文件或未来占位文件。

## 依赖预算

PASS。唯一新增直接生产依赖为精确 `vue-router 4.6.3`；新增开发依赖为 0。无 Axios、Pinia、UI 库、新测试框架或其他直接依赖；禁止升级 Vue、Vite、TypeScript 和现有测试依赖；lock 必须由 npm 正常生成。

## 30 个微任务时间盒

PASS，30/30。U01、U02、U03、U04、U04-A、U05～U12、U13-A～U13-E、U14-A～U14-E、U15-A～U15-B、U16、U17-A～U17-D 均为一个明确目标，预计 5～10 分钟，修改/只读范围与验证明确，超时或失败即停止且不自动进入下一单元；没有预算扩大。重点拆分及 U17-D 原子性已在 T8-SR-003 中核实。

## 测试规格

PASS。规格可证明登录页渲染、useApi 基础请求和错误契约、CSRF Header、useAuth 恢复及 401 清理、登录、登出、受保护页、两向守卫、初始化等待、无无限重定向及敏感认证数据不持久化；U15-A/B 提供真实代理联调；U16 覆盖前端 Build、前端测试及 TASK-0007 后端 28/28 回归。单元测试使用现有 Vitest、Node、Vue SSR、memory history 和明确 fetch mock 边界，不依赖外部服务、不需测试专用生产代码或新增测试依赖。

## 防过度开发

PASS。仅两个页面、两条路由、TASK-0007 四个认证 API、原生 fetch、模块内共享内存状态及唯一 vue-router 依赖。没有 Room、Cabinet、Server、业务 API、TASK-0009、后端修改、JWT、Refresh Token、Pinia、Axios、UI 库、权限矩阵、动态菜单、通用 SDK、部署系统或未来抽象层。

## 状态与锁

PASS。复审后仍保持：TASK-0008 `DRAFT`；current-task `DRAFT`；Owner Codex Architect；Reviewer Codex Reviewer；Blocker 无；三项规格锁 `CLAIMED` by Codex Architect；实施锁 0。本轮未修改任何状态、锁或规格锁。

## 工作流与 Git 校验

- `pwsh -NoLogo -NoProfile -File ./scripts/validate-agent-workflow.ps1`：PASS，`PASS=20 / FAIL=0 / TOTAL=20`。
- `git diff --check`：PASS，无输出。
- 提交范围：只允许新增本报告。

## 新 Findings

无。

- BLOCKER：0
- MAJOR：0
- MINOR：0
- NOTE：0

## 最终结论与许可

- 最终结论：`PASS`
- T8-SR-001：`CLOSED`
- T8-SR-002：`CLOSED`
- T8-SR-003：`CLOSED`
- T8-SR-004：`CLOSED`
- AC：20/20 PASS
- 文件预算：13/13 PASS
- 依赖预算：PASS
- 30 个微任务时间盒：30/30 PASS
- 测试规格：PASS
- 防过度开发：PASS
- 允许进入 U04：是
- 允许直接开始实现：否。仍须由有权 Codex Architect 在独立步骤完成 READY 门禁与合法 `DRAFT → READY`；随后由 Cursor Frontend 检查冲突、逐项认领实施锁并执行合法状态迁移。
