# Agent 自动化流水线设计

## 概述

将 Claude(架构规划) + Cursor(前端开发) + Codex(后端开发+代码审核) 三个 Agent 通过共享状态文件串联为自动化流水线。用户提需求后，除 Cursor 需手动触发外，其余阶段全自动执行。

## 状态机流转

```
PLANNING → BACKEND → FRONTEND → REVIEW → VERIFY → DONE
  (Claude)  (Codex)   (Cursor)  (Codex)   (Claude)

backend-only:  BACKEND → REVIEW (跳过 FRONTEND)
frontend-only: FRONTEND → REVIEW (跳过 BACKEND)
特殊状态：PAUSED（错误暂停，用户手动恢复）
```

## 各阶段职责

| 阶段 | 执行者 | 触发方式 | 超时 | 产出 |
|------|--------|---------|------|------|
| PLANNING | Claude | 用户提需求 | — | Task 文件 + state.json 初始化 |
| BACKEND | Codex CLI | Claude Bash 同步调用 | 30 min/次 | 后端代码 + commit + 测试结果 |
| FRONTEND | Cursor | 用户手动"继续" | — | 前端代码 + commit + 测试结果 |
| REVIEW | Codex CLI | Claude Bash 同步调用 | 15 min/次 | 审核报告 + issues 列表 |
| VERIFY | Claude | 自动 | 10 min | build + test + typecheck + diff |
| PAUSED | — | 错误触发 | 1 hour 后自动 abort | 等待用户手动恢复 |

## 目录结构

```
tasks/active/
  state.json         # 当前流水线状态（有且仅有一个）
  state.schema.json  # JSON Schema，用于 ajv 校验
  review-output.json # REVIEW 阶段 Codex 审核输出
  watch.sh           # Monitor 轮询脚本（只监听 frontend.status）
  watch.pid          # Monitor 进程 PID，防僵尸

tasks/
  YYYY-MM-DD-<name>-task.md       # 派发给 Codex/Cursor 的任务文件
  YYYY-MM-DD-<name>-review-task.md # REVIEW 阶段派发给 Codex 的审核任务
  YYYY-MM-DD-<name>-fix-task.md    # 驳回后重新派发的修复任务（含 review issues）
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
| `type` | string | PLANNING 阶段确定 |
| `status` | string | running=正常, paused=暂停, aborted=已取消 |
| `phase` | string | 当前阶段 |
| `updated` | string | 每次写 state.json 必须更新为当前 ISO8601 时间 |
| `history` | array | 每次状态变更（pending→in-progress→done→failed）必须追加一条 |

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
  "summary": "Task + Plan 已就绪，模块锁已获取",
  "handoffNote": "给 BACKEND 阶段的任务概述：需实现的 API 端点、数据模型、验收标准"
}
```

### phases.backend

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

`_invoked` 为 crash recovery 标记：Claude 调用 Codex 前设为 `true`，Codex 完成后写 `false`。
`retryCount` 上限为 2 次重试（即总共 3 次尝试：初始 + 2 次重试）。每次重试前 `started` 更新为当前时间。

### phases.frontend

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
    "frontendCommit": null
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

`scope.frontendCommit` 为 null 时表示 backend-only 任务（无前端改动）。
审核输出写入 `tasks/active/review-output.json`，Claude 读取后合并到 state.json。

**阻断与回退规则**：
- 只有 `severity: blocking` 触发 `verdict: rejected`
- 回退时根据 `affectedPhase` 决定目标：任一 blocking 的 affectedPhase=backend → 回退到 BACKEND；全部=frontend → 回退到 FRONTEND
- **回退前必须重置目标阶段状态**：status = "pending", _invoked = false, retryCount = 0, 清空 commit/filesChanged/testResults/handoffNote
- **回退到 FRONTEND 时必须先停止 Monitor，更新 state.json 后重新启动 Monitor**（否则 Monitor 看到旧 done 状态立即误触发）
- `retryCount > 2`（即第 3 次驳回后）→ phase = PAUSED

