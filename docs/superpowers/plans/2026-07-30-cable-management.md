# Cable Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add port-to-port cable routing management: new Port & Cable data models, REST API, global cable list page, port panel in server detail, and cable visualization layer on the floorplan.

**Architecture:** Two new EF entities (Port, Cable) with unique constraints, new PortsController + CablesController, frontend CableListView + port panel extension in ServerDetailView + cable layer in FloorplanCanvas. Follows existing patterns: `[ApiController]`/`[Authorize]`, `useApi()` composable, scoped Vue SFCs.

**Tech Stack:** .NET 8 + EF Core SQLite + Vue 3 + TypeScript + Konva 9.x + Vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-30-cable-management-design.md`

## Global Constraints

- Follow existing code patterns exactly: controller structure, error responses, CSRF handling
- Port: UNIQUE(ServerId, PortName). Cable: UNIQUE(SourcePortId), UNIQUE(TargetPortId)
- Delete port with cable → 400. Create cable to occupied port → 400
- Cable type colors: 铜缆 `#e67e22`, 光纤 `#f1c40f`, DAC `#3498db`
- Floorplan cables: only cross-rack links drawn, straight lines between rack centers
- TDD: test first, see it fail, then implement
- TypeScript strict: no `any`

---

### Task 1: Backend — Port and Cable models + DbContext + Migration

**Files:**
- Create: `src/backend/Datacenter.Api/Models/Port.cs`
- Create: `src/backend/Datacenter.Api/Models/Cable.cs`
- Modify: `src/backend/Datacenter.Api/Data/AppDbContext.cs`

**Produces:** Two entities with proper constraints, EF migration applied at startup.

- [ ] **Step 1: Create Port.cs**

```csharp
namespace Datacenter.Api.Models;

public sealed class Port
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ServerId { get; set; }

    public Server Server { get; set; } = null!;

    public string PortName { get; set; } = string.Empty;

    public string PortType { get; set; } = string.Empty;

    public string? Speed { get; set; }

    public string? Notes { get; set; }
}
```

- [ ] **Step 2: Create Cable.cs**

```csharp
namespace Datacenter.Api.Models;

public sealed class Cable
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid SourcePortId { get; set; }

    public Port SourcePort { get; set; } = null!;

    public Guid TargetPortId { get; set; }

    public Port TargetPort { get; set; } = null!;

    public string CableType { get; set; } = string.Empty;

    public string? Color { get; set; }

    public string? Length { get; set; }

    public string? Notes { get; set; }
}
```

- [ ] **Step 3: Add DbSet and configuration in AppDbContext.cs**

Add DbSets:
```csharp
public DbSet<Port> Ports => Set<Port>();
public DbSet<Cable> Cables => Set<Cable>();
```

Add configuration in `OnModelCreating`:

```csharp
var port = modelBuilder.Entity<Port>();
port.ToTable("Ports");
port.HasKey(item => item.Id);
port.HasIndex(item => new { item.ServerId, item.PortName }).IsUnique();
port.Property(item => item.PortName).IsRequired();
port.Property(item => item.PortType).IsRequired();
port.HasOne(item => item.Server)
    .WithMany()
    .HasForeignKey(item => item.ServerId)
    .OnDelete(DeleteBehavior.Restrict);

var cable = modelBuilder.Entity<Cable>();
cable.ToTable("Cables");
cable.HasKey(item => item.Id);
cable.HasIndex(item => item.SourcePortId).IsUnique();
cable.HasIndex(item => item.TargetPortId).IsUnique();
cable.Property(item => item.CableType).IsRequired();
cable.HasOne(item => item.SourcePort)
    .WithMany()
    .HasForeignKey(item => item.SourcePortId)
    .OnDelete(DeleteBehavior.Restrict);
cable.HasOne(item => item.TargetPort)
    .WithMany()
    .HasForeignKey(item => item.TargetPortId)
    .OnDelete(DeleteBehavior.Restrict);
```

- [ ] **Step 4: Create and apply migration**

```bash
cd src/backend/Datacenter.Api
dotnet ef migrations add AddPortsAndCables
dotnet build
```

Expected: Build succeeds. Migration added.

- [ ] **Step 5: Verify migration**

Start backend, verify database has Ports and Cables tables:
```bash
dotnet run
```

