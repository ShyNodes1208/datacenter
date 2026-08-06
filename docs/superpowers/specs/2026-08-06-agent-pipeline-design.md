# Agent 自动化流水线设计

## 概述

将 Claude(架构规划) + Cursor(前端开发) + Codex(后端开发+代码审核) 三个 Agent 通过共享状态文件串联为自动化流水线。用户提需求后，除 Cursor 需手动触发外，其余阶段全自动执行。

## 状态机流转

```
PLANNING → BACKEND → FRONTEND → REVIEW → VERIFY → DONE
  (Claude)  (Codex)   (Cursor)  (Codex)   (Claude)

特殊状态：PAUSED（错误暂停，用户手动恢复）
```

## 各阶段职责

| 阶段 | 执行者 | 触发方式 | 超时 | 产出 |
|------|--------|---------|------|------|
| PLANNING | Claude | 用户提需求 | — | Task 文件 + state.json 初始化 |
| BACKEND | Codex CLI | Claude Bash 同步调用 | 30 min | 后端代码 + commit + 测试结果 |
| FRONTEND | Cursor | 用户手动"继续" | — | 前端代码 + commit + 测试结果 |
| REVIEW | Codex CLI | Claude Bash 同步调用 | 15 min | 审核报告 + issues 列表 |
| VERIFY | Claude | 自动 | 10 min | build + test + typecheck + diff |
| PAUSED | — | 错误触发 | — | 等待用户手动恢复 |

## 目录结构

```
tasks/active/
  state.json       # 当前流水线状态（有且仅有一个）
  state.schema.json # JSON Schema，用于 jq 校验
  watch.sh         # Monitor 轮询脚本（只监听 frontend.status）
  watch.pid        # Monitor 进程 PID，防僵尸

tasks/
  YYYY-MM-DD-<name>-task.md       # 派发给 Codex/Cursor 的任务文件
  MODULE-LOCKS.md                  # 模块锁
  current-task.md                  # 当前任务摘要

tasks/completed/
  TASK-XXXX-state.json             # 已完成流水线归档

docs/superpowers/specs/   # 设计文档
docs/superpowers/plans/   # 实现计划
```

## state.json 完整 Schema

### 顶层