### phases.verify

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

**按 type 分支执行**：
- `fullstack`：所有 7 项检查都执行
- `backend-only`：只执行 backendBuild、backendTest、diffCheck、gitStatus；前端/typecheck 相关项标记为 `"skipped": true`
- `frontend-only`：只执行 frontendBuild、frontendTest、typeCheck、diffCheck、gitStatus；后端相关项标记为 `"skipped": true`

`diffCheck.expectedFiles` = `phases.backend.filesChanged` + `phases.frontend.filesChanged`（排除 skipped 的阶段）。

**VERIFY 失败处理**：verdict=failed → phase=PAUSED，errors[] 中 type="verify_failed"，detail 列出具体失败的检查项名称。用户修复后改 phase 回到对应开发阶段。**恢复时需要重置下游阶段**：如回到 BACKEND，则 BACKEND、FRONTEND（如适用）、REVIEW、VERIFY 全部 status=pending。

### errors

```json
[
  {
    "id": "ERR-001",
    "phase": "backend",
    "time": "ISO8601",
    "type": "build_failed | test_failed | review_rejected | timeout | codex_error | verify_failed",
    "detail": "dotnet build 退出码 1。CableScene.cs(42,10): error CS0246: 找不到类型",
    "action": "已自动重试 2 次仍失败。建议检查类型定义。",
    "resolved": true,
    "resolvedAt": "ISO8601"
  }
]
```

重试成功后必须将对应的 error 标记为 `resolved: true`。

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

**所有状态变更都必须追加**，包括：pending→in-progress, in-progress→done, in-progress→failed, failed→in-progress（重试）, done→pending（回退重置）。每个步骤在修改 status 后必须同时追加 history。

## 执行模型

**核心原则**：Claude 直接驱动阶段推进（同步调用 Codex、自行执行 VERIFY），Monitor 只监听 Cursor 的 `phases.frontend.status` 变化。

每步开始时检查 `status` 字段：若为 `aborted` → 跳到步骤 13（清理退出）。

### Claude 主流程