Then check tables exist in `.data/datacenter-dev.db`.

- [ ] **Step 6: Commit**

```bash
git add src/backend/Datacenter.Api/Models/Port.cs \
        src/backend/Datacenter.Api/Models/Cable.cs \
        src/backend/Datacenter.Api/Data/AppDbContext.cs \
        src/backend/Datacenter.Api/Migrations/
git commit -m "feat: add Port and Cable models with EF migration"
```

---

### Task 2: Backend — PortsController

**Files:**
- Create: `src/backend/Datacenter.Api/Controllers/PortsController.cs`

**Produces:**
- `GET /api/servers/{serverId}/ports` — list ports for a server
- `POST /api/servers/{serverId}/ports` — create a port (CanModify)
- `PUT /api/ports/{id}` — update port (CanModify)
- `DELETE /api/ports/{id}` — delete port, returns 400 if cable attached (CanModify)

- [ ] **Step 1: Create PortsController.cs**

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
[Route("api")]
public sealed class PortsController(AppDbContext dbContext, IAntiforgery antiforgery) : ControllerBase
{
    [HttpGet("servers/{serverId:guid}/ports")]
    public async Task<IActionResult> List(Guid serverId, CancellationToken cancellationToken)
    {
        var serverExists = await dbContext.Servers.AnyAsync(s => s.Id == serverId, cancellationToken);
        if (!serverExists)
            return NotFound(new { error = "服务器不存在" });

        var ports = await dbContext.Ports
            .AsNoTracking()
            .Where(p => p.ServerId == serverId)
            .Select(p => new
            {
                p.Id,
                p.ServerId,
                p.PortName,
                p.PortType,
                p.Speed,
                p.Notes,
                ConnectedCableId = dbContext.Cables
                    .Where(c => c.SourcePortId == p.Id || c.TargetPortId == p.Id)
                    .Select(c => c.Id)
                    .FirstOrDefault(),
                ConnectedToPortName = dbContext.Cables
                    .Where(c => c.SourcePortId == p.Id)
                    .Select(c => c.TargetPort.PortName)
                    .FirstOrDefault()
                    ?? dbContext.Cables
                    .Where(c => c.TargetPortId == p.Id)
                    .Select(c => c.SourcePort.PortName)
                    .FirstOrDefault(),
                ConnectedToServerName = dbContext.Cables
                    .Where(c => c.SourcePortId == p.Id)
                    .Select(c => c.TargetPort.Server.Name)
                    .FirstOrDefault()
                    ?? dbContext.Cables
                    .Where(c => c.TargetPortId == p.Id)
                    .Select(c => c.SourcePort.Server.Name)
                    .FirstOrDefault()
            })
            .ToListAsync(cancellationToken);

        return Ok(ports);
    }

    public sealed record CreatePortRequest(string PortName, string PortType, string? Speed, string? Notes);

