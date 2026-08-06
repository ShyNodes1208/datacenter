# Agent 自动化流水线设计

## 概述

将 Claude(架构规划) + Cursor(前端开发) + Codex(后端开发+代码审核) 三个 Agent 通过共享状态文件串联为自动化流水线。用户提需求后，除 Cursor 需手动触发外，其余阶段全自动执行。

## 状态机流转

```
PLANNING → BACKEND → FRONTEND → REVIEW → VERIFY → DONE
  (Claude)  (Codex)   (Cursor)  (Codex)   (Claude)
```

6 个阶段串行执行。REVIEW 不通过时 `phase` 回退到对应开发阶段。

## 各阶段职责

| 阶段 | 执行者 | 触发方式 | 产出 |
|------|--------|---------|------|
| PLANNING | Claude | 用户提需求 | Task 文件 + state.json 初始化 |
| BACKEND | Codex CLI | Claude Bash 自动调用 | 后端代码 + commit + 测试结果 |
| FRONTEND | Cursor | 用户手动"继续" | 前端代码 + commit + 测试结果 |
| REVIEW | Codex CLI | Claude Bash 自动调用 | 审核报告 + issues 列表 |
| VERIFY | Claude | 自动 | build + test + typecheck + diff |

## 目录结构

```
tasks/active/
  state.json     # 当前流水线状态（有且仅有一个）
  watch.sh       # Monitor 轮询脚本

tasks/
  YYYY-MM-DD-<name>-task<N>.md   # 派发给开发 Agent 的任务文件
  MODULE-LOCKS.md                 # 模块锁（已有）
  current-task.md                 # 当前任务摘要（已有）

docs/superpowers/specs/   # 设计文档
docs/superpowers/plans/   # 实现计划
```

## state.json 完整 Schema

### 顶层

```json
{
  "version": "1.0",
  "pipeline": "TASK-XXXX",
  "phase": "PLANNING | BACKEND | FRONTEND | REVIEW | VERIFY | DONE",
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
| `version` | string | Schema 版本，升级时用于兼容 |
| `pipeline` | string | 流水线标识，对应 TASK ID |
| `phase` | string | 当前阶段，Monitor 轮询此字段 |
| `task` | object | 任务元信息，所有 Agent 启动时先读这个 |
| `phases` | object | 5 个阶段的详细状态 |
| `errors` | array | 错误记录，包含已解决和未解决的 |
| `history` | array | 阶段变更日志 |

### task

```json
{
  "id": "TASK-0022",
  "title": "线缆可视化",
  "plan": "docs/superpowers/plans/2026-08-05-cable-visualization.md",
  "spec": "docs/superpowers/specs/2026-08-05-cable-visualization-design.md",
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
  "taskFile": "tasks/2026-08-06-cable-viz-task1.md",
  "planFile": "docs/superpowers/plans/...",
  "specFile": "docs/superpowers/specs/...",
  "modules": ["CableService", "CableController"],
  "branch": "feature/TASK-0022-cable-viz",
  "commit": "abc1234",
  "summary": "人类可读的产出摘要"
}
```

### phases.backend

Codex CLI 全自动执行。

```json
{
  "status": "pending | in-progress | done | failed",
  "owner": "codex",
  "started": "ISO8601",
  "completed": "ISO8601",
  "branch": "feature/TASK-0022-cable-viz",
  "commit": "def5678",
  "commitMsg": "feat: add CableScene API",
  "filesChanged": ["src/backend/..."],
  "testResults": {
    "total": 203,
    "passed": 203,
    "failed": 0
  },
  "cliCommand": "codex exec --task tasks/... --target backend",
  "handoffNote": "给下一个阶段的交接说明"
}
```

### phases.frontend

Cursor 手动触发，完成后更新 state.json。

```json
{
  "status": "pending | in-progress | done | failed",
  "owner": "cursor",
  "started": "ISO8601",
  "completed": "ISO8601",
  "branch": "feature/TASK-0022-cable-viz",
  "commit": "ghi9012",
  "commitMsg": "feat: add cable visualization layer",
  "filesChanged": ["src/frontend/..."],
  "testResults": {
    "total": 72,
    "passed": 71,
    "failed": 1,
    "failures": ["CableLayer > path precision"]
  },
  "handoffNote": "1 个测试失败是精度问题，非逻辑错误"
}
```

### phases.review

Codex CLI 全自动执行，审核 backend + frontend 的 diff。

```json
{
  "status": "pending | in-progress | done | failed",
  "owner": "codex",
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
      "file": "src/...",
      "line": 142,
      "summary": "问题描述",
      "recommendation": "修复建议"
    }
  ],
  "cliCommand": "codex exec --review ...",
  "handoffNote": "交接说明"
}
```

**阻断规则**：只有 `severity: blocking` 会触发 `verdict: rejected`，pipeline 回退到对应开发阶段。minor/info 记录到已知限制，不阻断。

### phases.verify

Claude 自动执行最终质量闸门。

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
    "diffCheck": { "passed": true, "expected": 7, "actual": 7, "extra": [] },
    "gitStatus": { "passed": true, "clean": true }
  },
  "verdict": "ready | failed",
  "handoffNote": "交付说明"
}
```

### errors

```json
[
  {
    "id": "ERR-001",
    "phase": "backend",
    "time": "ISO8601",
    "type": "build_failed | test_failed | review_rejected | timeout | unknown",
    "detail": "错误详情",
    "action": "处理方式",
    "resolved": false,
    "resolvedAt": null
  }
]
```