```
1. 收到需求
2. 分析 → 写 spec + plan + task 文件
3. 获取模块锁 → 创建 feature 分支
4. 初始化 state.json (phase: PLANNING, status: running, 更新 updated + history)
5. 完成 planning:
   - 设 phases.planning.status = done, completed = 当前时间
   - 写 phases.planning.handoffNote (任务概述，供 BACKEND 的 Codex Task 引用)
   - 追加 history (in-progress→done)
   - 更新 updated
   - phase = BACKEND

6. 直接执行 BACKEND:
   a. 检查 status = aborted? → 跳到步骤 13
   b. 检查 retryCount > 2 → phase = PAUSED，跳到步骤 12
   c. 如果是 REVIEW 驳回后回退或 PAUSED 恢复:
      - 重置 status=pending, _invoked=false, retryCount=0, 清空旧 commit/filesChanged/testResults/handoffNote
      - 追加 history (当前status→pending), 更新 updated
      - **级联重置**: fullstack 模式下同时重置 phases.frontend 为 pending, 清空旧数据
        (后端变更可能影响前端, Cursor 需验证兼容性)
   d. 生成 Codex Task 文件:
      - 首次执行：包含 planning.handoffNote
      - 重试执行：额外包含 errors[] 中最近一次失败详情
      - 驳回修复：额外包含 review.issues 中该阶段的 blocking 问题
   e. 设 _invoked = true, status = in-progress, started = 当前时间,
      追加 history (pending→in-progress), 更新 updated
   f. Bash: codex exec -p "$(cat tasks/...-task.md)"  (同步等待，超时 30min)
   g. 检查 status = aborted? → 跳到步骤 13
   h. 检查退出码:
      - 0 + git log 有新 commit → 继续 i
      - 0 + git log 无新 commit → 警告 "Codex 退出但未产生 commit",
        设 status=failed, retryCount++, 写 error, 回到 b
      - 非 0 或超时 → 设 _invoked=false, status=failed, retryCount++,
        写 error (含退出码/stderr), 追加 history (in-progress→failed), 回到 b
   i. 设 _invoked=false, status=done, 填充 commit/filesChanged/testResults
   j. 写 handoffNote (给 FRONTEND 或 REVIEW 的交接说明)
   k. 追加 history (in-progress→done), 更新 updated
   l. 释放后端模块锁 (REVIEW 驳回场景需重新获取)

7. 判断 type:
   - backend-only → 设 phases.frontend.status = "skipped", phase = REVIEW
   - frontend-only → phase = FRONTEND, 启动 Monitor
   - fullstack → phase = FRONTEND, 启动 Monitor

8. FRONTEND 阶段:
   a. 检查 status = aborted? → 跳到步骤 13
   b. 如果是 REVIEW 驳回后回退或 PAUSED 恢复:
      - 停止 Monitor (kill watch.pid)
      - 重置 status=pending, 清空旧 commit/filesChanged/testResults/handoffNote
      - 追加 history (当前status→pending), 更新 updated
      - 重新启动 Monitor
   c. 通知用户打开 Cursor，粘贴 Cursor Prompt Template
      (驳回场景：额外粘贴 review.issues 中 frontend 的 blocking 问题)
   d. 检查 Monitor 存活 (kill -0 $(cat watch.pid) 2>/dev/null):
      - 已死 → 清理 PID, 重新启动 Monitor
      - 存活 → 继续
   e. Monitor 等待 FRONTEND:done 或 PIPELINE:aborted
   f. 检测到 done → 停止 Monitor:
      - 如果是 PIPELINE:aborted → 跳到步骤 13
      - 如果是 FRONTEND:done → 验证 ALL required fields:
      - commit 非空
      - filesChanged 非空数组
      - testResults 对象存在
      - handoffNote 非空
      任一缺失 → phase=PAUSED, error="Cursor 未完整填写 state.json"
   g. 追加 history (in-progress→done), 更新 updated
   h. 释放前端模块锁
   i. phase = REVIEW

9. 直接执行 REVIEW:
   a. 检查 status = aborted? → 跳到步骤 13
   b. 检查 retryCount > 2 → phase = PAUSED，跳到步骤 12
   c. 如果是重新执行 (retry 或驳回后重入):
      - 重置 status=pending, _invoked=false, 清空旧 verdict/issues
      - 追加 history (当前status→pending), 更新 updated
   d. 生成 review task 文件:
      - 包含 phases.backend.handoffNote
      - 包含 phases.frontend.handoffNote (非 skipped 时)
      - 指定 scope: backendCommit + frontendCommit (可为 null)
      - 如果 backend-only: 说明只审核后端 diff
   e. 设 _invoked=true, status=in-progress, started=当前时间,
      追加 history (pending→in-progress), 更新 updated
   f. Bash: codex exec -p "$(cat tasks/...-review-task.md)"  (同步等待，超时 15min)
   g. 检查 status = aborted? → 跳到步骤 13
   h. 检查退出码:
      - 0 → 继续 i
      - 非 0 或超时 → 设 _invoked=false, status=failed, retryCount++,
        写 error, 追加 history (in-progress→failed), 回到 b
   i. 读 tasks/active/review-output.json → 校验 JSON 结构 → 合并到 state.json
   j. 判断 verdict:
      - approved / approved_with_issues → phase = VERIFY
      - rejected:
        retryCount++
        - retryCount <= 2: 追加 history (in-progress→failed),
          标记 phases.review.status = rejected,
          释放相关模块锁（回退后会重新获取）,
          按 affectedPhase 回退到步骤 6 或 8
        - retryCount > 2: phase = PAUSED，跳到步骤 12

10. 直接执行 VERIFY:
    a. 检查 status = aborted? → 跳到步骤 13
    b. 按 type 分支执行检查:
       - fullstack: backendBuild, backendTest, frontendBuild, frontendTest, typeCheck, diffCheck, gitStatus
       - backend-only: backendBuild, backendTest, diffCheck, gitStatus (前端项标记 skipped)
       - frontend-only: frontendBuild, frontendTest, typeCheck, diffCheck, gitStatus (后端项标记 skipped)
    c. diffCheck: expectedFiles = backend.filesChanged + frontend.filesChanged, actualFiles = git diff --name-only main...HEAD
    d. 全部通过 → phase = DONE
    e. 任一失败 → 设 status=failed, verdict=failed,
       写 verify_failed error (detail 列出失败项名称), 追加 history,
       phase = PAUSED, 跳到步骤 12

11. DONE:
    a. 释放所有模块锁
    b. 移动文件到归档: tasks/active/state.json → tasks/completed/TASK-XXXX-state.json
    c. 删除 tasks/active/watch.sh + watch.pid (如果存在)
    d. 追加最终 history (phase→DONE), 更新 updated
    e. 交付报告给用户 (commit 列表 + 测试结果 + 已知限制)

12. PAUSED 等待恢复:
    a. 设 status = paused, phase = PAUSED, 更新 updated
    b. 通知用户: 流水线暂停，原因见 errors[]
    c. 进入 PAUSED 轮询: 每 2 秒读 state.json, 检查 status + phase, 最长持续 1 hour
    d. status = aborted → 跳到步骤 13
    e. 超时 (1 hour 无变化) → 自动 status=aborted, 跳到步骤 13
    f. phase != PAUSED 且 status = running:
       - 重置目标阶段的 retryCount=0, status=pending, _invoked=false
       - **级联重置**：所有下游阶段也重置为 pending (例如回到 BACKEND，则 FRONTEND/REVIEW/VERIFY 也重置)
       - 标记相关 error 为 resolved
       - 追加 history (PAUSED→新phase), 更新 updated
       - 从对应步骤 (6/8/10) 继续执行

13. ABORT 清理:
    a. 释放所有模块锁
    b. Kill Monitor 进程 (如果 watch.pid 存在)
    c. 设 status = aborted, phase 保持当前值, 更新 updated
    d. 追加 history (当前 phase→aborted)
    e. 报告: 流水线已中止，当前分支保留，模块锁已释放
    f. 不归档 state.json (保留现场供排查)
```