```json
{
  "version": "1.0",
  "pipeline": "TASK-XXXX",
  "type": "fullstack | backend-only | frontend-only",
  "status": "running | paused | aborted",
  "phase": "PLANNING | BACKEND | FRONTEND | REVIEW | VERIFY | DONE | PAUSED",
  "created": "ISO8601",
  "updated": "ISO8601",
  "task": { ... },
  "phases": { ... },
  "errors": [],
  "history": []
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `type` | string | PLANNING 阶段确定：fullstack / backend-only / frontend-only |
| `status` | string | running=正常流转, paused=错误暂停, aborted=用户取消 |
| `phase` | string | 当前阶段 |

### task

```json
{
  "id": "TASK-0022",
  "title": "线缆可视化",
  "plan": "docs/superpowers/plans/...",
  "spec": "docs/superpowers/specs/...",
  "requirement": "实现机房线缆可视化，显示交换机到服务器的物理连接路径"
}
```

### phases.planning

```json
{
  "status": "pending | in-progress | done | failed",
  "owner": "claude",
  "started": "ISO8601",
  "completed": "ISO8601",
  "taskFile": "tasks/2026-08-06-cable-viz-task.md",
  "planFile": "docs/superpowers/plans/...",
  "specFile": "docs/superpowers/specs/...",
  "modules": {
    "backend": ["CableService", "CableController"],
    "frontend": ["useCableScene", "CableLayer"]
  },
  "branch": "feature/TASK-0022-cable-viz",
  "commit": "abc1234",
  "summary": "Task + Plan 已就绪，模块锁已获取"
}
```

### phases.backend

Codex CLI 同步调用。task 文件中包含完整的 state.json 读写指令。

```json
{
  "status": "pending | in-progress | done | failed",
  "owner": "codex",
  "retryCount": 0,
  "timeout": "30m",
  "_invoked": false,
  "started": "ISO8601",
  "completed": "ISO8601",
  "commit": "def5678",
  "commitMsg": "feat: add CableScene API",
  "filesChanged": ["src/backend/..."],
  "testResults": {
    "total": 203,
    "passed": 203,
    "failed": 0
  },
  "cliCommand": "codex exec -p \"$(cat tasks/...-task.md)\"",
  "handoffNote": "给 FRONTEND 阶段的交接说明：API 格式、端口号、已知注意事项"
}
```

`_invoked` 为 crash recovery 标记：Claude 调用 Codex 前设为 `true`，Codex 完成后写 `false`。Claude 重启时检查：若 `_invoked=true` 且 `status != done`，说明上次调用可能中断，根据 git log 判断是否重新执行。

### phases.frontend

Cursor 手动触发。用户使用 Cursor Prompt Template（见下方模板章节）。

```json
{
  "status": "pending | in-progress | done | failed | skipped",
  "owner": "cursor",
  "started": "ISO8601",
  "completed": "ISO8601",
  "commit": "ghi9012",
  "commitMsg": "feat: add cable visualization layer",
  "filesChanged": ["src/frontend/..."],
  "testResults": {
    "total": 72,
    "passed": 71,
    "failed": 1,
    "failures": ["CableLayer > path precision"]
  },
  "handoffNote": "给 REVIEW 阶段的交接说明：已知问题、设计取舍"
}
```

`status: skipped` 用于 backend-only 任务。

### phases.review

Codex CLI 同步调用，审核 backend + frontend 的 diff。

```json
{
  "status": "pending | in-progress | done | failed",
  "owner": "codex",
  "retryCount": 0,
  "timeout": "15m",
  "_invoked": false,
  "started": "ISO8601",
  "completed": "ISO8601",
  "scope": {
    "backendCommit": "def5678",
    "frontendCommit": "ghi9012"
  },
  "verdict": "approved | approved_with_issues | rejected",
  "issues": [
    {
      "id": "RV-001",
      "severity": "blocking | major | minor | info",
      "affectedPhase": "backend | frontend",
      "file": "src/backend/...",
      "line": 142,
      "summary": "问题描述",
      "recommendation": "修复建议"
    }
  ],
  "cliCommand": "codex exec -p \"$(cat tasks/...-review-task.md)\"",
  "handoffNote": "给 VERIFY 阶段的交接说明：已知问题、未修复项"
}
```

**阻断与回退规则**：
- 只有 `severity: blocking` 触发 `verdict: rejected`
- 回退时根据 `affectedPhase` 决定目标：所有 blocking 的 affectedPhase 中有 backend → 回退到 BACKEND；只有 frontend → 回退到 FRONTEND
- `retryCount` 达到 2 仍 rejected → `phase = PAUSED`，需要用户介入
- minor/info 记录到 known issues，不阻断

**审核输出格式**：task 文件要求 Codex 以 JSON 格式输出审核结果，写入 `tasks/active/review-output.json`。Claude 读取该文件后用 jq 校验，再合并到 state.json 的 `phases.review.issues`。

### phases.verify

Claude 自动执行。

```json
{
  "status": "pending | in-progress | done | failed",
  "owner": "claude",
  "started": "ISO8601",
  "completed": "ISO8601",
  "checks": {
    "backendBuild": { "passed": true, "command": "dotnet build", "exitCode": 0 },
    "backendTest": { "passed": true, "command": "dotnet test", "total": 203, "failed": 0 },
    "frontendBuild": { "passed": true, "command": "npm run build", "exitCode": 0 },
    "frontendTest": { "passed": true, "command": "npx vitest run", "total": 72, "failed": 0 },
    "typeCheck": { "passed": true, "command": "npx vue-tsc --noEmit" },
    "diffCheck": { "passed": true, "expectedFiles": ["..."], "actualFiles": ["..."], "extra": [], "missing": [] },
    "gitStatus": { "passed": true, "clean": true }
  },
  "verdict": "ready | failed",
  "handoffNote": "交付说明"
}
```

`diffCheck.expectedFiles` = `phases.backend.filesChanged` + `phases.frontend.filesChanged`。`actualFiles` = `git diff --name-only main...HEAD`。

**VERIFY 失败处理**：`verdict: failed` → `phase = PAUSED`。用户手动修复后改 `phase` 回到对应开发阶段（根据失败类型：后端测试失败→BACKEND，前端测试失败→FRONTEND，typecheck 失败→FRONTEND），重新流转。

### errors

```json
[
  {
    "id": "ERR-001",
    "phase": "backend",
    "time": "ISO8601",
    "type": "build_failed | test_failed | review_rejected | timeout | codex_error | verify_failed",
    "detail": "错误详情",
    "action": "已自动重试 2 次仍失败。建议检查 CableScene.cs:42 的类型定义。",
    "resolved": false,
    "resolvedAt": null
  }
]
```

**错误处理规则**：
- `codex_error`（Codex 进程崩溃）→ 自动重试 2 次，仍失败 → `phase = PAUSED`
- `build_failed | test_failed` → 自动重试 2 次，仍失败 → `phase = PAUSED`
- `review_rejected` → 见上方阻断与回退规则
- `timeout` → `phase = PAUSED`，不自动重试
- PAUSED 状态下，用户排查后手动改 `phase` 到对应阶段继续

### history

```json
[
  {
    "time": "ISO8601",
    "phase": "backend",
    "from": "pending",
    "to": "in-progress",
    "by": "claude"
  }
]
```

## 执行模型：Claude 直接驱动 + Monitor 仅监听 Cursor

**核心原则**：Claude 能自己控制的阶段（BACKEND、REVIEW、VERIFY）直接执行，不通过 Monitor 中转。Monitor 只做一件事：监听 Cursor 更新 `phases.frontend.status`。

### Claude 主流程

```
1. 收到需求
2. 分析 → 写 spec + plan + task 文件
3. 获取模块锁 → 创建 feature 分支
4. 初始化 state.json (phase: PLANNING, status: running)
5. 完成 planning → set phase = BACKEND
6. 直接执行 BACKEND:
   a. 检查 retryCount >= 2 → phase = PAUSED，跳到步骤 12
   b. 读 state.json → 读 phases.backend.handoffNote（首次为空）
   c. 设 _invoked = true, status = in-progress
   d. Bash: codex exec -p "$(cat tasks/...-task.md)"  (同步等待，超时 30min)
   e. 检查退出码:
      - 0 + git log 有新 commit → 继续 f
      - 非 0 或超时 → 设 _invoked = false, status = failed, retryCount++, 写 error 到 errors[], 回到 a
   f. 设 _invoked = false, status = done, 填充 commit/filesChanged/testResults
   g. 写 handoffNote
