# Change Request CR-0001

## 基本信息

- Change Request ID：CR-0001
- 发现者：Claude + DeepSeek Product Manager
- 原任务：TASK-0005（MVP 技术架构与开发基线）
- 变更原因：原 `AGENTS.md` 第 2 节禁止使用 WSL 和 Linux，要求所有命令在 Windows PowerShell 运行。TASK-0005 架构基线采用 WSL 2 Ubuntu 24.04 作为开发环境。经 hangyu/项目负责人评估并批准，WSL 2 作为 Windows 宿主上的 Linux 开发环境是当前团队的实际工作方式。需要更新 AGENTS.md 以反映实际开发环境。
- 产品范围影响：无。开发环境变更不影响 MVP 功能范围、用户角色、业务流程或验收标准。
- 技术影响：AGENTS.md 第 2 节需更新；架构基线文档中的开发环境描述已基于 WSL 2。Windows PowerShell 脚本保留，但 WSL 中统一通过 `pwsh` 执行。
- 文件影响：
  - AGENTS.md（修改第 2 节）
  - docs/architecture/MVP-ARCHITECTURE-BASELINE.md（开发环境描述保持一致）
- 测试影响：无。工作流校验脚本 `validate-agent-workflow.ps1` 通过 `pwsh` 在 WSL 中可正常执行，已验证 20/20 PASS。
- 风险：低。WSL 2 是 Windows 官方支持的 Linux 子系统；前端和后端工具链（Node.js、.NET SDK）在 WSL 中均有官方支持。
- Claude 裁决：批准。开发环境是技术实施细节，不影响产品基线。
- Architect 裁决：批准。WSL 2 是当前团队标准开发环境。
- 更新后的 Requirement Source：不适用（产品需求不变）。
- 批准状态：APPROVED

## 新开发环境约束

- Windows 作为宿主操作系统
- WSL 2 Ubuntu 24.04 作为主要开发、构建、测试和 Agent 命令执行环境
- Cursor 桌面版运行在 Windows，通过 WSL Remote 打开 Linux 项目
- Claude Code + DeepSeek 在 WSL 中运行
- Codex CLI 在 WSL 中运行
- Git、Node.js、npm、.NET SDK 在 WSL 中运行
- Git 仓库位于 `/home/shy/projects/datacenter-layout`（WSL Linux 文件系统）
- 不依赖独立 Linux 服务器
- 不依赖远程开发机
- 不要求 WSL 之外的服务器环境参与本地开发
- Windows PowerShell 脚本保留，WSL 中通过 `pwsh` 执行
- 生产部署方式仍由后续部署任务决定，WSL 仅是本地开发环境

## 裁决日期

2026-07-17