## Crash Recovery

Claude 重启时执行恢复流程：

```
1. 检查 tasks/active/state.json 是否存在
2. 不存在 → 无活动流水线，退出
3. 存在 → 读 state.json:
   a. status = aborted → 跳过，退出
   b. status = paused → 提示用户当前 paused，等待用户操作
   c. phase = PLANNING → 继续步骤 5
   d. phase = BACKEND | REVIEW → 检查 _invoked + status 组合:
      - _invoked=false, status=pending                  → 正常初始状态，从对应步骤 6/9 继续
      - _invoked=false, status=in-progress              → Claude 崩溃在设 _invoked 之前，视为 pending，重新执行
      - _invoked=true,  status=in-progress, git 有新commit → Codex 已完成但未更新 state,
                                                          Claude 补填 commit/filesChanged/testResults,
                                                          设 _invoked=false, status=done, 推进
      - _invoked=true,  status=in-progress, git 无新commit → Codex 未完成或未启动,
                                                          设 _invoked=false, status=pending, 重新调用
      - _invoked=false, status=done                     → 已完成，推进到下一阶段
      - _invoked=true,  status=done                     → Codex 完成但忘清 _invoked，设 _invoked=false，推进
      - _invoked=false, status=failed                   → Claude 已标记失败，检查 retryCount 决定重试或 PAUSED
      - _invoked=true,  status=failed                   → Codex 标记失败，同 failed 处理
      注意: handoffNote 无法从 git log 重建；补填时 handoffNote 填 "[由 crash recovery 补填，原始内容丢失]"
   e. phase = FRONTEND:
      - 先 kill 旧 Monitor (检查 watch.pid 是否存活)
      - 清理僵尸 PID 文件
      - 重启 Monitor, 等待 Cursor
   f. phase = VERIFY → 重新执行步骤 10
   g. phase = PAUSED → 提示用户，执行步骤 12 轮询
   h. phase = DONE → 执行步骤 11 归档
```

