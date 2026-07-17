# AGENTS.md

## 1. 项目目标

开发一套机房空间、机柜和设备落位管理系统。

系统以 2D 机房平面图为主要操作入口，以单机柜局部 3D 为辅助展示方式。

## 2. 固定开发环境

- 宿主操作系统：Windows
- 主要开发环境：WSL 2 Ubuntu 24.04
- 命令行：PowerShell（Windows 宿主）或 pwsh（WSL 内均可）
- Cursor 桌面版运行在 Windows，通过 WSL Remote 打开 Linux 项目
- Claude Code + DeepSeek 在 WSL 中运行
- Codex CLI 在 WSL 中运行
- Git、Node.js（NVM）、npm、.NET SDK 在 WSL 中运行
- Git 仓库位于 WSL Linux 文件系统（/home/shy/projects/datacenter-layout）
- 不依赖独立 Linux 服务器或远程开发机
- 所有构建、测试和开发命令在 WSL 终端中通过 pwsh 或 bash 执行
- 开发环境变更依据：CR-0001（tasks/CR-0001-WSL-DEV-ENVIRONMENT.md）

## 2.1 Agent 工作流权威来源

所有 Agent 必须遵守 [docs/architecture/AGENT-WORKFLOW.md](docs/architecture/AGENT-WORKFLOW.md)。该文档是任务状态与迁移、模块占用、交接、Reviewer 独立性、产品/技术裁决、范围变更、完成报告、Git 推送和最终完成条件的唯一权威来源。本文及角色文件只定义项目或角色补充约束；发生冲突时以权威工作流为准。

所有计划、设计和实现还必须通过该文档的“防过度规划、过度设计和过度开发门禁”：只交付可追踪到当前需求与验收标准的最小实现，禁止提前实现未来需求或引入未批准的复杂度。

## 3. Agent 角色

### Claude + DeepSeek

负责：

- 产品需求梳理
- grill-me 需求追问
- PRD
- 用户流程
- 范围管理
- 验收标准
- 需求变更裁决

原则上不直接修改业务代码。

### Codex Architect

负责：

- 系统架构
- 数据模型
- API 契约
- 安全设计
- ADR
- 技术任务拆分
- 技术风险判断

### Codex Backend

负责：

- .NET 后端
- 数据库
- API
- 权限
- 审计
- 单元测试
- 集成测试

### Cursor Frontend

负责：

- Vue 3 前端
- 2D 平面布局
- Grid Plan 适配
- Three.js 局部 3D
- 页面交互
- 前端测试

### Codex Reviewer

负责：

- 独立代码审核
- 测试审核
- 安全审核
- 性能审核
- 缺陷报告
- 修复复审

Reviewer 默认不直接修改被审核代码。

## 4. 关键架构约束

1. 2D 是主要操作界面，3D 是辅助界面。
2. 业务数据不能直接依赖 Grid Plan 的内部 JSON 格式。
3. 必须设计独立的平面图数据模型和渲染适配层。
4. 后端 API 契约由 Codex Architect 管理。
5. Cursor 不得自行修改后端 API 契约。
6. 所有设备上下架和位置变更必须保留审计记录。
7. 设备 U 位必须进行范围和冲突校验。
8. 所有重要功能必须有可执行的验收标准。
9. 所有 Agent 开始任务前必须读取 AGENTS.md、docs/architecture/AGENT-WORKFLOW.md 和 current-task.md。
10. 同一时间只能有一个 Agent 修改同一个业务模块；认领、父子路径冲突检测、交接和释放必须登记在 tasks/MODULE-LOCKS.md，并遵守权威工作流。

## 5. Git 规则

- main：稳定主分支
- feature/*：功能开发
- fix/*：缺陷修复
- poc/*：技术验证
- review/*：仅存放审核资料时使用

禁止直接在 main 分支进行大规模业务开发。

## 6. 当前阶段禁止范围

第一阶段暂不开发：

- 全建筑 BIM
- 全机房高精度 3D 漫游
- 实时线缆动画
- 完整供电链路
- 温度流体仿真
- AI 自动容量预测
- 完整 ITSM
- 完整监控平台

## 7. GitHub 同步规则

远程仓库：

https://github.com/ShyNodes1208/datacenter.git

固定要求：

1. 每个通过验收的任务必须创建 Git 提交。
2. 每个本地提交必须同步推送到 GitHub。
3. 未提交或未推送的任务不能标记为完成。
4. 提交前必须执行构建和相关测试。
5. 推送前必须确认 git status 中不存在意外文件。
6. 禁止提交密码、Token、数据库连接密码和生产环境配置。
7. main 分支只保存经过审核的稳定代码。
8. feature/*、fix/*、poc/* 分支也必须推送到 GitHub，不能只保存在本地。
9. Agent 完成任务时必须报告：
   - 当前分支
   - 提交哈希
   - 提交说明
   - 测试结果
   - 推送结果
10. 只有满足权威工作流中的全部最终完成条件，才可由独立 Reviewer 将任务转为 `COMPLETED`。

完成报告最低字段以权威工作流为准，任何角色只能追加字段，不得删减。
