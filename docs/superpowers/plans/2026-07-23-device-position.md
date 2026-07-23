# 设备落位图 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add device-position layer — users see rack cards in rooms, click to open a U-position device view, import device positions from visual-format Excel files.

**Architecture:** New `DevicePosition` model (RackId, UNumber, Label) with a `DevicePositionsController` for query + import. Rack GET endpoint added to serve rack lists. Frontend adds `RackDeviceView.vue` at `/racks/:id` and updates `HomeView.vue` to show rack cards per room. Excel import parses the side-by-side cabinet format with Chinese→English symbol conversion.

**Tech Stack:** .NET 8 / EF Core 8 / SQLite / ClosedXML 0.104.2 (backend), Vue 3 / Vue Router / TypeScript / Vite (frontend), xUnit (tests), Vitest + jsdom (frontend tests).

## Global Constraints

- All endpoints require login (401 for anonymous). No new role restrictions — all 4 roles can access.
- CSRF required for POST endpoints; validated via `IAntiforgery.ValidateRequestAsync`.
- No new NuGet/npm dependencies. Reuse ClosedXML 0.104.2.
- Chinese symbols (`【】（）：，；`) in Excel headers → English (`[]():,;`) before storing/matching.
- EF Migration files auto-generated via `dotnet ef migrations add`.
- Follow existing patterns: records for DTOs, `[Authorize]` on controller, `ON DELETE RESTRICT` for FK.
- Existing tests must keep passing.

---

### Task 1: DevicePosition Model + DbContext + Migration

**Files:**
- Create: `src/backend/Datacenter.Api/Models/DevicePosition.cs`
- Modify: `src/backend/Datacenter.Api/Data/AppDbContext.cs`
- Create: `src/backend/Datacenter.Api/Services/ChineseSymbolNormalizer.cs`
- Auto-generated: `src/backend/Datacenter.Api/Migrations/<ts>_AddDevicePositions.cs`
- Auto-generated: `src/backend/Datacenter.Api/Migrations/<ts>_AddDevicePositions.Designer.cs`
- Auto-modified: `src/backend/Datacenter.Api/Migrations/AppDbContextModelSnapshot.cs`

**Interfaces:**
- Produces: `DevicePosition` class with `Id` (Guid), `RackId` (Guid), `Rack` (nav), `UNumber` (int), `Label` (string?)
- Produces: `AppDbContext.DevicePositions` DbSet
- Produces: `ChineseSymbolNormalizer.Normalize(string)` → string

- [ ] **Step 1: Create DevicePosition model**

```csharp
// src/backend/Datacenter.Api/Models/DevicePosition.cs
namespace Datacenter.Api.Models;

public sealed class DevicePosition
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid RackId { get; set; }

    public Rack Rack { get; set; } = null!;

    public int UNumber { get; set; }

    public string? Label { get; set; }
}
```

- [ ] **Step 2: Create ChineseSymbolNormalizer helper**

```csharp
// src/backend/Datacenter.Api/Services/ChineseSymbolNormalizer.cs
namespace Datacenter.Api.Services;

public static class ChineseSymbolNormalizer
{
    private static readonly IReadOnlyDictionary<char, char> Map = new Dictionary<char, char>
    {
        ['【'] = '[',
        ['】'] = ']',
        ['（'] = '(',
        ['）'] = ')',
        ['：'] = ':',
        ['，'] = ',',
        ['；'] = ';',
    };

    public static string Normalize(string? input)
    {
        if (string.IsNullOrWhiteSpace(input))
        {
            return string.Empty;
        }

        var trimmed = input.Trim();
        var chars = trimmed.ToCharArray();
        var changed = false;

        for (var i = 0; i < chars.Length; i++)
        {
            if (Map.TryGetValue(chars[i], out var replacement))
            {
                chars[i] = replacement;
                changed = true;
            }
        }

        return changed ? new string(chars) : trimmed;
    }
}
```

- [ ] **Step 3: Add DevicePositions DbSet and relationship to AppDbContext**

In `src/backend/Datacenter.Api/Data/AppDbContext.cs`:

- Add property after `public DbSet<Rack> Racks`:
```csharp
public DbSet<DevicePosition> DevicePositions => Set<DevicePosition>();
```

- Add entity configuration before the closing `}` of `OnModelCreating`:
```csharp
var devicePosition = modelBuilder.Entity<DevicePosition>();
devicePosition.ToTable("DevicePositions");
devicePosition.HasKey(item => item.Id);
devicePosition.HasIndex(item => new { item.RackId, item.UNumber }).IsUnique();
devicePosition.Property(item => item.UNumber).IsRequired();
devicePosition.HasOne(item => item.Rack)
    .WithMany()
    .HasForeignKey(item => item.RackId)
    .OnDelete(DeleteBehavior.Restrict);
```