## Monitor 检测机制

Monitor **只监听 `phases.frontend.status`**。

```bash
#!/bin/bash
# tasks/active/watch.sh
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$SCRIPT_DIR/watch.pid"
STATE_FILE="$SCRIPT_DIR/state.json"

echo $$ > "$PID_FILE"
trap "rm -f '$PID_FILE'" EXIT

PREV_FRONTEND=""
while true; do
  # 同时监听顶层 status (abort 检测) 和 frontend.status
  PIPELINE_STATUS=$(jq -r '.status' "$STATE_FILE" 2>/dev/null || echo "N/A")
  if [ "$PIPELINE_STATUS" = "aborted" ]; then
    echo "PIPELINE:aborted"
    break
  fi
  CUR=$(jq -r '.phases.frontend.status' "$STATE_FILE" 2>/dev/null || echo "N/A")
  if [ "$CUR" != "$PREV_FRONTEND" ] && [ "$CUR" != "N/A" ]; then
    echo "FRONTEND:$CUR"
    PREV_FRONTEND="$CUR"
  fi
  sleep 1
done
```

注意：`watch.sh` 使用绝对路径（`$SCRIPT_DIR`），不依赖当前工作目录。

启动前检查 `watch.pid`：存活 → kill 后重启；已死 → 清理 PID 后启动。

| 事件 | Claude 动作 |
|------|------------|
| `FRONTEND:done` | 验证所有 required fields → 停止 Monitor → phase = REVIEW |
| `FRONTEND:failed` | phase = PAUSED, 通知用户 |
| `PIPELINE:aborted` | 停止 Monitor → 跳到步骤 13 (ABORT 清理) |
| `FRONTEND:pending` / `FRONTEND:in-progress` | 忽略 (正常过渡状态，restart 时会短暂出现) |

Cursor 的 Prompt Template 要求**一次性写入所有字段**（status + commit + filesChanged + testResults + handoffNote），避免 Monitor 在部分写入时触发。

## Agent 集成规范

### Codex 集成

每次调用前 Claude 生成 Codex Task 文件，根据场景选择模板：

**首次开发任务** (`tasks/YYYY-MM-DD-<name>-task.md`)：
```markdown
# Codex Task

## 当前流水线上下文
请先读取 tasks/active/state.json 了解完整上下文。

## 任务说明
<phases.planning.handoffNote>

## 具体任务
<开发任务描述>

## 完成后必须执行
1. 确保所有改动已 git commit (所有改动放在一个 commit 中)
2. 更新 tasks/active/state.json (一次写入所有字段):
   - phases.<当前阶段>.status = "done"
   - phases.<当前阶段>.commit = $(git rev-parse HEAD)
   - phases.<当前阶段>.commitMsg = "<提交说明>"
   - phases.<当前阶段>.filesChanged = $(git diff --name-only HEAD~1)
   - phases.<当前阶段>.testResults = <运行测试并填写结果>
   - phases.<当前阶段>.handoffNote = "<给下一阶段的交接说明>"
   - phases.<当前阶段>._invoked = false
```

**重试任务** (复用原 task 文件，Claude 在 prompt 前追加)：
```markdown
## 上次失败信息
<errors[] 中最近一条的 detail 和 action>
请基于以上错误信息修正后重试。
```

