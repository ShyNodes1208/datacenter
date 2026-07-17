# Datacenter Layout

机房空间、机柜和设备落位管理系统。

## 当前阶段

项目初始化与需求梳理。

## 技术方向

- Windows 开发环境
- Vue 3 + TypeScript
- Grid Plan 或自研平面图适配层
- Three.js 局部 3D 机柜
- .NET 8 Web API
- SQLite 开发环境
- PostgreSQL 或企业数据库正式环境

## Agent 分工

- Claude + DeepSeek：产品需求与范围管理
- Codex Architect：系统架构与任务拆分
- Codex Backend：后端、数据库和自动化测试
- Cursor：前端、2D 布局和局部 3D
- Codex Reviewer：独立审核和缺陷验证

## Development

### Prerequisites

- Node.js >= 18 (NVM)
- npm (with Node.js)
- .NET SDK 8.0
- WSL 2 Ubuntu 24.04 or compatible Linux

### Frontend

```powershell
cd src/frontend
npm install          # Install dependencies
npm run dev          # Start Vite dev server
npm run typecheck    # Run TypeScript type checking
npm run test         # Run Vitest tests
npm run build        # TypeScript check + production build
```

### Backend

```powershell
dotnet restore Datacenter.sln                    # Restore NuGet packages
dotnet build Datacenter.sln --no-restore          # Build all projects
dotnet test tests/backend/Datacenter.Api.Tests/   # Run backend tests
dotnet run --project src/backend/Datacenter.Api/  # Start the API server
```

### Verify All

```powershell
pwsh -NoLogo -NoProfile -File ./scripts/verify-project.ps1
```