Full `OnModelCreating` after changes:
```csharp
protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    var user = modelBuilder.Entity<User>();
    user.ToTable("Users", table => table.HasCheckConstraint(
        "CK_Users_Role",
        $"Role IN ('{Roles.RoomAdministrator}', '{Roles.Operations}', '{Roles.DbaApplicationOperations}', '{Roles.ReadOnlyViewer}')"));
    user.HasKey(item => item.Id);
    user.HasIndex(item => item.Username).IsUnique();
    user.Property(item => item.Username).IsRequired();
    user.Property(item => item.PasswordHash).IsRequired();
    user.Property(item => item.Role).IsRequired();
    user.Property(item => item.CreatedAt).IsRequired();

    var room = modelBuilder.Entity<Room>();
    room.ToTable("Rooms", table => table.HasCheckConstraint(
        "CK_Rooms_Status",
        "Status IN ('启用', '停用')"));
    room.HasKey(item => item.Id);
    room.HasIndex(item => item.Name).IsUnique();
    room.Property(item => item.Name).IsRequired();
    room.Property(item => item.Status).IsRequired();

    var rack = modelBuilder.Entity<Rack>();
    rack.ToTable("Racks");
    rack.HasKey(item => item.Id);
    rack.HasIndex(item => new { item.RoomId, item.Code }).IsUnique();
    rack.Property(item => item.Code).IsRequired();
    rack.Property(item => item.HeightU).IsRequired();
    rack.Property(item => item.X).IsRequired();
    rack.Property(item => item.Y).IsRequired();
    rack.Property(item => item.Z).IsRequired();
    rack.HasOne(item => item.Room)
        .WithMany()
        .HasForeignKey(item => item.RoomId)
        .OnDelete(DeleteBehavior.Restrict);

    var devicePosition = modelBuilder.Entity<DevicePosition>();
    devicePosition.ToTable("DevicePositions");
    devicePosition.HasKey(item => item.Id);
    devicePosition.HasIndex(item => new { item.RackId, item.UNumber }).IsUnique();
    devicePosition.Property(item => item.UNumber).IsRequired();
    devicePosition.HasOne(item => item.Rack)
        .WithMany()
        .HasForeignKey(item => item.RackId)
        .OnDelete(DeleteBehavior.Restrict);
}
```

- [ ] **Step 4: Generate EF Migration**

Run: `dotnet ef migrations add AddDevicePositions --project src/backend/Datacenter.Api`

Expected: Migration files created in `src/backend/Datacenter.Api/Migrations/`, `AppDbContextModelSnapshot.cs` updated.

- [ ] **Step 5: Build and run existing tests to verify nothing is broken**

Run:
```
dotnet build
dotnet test
```

Expected: Build succeeds, all existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/backend/Datacenter.Api/Models/DevicePosition.cs \
        src/backend/Datacenter.Api/Services/ChineseSymbolNormalizer.cs \
        src/backend/Datacenter.Api/Data/AppDbContext.cs \
        src/backend/Datacenter.Api/Migrations/
