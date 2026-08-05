# 线缆 Excel 批量导入 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 Excel 模板批量导入端口和线缆，替代逐条手动录入

**Architecture:** 后端新增 `POST /api/cables/import` 端点，用 ClosedXML 解析 .xlsx，逐行独立事务处理（匹配设备→自动创建端口→创建线缆）。前端 CableListView 加导入按钮，上传文件后展示结果摘要。

**Tech Stack:** C# + ClosedXML + EF Core（后端）, Vue 3 + TypeScript（前端）

## Global Constraints

- 角色限制：仅机房管理员/运维人员可导入
- CSRF token 必需（multipart 请求不依赖 cookie 但 CSRF header 仍然校验）
- 文件限制：仅 .xlsx，最大 10MB
- 逐行独立：某行失败不影响其他行
- 已有端口属性不修改，仅创建不存在的端口
- 默认端口类型：RJ45

---

## 文件结构

| 文件 | 职责 | 操作 |
|------|------|------|
| `CablesController.cs` | 新增 Import 方法 + RowCell 辅助方法 | 修改 |
| `CableListView.vue` | 新增导入按钮、上传逻辑、结果展示 | 修改 |
| `docs/线缆导入模板.xlsx` | Excel 模板（含表头 + 示例行） | 新建 |

---

### Task 1: 后端 — Import 端点

**Files:**
- Modify: `src/backend/Datacenter.Api/Controllers/CablesController.cs`（在 Delete 方法之后、RoomCables 方法之前插入，约第 155 行之后）

**Interfaces:**
- Consumes: `IFormFile`（ASP.NET Core 内置）, `XLWorkbook`（ClosedXML）, `AppDbContext`
- Produces: `POST /api/cables/import` — 接受 multipart form（file 字段），返回 `{ totalRows, successCount, errorCount, errors }`

- [ ] **Step 1: 在文件顶部添加 using 语句**

在现有 `using Microsoft.EntityFrameworkCore;` 之后添加：

```csharp
using ClosedXML.Excel;
```

- [ ] **Step 2: 在 Delete 方法之后添加 Import 方法**

在 `Delete` 方法的闭合 `}` 之后、`RoomCables` 方法声明之前（约第 155 行）插入以下代码：

