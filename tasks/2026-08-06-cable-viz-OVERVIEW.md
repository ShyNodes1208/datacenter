# 线缆可视化 — Cursor 任务总览

> **创建时间:** 2026-08-06
> **设计文档:** docs/superpowers/specs/2026-08-05-cable-visualization-design.md
> **实现计划:** docs/superpowers/plans/2026-08-05-cable-visualization.md

## 依赖关系

```
Task 1 (Cable.Purpose 迁移)
  └─ Task 2 (CablesController Purpose 支持)
  └─ Task 3 (CableSceneController 新端点)
        └─ Task 4 (useCableScene 深模块)
              ├─ Task 5 (CableLayer SVG 组件)
              ├─ Task 6 (Breadcrumb + Legend 组件)
              ├─ Task 7 (FloorplanCanvas 集成)
              └─ Task 8 (RackDeviceView 集成)
```

## 执行顺序建议

### 第一批 (可并行): Task 1
- Task 1 是基础迁移，先跑

### 第二批 (Task 1 后并行): Task 2 + Task 3
- Task 2 和 Task 3 互不依赖

### 第三批 (Task 3 后): Task 4
- 核心深模块，单文件新建

### 第四批 (Task 4 后并行): Task 5 + Task 6
- 三个新组件互不依赖

### 第五批 (Task 5+6 后并行): Task 7 + Task 8
- 两个视图集成

## 任务清单

| # | 任务 | 类型 | 文件数 | 预计复杂度 |
|---|------|------|--------|-----------|
| 1 | Cable Purpose 迁移 | 后端 | 2 | 低 |
| 2 | CablesController Purpose 支持 | 后端 | 2 | 中 |
| 3 | CableSceneController | 后端 | 1 | 中 |
| 4 | useCableScene 深模块 | 前端 | 1 | 高 |
| 5 | CableLayer SVG 组件 | 前端 | 1 | 中 |
| 6 | Breadcrumb + Legend | 前端 | 2 | 低 |
| 7 | FloorplanCanvas 集成 | 前端 | 1 | 中 |
| 8 | RackDeviceView 集成 | 前端 | 1 | 高 |

## 每个任务的验证命令

```bash
# 后端
cd src/backend/Datacenter.Api && dotnet build

# 前端
cd src/frontend && npx vue-tsc --noEmit
```

## 全局约束 (所有任务遵守)

1. 只读 — 无新增写入端点
2. 动画尊重 `prefers-reduced-motion`
3. SVG 层显示 "路径追踪效果，非实时流量"
4. 线路不穿过设备主体
5. 同源柜+同目标柜+同类型 → 聚合线束
