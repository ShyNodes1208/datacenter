# TASK-0031: Fix U display order back to U44-top

## Problem

TASK-0030 把 U 位顺序改成了 U1 → U44（自上而下），但用户要求是：

**界面自上而下为 U44 → U1**（高 U 位在上面，低 U 位在下面）

物理机柜中 U1 是最底部，U44 是最顶部。机柜视图应该像从正面看机柜一样，顶部在上面。

## Fix

**File:** `src/frontend/src/views/RackDeviceView.vue`

1. **U 位顺序**：恢复为 U44 在顶部、U1 在底部（即 positions 按降序排列，不要 reverse）
2. **保留 TASK-0030 的其他改动**：
   - 多 U 设备合并单元格 ✅
   - 每行显示各自 U 编号（U44、U43...），不用 "U21-U22" 范围格式 ✅
   - 设备名在合并区内居中 ✅

简单说：只把 U 顺序改回 U44-top，其他不动。

## Constraints
- 不过度设计
- 不过度开发