```csharp
    [HttpPost("cables/import")]
    [RequestSizeLimit(10_000_000)]
    public async Task<IActionResult> Import(IFormFile file, CancellationToken cancellationToken)
    {
        if (!User.IsInRole(Roles.RoomAdministrator) && !User.IsInRole(Roles.Operations))
            return StatusCode(StatusCodes.Status403Forbidden);

        try { await antiforgery.ValidateRequestAsync(HttpContext); }
        catch (AntiforgeryValidationException) { return BadRequest(new { error = "防伪令牌缺失或无效" }); }

        if (file is null || file.Length == 0)
            return BadRequest(new { error = "请选择要导入的文件" });

        if (!string.Equals(Path.GetExtension(file.FileName), ".xlsx", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { error = "仅支持 .xlsx 文件" });

        XLWorkbook workbook;
        try
        {
            await using var stream = file.OpenReadStream();
            workbook = new XLWorkbook(stream);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            return BadRequest(new { error = "无法读取 Excel 文件" });
        }

        using (workbook)
        {
            var worksheet = workbook.Worksheets.FirstOrDefault();
            if (worksheet is null)
                return BadRequest(new { error = "Excel 文件不包含工作表" });

            // 解析表头
            var headerMap = new Dictionary<string, int>();
            var headerRow = worksheet.FirstRow();
            var lastHeaderCol = headerRow.LastCellUsed()?.Address.ColumnNumber ?? 0;
            for (int col = 1; col <= lastHeaderCol; col++)
            {
                var header = headerRow.Cell(col).GetString().Trim();
                if (!string.IsNullOrEmpty(header))
                    headerMap[header] = col;
            }

            var requiredHeaders = new[] { "源设备", "源端口", "目标设备", "目标端口", "线缆类型" };
            foreach (var h in requiredHeaders)
            {
                if (!headerMap.ContainsKey(h))
                    return BadRequest(new { error = $"缺少必填列: {h}" });
            }

            // 预加载所有设备
            var allServers = await dbContext.Servers
                .AsNoTracking()
                .ToListAsync(cancellationToken);

            var serverByName = new Dictionary<string, Server>(StringComparer.OrdinalIgnoreCase);
            var serverByIP = new Dictionary<string, Server>(StringComparer.OrdinalIgnoreCase);
            foreach (var s in allServers)
            {
                serverByName[s.Name] = s;
                if (!string.IsNullOrEmpty(s.ManagementIP))
                    serverByIP[s.ManagementIP] = s;
            }

            // 预加载已占用端口
            var occupiedPortIds = new HashSet<Guid>(
                await dbContext.Cables.Select(c => c.SourcePortId).ToListAsync(cancellationToken));
            occupiedPortIds.UnionWith(
                await dbContext.Cables.Select(c => c.TargetPortId).ToListAsync(cancellationToken));

            // 逐行处理
            var errors = new List<object>();
            var successCount = 0;
            var totalRows = 0;

            var lastRow = worksheet.LastRowUsed()?.RowNumber() ?? 1;
            for (int row = 2; row <= lastRow; row++)
            {
                totalRows++;

                var srcDevice = RowCell(worksheet, row, headerMap, "源设备");
                var srcPortName = RowCell(worksheet, row, headerMap, "源端口");
                var srcPortType = RowCell(worksheet, row, headerMap, "源端口类型") ?? "RJ45";
                var srcPortSpeed = RowCell(worksheet, row, headerMap, "源端口速率");

                var tgtDevice = RowCell(worksheet, row, headerMap, "目标设备");
                var tgtPortName = RowCell(worksheet, row, headerMap, "目标端口");
                var tgtPortType = RowCell(worksheet, row, headerMap, "目标端口类型") ?? "RJ45";
                var tgtPortSpeed = RowCell(worksheet, row, headerMap, "目标端口速率");

                var cableType = RowCell(worksheet, row, headerMap, "线缆类型");
                var color = RowCell(worksheet, row, headerMap, "颜色");
                var length = RowCell(worksheet, row, headerMap, "长度");

                // 必填校验
                if (string.IsNullOrWhiteSpace(srcDevice))
                { errors.Add(new { row, error = "源设备为空" }); continue; }
                if (string.IsNullOrWhiteSpace(srcPortName))
                { errors.Add(new { row, error = "源端口为空" }); continue; }
                if (string.IsNullOrWhiteSpace(tgtDevice))
                { errors.Add(new { row, error = "目标设备为空" }); continue; }
                if (string.IsNullOrWhiteSpace(tgtPortName))
                { errors.Add(new { row, error = "目标端口为空" }); continue; }
                if (string.IsNullOrWhiteSpace(cableType))
                { errors.Add(new { row, error = "线缆类型为空" }); continue; }

                // 匹配设备
                if (!serverByName.TryGetValue(srcDevice, out var srcServer) &&
                    !serverByIP.TryGetValue(srcDevice, out srcServer))
                { errors.Add(new { row, error = $"源设备不存在: {srcDevice}" }); continue; }

                if (!serverByName.TryGetValue(tgtDevice, out var tgtServer) &&
                    !serverByIP.TryGetValue(tgtDevice, out tgtServer))
                { errors.Add(new { row, error = $"目标设备不存在: {tgtDevice}" }); continue; }

                // 自连接检查
                if (srcServer.Id == tgtServer.Id &&
                    string.Equals(srcPortName, tgtPortName, StringComparison.OrdinalIgnoreCase))
                { errors.Add(new { row, error = "源端口与目标端口相同" }); continue; }

                try
                {
                    // 查找或创建源端口
                    var srcPort = await dbContext.Ports
                        .FirstOrDefaultAsync(p => p.ServerId == srcServer.Id && p.PortName == srcPortName,
                            cancellationToken);

                    if (srcPort is null)
                    {
                        srcPort = new Port
                        {
                            ServerId = srcServer.Id,
                            PortName = srcPortName,
                            PortType = srcPortType,
                            Speed = string.IsNullOrWhiteSpace(srcPortSpeed) ? null : srcPortSpeed
                        };
                        dbContext.Ports.Add(srcPort);
                        await dbContext.SaveChangesAsync(cancellationToken);
                    }
                    else if (occupiedPortIds.Contains(srcPort.Id))
                    { errors.Add(new { row, error = $"源端口已被占用: {srcServer.Name} / {srcPortName}" }); continue; }

                    // 查找或创建目标端口
                    var tgtPort = await dbContext.Ports
                        .FirstOrDefaultAsync(p => p.ServerId == tgtServer.Id && p.PortName == tgtPortName,
                            cancellationToken);

                    if (tgtPort is null)
                    {
                        tgtPort = new Port
                        {
                            ServerId = tgtServer.Id,
                            PortName = tgtPortName,
                            PortType = tgtPortType,
                            Speed = string.IsNullOrWhiteSpace(tgtPortSpeed) ? null : tgtPortSpeed
                        };
                        dbContext.Ports.Add(tgtPort);
                        await dbContext.SaveChangesAsync(cancellationToken);
                    }
                    else if (occupiedPortIds.Contains(tgtPort.Id))
                    { errors.Add(new { row, error = $"目标端口已被占用: {tgtServer.Name} / {tgtPortName}" }); continue; }

                    // 同一端口检查（两边都可能刚创建）
                    if (srcPort.Id == tgtPort.Id)
                    { errors.Add(new { row, error = "源端口与目标端口相同" }); continue; }

                    // 最终占用检查（该端口可能被本批次前面的行连接）
                    var alreadyConnected = await dbContext.Cables
                        .AnyAsync(c => c.SourcePortId == srcPort.Id || c.TargetPortId == srcPort.Id ||
                                       c.SourcePortId == tgtPort.Id || c.TargetPortId == tgtPort.Id,
                            cancellationToken);
                    if (alreadyConnected)
                    { errors.Add(new { row, error = "端口已被占用" }); continue; }

                    var cable = new Cable
                    {
                        SourcePortId = srcPort.Id,
                        TargetPortId = tgtPort.Id,
                        CableType = cableType,
                        Color = string.IsNullOrWhiteSpace(color) ? null : color,
                        Length = string.IsNullOrWhiteSpace(length) ? null : length
                    };
                    dbContext.Cables.Add(cable);
                    await dbContext.SaveChangesAsync(cancellationToken);

                    occupiedPortIds.Add(srcPort.Id);
                    occupiedPortIds.Add(tgtPort.Id);
                    successCount++;
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    errors.Add(new { row, error = $"处理失败: {ex.Message}" });
                }
            }

            return Ok(new
            {
                totalRows,
                successCount,
                errorCount = errors.Count,
                errors = errors.Count > 0 ? errors : null
            });
        }
    }

    private static string? RowCell(IXLWorksheet worksheet, int row, Dictionary<string, int> map, string header)
    {
        if (!map.TryGetValue(header, out var col)) return null;
        var cell = worksheet.Cell(row, col);
        var value = cell.GetString()?.Trim();
        return string.IsNullOrEmpty(value) ? null : value;
    }
```

