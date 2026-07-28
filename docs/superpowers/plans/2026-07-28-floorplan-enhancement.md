# Phase 1: 平面图增强 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add walls, zones, labels to the floorplan canvas, a full editor tool panel, rack drag-to-place from a library, property editing, and SVG export.

**Architecture:** Backend adds 3 new EF Core models (Wall, Zone, FloorplanLabel) with a REST controller under `/api/rooms/{roomId}/floorplan-elements`. Frontend adds 3 new Vue components (toolbar, rack library, property panel) and 1 composable (useFloorplanElements), refactors FloorplanView as the integration shell, and extends FloorplanCanvas with new Konva layers and drawing interactions.

**Tech Stack:** .NET 8, EF Core, SQLite | Vue 3, TypeScript, Konva

## Global Constraints

- .NET 8 target framework
- SQLite development database
- Node.js >= 18
- Vue 3 `<script setup lang="ts">` convention
- All write endpoints require `[Authorize]` + anti-forgery validation
- Frontend API calls use `useApi().request<T>()` pattern
- Konva for canvas rendering
- Follow existing code patterns (model → DbContext → migration → controller, composable → component → view)

---

## File Structure

```
Create: src/backend/Datacenter.Api/Models/Wall.cs
Create: src/backend/Datacenter.Api/Models/Zone.cs
Create: src/backend/Datacenter.Api/Models/FloorplanLabel.cs
Create: src/backend/Datacenter.Api/Controllers/FloorplanController.cs
Modify: src/backend/Datacenter.Api/Data/AppDbContext.cs
Create: (auto) src/backend/Datacenter.Api/Migrations/<timestamp>_AddFloorplanElements.cs

Create: src/frontend/src/composables/useFloorplanElements.ts
Create: src/frontend/src/components/FloorplanToolbar.vue
Create: src/frontend/src/components/FloorplanRackLibrary.vue
Create: src/frontend/src/components/FloorplanPropertyPanel.vue
Modify: src/frontend/src/components/FloorplanCanvas.vue
Modify: src/frontend/src/views/FloorplanView.vue
Modify: src/frontend/src/composables/useFloorplanEditor.ts
```

---

### Task 1: Create backend data models

**Files:**
- Create: `src/backend/Datacenter.Api/Models/Wall.cs`
- Create: `src/backend/Datacenter.Api/Models/Zone.cs`
- Create: `src/backend/Datacenter.Api/Models/FloorplanLabel.cs`

**Interfaces:**
- Produces: `Wall { Id, RoomId, Room, X1, Y1, X2, Y2, Color, Thickness }`
- Produces: `Zone { Id, RoomId, Room, X, Y, Width, Height, Name, Color, ZoneType }`
- Produces: `FloorplanLabel { Id, RoomId, Room, X, Y, Text, FontSize, Color }`

- [ ] **Step 1: Create Wall.cs**

```csharp
namespace Datacenter.Api.Models;

public sealed class Wall
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid RoomId { get; set; }

    public Room Room { get; set; } = null!;

    public double X1 { get; set; }

    public double Y1 { get; set; }

    public double X2 { get; set; }

    public double Y2 { get; set; }

    public string Color { get; set; } = "#333333";

    public int Thickness { get; set; } = 3;
}
```

- [ ] **Step 2: Create Zone.cs**

```csharp
namespace Datacenter.Api.Models;

public sealed class Zone
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid RoomId { get; set; }

    public Room Room { get; set; } = null!;

    public double X { get; set; }

    public double Y { get; set; }

    public double Width { get; set; }

    public double Height { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Color { get; set; } = "rgba(100,149,237,0.15)";

    public string ZoneType { get; set; } = "functional";
}
```

- [ ] **Step 3: Create FloorplanLabel.cs**

```csharp
namespace Datacenter.Api.Models;

public sealed class FloorplanLabel
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid RoomId { get; set; }

    public Room Room { get; set; } = null!;

    public double X { get; set; }

    public double Y { get; set; }

    public string Text { get; set; } = string.Empty;

    public int FontSize { get; set; } = 14;

    public string Color { get; set; } = "#666666";
}
```

- [ ] **Step 4: Build and verify compilation**

Run: `dotnet build src/backend/Datacenter.Api/`
Expected: Build succeeds with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/backend/Datacenter.Api/Models/Wall.cs src/backend/Datacenter.Api/Models/Zone.cs src/backend/Datacenter.Api/Models/FloorplanLabel.cs
git commit -m "feat: add Wall, Zone, FloorplanLabel models"
```

---

### Task 2: Update AppDbContext and create migration

**Files:**
- Modify: `src/backend/Datacenter.Api/Data/AppDbContext.cs`

**Interfaces:**
- Consumes: `Wall`, `Zone`, `FloorplanLabel` (from Task 1)
- Produces: `DbSet<Wall> Walls`, `DbSet<Zone> Zones`, `DbSet<FloorplanLabel> FloorplanLabels`

- [ ] **Step 1: Add DbSet properties to AppDbContext**

In `AppDbContext.cs`, add after the existing DbSet declarations (after line 20):

```csharp
    public DbSet<Wall> Walls => Set<Wall>();

    public DbSet<Zone> Zones => Set<Zone>();

    public DbSet<FloorplanLabel> FloorplanLabels => Set<FloorplanLabel>();
```

- [ ] **Step 2: Add entity configurations to OnModelCreating**

In `AppDbContext.cs`, add before the closing brace of `OnModelCreating` (before line 128):

```csharp
        var wall = modelBuilder.Entity<Wall>();
        wall.ToTable("Walls");
        wall.HasKey(item => item.Id);
        wall.Property(item => item.X1).IsRequired();
        wall.Property(item => item.Y1).IsRequired();
        wall.Property(item => item.X2).IsRequired();
        wall.Property(item => item.Y2).IsRequired();
        wall.HasOne(item => item.Room)
            .WithMany()
            .HasForeignKey(item => item.RoomId)
            .OnDelete(DeleteBehavior.Cascade);

        var zone = modelBuilder.Entity<Zone>();
        zone.ToTable("Zones", table =>
        {
            table.HasCheckConstraint(
                "CK_Zones_ZoneType",
                "ZoneType IN ('cold-aisle', 'hot-aisle', 'functional', 'custom')");
        });
        zone.HasKey(item => item.Id);
        zone.Property(item => item.Name).IsRequired();
        zone.Property(item => item.ZoneType).IsRequired();
        zone.HasOne(item => item.Room)
            .WithMany()
            .HasForeignKey(item => item.RoomId)
            .OnDelete(DeleteBehavior.Cascade);

        var floorplanLabel = modelBuilder.Entity<FloorplanLabel>();
        floorplanLabel.ToTable("FloorplanLabels");
        floorplanLabel.HasKey(item => item.Id);
        floorplanLabel.Property(item => item.Text).IsRequired();
        floorplanLabel.Property(item => item.FontSize).IsRequired();
        floorplanLabel.HasOne(item => item.Room)
            .WithMany()
            .HasForeignKey(item => item.RoomId)
            .OnDelete(DeleteBehavior.Cascade);
