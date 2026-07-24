# Fix: GET device-positions 多 U 设备覆盖 U 位未跳过

## 问题

导入已正确识别合并单元格并设置 UHeight，但 GET 接口构建 positions 列表时，多 U 设备覆盖的低位 U 仍生成独立空行。

例如：IPS 100.3 在 U32、UHeight=2。GET 返回：
```json
{"uNumber": 32, "label": "IPS 100.3", "uHeight": 2},
{"uNumber": 31, "label": null, "uHeight": 1}
```

U31 的 null 行打断了前端合并逻辑，导致 IPS 100.3 只显示在 U32。

## 修改文件

`src/backend/Datacenter.Api/Controllers/DevicePositionsController.cs` — `Get` 方法

## 修改内容

在构建 allPositions 的 for 循环（U=HeightU 到 1）中，跳过已被上方多 U 设备覆盖的 U 位：

```
skipU = 0
for u = HeightU downto 1:
    if skipU > 0:
        skipU--
        continue
    
    if positionDict[u] exists:
        add position
        if label != null:
            occupiedU += uHeight
            skipU = uHeight - 1
    else:
        add {uNumber: u, label: null, uHeight: 1}
```

## 验收标准

1. IPS 100.3 (U32, UHeight=2) 在 positions 列表中只有一条，U31 不出现在列表中
2. WAF-1 (U37, UHeight=2) 同理
3. 非多 U 设备行为不变
4. 76 个测试全部通过
5. dotnet build 0 错误 0 警告