7. 判断 type:
   - backend-only → 跳过 FRONTEND，phase = REVIEW
   - fullstack/frontend-only → phase = FRONTEND，启动 Monitor
8. FRONTEND 阶段:
   a. 通知用户打开 Cursor，粘贴 Cursor Prompt Template
   b. Monitor 等待 FRONTEND:done
   c. 检测到 done → 停止 Monitor → 验证 phases.frontend.commit 非空 → phase = REVIEW
9. 直接执行 REVIEW:
   a. 检查 retryCount >= 2 → phase = PAUSED，跳到步骤 12
   b. 生成 review task 文件（包含 backend + frontend 的 handoffNote + diff 范围）
   c. 设 _invoked = true, status = in-progress
   d. Bash: codex exec -p "$(cat tasks/...-review-task.md)"  (同步等待，超时 15min)
   e. 检查退出码:
      - 0 → 继续 f
      - 非 0 或超时 → 设 _invoked = false, status = failed, retryCount++, 写 error, 回到 a
   f. 读 tasks/active/review-output.json → 校验 JSON → 合并到 state.json
   g. 判断 verdict:
      - approved / approved_with_issues → phase = VERIFY
      - rejected → retryCount++, 按 affectedPhase 回退到步骤 6 或 8（retryCount < 2 时重试，>= 2 时到步骤 12 PAUSED）
10. 直接执行 VERIFY:
    a. dotnet build + dotnet test
    b. npm run build + npx vitest run + npx vue-tsc
    c. git diff 校验
    d. 全部通过 → phase = DONE
    e. 任一失败 → phase = PAUSED，跳到步骤 12
11. DONE:
    a. 释放模块锁
    b. 移动 state.json + watch.sh + watch.pid → tasks/completed/
    c. 交付报告给用户
12. PAUSED 等待恢复:
    a. 通知用户：流水线暂停，原因见 errors 数组
    b. 进入轮询：每 2 秒读 state.json 的 phase 字段
    c. 用户修复后手动改 phase（如 BACKEND、FRONTEND、VERIFY）和 status = running
    d. 检测到 phase != PAUSED → 重置目标阶段的 retryCount = 0，从对应步骤（6/8/10）继续执行
    e. 检测到 status = aborted → 退出流水线
```

## Crash Recovery

Claude 重启时执行恢复流程：

```
1. 检查 tasks/active/state.json 是否存在
2. 不存在 → 无活动流水线，退出
3. 存在 → 读 state.json:
   a. status = aborted → 退出
   b. status = paused → 提示用户当前 paused，等待用户操作
   c. phase = BACKEND | REVIEW → 检查 _invoked:
      - _invoked = false 且 status = pending → 正常，继续执行
      - _invoked = true 且 status = in-progress → 检查 git log 是否有新 commit:
        * 有 → Codex 已完成但未更新 state，Claude 补填数据并推进
        * 无 → Codex 未完成或未启动，重新调用
      - _invoked = false 且 status = done → 跳过，推进到下一阶段
   d. phase = FRONTEND → 重启 Monitor，等待 Cursor
   e. phase = VERIFY → 重新执行 VERIFY
   f. phase = DONE → 归档，退出
