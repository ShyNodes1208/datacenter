# CLAUDE.md — datacenter 项目入口（Claude Code）

项目规则：先读 AGENTS.md（角色、约束、权威工作流 docs/architecture/AGENT-WORKFLOW.md）。

每次会话进入本项目后的启动流程：

1. 确认 Git 根目录、分支、状态（`git rev-parse --show-toplevel`、`git status`）
2. 按顺序读取共享状态（`.ai/`，本地不入 Git）：
   - `.ai/PROJECT.md`
   - `.ai/ARCHITECTURE.md`
   - `.ai/PLAN.md`
   - `.ai/TASKS.md`
   - `.ai/HANDOFF.md`
3. 相关时再读：`.ai/DECISIONS.md`、`.ai/REVIEW.md`、`tasks/current-task.md`、`tasks/MODULE-LOCKS.md`
4. 先输出状态摘要（当前目标 / 进度 / 未完成 / Git 状态），再开始新工作

规则：

- 项目事实只保存在 `.ai/` 与 `docs/`，不要复制进本文件
- 一个开发阶段结束、准备切换 Agent 时：更新 `.ai/HANDOFF.md` 与 `.ai/TASKS.md`（必要时 `.ai/DECISIONS.md`），再退出
- 不要与其他 Agent 同时修改同一 working tree（`.ai/.agent-lock` 由 `agent` 命令管理）
- 不要反复推翻 `.ai/DECISIONS.md` 已记录的决策；有异议先读证据