- [ ] **Step 3: 编译验证**

```bash
cd src/backend/Datacenter.Api && dotnet build
```

确保编译通过，无错误。

- [ ] **Step 4: Commit**

```bash
git add src/backend/Datacenter.Api/Controllers/CablesController.cs
git commit -m "feat: add POST /api/cables/import for Excel batch cable import"
```

---

### Task 2: 前端 — 导入按钮 + 上传逻辑

**Files:**
- Modify: `src/frontend/src/views/CableListView.vue`

**Interfaces:**
- Consumes: `POST /api/cables/import`（multipart/form-data，CSRF header）
- Produces: 导入按钮 + 文件选择 + 结果摘要展示

- [ ] **Step 1: 在 script 区域添加导入相关状态和方法**

在 `const drawerVisible = ref(false)` 之后（约第 63 行）添加：

```typescript
const importLoading = ref(false)
const importResult = ref<{ totalRows: number; successCount: number; errorCount: number; errors: { row: number; error: string }[] | null } | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

function triggerImport(): void {
  fileInput.value?.click()
}

async function handleImport(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  importLoading.value = true
  importResult.value = null

  const token = await getCsrfToken()
  if (!token) {
    importResult.value = { totalRows: 0, successCount: 0, errorCount: 1, errors: [{ row: 0, error: '无法获取防伪令牌' }] }
    importLoading.value = false
    input.value = ''
    return
  }

  const formData = new FormData()
  formData.append('file', file)

  try {
    const headers = new Headers()
    headers.set('X-XSRF-TOKEN', token)

    const response = await fetch('/api/cables/import', {
      method: 'POST',
      credentials: 'include',
      headers,
      body: formData,
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      const errMsg = (body as Record<string, unknown>).error
      importResult.value = {
        totalRows: 0,
        successCount: 0,
        errorCount: 1,
        errors: [{ row: 0, error: typeof errMsg === 'string' ? errMsg : '导入失败' }],
      }
    } else {
      const data = await response.json() as Record<string, unknown>
      importResult.value = {
        totalRows: (data.totalRows as number) ?? 0,
        successCount: (data.successCount as number) ?? 0,
        errorCount: (data.errorCount as number) ?? 0,
        errors: Array.isArray(data.errors) ? (data.errors as Array<{ row: number; error: string }>) : null,
      }
      await loadCables()
    }
  } catch {
    importResult.value = { totalRows: 0, successCount: 0, errorCount: 1, errors: [{ row: 0, error: '网络错误' }] }
  } finally {
    importLoading.value = false
    input.value = ''
  }
}
```

- [ ] **Step 2: 添加 getCsrfToken 辅助函数**

在 `doSearch` 函数之前插入：