git commit -m "feat: add DevicePosition model, ChineseSymbolNormalizer, and migration"
```

---

### Task 2: DevicePositionsController + Racks GET endpoint

**Files:**
- Create: `src/backend/Datacenter.Api/Controllers/DevicePositionsController.cs`
- Modify: `src/backend/Datacenter.Api/Controllers/RacksController.cs`

**Interfaces:**
- Consumes: `DevicePosition` model, `AppDbContext.DevicePositions`, `ChineseSymbolNormalizer.Normalize(string)`
- Produces: `GET /api/racks?roomId={guid}` → `List<RackResponse>`
- Produces: `GET /api/racks/{rackId}/device-positions` → `DevicePositionsResponse`
- Produces: `POST /api/racks/{rackId}/device-positions/import` → `ImportDevicePositionsResponse`

- [ ] **Step 1: Add GET /api/racks endpoint to RacksController**

Insert before the `import-preview` endpoint in `src/backend/Datacenter.Api/Controllers/RacksController.cs`:
```csharp
[HttpGet]
public async Task<IActionResult> Get([FromQuery] Guid? roomId, CancellationToken cancellationToken)
{
    IQueryable<Rack> query = dbContext.Racks.AsNoTracking();

    if (roomId.HasValue)
    {
        query = query.Where(rack => rack.RoomId == roomId.Value);
    }

    var racks = await query
        .Select(rack => new
        {
            rack.Id,
            rack.Code,
            rack.RoomId,
            RoomName = rack.Room.Name,
            rack.HeightU,
            rack.Brand,
            rack.Power,
            rack.Notes,
            rack.X,
            rack.Y,
            rack.Z
        })
        .ToListAsync(cancellationToken);

    return Ok(racks);
}
```

- [ ] **Step 2: Create DevicePositionsController with GET query endpoint**

```csharp
// src/backend/Datacenter.Api/Controllers/DevicePositionsController.cs
using Datacenter.Api.Data;
using Datacenter.Api.Models;
using Datacenter.Api.Services;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Datacenter.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/racks/{rackId:guid}/device-positions")]
public sealed class DevicePositionsController(AppDbContext dbContext, IAntiforgery antiforgery) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(Guid rackId, CancellationToken cancellationToken)
    {
        var rack = await dbContext.Racks
            .AsNoTracking()
            .Include(r => r.Room)
            .FirstOrDefaultAsync(r => r.Id == rackId, cancellationToken);

        if (rack is null)
        {
            return NotFound(new { error = "机柜不存在" });
        }

        var positions = await dbContext.DevicePositions
            .AsNoTracking()
            .Where(dp => dp.RackId == rackId)
            .OrderByDescending(dp => dp.UNumber)
            .Select(dp => new { dp.UNumber, dp.Label })
            .ToListAsync(cancellationToken);

        var positionDict = positions.ToDictionary(p => p.UNumber, p => p.Label);

        var allPositions = new List<object>(rack.HeightU);
        var occupied = 0;

        for (var u = rack.HeightU; u >= 1; u--)
        {
            var label = positionDict.TryGetValue(u, out var existingLabel) ? existingLabel : null;
            allPositions.Add(new { uNumber = u, label });
            if (label is not null)
            {
                occupied++;
            }
        }

        return Ok(new
        {
            rack = new
            {
                rack.Id,
                rack.Code,
                RoomName = rack.Room.Name,
                rack.HeightU,
                rack.X,
                rack.Y,
                rack.Z
            },
            positions = allPositions,
            stats = new
            {
                total = rack.HeightU,
                occupied,
                empty = rack.HeightU - occupied
            }
        });
    }

    [HttpPost("import")]
    [RequestSizeLimit(10_000_000)]
    public async Task<IActionResult> Import(Guid rackId, IFormFile file, CancellationToken cancellationToken)
    {
        var antiforgeryError = await ValidateAntiforgeryAsync();
        if (antiforgeryError is not null)
        {
            return antiforgeryError;
        }

        var rack = await dbContext.Racks
            .FirstOrDefaultAsync(r => r.Id == rackId, cancellationToken);

        if (rack is null)
        {
            return NotFound(new { error = "机柜不存在" });
        }

        if (file is null || file.Length == 0)
        {
            return BadRequest(new { error = "请选择要导入的文件" });
        }

        if (!string.Equals(Path.GetExtension(file.FileName), ".xlsx", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { error = "仅支持 .xlsx 文件" });
        }

        XLWorkbook workbook;
        try
        {
            await using var stream = file.OpenReadStream();
            workbook = new XLWorkbook(stream);
        }
        catch (Exception) when (true)
        {
            return BadRequest(new { error = "无法读取 Excel 文件" });
        }

        using (workbook)
        {
            var worksheet = workbook.Worksheets.FirstOrDefault();
            if (worksheet is null)
            {
                return BadRequest(new { error = "Excel 文件不包含工作表" });
            }

            // Scan row 1 for cabinet identifiers
            var lastColumn = worksheet.Row(1).LastCellUsed()?.Address.ColumnNumber ?? 0;
            int? targetStartColumn = null;

            for (var col = 1; col <= lastColumn; col++)
            {
                var headerText = worksheet.Cell(1, col).GetString().Trim();
                if (string.IsNullOrWhiteSpace(headerText))
                {
                    continue;
                }

                var normalized = ChineseSymbolNormalizer.Normalize(headerText);
                // Check if this header contains the rack code
                if (normalized.Contains(rack.Code, StringComparison.OrdinalIgnoreCase))
                {
                    targetStartColumn = col;
                    break;
                }
            }

            if (targetStartColumn is null)
            {
                return BadRequest(new { error = $"Excel 中未找到机柜 '{rack.Code}' 的数据列" });
            }

            var uNumberCol = targetStartColumn.Value;
            var labelCol = uNumberCol + 1;

            // Parse data rows (row 2 onward)
            var importData = new Dictionary<int, string?>();
            var lastRow = worksheet.LastRowUsed()?.RowNumber() ?? 1;
            var errors = new List<string>();

            for (var row = 2; row <= lastRow; row++)
            {
                var uNumberText = worksheet.Cell(row, uNumberCol).GetString().Trim();
                if (string.IsNullOrWhiteSpace(uNumberText))
                {
                    continue; // skip empty rows
                }

                // Parse U number (e.g., "42U" → 42)
                var uNumberStr = uNumberText.TrimEnd('U', 'u');
                if (!int.TryParse(uNumberStr, out var uNumber) || uNumber < 1)
                {
                    errors.Add($"第 {row} 行 U 位编号无效：'{uNumberText}'");
                    continue;
                }

                if (uNumber > rack.HeightU)
                {
                    errors.Add($"第 {row} 行 U 位编号 {uNumber} 超出机柜 U 位范围 (1-{rack.HeightU})");
                    continue;
                }

                var label = worksheet.Cell(row, labelCol).GetString().Trim();
                importData[uNumber] = string.IsNullOrWhiteSpace(label) ? null : label;
            }

            // Full replace: remove existing + insert new
            var existingPositions = await dbContext.DevicePositions
                .Where(dp => dp.RackId == rackId)
                .ToListAsync(cancellationToken);

            dbContext.DevicePositions.RemoveRange(existingPositions);

            foreach (var (uNumber, label) in importData)
            {
                if (label is not null)
                {
                    dbContext.DevicePositions.Add(new DevicePosition
                    {
                        RackId = rackId,
                        UNumber = uNumber,
                        Label = label
                    });
                }
            }

            await dbContext.SaveChangesAsync(cancellationToken);

            var occupied = importData.Count(kv => kv.Value is not null);
            var empty = rack.HeightU - occupied;

            return Ok(new
            {
                rackId = rack.Id,
                rackCode = rack.Code,
                totalUPositions = rack.HeightU,
                occupied,
                empty,
                errors = errors.Count > 0 ? errors : null
            });
        }
    }

    private async Task<BadRequestObjectResult?> ValidateAntiforgeryAsync()
    {
        try
        {
            await antiforgery.ValidateRequestAsync(HttpContext);
            return null;
        }
        catch (AntiforgeryValidationException)
        {
            return BadRequest(new { error = "防伪令牌缺失或无效" });
        }
    }
}
```

- [ ] **Step 3: Build and verify**

Run:
```
dotnet build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/backend/Datacenter.Api/Controllers/DevicePositionsController.cs \
        src/backend/Datacenter.Api/Controllers/RacksController.cs
