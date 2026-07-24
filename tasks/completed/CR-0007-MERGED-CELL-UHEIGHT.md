# Fix: 导入时处理 Excel 合并单元格

## 问题

`docs/机房机柜.xlsx` 中设备标签列有合并单元格，例如 `F12:F13` 合并为 "IPS  100.3"（占 2U）。当前导入逻辑按行逐格读取，合并区域只有左上角能读到值，其余格读出来是空字符串，导致：
- 多 U 设备只显示在起始 U 位
- UHeight 全部为 1
- 显示不正确

## 需要修改的文件

1. `src/backend/Datacenter.Api/Controllers/DevicePositionsController.cs` — 单柜导入
2. `src/backend/Datacenter.Api/Controllers/DevicePositionsBatchController.cs` — 批量导入

## 修改内容

在读取设备标签列的循环中，检测合并单元格：

1. 若当前单元格 `IsMerged()`：
   - 找到包含该单元格的合并区域 `MergedRange`
   - 如果不是该区域的左上角 → **跳过**（已由上一行处理）
   - 如果是左上角 → 取区域的值，`UHeight = 区域行数`
2. 若非合并单元格 → 保持现有逻辑，`UHeight = 1`

伪代码：

```
labelCell = worksheet.Cell(row, labelCol)
if labelCell.IsMerged():
    range = worksheet.MergedRanges.First(r => r.Contains(labelCell.Address))
    if labelCell.Address != range.FirstCell().Address:
        continue  // 不是左上角，跳过
    label = range.FirstCell().GetString().Trim()
    uHeight = range.RowCount()
else:
    label = labelCell.GetString().Trim()
    uHeight = 1
```

`importData` 字典需从 `Dictionary<int, string?>` 改为 `Dictionary<int, (string? Label, int UHeight)>`。

## 验收标准

1. 导入 `docs/机房机柜.xlsx` 后，IPS 100.3 显示 U32-U31（UHeight=2）
2. WAF-1 100.1 显示 U37-U36（UHeight=2）
3. 配线架 U42-U41 正确合并（两个 U 位同标签自动合并）
4. 非合并单元格 UHeight 仍为 1
5. 现有 76 个后端测试全部通过
6. `dotnet build` 0 错误 0 警告

## 完成后

- 提交代码
- 运行 `dotnet test`
- 报告结果