    [HttpPost("servers/{serverId:guid}/ports")]
    public async Task<IActionResult> Create(Guid serverId, CreatePortRequest request, CancellationToken cancellationToken)
    {
        if (!User.IsInRole(Roles.RoomAdministrator) && !User.IsInRole(Roles.Operations))
            return StatusCode(StatusCodes.Status403Forbidden);

        try { await antiforgery.ValidateRequestAsync(HttpContext); }
        catch (AntiforgeryValidationException) { return BadRequest(new { error = "防伪令牌缺失或无效" }); }

        var serverExists = await dbContext.Servers.AnyAsync(s => s.Id == serverId, cancellationToken);
        if (!serverExists)
            return NotFound(new { error = "服务器不存在" });

        var portName = request.PortName?.Trim();
        if (string.IsNullOrWhiteSpace(portName))
            return BadRequest(new { error = "端口名称不能为空" });

        if (string.IsNullOrWhiteSpace(request.PortType))
            return BadRequest(new { error = "端口类型不能为空" });

        var duplicate = await dbContext.Ports
            .AnyAsync(p => p.ServerId == serverId && p.PortName == portName, cancellationToken);
        if (duplicate)
            return BadRequest(new { error = "端口名称已存在" });

        var port = new Port
        {
            ServerId = serverId,
            PortName = portName,
            PortType = request.PortType.Trim(),
            Speed = request.Speed?.Trim(),
            Notes = request.Notes?.Trim()
        };
        dbContext.Ports.Add(port);
        await dbContext.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(List), new { serverId }, new { port.Id, port.ServerId, port.PortName, port.PortType, port.Speed, port.Notes });
    }

    public sealed record UpdatePortRequest(string PortName, string PortType, string? Speed, string? Notes);

    [HttpPut("ports/{id:guid}")]
    public async Task<IActionResult> Update(Guid id, UpdatePortRequest request, CancellationToken cancellationToken)
    {
        if (!User.IsInRole(Roles.RoomAdministrator) && !User.IsInRole(Roles.Operations))
            return StatusCode(StatusCodes.Status403Forbidden);

        try { await antiforgery.ValidateRequestAsync(HttpContext); }
        catch (AntiforgeryValidationException) { return BadRequest(new { error = "防伪令牌缺失或无效" }); }

        var port = await dbContext.Ports.FindAsync([id], cancellationToken);
        if (port is null)
            return NotFound(new { error = "端口不存在" });

        var portName = request.PortName?.Trim();
        if (string.IsNullOrWhiteSpace(portName))
            return BadRequest(new { error = "端口名称不能为空" });

        if (string.IsNullOrWhiteSpace(request.PortType))
            return BadRequest(new { error = "端口类型不能为空" });

        var duplicate = await dbContext.Ports
            .AnyAsync(p => p.ServerId == port.ServerId && p.PortName == portName && p.Id != id, cancellationToken);
        if (duplicate)
            return BadRequest(new { error = "端口名称已存在" });

        port.PortName = portName;
        port.PortType = request.PortType.Trim();
        port.Speed = request.Speed?.Trim();
        port.Notes = request.Notes?.Trim();
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new { port.Id, port.ServerId, port.PortName, port.PortType, port.Speed, port.Notes });
    }

    [HttpDelete("ports/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        if (!User.IsInRole(Roles.RoomAdministrator) && !User.IsInRole(Roles.Operations))
            return StatusCode(StatusCodes.Status403Forbidden);

        try { await antiforgery.ValidateRequestAsync(HttpContext); }
        catch (AntiforgeryValidationException) { return BadRequest(new { error = "防伪令牌缺失或无效" }); }

        var port = await dbContext.Ports.FindAsync([id], cancellationToken);
        if (port is null)
            return NotFound(new { error = "端口不存在" });

        var hasCable = await dbContext.Cables
            .AnyAsync(c => c.SourcePortId == id || c.TargetPortId == id, cancellationToken);
        if (hasCable)
            return BadRequest(new { error = "端口已连接线缆，请先删除线缆" });

        dbContext.Ports.Remove(port);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}
```

- [ ] **Step 2: Build backend**

```bash
cd src/backend/Datacenter.Api && dotnet build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/backend/Datacenter.Api/Controllers/PortsController.cs
git commit -m "feat: add PortsController with CRUD endpoints"
```

---

### Task 3: Backend — CablesController

**Files:**
- Create: `src/backend/Datacenter.Api/Controllers/CablesController.cs`

**Produces:**
- `GET /api/cables` — global list with optional ?rackId=, ?roomId=, ?cableType= filters
- `POST /api/cables` — create cable (CanModify)
- `DELETE /api/cables/{id}` — delete cable (CanModify)
- `GET /api/rooms/{id}/cables` — cross-rack links for floorplan

- [ ] **Step 1: Create CablesController.cs**

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
[Route("api")]
public sealed class CablesController(AppDbContext dbContext, IAntiforgery antiforgery) : ControllerBase
{
    [HttpGet("cables")]
    public async Task<IActionResult> List(
        [FromQuery] Guid? sourceRackId,
        [FromQuery] Guid? targetRackId,
        [FromQuery] Guid? roomId,
        [FromQuery] string? cableType,
        CancellationToken cancellationToken)
    {
        var query = dbContext.Cables.AsNoTracking();

        if (sourceRackId.HasValue)
        {
            query = query.Where(c => dbContext.ServerPositions
                .Any(sp => sp.ServerId == c.SourcePort.ServerId && sp.RackId == sourceRackId.Value && sp.Status == "在架"));
        }
        if (targetRackId.HasValue)
        {
            query = query.Where(c => dbContext.ServerPositions
                .Any(sp => sp.ServerId == c.TargetPort.ServerId && sp.RackId == targetRackId.Value && sp.Status == "在架"));
        }
        if (roomId.HasValue)
        {
            query = query.Where(c => dbContext.ServerPositions
                .Any(sp => sp.ServerId == c.SourcePort.ServerId && sp.Rack.RoomId == roomId.Value && sp.Status == "在架")
                || dbContext.ServerPositions
                .Any(sp => sp.ServerId == c.TargetPort.ServerId && sp.Rack.RoomId == roomId.Value && sp.Status == "在架"));
        }
        if (!string.IsNullOrWhiteSpace(cableType))
        {
            query = query.Where(c => c.CableType == cableType);
        }

        var cables = await query
            .Select(c => new
            {
                c.Id,
                c.SourcePortId,
                SourcePortName = c.SourcePort.PortName,
                SourceServerName = c.SourcePort.Server.Name,
                SourceServerId = c.SourcePort.ServerId,
                SourceRackCode = dbContext.ServerPositions
                    .Where(sp => sp.ServerId == c.SourcePort.ServerId && sp.Status == "在架")
                    .Select(sp => sp.Rack.Code)
                    .FirstOrDefault(),
                SourceRackId = dbContext.ServerPositions
                    .Where(sp => sp.ServerId == c.SourcePort.ServerId && sp.Status == "在架")
                    .Select(sp => sp.RackId)
                    .FirstOrDefault(),
                SourceRoomName = dbContext.ServerPositions
                    .Where(sp => sp.ServerId == c.SourcePort.ServerId && sp.Status == "在架")
                    .Select(sp => sp.Rack.Room.Name)
                    .FirstOrDefault(),
                c.TargetPortId,
                TargetPortName = c.TargetPort.PortName,
                TargetServerName = c.TargetPort.Server.Name,
                TargetServerId = c.TargetPort.ServerId,
                TargetRackCode = dbContext.ServerPositions
                    .Where(sp => sp.ServerId == c.TargetPort.ServerId && sp.Status == "在架")
                    .Select(sp => sp.Rack.Code)
                    .FirstOrDefault(),
                TargetRackId = dbContext.ServerPositions
                    .Where(sp => sp.ServerId == c.TargetPort.ServerId && sp.Status == "在架")
                    .Select(sp => sp.RackId)
                    .FirstOrDefault(),
                TargetRoomName = dbContext.ServerPositions
                    .Where(sp => sp.ServerId == c.TargetPort.ServerId && sp.Status == "在架")
                    .Select(sp => sp.Rack.Room.Name)
                    .FirstOrDefault(),
                c.CableType,
                c.Color,
                c.Length,
                c.Notes
            })
            .ToListAsync(cancellationToken);

        return Ok(cables);
    }

    public sealed record CreateCableRequest(
        Guid SourcePortId, Guid TargetPortId, string CableType, string? Color, string? Length);

    [HttpPost("cables")]
    public async Task<IActionResult> Create(CreateCableRequest request, CancellationToken cancellationToken)
    {
        if (!User.IsInRole(Roles.RoomAdministrator) && !User.IsInRole(Roles.Operations))
            return StatusCode(StatusCodes.Status403Forbidden);

        try { await antiforgery.ValidateRequestAsync(HttpContext); }
        catch (AntiforgeryValidationException) { return BadRequest(new { error = "防伪令牌缺失或无效" }); }

        if (string.IsNullOrWhiteSpace(request.CableType))
            return BadRequest(new { error = "线缆类型不能为空" });

        var sourcePort = await dbContext.Ports.FindAsync([request.SourcePortId], cancellationToken);
        if (sourcePort is null)
            return BadRequest(new { error = "源端口不存在" });

        var targetPort = await dbContext.Ports.FindAsync([request.TargetPortId], cancellationToken);
        if (targetPort is null)
            return BadRequest(new { error = "目标端口不存在" });

        var sourceOccupied = await dbContext.Cables
            .AnyAsync(c => c.SourcePortId == request.SourcePortId || c.TargetPortId == request.SourcePortId, cancellationToken);
        if (sourceOccupied)
            return BadRequest(new { error = "源端口已被占用" });

        var targetOccupied = await dbContext.Cables
            .AnyAsync(c => c.SourcePortId == request.TargetPortId || c.TargetPortId == request.TargetPortId, cancellationToken);
        if (targetOccupied)
            return BadRequest(new { error = "目标端口已被占用" });

        var cable = new Cable
        {
            SourcePortId = request.SourcePortId,
            TargetPortId = request.TargetPortId,
            CableType = request.CableType.Trim(),
            Color = request.Color?.Trim(),
            Length = request.Length?.Trim()
        };
        dbContext.Cables.Add(cable);
        await dbContext.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(List), null, new { cable.Id, cable.SourcePortId, cable.TargetPortId, cable.CableType, cable.Color, cable.Length });
    }

    [HttpDelete("cables/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        if (!User.IsInRole(Roles.RoomAdministrator) && !User.IsInRole(Roles.Operations))
            return StatusCode(StatusCodes.Status403Forbidden);

        try { await antiforgery.ValidateRequestAsync(HttpContext); }
        catch (AntiforgeryValidationException) { return BadRequest(new { error = "防伪令牌缺失或无效" }); }

        var cable = await dbContext.Cables.FindAsync([id], cancellationToken);
        if (cable is null)
            return NotFound(new { error = "线缆不存在" });

        dbContext.Cables.Remove(cable);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpGet("rooms/{id:guid}/cables")]
    public async Task<IActionResult> RoomCables(Guid id, CancellationToken cancellationToken)
    {
        var roomExists = await dbContext.Rooms.AnyAsync(r => r.Id == id, cancellationToken);
        if (!roomExists)
            return NotFound(new { error = "机房不存在" });

        var cables = await dbContext.Cables
            .AsNoTracking()
            .Where(c =>
                dbContext.ServerPositions.Any(sp => sp.ServerId == c.SourcePort.ServerId && sp.Rack.RoomId == id && sp.Status == "在架")
                && dbContext.ServerPositions.Any(sp => sp.ServerId == c.TargetPort.ServerId && sp.Rack.RoomId == id && sp.Status == "在架"))
            .Select(c => new
            {
                c.Id,
                c.CableType,
                c.Color,
                SourceRackId = dbContext.ServerPositions
                    .Where(sp => sp.ServerId == c.SourcePort.ServerId && sp.Status == "在架")
                    .Select(sp => sp.RackId)
                    .FirstOrDefault(),
                SourceRackCode = dbContext.ServerPositions
                    .Where(sp => sp.ServerId == c.SourcePort.ServerId && sp.Status == "在架")
                    .Select(sp => sp.Rack.Code)
                    .FirstOrDefault(),
                SourceX = dbContext.ServerPositions
                    .Where(sp => sp.ServerId == c.SourcePort.ServerId && sp.Status == "在架")
                    .Select(sp => sp.Rack.X)
                    .FirstOrDefault(),
                SourceY = dbContext.ServerPositions
                    .Where(sp => sp.ServerId == c.SourcePort.ServerId && sp.Status == "在架")
                    .Select(sp => sp.Rack.Y)
                    .FirstOrDefault(),
                TargetRackId = dbContext.ServerPositions
                    .Where(sp => sp.ServerId == c.TargetPort.ServerId && sp.Status == "在架")
                    .Select(sp => sp.RackId)
                    .FirstOrDefault(),
                TargetRackCode = dbContext.ServerPositions
                    .Where(sp => sp.ServerId == c.TargetPort.ServerId && sp.Status == "在架")
                    .Select(sp => sp.Rack.Code)
                    .FirstOrDefault(),
                TargetX = dbContext.ServerPositions
                    .Where(sp => sp.ServerId == c.TargetPort.ServerId && sp.Status == "在架")
                    .Select(sp => sp.Rack.X)
                    .FirstOrDefault(),
                TargetY = dbContext.ServerPositions
                    .Where(sp => sp.ServerId == c.TargetPort.ServerId && sp.Status == "在架")
                    .Select(sp => sp.Rack.Y)
                    .FirstOrDefault(),
            })
            .ToListAsync(cancellationToken);

        // Filter to only cross-rack cables, dedupe and group by rack pair
        var links = cables
            .Where(c => c.SourceRackId != null && c.TargetRackId != null && c.SourceRackId != c.TargetRackId)
            .GroupBy(c => new
            {
                // Canonical rack pair: sort IDs so A→B and B→A are the same link
                Rack1 = string.Compare(c.SourceRackCode, c.TargetRackCode, StringComparison.Ordinal) < 0
                    ? c.SourceRackCode : c.TargetRackCode,
                Rack2 = string.Compare(c.SourceRackCode, c.TargetRackCode, StringComparison.Ordinal) < 0
                    ? c.TargetRackCode : c.SourceRackCode,
            })
            .Select(g => new
            {
                CableCount = g.Count(),
                CableTypes = g.Select(c => c.CableType).Distinct().ToList(),
                Source = new { RackId = g.First().SourceRackId, RackCode = g.First().SourceRackCode, X = g.First().SourceX, Y = g.First().SourceY },
                Target = new { RackId = g.First().TargetRackId, RackCode = g.First().TargetRackCode, X = g.First().TargetX, Y = g.First().TargetY },
            })
            .ToList();

        return Ok(new { links });
    }
}
```

- [ ] **Step 2: Build backend**

```bash
cd src/backend/Datacenter.Api && dotnet build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/backend/Datacenter.Api/Controllers/CablesController.cs
git commit -m "feat: add CablesController with CRUD and floorplan links endpoint"
```

---

### Task 4: Frontend — CableListView page

**Files:**
- Create: `src/frontend/src/views/CableListView.vue`
- Modify: `src/frontend/src/router.ts`

**Produces:** New route `/cables` with filterable cable table and create/delete functionality.

- [ ] **Step 1: Add route in router.ts**

```typescript
{ path: '/cables', component: () => import('./views/CableListView.vue'), meta: { requiresAuth: true } },
```

- [ ] **Step 2: Create CableListView.vue**

The component should include:

**Script:**
- Type definitions for CableItem, PortOption
- `loadCables()` — calls `GET /api/cables` with optional query params
- `loadPortOptions()` — calls `GET /api/servers` + `GET /api/servers/{id}/ports` to build port picker data
- Filter state: `filterRoomId`, `filterRackId`, `filterCableType`
- `createCable()` — calls `POST /api/cables`
- `deleteCable(id)` — confirmation + `DELETE /api/cables/{id}`
- `getCableColor(type)` — maps cable type to hex color

**Template:**
- Filter bar: room select, cable type select, search button
- "新增线缆" button → opens drawer with source port picker + target port picker + cable type/color/length fields
- Table: Source (server/port/rack) → Target (server/port/rack) → Type (colored tag) → Color → Length → Delete button
- Delete cable confirmation

**CSS:** Follow existing table and form styles.

- [ ] **Step 3: Add nav link in App.vue**

Add to app-nav:
```html
<a href="/cables" class="app-nav__link" @click.prevent="router.push('/cables')">线缆管理</a>
```

- [ ] **Step 4: Verify**

```bash
cd src/frontend && npx vue-tsc --noEmit && npx vitest run
```

Expected: no type errors, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/frontend/src/views/CableListView.vue \
        src/frontend/src/router.ts \
        src/frontend/src/App.vue
git commit -m "feat: add cable list page with filter and create/delete"
```

---

### Task 5: Frontend — ServerDetailView port panel

**Files:**
- Modify: `src/frontend/src/views/ServerDetailView.vue`

**Produces:** New "端口与连接" card section showing ports and their cable connections.

**Changes:**
1. Add new types: `PortItem`, `CreatePortRequest`
2. Add state: `ports`, `portsLoading`, `portFormVisible`, `newPortName`, `newPortType`, `newPortSpeed`
3. `loadPorts()` — calls `GET /api/servers/{id}/ports`
4. `createPort()` — calls `POST /api/servers/{id}/ports`
5. `deletePort(id)` — calls `DELETE /api/ports/{id}`
6. New card section template below "当前位置" card:

```html
<section class="card">
  <h3 class="card__title">端口与连接</h3>
  <p v-if="portsLoading">加载中...</p>
  <p v-else-if="ports.length === 0" class="muted">暂无端口</p>
  <table v-else class="data-table">
    <thead>
      <tr>
        <th>端口名</th><th>类型</th><th>速率</th><th>连接状态</th><th>操作</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="port in ports" :key="port.id">
        <td>{{ port.portName }}</td>
        <td>{{ port.portType }}</td>
        <td>{{ port.speed ?? '-' }}</td>
        <td>
          <span v-if="port.connectedToServerName" class="connected-link">
            → <a href="#" @click.prevent="goToServer(port.connectedServerId)">{{ port.connectedToServerName }}</a>
            ({{ port.connectedToPortName }})
          </span>
          <span v-else class="muted">未连接</span>
        </td>
        <td>
          <button v-if="canEdit && !port.connectedCableId" class="btn btn--small" @click="openConnect(port.id)">连接</button>
          <button v-if="canEdit && !port.connectedCableId" class="btn btn--small btn--danger" @click="deletePort(port.id)">删除</button>
        </td>
      </tr>
    </tbody>
  </table>
  <div v-if="canEdit && portFormVisible" class="port-form">
    <input v-model="newPortName" placeholder="端口名 (如 GE0/0/1)" />
    <select v-model="newPortType">
      <option value="">选择类型</option>
      <option>RJ45</option><option>SFP+</option><option>QSFP28</option><option>LC</option>
    </select>
    <input v-model="newPortSpeed" placeholder="速率 (如 10G)" />
    <button class="btn btn--primary btn--small" @click="createPort">添加</button>
    <button class="btn btn--small" @click="portFormVisible = false">取消</button>
  </div>
  <button v-if="canEdit && !portFormVisible" class="btn btn--small" @click="portFormVisible = true">+ 添加端口</button>
</section>
```

7. `goToServer(serverId)` — navigates to that server's detail page
8. `deletePort` handler calls API

Note: full implementation of `openConnect` (select target port and create cable) can use a drawer. For this task, implement the connect flow inline or with the existing `RackOperationDrawer` component.

- [ ] **Step 1: Make the changes**

- [ ] **Step 2: Verify**

```bash
cd src/frontend && npx vue-tsc --noEmit && npx vitest run
```

Expected: no type errors, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/frontend/src/views/ServerDetailView.vue
git commit -m "feat: add port panel to server detail with port management"
```

---

### Task 6: Frontend — FloorplanCanvas cable layer

**Files:**
- Modify: `src/frontend/src/components/FloorplanCanvas.vue`
- Modify: `src/frontend/src/views/FloorplanView.vue` (load cable data, pass as prop)

**Produces:** Cable lines drawn on floorplan between racks.

**Changes in FloorplanCanvas:**

1. Add `cableLinks` prop:
```typescript
interface CableLink {
  source: { rackId: string; rackCode: string; x: number; y: number }
  target: { rackId: string; rackCode: string; x: number; y: number }
  cableCount: number
  cableTypes: string[]
}
```

2. Add `cableLayer: Konva.Layer | null = null`

3. Add `drawCables()` function:
```typescript
const CABLE_COLORS: Record<string, string> = { '铜缆': '#e67e22', '光纤': '#f1c40f', 'DAC': '#3498db' }

function drawCables(): void {
  if (!cableLayer) return
  cableLayer.destroyChildren()
  for (const link of props.cableLinks) {
    const sx = props.toCanvasX(link.source.x) + RACK_W / 2
    const sy = props.toCanvasY(link.source.y) + RACK_H / 2
    const tx = props.toCanvasX(link.target.x) + RACK_W / 2
    const ty = props.toCanvasY(link.target.y) + RACK_H / 2
    // Use first cable type color for the line; if mixed types, use gray
    const color = link.cableTypes.length === 1
      ? (CABLE_COLORS[link.cableTypes[0]] ?? '#95a5a6')
      : '#95a5a6'
    const line = new Konva.Line({
      points: [sx, sy, tx, ty],
      stroke: color, strokeWidth: 2, opacity: 0.6,
      listening: true,
    })
    const tooltip = new Konva.Label({
      x: (sx + tx) / 2, y: (sy + ty) / 2 - 12,
      visible: false, listening: false, opacity: 0.92,
    })
    tooltip.add(new Konva.Tag({ fill: '#2c3e50', cornerRadius: 4 }))
    tooltip.add(new Konva.Text({
      text: `${link.source.rackCode} ↔ ${link.target.rackCode}\n${link.cableCount} 条线缆\n${link.cableTypes.join(', ')}`,
      fontSize: 11, fontFamily: 'sans-serif', fill: '#fff', padding: 6, lineHeight: 1.4,
    }))
    line.on('mouseenter', () => { tooltip.visible(true); cableLayer?.batchDraw() })
    line.on('mouseleave', () => { tooltip.visible(false); cableLayer?.batchDraw() })
    cableLayer.add(line, tooltip)
  }
  cableLayer.batchDraw()
}
```

4. Add `cableLayer` to `init()` after `snapLayer`:
```typescript
cableLayer = new Konva.Layer()
stage.add(cableLayer)
```

5. Watch `cableLinks` prop:
```typescript
watch(() => props.cableLinks, () => { drawCables() }, { deep: true })
```

**Changes in FloorplanView:**

1. Add `cableLinks` ref and `loadCables()` function:
```typescript
const cableLinks = ref<CableLink[]>([])

async function loadCables(): Promise<void> {
  const result = await request<{ links: CableLink[] }>(`/api/rooms/${roomId.value}/cables`, { method: 'GET' })
  if (result.ok && result.data) {
    cableLinks.value = result.data.links
  }
}
```

2. Pass `cableLinks` to FloorplanCanvas:
```html
<FloorplanCanvas
  :cable-links="cableLinks"
  ...
/>
```

3. Call `loadCables()` after `loadRacks()` in `onMounted`:
```typescript
onMounted(() => {
  loadRacks()
  loadCables()
  window.addEventListener('keydown', onKeyDown)
})
```

- [ ] **Step 1: Make the changes**

- [ ] **Step 2: Verify**

```bash
cd src/frontend && npx vue-tsc --noEmit && npx vitest run
```

Expected: no type errors, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/frontend/src/components/FloorplanCanvas.vue \
        src/frontend/src/views/FloorplanView.vue
git commit -m "feat: add cable visualization layer to floorplan"
```

---

### Task 7: Seed test data for cables

**Files:**
- Modify: `scripts/seed_test_data.py`

**Produces:** Ports and cables in the test database for verification.

- [ ] **Step 1: Add port and cable seed data**

Add to the script after the existing server positions section. Add ports for 10-12 servers, then connect them with cables to create realistic cross-rack and intra-rack links.

Example ports to seed:
- `app-web-01`: GE0/0/1 (RJ45, 1G), GE0/0/2 (RJ45, 1G)
- `net-core-sw-01`: GE0/0/1-GE0/0/5 (SFP+, 10G)
- etc.

Example cables:
- `app-web-01 GE0/0/1` → `net-core-sw-01 GE0/0/1` (铜缆, 蓝色, 3m)
- `app-api-01 GE0/0/1` → `net-core-sw-01 GE0/0/2` (铜缆, 蓝色, 3m)
- `db-mysql-01 GE0/0/1` → `net-core-sw-02 GE0/0/1` (光纤, 黄色, 5m)
- Cross-rack: `dr-web-01 GE0/0/1` → `net-agg-sw-01 GE0/0/1` (光纤, 黄色, 10m)

- [ ] **Step 2: Run the seed script**

```bash
cd /home/shy/projects/datacenter-layout && python3 scripts/seed_test_data.py
```

- [ ] **Step 3: Commit**

```bash
git add scripts/seed_test_data.py
git commit -m "chore: add port and cable seed data"
```

---

### Task 8: Manual verification

- [ ] **Step 1: Start services**
```bash
cd src/backend/Datacenter.Api && dotnet run
cd src/frontend && npm run dev
```

- [ ] **Step 2: Run seed data**
```bash
cd /home/shy/projects/datacenter-layout && python3 scripts/seed_test_data.py
```

- [ ] **Step 3: Verify cable list page**
1. Navigate to `/cables`
2. Verify cables appear in table with source/target server/port/rack
3. Filter by cable type works
4. Delete a cable works
5. Create a new cable between two free ports works

- [ ] **Step 4: Verify server detail port panel**
1. Navigate to a server that has ports (e.g., app-web-01)
2. "端口与连接" card shows ports with connection status
3. Connected ports show "→ link to target server (port)"
4. Click target server link → navigates to that server
5. Add a port works
6. Delete an unconnected port works

- [ ] **Step 5: Verify floorplan cable layer**
1. Navigate to 机房A floorplan
2. Verify cross-rack cable lines drawn between racks
3. Hover a line → tooltip shows rack pair, cable count, types
4. Verify line color matches cable type

- [ ] **Step 6: Final commit if fixes needed**