git commit -m "feat: add DevicePositionsController with GET query and POST import, add GET /api/racks"
```

---

### Task 3: Frontend Router + RackDeviceView page

**Files:**
- Create: `src/frontend/src/views/RackDeviceView.vue`
- Modify: `src/frontend/src/router.ts`

**Interfaces:**
- Consumes: `GET /api/racks/{id}/device-positions` → `DevicePositionsResponse`
- Consumes: `POST /api/racks/{id}/device-positions/import` (multipart)
- Produces: Vue component at route `/racks/:id`

- [ ] **Step 1: Add route for RackDeviceView**

In `src/frontend/src/router.ts`, add import and route:
```typescript
import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from './composables/useAuth'
import HomeView from './views/HomeView.vue'
import LoginView from './views/LoginView.vue'
import RackDeviceView from './views/RackDeviceView.vue'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: LoginView },
    { path: '/', component: HomeView, meta: { requiresAuth: true } },
    { path: '/racks/:id', component: RackDeviceView, meta: { requiresAuth: true } },
  ],
})

router.beforeEach(async (to) => {
  const { user, restore } = useAuth()
  await restore()

  const isAuthenticated = user.value !== null

  if (to.meta.requiresAuth && !isAuthenticated) {
    return to.path === '/login' ? true : '/login'
  }

  if (to.path === '/login' && isAuthenticated) {
    return '/'
  }

  return true
})
```

- [ ] **Step 2: Create RackDeviceView.vue**

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '../composables/useApi'

type RackInfo = {
  id: string
  code: string
  roomName: string
  heightU: number
  x: number
  y: number
  z: number
}

type UPosition = {
  uNumber: number
  label: string | null
}

type RackStats = {
  total: number
  occupied: number
  empty: number
}

type DevicePositionsData = {
  rack: RackInfo
  positions: UPosition[]
  stats: RackStats
}

type ImportResult = {
  rackId: string
  rackCode: string
  totalUPositions: number
  occupied: number
  empty: number
  errors?: string[]
}

const route = useRoute()
const router = useRouter()
const { request } = useApi()

const rackId = computed(() => route.params.id as string)

const data = ref<DevicePositionsData | null>(null)
const error = ref('')
const importVisible = ref(false)
const importError = ref('')
const importResult = ref<ImportResult | null>(null)
const importSubmitting = ref(false)

async function loadData(): Promise<void> {
  error.value = ''

  const result = await request<DevicePositionsData>(
    `/api/racks/${rackId.value}/device-positions`,
    { method: 'GET' },
  )

  if (!result.ok) {
    error.value = result.error
    return
  }

  data.value = result.data
}

onMounted(() => {
  void loadData()
})

function openImport(): void {
  importVisible.value = true
  importResult.value = null
  importError.value = ''
}

function cancelImport(): void {
  importVisible.value = false
  importResult.value = null
  importError.value = ''
}

async function handleFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  importError.value = ''

  const csrfResult = await request('/api/auth/csrf', { method: 'GET' })
  if (!csrfResult.ok) {
    importError.value = csrfResult.error
    return
  }
  const token = csrfResult.headers.get('X-XSRF-TOKEN')
  if (!token) {
    importError.value = 'Request failed.'
    return
  }

  importSubmitting.value = true
  const formData = new FormData()
  formData.append('file', file)

  let response: Response
  try {
    response = await fetch(`/api/racks/${rackId.value}/device-positions/import`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-XSRF-TOKEN': token },
      body: formData,
    })
  } catch {
    importError.value = 'Request failed.'
    importSubmitting.value = false
    return
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({} as Record<string, unknown>))
    importError.value = ((body as Record<string, unknown>).error as string) || '导入失败'
    importSubmitting.value = false
    return
  }

  importResult.value = (await response.json()) as ImportResult
  importSubmitting.value = false
  await loadData()
}

function closeResult(): void {
  importVisible.value = false
  importResult.value = null
}

const usagePercent = computed(() => {
  if (!data.value || data.value.stats.total === 0) return 0
  return Math.round((data.value.stats.occupied / data.value.stats.total) * 100)
})

/** Merge consecutive U positions with the same label for visual grouping */
const mergedPositions = computed(() => {
  if (!data.value) return []
  const positions = data.value.positions
  if (positions.length === 0) return []

  const merged: Array<{ startU: number; endU: number; label: string | null }> = []
  let current = { startU: positions[0].uNumber, endU: positions[0].uNumber, label: positions[0].label }

  for (let i = 1; i < positions.length; i++) {
    const pos = positions[i]
    if (pos.label === current.label && pos.uNumber === current.startU - 1) {
      // Same label and consecutive, extend downward
      current.startU = pos.uNumber
    } else {
      merged.push(current)
      current = { startU: pos.uNumber, endU: pos.uNumber, label: pos.label }
    }
  }
  merged.push(current)
  return merged
})
</script>

<template>
  <div>
    <div v-if="error" role="alert" aria-live="polite">{{ error }}</div>

    <template v-if="data">
      <p>
        <a href="/" @click.prevent="router.push('/')">机房列表</a>
        &gt; {{ data.rack.roomName }} &gt; {{ data.rack.code }}
      </p>

      <p>
        U 位总数：{{ data.stats.total }} |
        已占用：{{ data.stats.occupied }} |
        空闲：{{ data.stats.empty }} |
        使用率：{{ usagePercent }}%
      </p>

      <button type="button" @click="openImport">导入设备</button>

      <div v-if="importVisible" style="margin-top: 1em; padding: 1em; border: 1px solid #ccc">
        <template v-if="!importResult">
          <input type="file" accept=".xlsx" @change="handleFileChange" />
          <div v-if="importError" role="alert" aria-live="polite">{{ importError }}</div>
          <br />
          <button type="button" :disabled="importSubmitting" @click="cancelImport">取消</button>
        </template>
        <template v-else>
          <p>导入完成：{{ importResult.occupied }} 个 U 位有设备，{{ importResult.empty }} 个空闲</p>
          <div v-if="importResult.errors?.length">
            <p v-for="(err, i) in importResult.errors" :key="i" style="color: red">{{ err }}</p>
          </div>
          <button type="button" @click="closeResult">关闭</button>
        </template>
      </div>

      <div style="margin-top: 1em; display: flex; gap: 1em">
        <!-- U-position rack view (left) -->
        <div style="flex: 1; border: 2px solid #333; max-width: 400px">
          <div
            v-for="group in mergedPositions"
            :key="`${group.startU}-${group.endU}`"
            :style="{
              height: `${(group.startU - group.endU + 1) * 20}px`,
              backgroundColor: group.label ? '#b3d9ff' : '#e0ffe0',
              borderBottom: '1px solid #ccc',
              display: 'flex',
              alignItems: 'center',
              padding: '0 8px',
              fontSize: '12px',
              overflow: 'hidden',
            }"
          >
            <span style="font-weight: bold; min-width: 40px; flex-shrink: 0">
              U{{ group.startU }}{{ group.startU !== group.endU ? `-U${group.endU}` : '' }}
            </span>
            <span v-if="group.label" style="margin-left: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">
              {{ group.label }}
            </span>
          </div>
        </div>

        <!-- Stats panel (right) -->
        <div style="width: 200px; padding: 1em; border: 1px solid #ccc; align-self: flex-start">
          <h3>容量统计</h3>
          <p>U 位总数：{{ data.stats.total }}</p>
          <p>已占用：{{ data.stats.occupied }}</p>
          <p>空闲：{{ data.stats.empty }}</p>
          <p>使用率：{{ usagePercent }}%</p>
          <div style="background: #eee; height: 20px; border-radius: 4px; overflow: hidden">
            <div
              :style="{
                width: `${usagePercent}%`,
                height: '100%',
                backgroundColor: '#4a90d9',
                transition: 'width 0.3s',
              }"
            ></div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
```