```typescript
async function getCsrfToken(): Promise<string | null> {
  const csrfResult = await request('/api/auth/csrf', { method: 'GET' })
  if (!csrfResult.ok) return null
  return csrfResult.headers.get('X-XSRF-TOKEN')
}
```

- [ ] **Step 3: 在模板中添加导入按钮和文件输入**

在筛选栏的 "重置" 按钮之后（`</button>` 第 298 行），添加：

```html
      <input
        ref="fileInput"
        type="file"
        accept=".xlsx"
        style="display: none"
        @change="handleImport"
      />
      <button
        v-if="canEdit"
        type="button"
        class="btn btn--small"
        :disabled="importLoading"
        @click="triggerImport"
      >
        {{ importLoading ? '导入中...' : '📥 导入 Excel' }}
      </button>
```

- [ ] **Step 4: 在模板中添加结果展示区域**

在筛选栏 `</div>` 之后（第 298 行）、`error` div 之前（第 300 行）添加：

```html

    <div v-if="importResult" class="import-result" :class="importResult.errorCount > 0 ? 'import-result--partial' : 'import-result--success'">
      <template v-if="importResult.errorCount === 0">
        ✅ 导入完成：{{ importResult.totalRows }} 行全部成功
      </template>
      <template v-else>
        ⚠ 导入完成：{{ importResult.successCount }}/{{ importResult.totalRows }} 行成功，{{ importResult.errorCount }} 行失败
        <details v-if="importResult.errors && importResult.errors.length > 0" class="import-errors">
          <summary>查看失败详情</summary>
          <ul>
            <li v-for="(e, i) in importResult.errors" :key="i">
              第 {{ e.row }} 行：{{ e.error }}
            </li>
          </ul>
        </details>
      </template>
    </div>
```

- [ ] **Step 5: 在 style 区域添加导入结果样式**

在 `<style scoped>` 末尾（`</style>` 之前）添加：

```css
.import-result {
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius);
  font-size: var(--font-sm);
  margin-bottom: var(--space-md);
}

.import-result--success {
  background: #e6f7e6;
  color: #2d8a2d;
  border: 1px solid #b7e4b7;
}

.import-result--partial {
  background: #fef3e0;
  color: #b8731f;
  border: 1px solid #f5d698;
}

.import-errors {
  margin-top: var(--space-sm);
  font-size: var(--font-sm);
}

.import-errors summary {
  cursor: pointer;
  font-weight: 500;
}

.import-errors ul {
  margin: var(--space-xs) 0 0;
  padding-left: var(--space-md);
  list-style: disc;
}

.import-errors li {
  margin-bottom: 2px;
}
```

- [ ] **Step 6: 编译验证**

```bash
cd src/frontend && npx vue-tsc --noEmit
```

确保类型检查通过。

- [ ] **Step 7: Commit**

```bash
git add src/frontend/src/views/CableListView.vue
git commit -m "feat: add Excel import button and result display to cable list"
```

---

### Task 3: Excel 模板文件

**Files:**
- Create: `docs/线缆导入模板.xlsx`

- [ ] **Step 1: 创建模板文件**

用以下脚本生成模板：

```bash
cd /home/shy/projects/datacenter-layout
python3 -c "
import openpyxl
wb = openpyxl.Workbook()
ws = wb.active
ws.title = '线缆连接'

headers = ['源设备', '源端口', '源端口类型', '源端口速率',
           '目标设备', '目标端口', '目标端口类型', '目标端口速率',
           '线缆类型', '颜色', '长度']
for i, h in enumerate(headers, 1):
    ws.cell(row=1, column=i, value=h)

# 示例行
example = ['app-web-01', 'GE0/0/1', 'RJ45', '1G',
           'net-core-sw-01', 'GE0/0/1', 'RJ45', '1G',
           '铜缆', '', '3m']
for i, v in enumerate(example, 1):
    ws.cell(row=2, column=i, value=v)

wb.save('docs/线缆导入模板.xlsx')
print('OK')
" 2>/dev/null || echo "openpyxl not available, create manually"
```

如果 openpyxl 不可用，手动创建 Excel 文件：
1. 打开 Excel/WPS
2. 在第一行填写表头：源设备、源端口、源端口类型、源端口速率、目标设备、目标端口、目标端口类型、目标端口速率、线缆类型、颜色、长度
3. 第二行填写示例数据：app-web-01、GE0/0/1、RJ45、1G、net-core-sw-01、GE0/0/1、RJ45、1G、铜缆、(空)、3m
4. 保存为 `docs/线缆导入模板.xlsx`

- [ ] **Step 2: Commit**

```bash
git add docs/线缆导入模板.xlsx
git commit -m "docs: add cable import Excel template"
```