**错误处理规则**：
- 非 blocking 自动重试最多 2 次，2 次后暂停
- blocking 立即暂停，写入 errors，等 Claude 决策
- 暂停时 `phase` 不变，Claude 手动修复后恢复

### history

```json
[
  {
    "time": "ISO8601",
    "phase": "backend",
    "from": "pending",
    "to": "in-progress",
    "by": "claude",
    "autoTriggered": true
  }
]
```

## Monitor 检测机制

由于环境中没有 inotifywait，使用轮询方式。脚本 `tasks/active/watch.sh`：

```bash
#!/bin/bash
PREV_PHASE=""
PREV_FE_STATUS=""
while true; do
  CUR_PHASE=$(jq -r '.phase' tasks/active/state.json 2>/dev/null || echo "IDLE")
  CUR_FE_STATUS=$(jq -r '.phases.frontend.status' tasks/active/state.json 2>/dev/null || echo "N/A")

  if [ "$CUR_PHASE" != "$PREV_PHASE" ]; then
    echo "PHASE:$CUR_PHASE"
    PREV_PHASE="$CUR_PHASE"
  fi

  # 仅在 FRONTEND 阶段监听 Cursor 的状态变化
  if [ "$CUR_FE_STATUS" != "$PREV_FE_STATUS" ] && [ "$CUR_PHASE" = "FRONTEND" ]; then
    echo "FRONTEND:$CUR_FE_STATUS"
    PREV_FE_STATUS="$CUR_FE_STATUS"
  fi

  sleep 1
done
```

同时监听两个字段：
- `phase`：阶段变更，Claude 自己写入 → 触发 Codex 调用或 Verify
- `phases.frontend.status`：Cursor 写入 `done` → Claude 检测到后推进到 REVIEW

Claude Code 通过 Monitor 工具运行此脚本。每行 stdout 是一个事件，Claude 收到后执行对应动作：

| 事件 | Claude 动作 |
|------|------------|
| `PHASE:BACKEND` | Bash 调用 Codex CLI 做后端开发 |
| `FRONTEND:done` | Cursor 完成，推进 phase 到 REVIEW |
| `PHASE:REVIEW` | Bash 调用 Codex CLI 做代码审核 |
| `PHASE:VERIFY` | 自动执行 build + test + diff |
| `PHASE:DONE` | 交付结果，停止 Monitor |

## Claude 主流程

```
1. 收到需求
2. 分析需求 → 写 spec + plan + task 文件
3. 创建 feature 分支
4. 初始化 tasks/active/state.json (phase: BACKEND)
5. 启动 Monitor 监听 state.json
6. 进入自动循环：
   - BACKEND  → codex exec → 更新 state → phase = FRONTEND
   - FRONTEND → 等待用户 + Monitor → 检测到 done → phase = REVIEW
   - REVIEW   → codex exec → 更新 state → phase = VERIFY
   - VERIFY   → build + test + diff → phase = DONE
   
   纯后端任务（无前端改动）时跳过 FRONTEND，BACKEND 完成直接进入 REVIEW。
7. 停止 Monitor → 交付结果
```

## 设计决策

| 决策 | 选择 | 原因 |
|------|------|------|
| 编排方式 | state.json 状态机 | 所有 Agent 共享同一文件，无需网络通信 |
| 状态检测 | Monitor + 轮询 jq | 环境没有 inotifywait，轮询 1s 延迟可接受 |
| Codex 集成 | Claude Bash 调用 CLI | Codex CLI 原生支持命令行 |
| Cursor 集成 | 手动 + 状态文件 | Cursor 无 CLI 接口 |
| 错误恢复 | 自动重试 2 次 → 暂停 | 避免死循环 |
| Review 阻断 | 只有 blocking 级别 | minor/info 不阻断交付 |
| 回退机制 | phase 字段回退 | 简单可靠，Monitor 自动检测重新触发 |

## 不足与风险

| 问题 | 影响 | 缓解 |
|------|------|------|
| Cursor 仍是手动 | 无法一键到底 | 等 DeepSeek Flash 足够好，切全 Codex CLI |
| 轮询有 1 秒延迟 | 阶段间短暂空转 | 可忽略，实际阶段都是分钟级 |
| state.json 无并发锁 | 同时写会覆盖 | 流程串行，同一时间只有一个写者 |
| Codex 额度限制 | 大任务可能耗尽 | Task 粒度控制 |
| Monitor 进程可能挂 | 流水线中断 | Verify 阶段检查完整性 |
| state.json 无 schema 校验 | 写错字段静默失败 | Claude 每次写后 jq 校验 |

## 验收标准

- [ ] AC-01：用户提需求后，Claude 自动生成 task 文件和 state.json，phase 初始化为 BACKEND
- [ ] AC-02：BACKEND 阶段，Claude 自动调用 Codex CLI，Codex 完成后更新 commit/testResults
- [ ] AC-03：FRONTEND 阶段，Monitor 检测到 Cursor 更新 state.json 后自动推进
- [ ] AC-04：REVIEW 阶段，Codex 审核报告写入 issues 数组，blocking 问题时 phase 回退
- [ ] AC-05：VERIFY 阶段，Claude 自动执行 build + test + typecheck + diff，全部通过后 phase = DONE
- [ ] AC-06：任何阶段失败，errors 数组记录错误详情和处理动作
- [ ] AC-07：非 blocking 错误自动重试最多 2 次，仍失败则暂停通知用户
- [ ] AC-08：流水线完成后，用户收到完整的交付报告（commit、测试结果、已知限制）
