# BUG-001: Fix NaN% in rack card occupancy display

## Problem

机柜卡片显示 "已用/44U(NaN%)"，`occupiedU` 未正确读取或计算。

## Fix

**File:** `src/frontend/src/views/HomeView.vue`

检查机柜卡片中占用统计的代码：
1. 确认读取的字段名是 `occupiedU`（与后端 GET /api/racks 返回一致）
2. 百分比计算加防御：`totalU > 0 ? Math.round((occupiedU / totalU) * 100) : 0`
3. 如果 `occupiedU` 可能为 undefined/null，用 `(rack.occupiedU ?? 0)` 兜底