- [ ] **Step 3: Typecheck and build frontend**

Run:
```
cd src/frontend
npm run typecheck
npm run build
```

Expected: No type errors. Build succeeds.

- [ ] **Step 4: Run frontend tests**

Run:
```
cd src/frontend
npm test
```

Expected: All existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/frontend/src/router.ts \
        src/frontend/src/views/RackDeviceView.vue
git commit -m "feat: add RackDeviceView with U-position grid and import, add /racks/:id route"
```

---

### Task 4: HomeView rack cards

**Files:**
- Modify: `src/frontend/src/views/HomeView.vue`

**Interfaces:**
- Consumes: `GET /api/racks?roomId={guid}` → list of rack objects (from Task 2)
- Produces: Clickable rack cards within each room section

- [ ] **Step 1: Add rack card display to HomeView**

Modify `src/frontend/src/views/HomeView.vue`:

**Script additions** (add after `rooms` related state and functions):

```typescript
type RackItem = {
  id: string
  code: string
  roomId: string
  roomName: string
  heightU: number
  brand: string | null
  power: number | null
  notes: string | null
  x: number
  y: number
  z: number
}

const expandedRoomId = ref<string | null>(null)
const roomRacks = ref<Map<string, RackItem[]>>(new Map())
const racksLoading = ref<Set<string>>(new Set())