```

## Monitor 检测机制

Monitor **只监听 `phases.frontend.status`**，不再监听 `phase`（Claude 自己驱动阶段推进）。

```bash
#!/bin/bash
# tasks/active/watch.sh
# 记录 PID 防僵尸
echo $$ > tasks/active/watch.pid
trap "rm -f tasks/active/watch.pid" EXIT

PREV=""
while true; do
  CUR=$(jq -r '.phases.frontend.status' tasks/active/state.json 2>/dev/null || echo "N/A")
  if [ "$CUR" != "$PREV" ] && [ "$CUR" != "N/A" ]; then
    echo "FRONTEND:$CUR"
    PREV="$CUR"
  fi
  sleep 1
done
```

Claude 启动 Monitor 前检查 `watch.pid`：若存在且进程存活 → kill 后重启；若存在但进程已死 → 清理 PID 文件后启动。

| 事件 | Claude 动作 |
|------|------------|
| `FRONTEND:done` | 验证 commit 非空 → 停止 Monitor → phase = REVIEW |
| `FRONTEND:failed` | phase = PAUSED，通知用户 |

## Agent 集成规范

### Codex 集成

Codex CLI 通过 Bash 同步调用。每次调用前 Claude 生成一个 **Codex Task 文件** (`tasks/YYYY-MM-DD-<name>-codex-task.md`)，内容必须包含：

```markdown
# Codex Task

## 当前流水线上下文

请先读取 tasks/active/state.json 了解完整上下文。
你的工作在 phases.<当前阶段> 中定义。

## 你的任务

<具体开发或审核任务描述>

## 完成后必须执行

1. 确保所有改动已 git commit
2. 更新 tasks/active/state.json:
   - 设 phases.<当前阶段>.status = "done"
   - 设 phases.<当前阶段>.commit = $(git rev-parse HEAD)
   - 设 phases.<当前阶段>.commitMsg = "<提交说明>"
   - 设 phases.<当前阶段>.filesChanged = $(git diff --name-only HEAD~1)
   - 设 phases.<当前阶段>.testResults = <运行测试并填写结果>
   - 设 phases.<当前阶段>.handoffNote = "<给下一阶段的交接说明>"
   - 设 phases.<当前阶段>._invoked = false
3. 如果是 REVIEW 阶段，额外写 tasks/active/review-output.json:
   { "verdict": "...", "issues": [ { "id": "RV-001", "severity": "...", ... } ] }

## 上一阶段交接说明

<前一个 phase 的 handoffNote>
```

**注意**：Codex CLI 的实际调用语法待验证。当前假设为 `codex exec -p "<prompt>"`。如果 Codex CLI 不支持 `-p` 从文件读取，则改为 `codex exec "$(cat task.md)"` 或类似方式。

### Cursor 集成

用户打开 Cursor 后，粘贴以下 **Cursor Prompt Template**：

```markdown
## Cursor Frontend Task

当前流水线：读取 tasks/active/state.json 了解后端产出和上下文。

后端已完成的工作：
<phases.backend.handoffNote>

后端 API 提交：<phases.backend.commit>
后端改动文件：<phases.backend.filesChanged>

你的任务：<phases.frontend 的具体任务描述，从 task 文件摘取>

完成后必须更新 tasks/active/state.json：
1. phases.frontend.status = "done"
2. phases.frontend.commit = 执行 git rev-parse HEAD 获取
3. phases.frontend.commitMsg = "<你的提交说明>"
4. phases.frontend.filesChanged = 执行 git diff --name-only HEAD~1 获取
5. phases.frontend.testResults = 执行 npx vitest run --reporter=json 获取
6. phases.frontend.handoffNote = "<给审核阶段的交接说明>"

