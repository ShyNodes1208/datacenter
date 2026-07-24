# TASK-0032: Fix button and name position in merged U blocks

## Problem (from Codex review)

1. **移动/下架按钮在合并块垂直居中**（align-self: center）。应在合并块的顶部 U 行（最高 U 位）。

2. **设备名称只垂直居中、未水平居中**。应在合并区域内水平+垂直居中。

## Fix

**File:** `src/frontend/src/views/RackDeviceView.vue`

### 按钮位置
- 将按钮从 `align-self: center` 改为 `align-self: flex-start`
- 按钮应出现在合并块的**第一行**（即最高 U 编号的行）

### 设备名称位置
- 设备名应在合并区域中水平居中
- 建议使用 `flex: 1; text-align: center` 让名称占据剩余空间并居中
- 右侧按钮需要固定宽度，不随内容变化

## Constraints
- 不过度设计
- 不过度开发
