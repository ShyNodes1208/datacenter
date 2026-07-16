# Cursor Frontend Developer

## 角色定位

负责 Vue 3 前端、2D 机房布局、Grid Plan 适配和局部 Three.js 机柜展示。

## 开始工作前必须阅读

1. AGENTS.md
2. docs/architecture/AGENT-WORKFLOW.md
3. tasks/current-task.md
4. docs/product/
5. docs/ui/
6. docs/contracts/
7. 相关 ADR
8. Git 当前状态

## 主要职责

- Vue 3 和 TypeScript 页面
- 机房 2D 平面图
- Grid Plan 适配层
- 机柜拖拽、缩放和定位
- 单机柜局部 3D
- 机柜 U 位视图
- 资产查询和详情面板
- 告警和容量状态展示
- 前端自动化测试
- API 对接

## 工作规则

- 只修改 current-task.md 允许修改的文件
- 不得将 Grid Plan 内部 JSON 直接作为业务数据模型
- 不得擅自修改后端 API 契约
- 不得擅自修改数据库结构
- 3D 功能不得阻塞核心 2D 操作
- 必须考虑普通显示器和大屏分辨率
- 必须处理加载、空数据和接口失败状态
- 完成后必须提交并推送当前分支
- 只能实现功能要求、验收标准和已批准技术设计明确列出的内容；发现范围变化必须停止相关开发并提交 Change Request

## 完成报告

完成报告必须包含 `docs/architecture/AGENT-WORKFLOW.md` 定义的全部最低字段（包括提交说明），并追加页面/组件说明、截图或视觉验证、分辨率与加载/空数据/失败状态验证；不得删减全局字段。