确认所有改动已 commit。
```

## 模块锁集成

每个开发阶段前，Claude 在 `MODULE-LOCKS.md` 登记：

```
| Module | Locked By | Phase | Time |
| CableService | TASK-0022 | BACKEND | 2026-08-06T14:36 |
| CableController | TASK-0022 | BACKEND | 2026-08-06T14:36 |
| useCableScene | TASK-0022 | FRONTEND | 2026-08-06T14:55 |
```

阶段完成后释放对应模块锁。如果 pipeline.type = backend-only，只锁后端模块。

## JSON Schema 校验

`tasks/active/state.schema.json` 提供完整的 state.json JSON Schema。Claude 每次写 state.json 后用 jq 校验：

```bash
jq -e '. | if type == "object" then true else error("invalid") end' tasks/active/state.json \
  && echo "valid" || echo "INVALID - abort"
```

## 状态流转图（含异常路径）

```
                    ┌──────────────────────────────┐
                    │          PAUSED               │
                    │  (用户修复后手动设 phase)       │
                    └──────────┬───────────────────┘
                               ▲
          timeout/retry耗尽/    │
          verify失败/review循环 │
                               │
PLANNING → BACKEND → FRONTEND → REVIEW → VERIFY → DONE
              ▲         ▲         │                  │
              │         │    rejected+retry<2         │
              │         └─────────┤ (仅frontend       │
              │                   │  blocking时)      │
              └───────────────────┘ (backend blocking)
              
用户设 status=aborted → 任意阶段可中止
backend-only: BACKEND → REVIEW (跳过 FRONTEND)
```

## 设计决策

| 决策 | 选择 | 原因 |
|------|------|------|
| 编排方式 | state.json 状态机 | 所有 Agent 共享文件，无需网络通信 |
| 执行模型 | Claude 直接驱动 + Monitor 仅监听 Cursor | 避免 Claude 自己写 phase 自己监听的回环 |
| Codex 集成 | Claude Bash 同步调用 + 结构化 task 文件 | task 文件包含完整读写指令，解决 B1 |
| Codex 输出 | JSON 文件 (`review-output.json`) | 解决非结构化审核文本无法解析的问题 |
| Cursor 集成 | 手动 + Prompt Template | Cursor 无 CLI 接口 |
| 状态检测 | Monitor 轮询 + PID 文件 | 环境无 inotifywait，PID 防僵尸 |
| 错误恢复 | 自动重试 2 次 → PAUSED | 避免死循环 |
| 崩溃恢复 | `_invoked` 标记 + git log 验证 | 区分"被调用但未完成"和"从未调用" |
| Review 阻断 | blocking + affectedPhase 回退 | 精确回退到问题所在阶段 |
| Review 驳回上限 | retryCount ≤ 2 | 避免无限循环 |

## 不足与风险

| 问题 | 影响 | 缓解 |
|------|------|------|
| Cursor 仍是手动 | 无法一键到底 | 等 DeepSeek Flash 足够好，切全 Codex CLI |
| Codex CLI 接口未验证 | task 文件格式可能需调整 | 第一次用最小任务端到端测试 |
| 轮询有 1 秒延迟 | FRONTEND 完成后最多 1s 才检测到 | 可忽略 |
| state.json 无并发锁 | 同时写会覆盖 | 流程串行，同一时间只有一个写者 |
| Codex 额度限制 | 大任务可能耗尽 | Task 粒度控制 + type 字段规划阶段数 |
| Monitor 僵尸进程 | 崩溃后残留 | PID 文件 + trap EXIT 清理 |
| Claude 会话崩溃 | 流水线中断 | `_invoked` 恢复机制 |

## 验收标准

- [ ] AC-01：用户提需求后，Claude 生成 task + state.json，phase 从 PLANNING 开始
- [ ] AC-02：PLANNING 完成后，Claude 直接执行 BACKEND（Bash 调用 Codex，同步等待）
- [ ] AC-03：Codex 完成后按 task 文件指令更新 state.json（commit/testResults/handoffNote）
- [ ] AC-04：FRONTEND 阶段，Monitor 检测到 `frontend.status = done` 后 Claude 推进到 REVIEW
- [ ] AC-05：REVIEW 阶段，Codex 输出 review-output.json，blocking 时按 affectedPhase 回退
- [ ] AC-06：同一阶段驳回超过 2 次 → phase = PAUSED
- [ ] AC-07：任何错误自动重试 2 次仍失败 → phase = PAUSED，errors 数组记录
- [ ] AC-08：VERIFY 全部检查通过 → phase = DONE → 模块锁释放 → 归档到 completed/
- [ ] AC-09：Claude 崩溃重启后，通过 `_invoked` + git log 恢复流水线状态
- [ ] AC-10：状态文件每次写入后用 state.schema.json 校验
- [ ] AC-11：用户可随时设 `status = aborted` 中止流水线