async function toggleRoom(roomId: string): Promise<void> {
  if (expandedRoomId.value === roomId) {
    expandedRoomId.value = null
    return
  }
  expandedRoomId.value = roomId

  // Load racks if not already cached
  if (!roomRacks.value.has(roomId)) {
    racksLoading.value.add(roomId)

    const result = await request<RackItem[]>(`/api/racks?roomId=${roomId}`, { method: 'GET' })
    if (result.ok && Array.isArray(result.data)) {
      const racks = new Map(roomRacks.value)
      racks.set(roomId, result.data)
      roomRacks.value = racks
    }

    racksLoading.value.delete(roomId)
  }
}

function goToRack(rackId: string): void {
  router.push(`/racks/${rackId}`)
}
```

**Template changes**: Replace the room list `<li>` items with expandable sections. The existing `<ul>` listing rooms should be changed to:

```html
<section aria-label="机房列表">
  <div v-if="roomsError" role="alert" aria-live="polite">{{ roomsError }}</div>
  <p v-else-if="rooms !== null && rooms.length === 0">暂无机房</p>
  <div v-else-if="rooms !== null">
    <div v-for="room in rooms" :key="room.id" style="margin-bottom: 1em; border: 1px solid #ccc; padding: 0.5em">
      <div
        @click="toggleRoom(room.id)"
        style="cursor: pointer; display: flex; align-items: center; gap: 0.5em"
      >
        <span style="font-weight: bold; font-size: 1.1em">{{ room.name }}</span>
        <span :style="{ color: room.status === '启用' ? 'green' : 'red' }">{{ room.status }}</span>
        <span style="color: #888; font-size: 0.85em">[{{ expandedRoomId === room.id ? '收起' : '展开' }}]</span>
        <template v-if="isRoomAdmin && !createFormVisible">
          <button
            v-if="editingRoomId !== room.id"
            type="button"
            @click.stop="startEdit(room)"
            style="margin-left: auto"
          >
            编辑
          </button>
        </template>
        <span v-if="racksLoading.has(room.id)" style="margin-left: auto; color: #888">加载中...</span>
      </div>

      <!-- Inline edit form -->
      <div v-if="editingRoomId === room.id" style="margin-top: 0.5em; padding: 0.5em; background: #f5f5f5">
        <input v-model="editName" name="editName" type="text" />
        <select v-model="editStatus" name="editStatus">
          <option value="启用">启用</option>
          <option value="停用">停用</option>
        </select>
        <button type="button" :disabled="editSubmitting" @click="saveEdit(room)">
          {{ editSubmitting ? '保存中...' : '保存' }}
        </button>
        <button type="button" :disabled="editSubmitting" @click="cancelEdit">取消</button>
        <div v-if="editError" role="alert" aria-live="polite">{{ editError }}</div>
      </div>

      <!-- Rack cards (expanded) -->
      <div v-if="expandedRoomId === room.id && roomRacks.has(room.id)" style="margin-top: 0.5em">
        <div v-if="roomRacks.get(room.id)!.length === 0" style="color: #888; font-size: 0.9em">
          暂无导入的机柜
        </div>
        <div v-else style="display: flex; flex-wrap: wrap; gap: 0.5em">
          <div
            v-for="rack in roomRacks.get(room.id)!"
            :key="rack.id"
            @click="goToRack(rack.id)"
            style="
              border: 1px solid #999; padding: 0.5em; cursor: pointer;
              min-width: 120px; background: #f9f9f9;
            "
          >
            <div style="font-weight: bold">{{ rack.code }}</div>
            <div style="font-size: 0.85em; color: #666">{{ rack.heightU }}U</div>
            <div
              v-if="rack.brand"
              style="font-size: 0.85em; color: #666"
            >{{ rack.brand }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>
```

Note: Remove the old `<ul>` with room list items and replace with the above. The old `<li v-for="room in rooms">` section is fully replaced.

The old room list section (around lines 497-520) should be entirely replaced by the new section above. The rest of the template (import modal, create form, logout button) stays unchanged.

- [ ] **Step 2: Typecheck and build**

Run:
```
cd src/frontend
npm run typecheck
npm run build
```

Expected: No type errors. Build succeeds.

- [ ] **Step 3: Run frontend tests and update if needed**

Run:
```
cd src/frontend
npm test
```

If existing tests reference old DOM structure in HomeView, update the test selectors.

- [ ] **Step 4: Commit**

```bash
git add src/frontend/src/views/HomeView.vue
git commit -m "feat: add expandable rack cards to HomeView with room toggle"
```

---

### Task 5: Backend integration tests + full verification

**Files:**
- Create: `tests/backend/Datacenter.Api.Tests/IntegrationTests/DevicePositionIntegrationTests.cs`
- Modify: `tests/backend/Datacenter.Api.Tests/IntegrationTests/AuthTestFixture.cs` (if needed for device position seed data)

**Interfaces:**
- Consumes: All endpoints from Tasks 1-2, `AuthTestFixture` test infrastructure
- Produces: Integration tests covering GET/POST/import, auth, CSRF

- [ ] **Step 1: Create DevicePosition integration tests**

```csharp
// tests/backend/Datacenter.Api.Tests/IntegrationTests/DevicePositionIntegrationTests.cs
using System.Net;
using System.Net.Http.Headers;
using Datacenter.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Datacenter.Api.Tests.IntegrationTests;

[Collection(nameof(AuthTestFixture))]
public sealed class DevicePositionIntegrationTests(AuthTestFixture fixture) : IAsyncLifetime
{
    private readonly HttpClient _client = fixture.CreateClient();
    private Rack _rack = null!;
    private Room _room = null!;

    public async Task InitializeAsync()
    {
        using var scope = fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<Datacenter.Api.Data.AppDbContext>();

        _room = new Room { Name = $"DP-TEST-{Guid.NewGuid():N}", Status = "启用" };
        db.Rooms.Add(_room);
        await db.SaveChangesAsync();

        _rack = new Rack
        {
            Code = $"RACK-DP-{Guid.NewGuid():N}",
            RoomId = _room.Id,
            HeightU = 42,
            X = 0, Y = 0, Z = 0
        };
        db.Racks.Add(_rack);
        await db.SaveChangesAsync();
    }

    public async Task DisposeAsync()
    {
        using var scope = fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<Datacenter.Api.Data.AppDbContext>();
        db.DevicePositions.RemoveRange(db.DevicePositions.Where(dp => dp.RackId == _rack.Id));
        db.Racks.Remove(_rack);
        db.Rooms.Remove(_room);
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task GetDevicePositions_Unauthenticated_Returns401()
    {
        var client = fixture.CreateClient(); // no auth cookie
        var response = await client.GetAsync($"/api/racks/{_rack.Id}/device-positions");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetDevicePositions_NonexistentRack_Returns404()
    {
        await fixture.AuthenticateAsAsync(_client, Roles.RoomAdministrator);
        var response = await _client.GetAsync($"/api/racks/{Guid.NewGuid()}/device-positions");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetDevicePositions_EmptyRack_ReturnsAllPositionsNull()
    {
        await fixture.AuthenticateAsAsync(_client, Roles.RoomAdministrator);

        var response = await _client.GetAsync($"/api/racks/{_rack.Id}/device-positions");
        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("\"total\":42", body, StringComparison.Ordinal);
        Assert.Contains("\"occupied\":0", body, StringComparison.Ordinal);
        Assert.Contains("\"empty\":42", body, StringComparison.Ordinal);
    }

    [Fact]
    public async Task ImportDevicePositions_RequiresCsrf()
    {
        await fixture.AuthenticateAsAsync(_client, Roles.RoomAdministrator);

        var content = new MultipartFormDataContent();
        var response = await _client.PostAsync(
            $"/api/racks/{_rack.Id}/device-positions/import",
            content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("防伪令牌缺失或无效", body, StringComparison.Ordinal);
    }

    [Fact]
    public async Task GetRacks_ByRoomId_ReturnsFilteredRacks()
    {
        await fixture.AuthenticateAsAsync(_client, Roles.ReadOnlyViewer);

        var response = await _client.GetAsync($"/api/racks?roomId={_room.Id}");
        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains(_rack.Code, body, StringComparison.Ordinal);
    }

    [Fact]
    public async Task GetRacks_ByRoomId_NonexistentRoom_ReturnsEmpty()
    {
        await fixture.AuthenticateAsAsync(_client, Roles.RoomAdministrator);

        var response = await _client.GetAsync($"/api/racks?roomId={Guid.NewGuid()}");
        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("[]", body, StringComparison.Ordinal);
    }
}
```

- [ ] **Step 2: Run backend tests**

Run:
```
dotnet test
```

Expected: All backend tests pass (existing + new).

- [ ] **Step 3: Full build and test**

Run:
```
dotnet build
dotnet test
cd src/frontend
npm run typecheck
npm test
npm run build
cd ../..
```

Expected: Everything passes.

- [ ] **Step 4: Commit**

```bash
git add tests/backend/Datacenter.Api.Tests/IntegrationTests/DevicePositionIntegrationTests.cs
git commit -m "test: add DevicePosition integration tests"
```

---

### Task 6: End-to-end smoke test

**Files:**
- No new files. Manual verification.

**Interfaces:**
- Consumes: Running app (backend + frontend dev server)

- [ ] **Step 1: Start backend**

```bash
cd src/backend/Datacenter.Api
dotnet run
```

- [ ] **Step 2: Start frontend**

```bash
cd src/frontend
npm run dev
```

- [ ] **Step 3: Manual smoke test checklist**

1. Login as 机房管理员
2. Home page shows rooms → click room → see rack cards
3. Click rack card → opens `/racks/:id` with U-position grid
4. Empty rack shows all green bars, stats show total=42U, occupied=0, empty=42
5. Click "导入设备" → select `docs/机房机柜.xlsx` → imports successfully
6. After import, U-position grid shows occupied slots in blue with device labels
7. Stats update correctly
8. Back to home → rack card is still clickable

- [ ] **Step 4: Run existing frontend tests one more time**

```bash
cd src/frontend
npm test
```

- [ ] **Step 5: Final commit**

```bash
git add -A
git diff --check
git commit -m "chore: final verification, all tests pass"
```

---

## Plan Summary

| Task | Files | Description |
|---|---|---|
| 1 | 5 new + 2 modify | DevicePosition model, migration, ChineseSymbolNormalizer |
| 2 | 1 new + 1 modify | DevicePositionsController + GET /api/racks |
| 3 | 1 new + 1 modify | RackDeviceView.vue + router |
| 4 | 1 modify | HomeView rack cards |
| 5 | 1 new | Integration tests |
| 6 | 0 | Manual E2E smoke test |

**Total: 9 files** (matches spec budget).