**驳回修复任务** (`tasks/YYYY-MM-DD-<name>-fix-task.md`)：
```markdown
# Codex Fix Task (REVIEW Rejected)

## 审核驳回原因
<review.issues 中所有 blocking 且 affectedPhase 匹配当前阶段的 issue>
请逐一修复上述问题。

## 原始任务
<原 task 文件内容>

## 完成后必须执行
(同首次开发任务)
```

### Cursor 集成

**首次 Prompt Template**：
```markdown
## Cursor Frontend Task

当前流水线：读取 tasks/active/state.json 了解后端产出和上下文。

后端已完成的工作：
<phases.backend.handoffNote>

后端 API 提交：<phases.backend.commit>
后端改动文件：<phases.backend.filesChanged>

你的任务：<从 task 文件摘取的前端任务描述>

完成后必须更新 tasks/active/state.json (一次性写入所有字段)：
1. phases.frontend.status = "done"
2. phases.frontend.commit = 执行 git rev-parse HEAD 获取
3. phases.frontend.commitMsg = "<你的提交说明>"
4. phases.frontend.filesChanged = 执行 git diff --name-only HEAD~1 获取
5. phases.frontend.testResults = 执行 npx vitest run --reporter=json 获取
6. phases.frontend.handoffNote = "<给审核阶段的交接说明>"

确认所有改动已 commit。
```

**驳回修复 Prompt Template**（在首次模板基础上追加）：
```markdown
## 上次审核发现的问题 (必须修复)
<review.issues 中 affectedPhase=frontend 的 blocking 项>
请在当前代码基础上修复上述问题。
```

## 模块锁集成

- **获取**：PLANNING 完成后、进入 BACKEND 前 → 锁后端模块。进入 FRONTEND 前 → 锁前端模块
- **释放**：阶段完成后释放本阶段模块锁
- **驳回回退**：回退前释放相关锁，重新进入后重新获取
- **Abort**：释放所有锁
- backend-only 只锁后端模块，frontend-only 只锁前端模块

## JSON Schema 校验

`tasks/active/state.schema.json` 提供完整 JSON Schema。Claude 使用两层校验：

1. **快速闸门** (每次写入后)：`jq -e '.phase and .status' state.json` — 验证基本结构存在
2. **完整校验** (关键节点：phase 变更前)：`npx ajv validate -s state.schema.json -d state.json` — 完整 schema 校验

两层都通过才允许继续。校验失败 → phase=PAUSED。

## 状态流转图（含异常路径）

```
                         ┌──────────────────────────────┐
                         │          PAUSED               │
                         │  (用户修复后手动设 phase)       │
                         │  超时 1h → auto-abort          │
                         └──────────┬───────────────────┘
                                    ▲
               timeout/retry>2/      │
               verify失败/review>2   │
                                    │
PLANNING → BACKEND → FRONTEND → REVIEW → VERIFY → DONE
   │          ▲         ▲         │                  │
   │          │         │    rejected (retryCount≤2)  │
   │          │         └─────────┤ (frontend         │
   │          │                   │  blocking时)      │
   │          └───────────────────┘ (backend blocking)
   │          
   └── frontend-only: 跳过 BACKEND
   
用户设 status=aborted → 任意 abort 检查点 → 步骤 13 清理
backend-only: BACKEND → REVIEW (跳过 FRONTEND, frontend.status=skipped)
frontend-only: PLANNING → FRONTEND → REVIEW → VERIFY → DONE
```

## 设计决策