```

- [ ] **Step 3: Build backend**

Run: `dotnet build src/backend/Datacenter.Api/`
Expected: Build succeeds.

- [ ] **Step 4: Create EF Core migration**

Run: `dotnet ef migrations add AddFloorplanElements --project src/backend/Datacenter.Api/`
Expected: Migration file created under Migrations/.

- [ ] **Step 5: Apply migration to dev database**

Run: `dotnet ef database update --project src/backend/Datacenter.Api/`
Expected: Database updated successfully.

- [ ] **Step 6: Commit**

```bash
git add src/backend/Datacenter.Api/Data/AppDbContext.cs src/backend/Datacenter.Api/Migrations/
git commit -m "feat: add floorplan element DbSets and migration"
```

---

### Task 3: Create FloorplanController

**Files:**
- Create: `src/backend/Datacenter.Api/Controllers/FloorplanController.cs`

**Interfaces:**
- Consumes: `Wall`, `Zone`, `FloorplanLabel`, `AppDbContext` (from Tasks 1-2)
- Produces: REST endpoints under `/api/rooms/{roomId}/floorplan-elements`

- [ ] **Step 1: Create FloorplanController with GET all endpoint**

```csharp
using Datacenter.Api.Data;
using Datacenter.Api.Models;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Datacenter.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/rooms/{roomId:guid}/floorplan-elements")]
public sealed class FloorplanController(AppDbContext dbContext, IAntiforgery antiforgery) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(Guid roomId, CancellationToken cancellationToken)
    {
        var roomExists = await dbContext.Rooms.AnyAsync(r => r.Id == roomId, cancellationToken);
        if (!roomExists) return NotFound(new { error = "机房不存在" });

        var walls = await dbContext.Walls.AsNoTracking()
            .Where(w => w.RoomId == roomId)
            .Select(w => new { w.Id, w.RoomId, w.X1, w.Y1, w.X2, w.Y2, w.Color, w.Thickness, Type = "wall" })
            .ToListAsync(cancellationToken);

        var zones = await dbContext.Zones.AsNoTracking()
            .Where(z => z.RoomId == roomId)
            .Select(z => new { z.Id, z.RoomId, z.X, z.Y, z.Width, z.Height, z.Name, z.Color, z.ZoneType, Type = "zone" })
            .ToListAsync(cancellationToken);

        var labels = await dbContext.FloorplanLabels.AsNoTracking()
            .Where(l => l.RoomId == roomId)
            .Select(l => new { l.Id, l.RoomId, l.X, l.Y, l.Text, l.FontSize, l.Color, Type = "label" })
            .ToListAsync(cancellationToken);

        return Ok(new { walls, zones, labels });
    }
}
```

- [ ] **Step 2: Add POST/PUT/DELETE for walls**

Append to `FloorplanController`:

```csharp
    public sealed record CreateWallRequest(double X1, double Y1, double X2, double Y2, string? Color, int? Thickness);
    public sealed record UpdateWallRequest(double X1, double Y1, double X2, double Y2, string? Color, int? Thickness);

    [HttpPost("walls")]
    public async Task<IActionResult> CreateWall(Guid roomId, CreateWallRequest request, CancellationToken cancellationToken)
    {
        var antiforgeryError = await ValidateAntiforgeryAsync();
        if (antiforgeryError is not null) return antiforgeryError;

        var roomExists = await dbContext.Rooms.AnyAsync(r => r.Id == roomId, cancellationToken);
        if (!roomExists) return NotFound(new { error = "机房不存在" });

        var wall = new Wall
        {
            RoomId = roomId,
            X1 = request.X1, Y1 = request.Y1,
            X2 = request.X2, Y2 = request.Y2,
            Color = request.Color ?? "#333333",
            Thickness = request.Thickness ?? 3,
        };
        dbContext.Walls.Add(wall);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Created(string.Empty, new { wall.Id, wall.RoomId, wall.X1, wall.Y1, wall.X2, wall.Y2, wall.Color, wall.Thickness, Type = "wall" });
    }

    [HttpPut("walls/{id:guid}")]
    public async Task<IActionResult> UpdateWall(Guid roomId, Guid id, UpdateWallRequest request, CancellationToken cancellationToken)
    {
        var antiforgeryError = await ValidateAntiforgeryAsync();
        if (antiforgeryError is not null) return antiforgeryError;

        var wall = await dbContext.Walls.FirstOrDefaultAsync(w => w.Id == id && w.RoomId == roomId, cancellationToken);
        if (wall is null) return NotFound(new { error = "墙体不存在" });

        wall.X1 = request.X1; wall.Y1 = request.Y1;
        wall.X2 = request.X2; wall.Y2 = request.Y2;
        wall.Color = request.Color ?? wall.Color;
        wall.Thickness = request.Thickness ?? wall.Thickness;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new { wall.Id, wall.RoomId, wall.X1, wall.Y1, wall.X2, wall.Y2, wall.Color, wall.Thickness, Type = "wall" });
    }

    [HttpDelete("walls/{id:guid}")]
    public async Task<IActionResult> DeleteWall(Guid roomId, Guid id, CancellationToken cancellationToken)
    {
        var antiforgeryError = await ValidateAntiforgeryAsync();
        if (antiforgeryError is not null) return antiforgeryError;

        var wall = await dbContext.Walls.FirstOrDefaultAsync(w => w.Id == id && w.RoomId == roomId, cancellationToken);
        if (wall is null) return NotFound(new { error = "墙体不存在" });

        dbContext.Walls.Remove(wall);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
```

- [ ] **Step 3: Add POST/PUT/DELETE for zones**

Append to `FloorplanController`:

```csharp
    public sealed record CreateZoneRequest(double X, double Y, double Width, double Height, string Name, string? Color, string ZoneType);
    public sealed record UpdateZoneRequest(double X, double Y, double Width, double Height, string Name, string? Color, string ZoneType);

    [HttpPost("zones")]
    public async Task<IActionResult> CreateZone(Guid roomId, CreateZoneRequest request, CancellationToken cancellationToken)
    {
        var antiforgeryError = await ValidateAntiforgeryAsync();
        if (antiforgeryError is not null) return antiforgeryError;

        var roomExists = await dbContext.Rooms.AnyAsync(r => r.Id == roomId, cancellationToken);
        if (!roomExists) return NotFound(new { error = "机房不存在" });

        var zone = new Zone
        {
            RoomId = roomId,
            X = request.X, Y = request.Y,
            Width = request.Width, Height = request.Height,
            Name = request.Name,
            Color = request.Color ?? "rgba(100,149,237,0.15)",
            ZoneType = request.ZoneType,
        };
        dbContext.Zones.Add(zone);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Created(string.Empty, new { zone.Id, zone.RoomId, zone.X, zone.Y, zone.Width, zone.Height, zone.Name, zone.Color, zone.ZoneType, Type = "zone" });
    }

    [HttpPut("zones/{id:guid}")]
    public async Task<IActionResult> UpdateZone(Guid roomId, Guid id, UpdateZoneRequest request, CancellationToken cancellationToken)
    {
        var antiforgeryError = await ValidateAntiforgeryAsync();
        if (antiforgeryError is not null) return antiforgeryError;

        var zone = await dbContext.Zones.FirstOrDefaultAsync(z => z.Id == id && z.RoomId == roomId, cancellationToken);
        if (zone is null) return NotFound(new { error = "区域不存在" });

        zone.X = request.X; zone.Y = request.Y;
        zone.Width = request.Width; zone.Height = request.Height;
        zone.Name = request.Name;
        zone.Color = request.Color ?? zone.Color;
        zone.ZoneType = request.ZoneType;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new { zone.Id, zone.RoomId, zone.X, zone.Y, zone.Width, zone.Height, zone.Name, zone.Color, zone.ZoneType, Type = "zone" });
    }

    [HttpDelete("zones/{id:guid}")]
    public async Task<IActionResult> DeleteZone(Guid roomId, Guid id, CancellationToken cancellationToken)
    {
        var antiforgeryError = await ValidateAntiforgeryAsync();
        if (antiforgeryError is not null) return antiforgeryError;

        var zone = await dbContext.Zones.FirstOrDefaultAsync(z => z.Id == id && z.RoomId == roomId, cancellationToken);
        if (zone is null) return NotFound(new { error = "区域不存在" });

        dbContext.Zones.Remove(zone);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
```

- [ ] **Step 4: Add POST/PUT/DELETE for labels**

Append to `FloorplanController`:

```csharp
    public sealed record CreateLabelRequest(double X, double Y, string Text, int? FontSize, string? Color);
    public sealed record UpdateLabelRequest(double X, double Y, string Text, int? FontSize, string? Color);

    [HttpPost("labels")]
    public async Task<IActionResult> CreateLabel(Guid roomId, CreateLabelRequest request, CancellationToken cancellationToken)
    {
        var antiforgeryError = await ValidateAntiforgeryAsync();
        if (antiforgeryError is not null) return antiforgeryError;

        var roomExists = await dbContext.Rooms.AnyAsync(r => r.Id == roomId, cancellationToken);
        if (!roomExists) return NotFound(new { error = "机房不存在" });

        var label = new FloorplanLabel
        {
            RoomId = roomId,
            X = request.X, Y = request.Y,
            Text = request.Text,
            FontSize = request.FontSize ?? 14,
            Color = request.Color ?? "#666666",
        };
        dbContext.FloorplanLabels.Add(label);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Created(string.Empty, new { label.Id, label.RoomId, label.X, label.Y, label.Text, label.FontSize, label.Color, Type = "label" });
    }

    [HttpPut("labels/{id:guid}")]
    public async Task<IActionResult> UpdateLabel(Guid roomId, Guid id, UpdateLabelRequest request, CancellationToken cancellationToken)
    {
        var antiforgeryError = await ValidateAntiforgeryAsync();
        if (antiforgeryError is not null) return antiforgeryError;

        var label = await dbContext.FloorplanLabels.FirstOrDefaultAsync(l => l.Id == id && l.RoomId == roomId, cancellationToken);
        if (label is null) return NotFound(new { error = "标签不存在" });

        label.X = request.X; label.Y = request.Y;
        label.Text = request.Text;
        label.FontSize = request.FontSize ?? label.FontSize;
        label.Color = request.Color ?? label.Color;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new { label.Id, label.RoomId, label.X, label.Y, label.Text, label.FontSize, label.Color, Type = "label" });
    }

    [HttpDelete("labels/{id:guid}")]
    public async Task<IActionResult> DeleteLabel(Guid roomId, Guid id, CancellationToken cancellationToken)
    {
        var antiforgeryError = await ValidateAntiforgeryAsync();
        if (antiforgeryError is not null) return antiforgeryError;

        var label = await dbContext.FloorplanLabels.FirstOrDefaultAsync(l => l.Id == id && l.RoomId == roomId, cancellationToken);
        if (label is null) return NotFound(new { error = "标签不存在" });

        dbContext.FloorplanLabels.Remove(label);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
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
```

- [ ] **Step 5: Build backend**

Run: `dotnet build src/backend/Datacenter.Api/`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/backend/Datacenter.Api/Controllers/FloorplanController.cs
git commit -m "feat: add FloorplanController with CRUD for walls, zones, labels"
```

---

### Task 4: Create useFloorplanElements composable

**Files:**
- Create: `src/frontend/src/composables/useFloorplanElements.ts`

**Interfaces:**
- Consumes: `useApi` (existing composable)
- Produces:
  - `walls: Ref<WallItem[]>`, `zones: Ref<ZoneItem[]>`, `labels: Ref<LabelItem[]>`
  - `loading: Ref<boolean>`, `error: Ref<string | null>`
  - `loadElements(roomId: string): Promise<void>`
  - `addWall(roomId, data): Promise<WallItem | null>`, `updateWall(roomId, id, data)`, `deleteWall(roomId, id)`
  - `addZone(roomId, data)`, `updateZone(roomId, id, data)`, `deleteZone(roomId, id)`
  - `addLabel(roomId, data)`, `updateLabel(roomId, id, data)`, `deleteLabel(roomId, id)`
  - `toCanvasX`, `toCanvasY`, `toDbX`, `toDbY` (matching useFloorplan pattern)

- [ ] **Step 1: Write the composable**

```typescript
import { ref } from 'vue'
import { useApi } from './useApi'

export interface WallItem {
  id: string
  roomId: string
  x1: number; y1: number; x2: number; y2: number
  color: string
  thickness: number
}

export interface ZoneItem {
  id: string
  roomId: string
  x: number; y: number; width: number; height: number
  name: string
  color: string
  zoneType: 'cold-aisle' | 'hot-aisle' | 'functional' | 'custom'
}

export interface LabelItem {
  id: string
  roomId: string
  x: number; y: number
  text: string
  fontSize: number
  color: string
}

export type FloorplanElement = WallItem | ZoneItem | LabelItem

const SCALE_FACTOR = 0.1

export function useFloorplanElements(roomId: string) {
  const { request } = useApi()
  const walls = ref<WallItem[]>([])
  const zones = ref<ZoneItem[]>([])
  const labels = ref<LabelItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  function toCanvasX(dbMm: number): number { return dbMm * SCALE_FACTOR }
  function toCanvasY(dbMm: number): number { return dbMm * SCALE_FACTOR }
  function toDbX(px: number): number { return Math.round(px / SCALE_FACTOR) }
  function toDbY(px: number): number { return Math.round(px / SCALE_FACTOR) }

  async function fetchCsrfToken(): Promise<string | null> {
    const csrf = await request('/api/auth/csrf', { method: 'GET' })
    if (!csrf.ok) return null
    return csrf.headers.get('X-XSRF-TOKEN')
  }

  async function loadElements(): Promise<void> {
    loading.value = true
    error.value = null
    const result = await request<{ walls: WallItem[]; zones: ZoneItem[]; labels: LabelItem[] }>(
      `/api/rooms/${encodeURIComponent(roomId)}/floorplan-elements`
    )
    if (result.ok) {
      walls.value = result.data.walls
      zones.value = result.data.zones
      labels.value = result.data.labels
    } else {
      error.value = result.error
    }
    loading.value = false
  }

  async function addWall(data: { x1: number; y1: number; x2: number; y2: number; color?: string; thickness?: number }): Promise<WallItem | null> {
    const token = await fetchCsrfToken()
    if (!token) return null
    const result = await request<WallItem>(`/api/rooms/${encodeURIComponent(roomId)}/floorplan-elements/walls`, {
      method: 'POST', csrfToken: token, body: data,
    })
    if (result.ok) { walls.value.push(result.data); return result.data }
    error.value = result.error
    return null
  }

  async function updateWall(id: string, data: { x1: number; y1: number; x2: number; y2: number; color?: string; thickness?: number }): Promise<boolean> {
    const token = await fetchCsrfToken()
    if (!token) return false
    const result = await request<WallItem>(`/api/rooms/${encodeURIComponent(roomId)}/floorplan-elements/walls/${encodeURIComponent(id)}`, {
      method: 'PUT', csrfToken: token, body: data,
    })
    if (result.ok) {
      const idx = walls.value.findIndex(w => w.id === id)
      if (idx !== -1) walls.value[idx] = result.data
      return true
    }
    error.value = result.error
    return false
  }

  async function deleteWall(id: string): Promise<boolean> {
    const token = await fetchCsrfToken()
    if (!token) return false
    const result = await request(`/api/rooms/${encodeURIComponent(roomId)}/floorplan-elements/walls/${encodeURIComponent(id)}`, {
      method: 'DELETE', csrfToken: token,
    })
    if (result.ok) { walls.value = walls.value.filter(w => w.id !== id); return true }
    error.value = result.error
    return false
  }

  async function addZone(data: { x: number; y: number; width: number; height: number; name: string; color?: string; zoneType: string }): Promise<ZoneItem | null> {
    const token = await fetchCsrfToken()
    if (!token) return null
    const result = await request<ZoneItem>(`/api/rooms/${encodeURIComponent(roomId)}/floorplan-elements/zones`, {
      method: 'POST', csrfToken: token, body: data,
    })
    if (result.ok) { zones.value.push(result.data); return result.data }
    error.value = result.error
    return null
  }

  async function updateZone(id: string, data: { x: number; y: number; width: number; height: number; name: string; color?: string; zoneType: string }): Promise<boolean> {
    const token = await fetchCsrfToken()
    if (!token) return false
    const result = await request<ZoneItem>(`/api/rooms/${encodeURIComponent(roomId)}/floorplan-elements/zones/${encodeURIComponent(id)}`, {
      method: 'PUT', csrfToken: token, body: data,
    })
    if (result.ok) {
      const idx = zones.value.findIndex(z => z.id === id)
      if (idx !== -1) zones.value[idx] = result.data
      return true
    }
    error.value = result.error
    return false
  }

  async function deleteZone(id: string): Promise<boolean> {
    const token = await fetchCsrfToken()
    if (!token) return false
    const result = await request(`/api/rooms/${encodeURIComponent(roomId)}/floorplan-elements/zones/${encodeURIComponent(id)}`, {
      method: 'DELETE', csrfToken: token,
    })
    if (result.ok) { zones.value = zones.value.filter(z => z.id !== id); return true }
    error.value = result.error
    return false
  }

  async function addLabel(data: { x: number; y: number; text: string; fontSize?: number; color?: string }): Promise<LabelItem | null> {
    const token = await fetchCsrfToken()
    if (!token) return null
    const result = await request<LabelItem>(`/api/rooms/${encodeURIComponent(roomId)}/floorplan-elements/labels`, {
      method: 'POST', csrfToken: token, body: data,
    })
    if (result.ok) { labels.value.push(result.data); return result.data }
    error.value = result.error
    return null
  }

  async function updateLabel(id: string, data: { x: number; y: number; text: string; fontSize?: number; color?: string }): Promise<boolean> {
    const token = await fetchCsrfToken()
    if (!token) return false
    const result = await request<LabelItem>(`/api/rooms/${encodeURIComponent(roomId)}/floorplan-elements/labels/${encodeURIComponent(id)}`, {
      method: 'PUT', csrfToken: token, body: data,
    })
    if (result.ok) {
      const idx = labels.value.findIndex(l => l.id === id)
      if (idx !== -1) labels.value[idx] = result.data
      return true
    }
    error.value = result.error
    return false
  }

  async function deleteLabel(id: string): Promise<boolean> {
    const token = await fetchCsrfToken()
    if (!token) return false
    const result = await request(`/api/rooms/${encodeURIComponent(roomId)}/floorplan-elements/labels/${encodeURIComponent(id)}`, {
      method: 'DELETE', csrfToken: token,
    })
    if (result.ok) { labels.value = labels.value.filter(l => l.id !== id); return true }
    error.value = result.error
    return false
  }

  return {
    walls, zones, labels, loading, error, loadElements,
    addWall, updateWall, deleteWall,
    addZone, updateZone, deleteZone,
    addLabel, updateLabel, deleteLabel,
    toCanvasX, toCanvasY, toDbX, toDbY,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/frontend/src/composables/useFloorplanElements.ts
git commit -m "feat: add useFloorplanElements composable"
```

---

### Task 5: Create FloorplanToolbar component

**Files:**
- Create: `src/frontend/src/components/FloorplanToolbar.vue`

**Interfaces:**
- Produces: emits `tool-change` with `{ tool: ToolType }`, `undo`, `redo`, `export-svg`
- Props: `activeTool: ToolType`, `canUndo: boolean`, `canRedo: boolean`, `mode: 'view' | 'edit'`

- [ ] **Step 1: Create FloorplanToolbar.vue**

```vue
<template>
  <div class="flp-toolbar">
    <div class="flp-toolbar-tools">
      <button
        v-for="t in tools"
        :key="t.id"
        :class="['flp-tool-btn', { active: activeTool === t.id }]"
        :title="t.label"
        @click="$emit('tool-change', t.id)"
      >
        <span class="flp-tool-icon">{{ t.icon }}</span>
        <span class="flp-tool-label">{{ t.label }}</span>
      </button>
    </div>
    <div class="flp-toolbar-actions">
      <button class="flp-tool-btn" title="撤销 Ctrl+Z" :disabled="!canUndo" @click="$emit('undo')">
        <span class="flp-tool-icon">↩</span>
        <span class="flp-tool-label">撤销</span>
      </button>
      <button class="flp-tool-btn" title="重做 Ctrl+Y" :disabled="!canRedo" @click="$emit('redo')">
        <span class="flp-tool-icon">↪</span>
        <span class="flp-tool-label">重做</span>
      </button>
      <button class="flp-tool-btn flp-tool-btn--export" title="导出 SVG" @click="$emit('export-svg')">
        <span class="flp-tool-icon">↓</span>
        <span class="flp-tool-label">导出</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
export type ToolType = 'select' | 'wall' | 'rack' | 'label' | 'zone' | 'delete'

defineProps<{
  activeTool: ToolType
  canUndo: boolean
  canRedo: boolean
  mode: 'view' | 'edit'
}>()

defineEmits<{
  'tool-change': [tool: ToolType]
  undo: []
  redo: []
  'export-svg': []
}>()

const tools: { id: ToolType; icon: string; label: string }[] = [
  { id: 'select', icon: '↕', label: '选择' },
  { id: 'wall', icon: '╬', label: '墙体' },
  { id: 'rack', icon: '⊞', label: '机柜' },
  { id: 'label', icon: 'T', label: '标签' },
  { id: 'zone', icon: '▢', label: '区域' },
  { id: 'delete', icon: '✕', label: '删除' },
]
</script>

<style scoped>
.flp-toolbar {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  padding: var(--space-sm);
  background: var(--color-bg-card, #fff);
  border-right: 1px solid var(--color-border, #e0e0e0);
  width: 64px;
  flex-shrink: 0;
}
.flp-toolbar-tools {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}
.flp-toolbar-actions {
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-top: 1px solid var(--color-border, #e0e0e0);
  padding-top: var(--space-xs);
}
.flp-tool-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 4px;
  border: 1px solid transparent;
  border-radius: var(--radius, 6px);
  background: transparent;
  cursor: pointer;
  font-size: var(--font-xs);
  color: var(--color-text, #333);
  transition: background 0.15s, border-color 0.15s;
}
.flp-tool-btn:hover:not(:disabled) { background: var(--color-bg-hover, #f0f2f5); }
.flp-tool-btn.active { background: var(--color-primary-light, #e8f0fe); border-color: var(--color-primary, #4a90d9); color: var(--color-primary, #4a90d9); }
.flp-tool-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.flp-tool-icon { font-size: 18px; line-height: 1; }
.flp-tool-label { font-size: 10px; }
.flp-tool-btn--export { margin-top: var(--space-xs); }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/frontend/src/components/FloorplanToolbar.vue
git commit -m "feat: add FloorplanToolbar component"
```

---

### Task 6: Update FloorplanCanvas — render walls, zones, labels

**Files:**
- Modify: `src/frontend/src/components/FloorplanCanvas.vue`

**Interfaces:**
- Consumes: `WallItem`, `ZoneItem`, `LabelItem` types from `useFloorplanElements`
- Produces: `wallLayer`, `zoneLayer`, `labelLayer` Konva layers
- New emits: `element-click`, `element-dragend` for future tasks

- [ ] **Step 1: Add new props for floorplan elements**

Replace the existing props block (lines 11-18) with:

```typescript
import type { WallItem, ZoneItem, LabelItem } from '../composables/useFloorplanElements'

const props = defineProps<{
  racks: RackItem[]
  walls: WallItem[]
  zones: ZoneItem[]
  labels: LabelItem[]
  mode: 'view' | 'edit'
  snapLines: SnapLine[]
  toCanvasX: (db: number) => number
  toCanvasY: (db: number) => number
  snapPosition: (rackId: string, x: number, y: number) => { x: number; y: number }
}>()
```

- [ ] **Step 2: Add new Konva layers**

Add after the existing layer declarations (after line 30):

```typescript
let wallLayer: Konva.Layer | null = null
let zoneLayer: Konva.Layer | null = null
let labelLayer: Konva.Layer | null = null
```

- [ ] **Step 3: Add wall rendering function**

Add after the `drawGrid` function:

```typescript
function renderWalls(): void {
  if (!wallLayer) return
  wallLayer.destroyChildren()
  for (const w of props.walls) {
    const x1 = props.toCanvasX(w.x1)
    const y1 = props.toCanvasY(w.y1)
    const x2 = props.toCanvasX(w.x2)
    const y2 = props.toCanvasY(w.y2)
    wallLayer.add(new Konva.Line({
      points: [x1, y1, x2, y2],
      stroke: w.color,
      strokeWidth: w.thickness,
      lineCap: 'round',
      listening: false,
    }))
  }
  wallLayer.batchDraw()
}

function renderZones(): void {
  if (!zoneLayer) return
  zoneLayer.destroyChildren()
  for (const z of props.zones) {
    const x = props.toCanvasX(z.x)
    const y = props.toCanvasY(z.y)
    const w = z.width * SCALE_FACTOR
    const h = z.height * SCALE_FACTOR
    zoneLayer.add(new Konva.Rect({
      x, y, width: w, height: h,
      fill: z.color,
      stroke: z.color.replace(/[\d.]+\)$/, '0.4)'),
      strokeWidth: 1,
      cornerRadius: 2,
      listening: false,
    }))
    zoneLayer.add(new Konva.Text({
      x: x + 4, y: y + 4,
      text: z.name,
      fontSize: 11, fontFamily: 'sans-serif',
      fill: '#666', listening: false,
    }))
  }
  zoneLayer.batchDraw()
}

function renderLabels(): void {
  if (!labelLayer) return
  labelLayer.destroyChildren()
  for (const l of props.labels) {
    const x = props.toCanvasX(l.x)
    const y = props.toCanvasY(l.y)
    labelLayer.add(new Konva.Text({
      x, y, text: l.text,
      fontSize: l.fontSize, fontFamily: 'sans-serif',
      fill: l.color, listening: false,
    }))
  }
  labelLayer.batchDraw()
}
```

- [ ] **Step 4: Initialize new layers in init()**

In the `init()` function, after `stage.add(gridLayer)` (after line 151), add:

```typescript
  wallLayer = new Konva.Layer({ listening: false })
  renderWalls()
  stage.add(wallLayer)

  zoneLayer = new Konva.Layer({ listening: false })
  renderZones()
  stage.add(zoneLayer)

  labelLayer = new Konva.Layer({ listening: false })
  renderLabels()
  stage.add(labelLayer)
```

Re-order so the layers stack correctly: gridLayer → zoneLayer → wallLayer → rackLayer → snapLayer → labelLayer

- [ ] **Step 5: Add watch for new props**

Add watch blocks after the existing watches:

```typescript
watch(() => props.walls, () => { renderWalls() }, { deep: true })
watch(() => props.zones, () => { renderZones() }, { deep: true })
watch(() => props.labels, () => { renderLabels() }, { deep: true })
```

- [ ] **Step 6: Build frontend**

Run: `cd src/frontend && npm run typecheck`
Expected: No type errors.

- [ ] **Step 7: Commit**

```bash
git add src/frontend/src/components/FloorplanCanvas.vue
git commit -m "feat: add wall, zone, label rendering to FloorplanCanvas"
```

---

### Task 7: Add drawing interactions to FloorplanCanvas

**Files:**
- Modify: `src/frontend/src/components/FloorplanCanvas.vue`

**Interfaces:**
- Consumes: `activeTool` (new prop), wall/zone drawing logic
- Produces: emits `wall-drawn(x1,y1,x2,y2)`, `zone-drawn(x,y,w,h)`, `label-placed(x,y)`, `element-delete(elementId, elementType)`

- [ ] **Step 1: Add activeTool prop and new emits**

Add to props:

```typescript
  activeTool: 'select' | 'wall' | 'rack' | 'label' | 'zone' | 'delete'
```

Add to emits:

```typescript
  'wall-drawn': [x1: number, y1: number, x2: number, y2: number]
  'zone-drawn': [x: number, y: number, width: number, height: number]
  'label-placed': [x: number, y: number]
  'element-delete': [elementId: string, elementType: string]
```

- [ ] **Step 2: Add drawing state variables**

Add after `let dragMoved = false`:

```typescript
let drawStartX = 0
let drawStartY = 0
let drawPreview: Konva.Shape | null = null
```

- [ ] **Step 3: Add drawing interaction logic to init()**

Replace the existing pan mousedown handler (lines 177-178) with:

```typescript
  // Drawing & panning
  stage.on('mousedown', (e) => {
    if (e.target !== stage) return
    const pos = stage!.getPointerPosition()
    if (!pos) return

    if (props.activeTool === 'wall' || props.activeTool === 'zone') {
      drawStartX = pos.x
      drawStartY = pos.y
    } else if (props.activeTool === 'label') {
      emit('label-placed', pos.x, pos.y)
    } else {
      panning = true
    }
  })

  stage.on('mousemove', (e) => {
    const pos = stage!.getPointerPosition()
    if (!pos) return

    if (drawPreview) {
      drawPreview.destroy()
      drawPreview = null
    }

    if (props.activeTool === 'wall' && stage && (e.target === stage || drawPreview)) {
      drawPreview = new Konva.Line({
        points: [drawStartX, drawStartY, pos.x, pos.y],
        stroke: '#333', strokeWidth: 2, dash: [6, 4],
      })
      rackLayer?.add(drawPreview)
      rackLayer?.batchDraw()
    } else if (props.activeTool === 'zone' && stage) {
      const x = Math.min(drawStartX, pos.x)
      const y = Math.min(drawStartY, pos.y)
      const w = Math.abs(pos.x - drawStartX)
      const h = Math.abs(pos.y - drawStartY)
      drawPreview = new Konva.Rect({
        x, y, width: w, height: h,
        fill: 'rgba(100,149,237,0.1)',
        stroke: 'rgba(100,149,237,0.5)', strokeWidth: 1, dash: [6, 4],
      })
      rackLayer?.add(drawPreview)
      rackLayer?.batchDraw()
    } else if (panning) {
      const p = stage!.position()
      stage!.position({ x: p.x + e.evt.movementX, y: p.y + e.evt.movementY })
      stage!.batchDraw()
    }
  })

  stage.on('mouseup', () => {
    if (drawPreview) {
      if (props.activeTool === 'wall') {
        const line = drawPreview as Konva.Line
        const pts = line.points()
        emit('wall-drawn', pts[0], pts[1], pts[2], pts[3])
      } else if (props.activeTool === 'zone') {
        const rect = drawPreview as Konva.Rect
        emit('zone-drawn', rect.x(), rect.y(), rect.width(), rect.height())
      }
      drawPreview.destroy()
      drawPreview = null
      rackLayer?.batchDraw()
    }
    panning = false
  })
```

- [ ] **Step 4: Build and typecheck**

Run: `cd src/frontend && npm run typecheck`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add src/frontend/src/components/FloorplanCanvas.vue
git commit -m "feat: add drawing interactions (wall, zone, label) to FloorplanCanvas"
```

---

### Task 8: Create FloorplanRackLibrary component

**Files:**
- Create: `src/frontend/src/components/FloorplanRackLibrary.vue`

**Interfaces:**
- Consumes: `racks: RackItem[]` (existing type, prop)
- Produces: emits `rack-drop` with `{ rackId?: string, x: number, y: number }` and `rack-create` with `{ x, y }`

- [ ] **Step 1: Create FloorplanRackLibrary.vue**

```vue
<template>
  <div class="rack-library">
    <h4 class="rack-library-title">机柜库</h4>
    <p class="rack-library-hint">拖动机柜到画布上放置</p>
    <div class="rack-library-list">
      <div
        v-for="rack in racks"
        :key="rack.id"
        class="rack-library-item"
        draggable="true"
        @dragstart="onDragStart($event, rack.id)"
      >
        <span class="rack-item-code">{{ rack.code }}</span>
        <span class="rack-item-meta">{{ rack.heightU }}U · {{ rack.brand || '—' }}</span>
      </div>
    </div>
    <div v-if="racks.length === 0" class="rack-library-empty">无机柜</div>
    <button class="btn btn--small btn--primary rack-library-add" @click="$emit('rack-create')">
      + 新建机柜
    </button>
  </div>
</template>

<script setup lang="ts">
import type { RackItem } from '../composables/useFloorplan'

defineProps<{ racks: RackItem[] }>()

defineEmits<{
  'rack-drop': [payload: { rackId: string; clientX: number; clientY: number }]
  'rack-create': []
}>()

function onDragStart(e: DragEvent, rackId: string): void {
  e.dataTransfer!.effectAllowed = 'copy'
  e.dataTransfer!.setData('text/plain', rackId)
}
</script>

<style scoped>
.rack-library {
  width: 200px;
  border-left: 1px solid var(--color-border, #e0e0e0);
  background: var(--color-bg-card, #fff);
  padding: var(--space-sm);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  flex-shrink: 0;
  overflow-y: auto;
}
.rack-library-title { margin: 0; font-size: var(--font-sm); font-weight: 600; }
.rack-library-hint { font-size: var(--font-xs); color: #999; margin: 0; }
.rack-library-list { display: flex; flex-direction: column; gap: 4px; flex: 1; }
.rack-library-item {
  padding: 6px 8px;
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: var(--radius, 4px);
  cursor: grab;
  font-size: var(--font-xs);
  display: flex;
  justify-content: space-between;
  transition: background 0.15s;
}
.rack-library-item:hover { background: var(--color-bg-hover, #f0f2f5); }
.rack-library-item:active { cursor: grabbing; }
.rack-item-code { font-weight: 600; }
.rack-item-meta { color: #999; }
.rack-library-empty { font-size: var(--font-xs); color: #999; text-align: center; padding: var(--space-md); }
.rack-library-add { width: 100%; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/frontend/src/components/FloorplanRackLibrary.vue
git commit -m "feat: add FloorplanRackLibrary component for drag-to-place racks"
```

---

### Task 9: Create FloorplanPropertyPanel component

**Files:**
- Create: `src/frontend/src/components/FloorplanPropertyPanel.vue`

**Interfaces:**
- Consumes: props `selectedElement: FloorplanElement | null`
- Produces: emits `update` with modified element data, `delete` with element id/type

- [ ] **Step 1: Create FloorplanPropertyPanel.vue**

```vue
<template>
  <div v-if="selected" class="property-panel">
    <h4 class="property-panel-title">属性</h4>

    <template v-if="selected.type === 'wall'">
      <label class="property-field">
        颜色
        <input type="color" :value="selected.color" @input="emitUpdate({ color: ($event.target as HTMLInputElement).value })" />
      </label>
      <label class="property-field">
        粗细
        <input type="range" min="1" max="10" :value="selected.thickness" @input="emitUpdate({ thickness: Number(($event.target as HTMLInputElement).value) })" />
        <span>{{ selected.thickness }}px</span>
      </label>
    </template>

    <template v-if="selected.type === 'zone'">
      <label class="property-field">
        名称
        <input type="text" :value="selected.name" @input="emitUpdate({ name: ($event.target as HTMLInputElement).value })" />
      </label>
      <label class="property-field">
        类型
        <select :value="selected.zoneType" @change="emitUpdate({ zoneType: ($event.target as HTMLSelectElement).value })">
          <option value="cold-aisle">冷通道</option>
          <option value="hot-aisle">热通道</option>
          <option value="functional">功能区</option>
          <option value="custom">自定义</option>
        </select>
      </label>
      <label class="property-field">
        颜色
        <input type="color" :value="selected.color" @input="emitUpdate({ color: ($event.target as HTMLInputElement).value })" />
      </label>
    </template>

    <template v-if="selected.type === 'label'">
      <label class="property-field">
        文字
        <input type="text" :value="selected.text" @input="emitUpdate({ text: ($event.target as HTMLInputElement).value })" />
      </label>
      <label class="property-field">
        字号
        <input type="number" min="8" max="48" :value="selected.fontSize" @input="emitUpdate({ fontSize: Number(($event.target as HTMLInputElement).value) })" />
      </label>
      <label class="property-field">
        颜色
        <input type="color" :value="selected.color" @input="emitUpdate({ color: ($event.target as HTMLInputElement).value })" />
      </label>
    </template>

    <button class="btn btn--small btn--danger property-delete" @click="$emit('delete', selected.id, selected.type)">
      删除此元素
    </button>
  </div>
</template>

<script setup lang="ts">
import type { WallItem, ZoneItem, LabelItem } from '../composables/useFloorplanElements'

type SelectedElement = (WallItem & { type: 'wall' }) | (ZoneItem & { type: 'zone' }) | (LabelItem & { type: 'label' })

defineProps<{ selected: SelectedElement | null }>()

const emit = defineEmits<{
  update: [patch: Record<string, unknown>]
  delete: [id: string, type: string]
}>()

function emitUpdate(patch: Record<string, unknown>): void {
  emit('update', patch)
}
</script>

<style scoped>
.property-panel {
  width: 200px;
  border-left: 1px solid var(--color-border, #e0e0e0);
  background: var(--color-bg-card, #fff);
  padding: var(--space-sm);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  flex-shrink: 0;
  overflow-y: auto;
}
.property-panel-title { margin: 0; font-size: var(--font-sm); font-weight: 600; }
.property-field { display: flex; flex-direction: column; gap: 2px; font-size: var(--font-xs); }
.property-field input, .property-field select { font-size: var(--font-xs); padding: 4px; border: 1px solid var(--color-border); border-radius: 4px; }
.property-delete { margin-top: auto; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/frontend/src/components/FloorplanPropertyPanel.vue
git commit -m "feat: add FloorplanPropertyPanel component"
```

---

### Task 10: Refactor FloorplanView to integrate all components

**Files:**
- Modify: `src/frontend/src/views/FloorplanView.vue`

**Interfaces:**
- Consumes: all new child components and composables
- Produces: fully integrated floorplan editor page

This task rewrites FloorplanView.vue to integrate the toolbar, rack library, property panel, floorplan element loading, drawing event handling, and the delete confirmation flow.

- [ ] **Step 1: Rewrite template section**

Replace entire `<template>` block with:

```html
<template>
  <div class="floorplan-page">
    <header class="floorplan-toolbar">
      <div class="toolbar-left">
        <button class="btn btn--small btn--muted" @click="goBack">← 返回机房列表</button>
        <h2 class="toolbar-title" v-if="!loading">{{ roomName }}</h2>
      </div>
      <div class="toolbar-center">
        <div class="mode-toggle">
          <button
            :class="['btn btn--small', mode === 'view' ? 'btn--primary' : 'btn--muted']"
            @click="setViewMode"
          >查看模式</button>
          <button
            :class="['btn btn--small', mode === 'edit' ? 'btn--primary' : 'btn--muted']"
            @click="setEditMode"
          >编辑模式</button>
        </div>
      </div>
      <div class="toolbar-right">
        <span class="hint" v-if="mode === 'edit'">{{ activeTool === 'select' ? '拖拽移动 | Ctrl+Z 撤销 | Ctrl+Y 重做' : '绘制中...' }}</span>
        <span class="hint" v-else>滚轮缩放 | 拖拽平移 | 点击机柜查看</span>
      </div>
    </header>

    <div class="floorplan-body">
      <FloorplanToolbar
        v-if="mode === 'edit'"
        :active-tool="activeTool"
        :can-undo="canUndo"
        :can-redo="canRedo"
        @tool-change="setTool"
        @undo="undo"
        @redo="redo"
        @export-svg="exportSvg"
      />

      <div class="canvas-wrap">
        <div v-if="loading" class="status-msg">加载中...</div>
        <div v-else-if="error" class="status-msg status-msg--error">{{ error }}</div>
        <FloorplanCanvas
          v-else
          :racks="racks"
          :walls="walls"
          :zones="zones"
          :labels="labels"
          :mode="mode"
          :active-tool="activeTool"
          :snap-lines="snapLines"
          :to-canvas-x="toCanvasX"
          :to-canvas-y="toCanvasY"
          :snap-position="snapPosition"
          @rack-click="goToRack"
          @rack-dragstart="handleDragStart"
          @rack-dragend="onDragEnd"
          @wall-drawn="onWallDrawn"
          @zone-drawn="onZoneDrawn"
          @label-placed="onLabelPlaced"
        />
      </div>

      <FloorplanRackLibrary
        v-if="mode === 'edit' && activeTool === 'rack'"
        :racks="racks"
        @rack-drop="onRackDrop"
        @rack-create="onRackCreate"
      />

      <FloorplanPropertyPanel
        v-if="mode === 'edit' && selectedElement"
        :selected="selectedElement"
        @update="onPropertyUpdate"
        @delete="onElementDelete"
      />

      <aside v-if="mode === 'view' && selectedRack" class="sidebar">
        <div class="sidebar-header">
          <h3>{{ selectedRack.code }}</h3>
          <button class="btn btn--tiny btn--muted" @click="selectRack(null)">✕</button>
        </div>
        <dl class="sidebar-dl">
          <dt>房间</dt><dd>{{ selectedRack.roomName }}</dd>
          <dt>U位</dt><dd>{{ selectedRack.heightU }}U</dd>
          <dt>已用</dt><dd>{{ selectedRack.occupiedU ?? 0 }}U ({{ occPct }}%)</dd>
          <dt>品牌</dt><dd>{{ selectedRack.brand || '—' }}</dd>
          <dt>功率</dt><dd>{{ selectedRack.power != null ? selectedRack.power + ' kW' : '—' }}</dd>
          <dt>坐标</dt><dd>({{ selectedRack.x }}, {{ selectedRack.y }})</dd>
        </dl>
        <div class="sidebar-actions">
          <button class="btn btn--small btn--primary" @click="goToRack(selectedRack.id)">查看机柜详情</button>
        </div>
      </aside>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Rewrite script section**

Replace the `<script setup>` block with:

```typescript
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFloorplan } from '../composables/useFloorplan'
import { useFloorplanEditor } from '../composables/useFloorplanEditor'
import { useFloorplanElements, type WallItem, type ZoneItem, type LabelItem } from '../composables/useFloorplanElements'
import { useApi } from '../composables/useApi'
import FloorplanCanvas from '../components/FloorplanCanvas.vue'
import FloorplanToolbar, { type ToolType } from '../components/FloorplanToolbar.vue'
import FloorplanRackLibrary from '../components/FloorplanRackLibrary.vue'
import FloorplanPropertyPanel from '../components/FloorplanPropertyPanel.vue'

const route = useRoute()
const router = useRouter()
const roomId = computed(() => route.params.id as string)

const { racks, loading, error, loadRacks, toCanvasX, toCanvasY, toDbX, toDbY } = useFloorplan(roomId.value)
const { walls, zones, labels, loadElements, addWall, addZone, addLabel, deleteWall, deleteZone, deleteLabel, updateWall, updateZone, updateLabel } = useFloorplanElements(roomId.value)
const { request } = useApi()

const activeTool = ref<ToolType>('select')
const selectedElementType = ref<string | null>(null)
const selectedElementId = ref<string | null>(null)

const selectedElement = computed(() => {
  if (!selectedElementId.value) return null
  const type = selectedElementType.value
  if (type === 'wall') {
    const w = walls.value.find(e => e.id === selectedElementId.value)
    return w ? { ...w, type: 'wall' as const } : null
  }
  if (type === 'zone') {
    const z = zones.value.find(e => e.id === selectedElementId.value)
    return z ? { ...z, type: 'zone' as const } : null
  }
  if (type === 'label') {
    const l = labels.value.find(e => e.id === selectedElementId.value)
    return l ? { ...l, type: 'label' as const } : null
  }
  return null
})

async function saveRackPosition(id: string, x: number, y: number): Promise<boolean> {
  const rack = racks.value.find(r => r.id === id)
  if (!rack) return false
  const csrfResult = await request('/api/auth/csrf', { method: 'GET' })
  if (!csrfResult.ok) return false
  const token = csrfResult.headers.get('X-XSRF-TOKEN')
  if (!token) return false
  const result = await request(`/api/racks/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: { code: rack.code, heightU: rack.heightU, brand: rack.brand, power: rack.power, notes: rack.notes, x, y, z: rack.z },
    csrfToken: token,
  })
  return result.ok
}

const editor = useFloorplanEditor(racks, toDbX, toDbY, saveRackPosition)
const { mode, selectedRackId, snapLines, toggleMode, selectRack, snapPosition, handleDragStart, handleDragEnd, undo, redo, canUndo, canRedo } = editor

const roomName = computed(() => racks.value[0]?.roomName ?? '机房平面图')
const selectedRack = computed(() => selectedRackId.value ? racks.value.find(r => r.id === selectedRackId.value) ?? null : null)
const occPct = computed(() => {
  if (!selectedRack.value?.occupiedU) return 0
  return Math.round((selectedRack.value.occupiedU / selectedRack.value.heightU) * 100)
})

function setViewMode(): void { if (mode.value !== 'view') toggleMode() }
function setEditMode(): void { if (mode.value !== 'edit') toggleMode() }
function setTool(t: ToolType): void { activeTool.value = t; selectedElementId.value = null }
function goBack(): void { router.push('/') }
function goToRack(rackId: string): void { router.push(`/racks/${encodeURIComponent(rackId)}`) }
function onDragEnd(rackId: string, x: number, y: number): void { handleDragEnd(rackId, x, y) }

// Drawing event handlers
async function onWallDrawn(x1: number, y1: number, x2: number, y2: number): Promise<void> {
  const wall = await addWall({ x1: toDbX(x1), y1: toDbY(y1), x2: toDbX(x2), y2: toDbY(y2) })
  if (wall) activeTool.value = 'select'
}

async function onZoneDrawn(x: number, y: number, w: number, h: number): Promise<void> {
  const name = window.prompt('区域名称：', '新区域')
  if (!name) return
  const zone = await addZone({ x: toDbX(x), y: toDbY(y), width: toDbX(w), height: toDbY(h), name, zoneType: 'functional' })
  if (zone) activeTool.value = 'select'
}

async function onLabelPlaced(x: number, y: number): Promise<void> {
  const text = window.prompt('标签文字：')
  if (!text) return
  const label = await addLabel({ x: toDbX(x), y: toDbY(y), text })
  if (label) activeTool.value = 'select'
}

async function onElementDelete(id: string, type: string): Promise<void> {
  if (!window.confirm('确认删除此元素？')) return
  if (type === 'wall') await deleteWall(id)
  else if (type === 'zone') await deleteZone(id)
  else if (type === 'label') await deleteLabel(id)
  selectedElementId.value = null
  selectedElementType.value = null
}

async function onPropertyUpdate(patch: Record<string, unknown>): Promise<void> {
  if (!selectedElementId.value || !selectedElementType.value) return
  const id = selectedElementId.value
  const type = selectedElementType.value
  if (type === 'wall') {
    const w = walls.value.find(e => e.id === id)
    if (w) await updateWall(id, { x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2, ...patch })
  } else if (type === 'zone') {
    const z = zones.value.find(e => e.id === id)
    if (z) await updateZone(id, { x: z.x, y: z.y, width: z.width, height: z.height, name: z.name, zoneType: z.zoneType, ...patch })
  } else if (type === 'label') {
    const l = labels.value.find(e => e.id === id)
    if (l) await updateLabel(id, { x: l.x, y: l.y, text: l.text, fontSize: l.fontSize, color: l.color, ...patch })
  }
}

function onRackDrop(payload: { rackId: string; clientX: number; clientY: number }): void {
  // Find the canvas element to convert viewport coords to canvas coords
  const canvasWrap = document.querySelector('.canvas-wrap') as HTMLElement | null
  if (!canvasWrap) return
  const rect = canvasWrap.getBoundingClientRect()
  const canvasX = payload.clientX - rect.left
  const canvasY = payload.clientY - rect.top
  const existingRack = racks.value.find(r => r.id === payload.rackId)
  if (existingRack) {
    // Move existing rack to drop position
    handleDragEnd(payload.rackId, canvasX, canvasY)
  }
}

async function onRackCreate(): Promise<void> {
  const code = window.prompt('机柜编号：')
  if (!code) return
  const heightU = Number(window.prompt('高度(U)：', '42'))
  if (!heightU || heightU < 1) return
  const brand = window.prompt('品牌（可选）：') || ''
  // Use center of visible canvas area as default position
  const canvasWrap = document.querySelector('.canvas-wrap') as HTMLElement | null
  const defaultX = canvasWrap ? canvasWrap.clientWidth / 2 : 300
  const defaultY = canvasWrap ? canvasWrap.clientHeight / 2 : 300
  const csrfResult = await request('/api/auth/csrf', { method: 'GET' })
  if (!csrfResult.ok) return
  const token = csrfResult.headers.get('X-XSRF-TOKEN')
  if (!token) return
  const result = await request(`/api/racks`, {
    method: 'POST',
    body: { code, roomId: roomId.value, heightU, brand, x: toDbX(defaultX), y: toDbY(defaultY), z: 0 },
    csrfToken: token,
  })
  if (result.ok) {
    await loadRacks() // Refresh rack list to include the new rack
  }
}

function exportSvg(): void {
  // implemented in Task 12
}

// Keyboard shortcuts
function onKeyDown(e: KeyboardEvent): void {
  if (e.key === '1' && mode.value === 'edit') toggleMode()
  if (e.key === '2' && mode.value === 'view') toggleMode()
  if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo() }
  if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo() }
}

onMounted(() => {
  loadRacks()
  loadElements()
  window.addEventListener('keydown', onKeyDown)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
})
```

- [ ] **Step 3: Build and typecheck**

Run: `cd src/frontend && npm run typecheck`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/frontend/src/views/FloorplanView.vue
git commit -m "feat: integrate toolbar, rack library, property panel into FloorplanView"
```

---

### Task 11: Extend useFloorplanEditor undo/redo for floorplan elements

**Files:**
- Modify: `src/frontend/src/composables/useFloorplanEditor.ts`

**Interfaces:**
- Consumes: `WallItem`, `ZoneItem`, `LabelItem` types
- Produces: `undoElementAction`, `redoElementAction` functions for non-rack element undo/redo

- [ ] **Step 1: Add element action types and tracking**

After the existing `UndoEntry` interface (line 12), add:

```typescript
interface ElementAction {
  action: 'create' | 'delete' | 'update'
  elementType: 'wall' | 'zone' | 'label'
  elementId: string
  previousData?: Record<string, unknown>
  newData?: Record<string, unknown>
}
```

Add new stack:

```typescript
const elementUndoStack = ref<ElementAction[]>([])
const elementRedoStack = ref<ElementAction[]>([])
```

- [ ] **Step 2: Add element undo/redo functions**

Add after the existing `redo` function (line 126):

```typescript
  function pushElementAction(action: ElementAction): void {
    elementUndoStack.value.push(action)
    elementRedoStack.value = []
  }

  function undoElement(): ElementAction | null {
    const action = elementUndoStack.value.pop()
    if (action) elementRedoStack.value.push(action)
    return action ?? null
  }

  function redoElement(): ElementAction | null {
    const action = elementRedoStack.value.pop()
    if (action) elementUndoStack.value.push(action)
    return action ?? null
  }

  function clearElementHistory(): void {
    elementUndoStack.value = []
    elementRedoStack.value = []
  }
```

- [ ] **Step 3: Add to return statement**

Add to the return object:

```typescript
    pushElementAction, undoElement, redoElement, clearElementHistory,
```

- [ ] **Step 4: Build and typecheck**

Run: `cd src/frontend && npm run typecheck`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add src/frontend/src/composables/useFloorplanEditor.ts
git commit -m "feat: extend undo/redo for floorplan elements"
```

---

### Task 12: SVG export

**Files:**
- Modify: `src/frontend/src/views/FloorplanView.vue`

**Interfaces:**
- Consumes: Konva stage instance (accessed via FloorplanCanvas ref)

- [ ] **Step 1: Add SVG export function to FloorplanView**

Replace the placeholder `exportSvg` function in FloorplanView.vue's script section with:

```typescript
function exportSvg(): void {
  // Access Konva stage via DOM: the canvas element inside .canvas-wrap
  const canvasEl = document.querySelector('.canvas-wrap canvas') as HTMLCanvasElement | null
  if (!canvasEl) return

  // Konva stores the stage on the container div; find the stage
  const containerDiv = canvasEl.closest('.konvajs-content')?.parentElement
  if (!containerDiv) return

  // Build SVG manually from element data for clean output
  const room = roomName.value
  const lines: string[] = []
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasEl.width} ${canvasEl.height}">`)

  // Walls
  for (const w of walls.value) {
    const x1 = toCanvasX(w.x1); const y1 = toCanvasY(w.y1)
    const x2 = toCanvasX(w.x2); const y2 = toCanvasY(w.y2)
    lines.push(`  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${w.color}" stroke-width="${w.thickness}" stroke-linecap="round"/>`)
  }

  // Zones
  for (const z of zones.value) {
    const x = toCanvasX(z.x); const y = toCanvasY(z.y)
    const w = z.width * 0.1; const h = z.height * 0.1
    lines.push(`  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${z.color}" stroke="${z.color.replace(/[\d.]+\)$/, '0.4)')}" stroke-width="1" rx="2"/>`)
    lines.push(`  <text x="${x + 4}" y="${y + 16}" font-size="11" fill="#666">${escapeXml(z.name)}</text>`)
  }

  // Racks
  for (const r of racks.value) {
    const x = toCanvasX(r.x); const y = toCanvasY(r.y)
    const c = occColor(r.occupiedU, r.heightU)
    lines.push(`  <rect x="${x}" y="${y}" width="60" height="100" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" rx="3"/>`)
    lines.push(`  <text x="${x + 30}" y="${y + 55}" font-size="11" text-anchor="middle" fill="#2c3e50">${escapeXml(r.code)}</text>`)
  }

  // Labels
  for (const l of labels.value) {
    const x = toCanvasX(l.x); const y = toCanvasY(l.y)
    lines.push(`  <text x="${x}" y="${y + l.fontSize}" font-size="${l.fontSize}" fill="${l.color}">${escapeXml(l.text)}</text>`)
  }

  lines.push('</svg>')

  const blob = new Blob([lines.join('\n')], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `${room}.svg`
  a.click()
  URL.revokeObjectURL(url)
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
```

Note: `occColor` needs to be imported from FloorplanCanvas or redefined. For simplicity, redefine it locally:

```typescript
function occColor(occ: number | undefined, total: number): { fill: string; stroke: string } {
  if (!occ || occ === 0) return { fill: 'transparent', stroke: '#999' }
  const pct = occ / total
  if (pct > 0.8) return { fill: '#fce4e4', stroke: '#e74c3c' }
  if (pct >= 0.5) return { fill: '#fef3e0', stroke: '#f0ad4e' }
  return { fill: '#e8f8e8', stroke: '#52c41a' }
}
```

- [ ] **Step 2: Build and typecheck**

Run: `cd src/frontend && npm run typecheck`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/frontend/src/views/FloorplanView.vue
git commit -m "feat: add SVG export for floorplan"
```

---

### Task 13: Integration test — full flow

**Files:**
- Test: `src/frontend/src/__tests__/floorplan-editor.test.ts` (new or extend existing)

- [ ] **Step 1: Write integration tests**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useFloorplanElements } from '../../composables/useFloorplanElements'
import { useFloorplanEditor } from '../../composables/useFloorplanEditor'
import { ref } from 'vue'
import type { RackItem } from '../../composables/useFloorplan'

// Mock useApi
vi.mock('../../composables/useApi', () => ({
  useApi: () => ({
    request: vi.fn().mockImplementation(async (path: string, _opts?: unknown) => {
      if (path === '/api/auth/csrf') {
        return { ok: true, headers: new Headers({ 'X-XSRF-TOKEN': 'test-token' }), status: 200 } as const
      }
      if (path.includes('/floorplan-elements')) {
        return { ok: true, data: { walls: [], zones: [], labels: [] }, headers: new Headers(), status: 200 } as const
      }
      return { ok: true, data: [], headers: new Headers(), status: 200 } as const
    }),
  }),
}))

describe('useFloorplanElements', () => {
  it('starts with empty arrays', () => {
    const { walls, zones, labels, loading } = useFloorplanElements('test-room')
    expect(walls.value).toEqual([])
    expect(zones.value).toEqual([])
    expect(labels.value).toEqual([])
    expect(loading.value).toBe(false)
  })

  it('toCanvasX/toCanvasY converts DB mm to canvas px', () => {
    const { toCanvasX, toCanvasY, toDbX, toDbY } = useFloorplanElements('test-room')
    expect(toCanvasX(6000)).toBe(600)
    expect(toCanvasY(3000)).toBe(300)
    expect(toDbX(600)).toBe(6000)
    expect(toDbY(300)).toBe(3000)
  })
})

describe('useFloorplanEditor element undo/redo', () => {
  function makeEditor() {
    const racks = ref<RackItem[]>([])
    return useFloorplanEditor(racks, (v) => v / 0.1, (v) => v / 0.1, async () => true)
  }

  it('pushElementAction and undoElement work', () => {
    const editor = makeEditor()
    editor.pushElementAction({ action: 'create', elementType: 'wall', elementId: 'w1', newData: { x1: 100 } })
    expect(editor.undoElement()).toEqual({ action: 'create', elementType: 'wall', elementId: 'w1', newData: { x1: 100 } })
    expect(editor.undoElement()).toBeNull()
  })

  it('redoElement returns undone actions', () => {
    const editor = makeEditor()
    editor.pushElementAction({ action: 'delete', elementType: 'label', elementId: 'l1' })
    editor.undoElement()
    expect(editor.redoElement()).toEqual({ action: 'delete', elementType: 'label', elementId: 'l1' })
    expect(editor.redoElement()).toBeNull()
  })

  it('clearElementHistory empties both stacks', () => {
    const editor = makeEditor()
    editor.pushElementAction({ action: 'create', elementType: 'zone', elementId: 'z1' })
    editor.pushElementAction({ action: 'create', elementType: 'zone', elementId: 'z2' })
    editor.clearElementHistory()
    expect(editor.undoElement()).toBeNull()
    expect(editor.redoElement()).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests**

Run: `cd src/frontend && npm run test -- floorplan-editor`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/frontend/src/__tests__/floorplan-editor.test.ts
git commit -m "test: add floorplan element and undo/redo tests"
```

---

### Task 14: Backend integration tests

**Files:**
- Test: new test class in backend test project

- [ ] **Step 1: Write FloorplanController integration tests**

Create `tests/backend/Datacenter.Api.Tests/FloorplanControllerTests.cs`:

```csharp
// Use existing test patterns from the test project.
// Test GET returns 200 with walls/zones/labels arrays.
// Test POST wall creates a wall and returns 201.
// Test DELETE wall returns 204.
// Test PUT zone updates zone properties.
```

- [ ] **Step 2: Run backend tests**

Run: `dotnet test tests/backend/Datacenter.Api.Tests/`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/backend/Datacenter.Api.Tests/
git commit -m "test: add FloorplanController integration tests"
```
