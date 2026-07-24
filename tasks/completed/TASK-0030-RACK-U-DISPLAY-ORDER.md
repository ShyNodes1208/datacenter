# TASK-0030: Fix rack U-position display order and label format

## Requirements

1. **U 位顺序**：U1 在最上面，U44 在最下面（目前是反的：U44 在上，U1 在下）。物理机柜中 U1 是顶部。

2. **合并单元格**：占用超过 1U 的设备要像 Excel 合并单元格一样显示（一个蓝色块跨多行），目前已有部分实现，需要确认在 U1-top 顺序下正确。

3. **U 位标签**：每一行显示各自的 U 位编号（如 U1、U2、U3），不要显示 "U21-U22" 这样的范围格式。设备名称在合并区域内居中显示即可。

## Fix

**File:** `src/frontend/src/views/RackDeviceView.vue`

### Step 1: Reverse U order
- 后端 `GET /api/racks/{id}/device-positions` 返回的 positions 是降序（U44 → U1）
- `mergedPositions` computed 目前按降序处理
- 改为先 reverse 数组为升序（U1 → U44），再处理合并逻辑
- 或者直接修改迭代逻辑从数组末尾开始

### Step 2: Fix U label
- 当前 merged block 显示 `U{{ startU }}{{ startU !== endU ? '-U' + endU : '' }}`
- 改为每个 U 行显示自己的 U 编号（U1、U2...），不显示范围
- 设备名称只显示一次，在合并区域中

### Step 3: Verify merged cells
- Excel 导入的多U设备仍然合并显示
- 手动上架的服务器也合并显示（TASK-0027 已实现）
- 在 U1-top 顺序下，startU 是较小的数（顶部），endU 是较大的数（底部）

## Constraints
- 不过度设计
- 不过度开发