| 决策 | 选择 | 原因 |
|------|------|------|
| 编排方式 | state.json 状态机 | 共享文件，零网络依赖 |
| 执行模型 | Claude 直接驱动 + Monitor 仅监听 Cursor | 避免自己写 phase 自己监听的回环 |
| Codex 集成 | Bash 同步调用 + 结构化 task 文件 | 可编程驱动，task 文件包含完整 state.json 读写指令 |
| Codex 输出 | review-output.json (结构化) | 解决非结构化审核文本无法程序化解析的问题 |
| Cursor 集成 | 手动 + Prompt Template | Cursor 无 CLI 接口 |
| 状态检测 | Monitor 轮询 + PID 文件 | 环境无 inotifywait |
| 错误恢复 | 自动重试最多 2 次 (共 3 次尝试) → PAUSED | retryCount > 2 触发暂停，避免死循环 |
| 崩溃恢复 | `_invoked` + `status` 组合矩阵 (8 种状态全覆盖) | 精确区分"未调用/调用中/已完成/已失败" |
| Review 阻断 | blocking + affectedPhase 回退 + 目标阶段状态重置 | 精确回退，状态机语义不混乱 |
| Review 驳回上限 | retryCount ≤ 2, 即最多 3 次 Review | 避免无限驳回循环 |
| PAUSED 超时 | 1 hour 无操作 → auto-abort | 防止流水线永久挂起 |
| 级联重置 | PAUSED 恢复/回退时下游所有阶段 status→pending | 确保状态机一致性 |
| Abort | 步骤边界检查 + Bash 返回后检查 | Bash 同步阻塞期间无法中断是已知限制 |
| 模块锁 | 按 type 获取/释放 + 回退时重新获取 | 防止并发冲突 |

## 已知限制

| 限制 | 影响 | 缓解 |
|------|------|------|
| Cursor 仍需手动 | 无法全自动 | DeepSeek Flash 成熟后可切全 Codex CLI |
| Bash 同步阻塞期间无法感知 abort | 最坏等 30min | Bash 返回后立即检查 status |
| handoffNote 崩溃后无法重建 | 交接信息丢失 | crash recovery 用占位文本标注丢失 |
| state.json 无文件锁 | 理论上有竞争风险 | 流程串行，同一时间只有 Claude 或 Codex 之一写入 |
| Codex CLI 接口未验证 | task 文件格式可能需调整 | 第一次端到端测试验证 |
| watch.sh 用轮询 | 最多 1s 延迟 | 对分钟级开发阶段可忽略 |
| SIGKILL 无法触发 trap | PID 文件残留 | 启动时检查存活，死进程自动清理 |

## 验收标准

- [ ] AC-01：用户提需求后，Claude 生成 task + state.json，phase 从 PLANNING 开始，type 在 planning 阶段确定
- [ ] AC-02：PLANNING 完成后进入 BACKEND，Claude Bash 调用 Codex 同步执行
- [ ] AC-03：Codex 完成后按 task 文件指令完整更新 state.json（所有 required fields）
- [ ] AC-04：FRONTEND 阶段 Monitor 检测 done → 验证所有 fields → 推进 REVIEW
- [ ] AC-05：REVIEW rejected (retryCount≤2) → 回退到对应阶段并重置其状态 + Monitor（FRONTEND 时）
- [ ] AC-06：REVIEW rejected (retryCount>2) → phase = PAUSED
- [ ] AC-07：任何阶段 retryCount>2 或超时 → phase = PAUSED, errors 完整记录
- [ ] AC-08：backend-only 跳过 FRONTEND (status=skipped)，VERIFY 只执行后端检查
- [ ] AC-09：frontend-only 跳过 BACKEND，VERIFY 只执行前端检查
- [ ] AC-10：VERIFY 全部检查通过 → DONE → 模块锁释放 → 归档到 completed/
- [ ] AC-11：Claude 崩溃重启后，通过 _invoked+status 组合矩阵（8 种）正确恢复
- [ ] AC-12：每次状态写入后 jq 校验通过，phase 变更前 ajv schema 校验通过
- [ ] AC-13：用户设 status=aborted → 下次 abort 检查点触发清理（释放锁、kill Monitor、停止执行）
- [ ] AC-14：PAUSED 状态 1 hour 无变化 → 自动 abort
- [ ] AC-15：所有 state.json 写入同步更新 updated 字段和追加 history 记录
