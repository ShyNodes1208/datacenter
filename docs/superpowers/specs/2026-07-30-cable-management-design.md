# Cable Management Design Spec

> Cable routing management for the datacenter layout system. Models ports and cables with port-to-port connections, supports intra-rack, cross-rack, and cross-room cabling.

## Data Model

### Port

An endpoint on a server. Each server can have multiple ports.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Id | GUID | yes | PK |
| ServerId | GUID | yes | FK → Servers |
| PortName | string | yes | "GE0/0/1", "eth0", "Port 1" |
| PortType | string | yes | "RJ45", "SFP+", "QSFP28", "LC" |
| Speed | string | no | "1G", "10G", "25G", "100G" |
| Notes | string | no | |

- **Unique constraint:** `(ServerId, PortName)` — no duplicate port names on the same server.

### Cable

A physical cable connecting two ports (one-to-one). Both ends connect to ports on potentially different servers in potentially different racks.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Id | GUID | yes | PK |
| SourcePortId | GUID | yes | FK → Ports |
| TargetPortId | GUID | yes | FK → Ports |
| CableType | string | yes | "铜缆", "光纤", "DAC" |
| Color | string | no | "蓝色", "黄色", "橙色" |
| Length | string | no | "3m", "5m" |
| Notes | string | no | |

- **Unique constraints:** `SourcePortId` and `TargetPortId` are each unique — a port can only be connected to one cable.

### Relationship Chain

```
Server → Port → Cable ← Port ← Server
```

Supports three scenarios:
1. **Intra-rack:** both servers in same rack → cable connects within rack
2. **Cross-rack:** servers in different racks, same or different rooms → cable between racks
3. **Patch panel:** future — Port can be attached to a PatchPanel entity instead of a Server

## API Endpoints

### Ports

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/servers/{id}/ports` | Yes | List ports for a server |
| POST | `/api/servers/{id}/ports` | Yes (CanModify) | Add a port to a server |
| PUT | `/api/ports/{id}` | Yes (CanModify) | Update port details |
| DELETE | `/api/ports/{id}` | Yes (CanModify) | Delete a port (fails if cable connected) |
| POST | `/api/servers/{id}/ports/batch` | Yes (CanModify) | Batch import ports (Excel) |

**POST /api/servers/{id}/ports** request body:
```json
{
  "portName": "GE0/0/1",
  "portType": "SFP+",
  "speed": "10G",
  "notes": "上联核心交换机"
}
```

### Cables

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/cables` | Yes | List all cables. Query params: `?sourceRackId=`, `?targetRackId=`, `?roomId=`, `?cableType=` |
| POST | `/api/cables` | Yes (CanModify) | Create a cable connection |
| DELETE | `/api/cables/{id}` | Yes (CanModify) | Delete a cable |
| GET | `/api/rooms/{id}/cables` | Yes | Get cables for floorplan rendering (aggregated by rack pair with coordinates) |

**GET /api/cables** response item:
```json
{
  "id": "guid",
  "sourcePortId": "guid",
  "sourcePortName": "GE0/0/1",
  "sourceServerName": "app-web-01",
  "sourceServerId": "guid",
  "sourceRackCode": "A01",
  "sourceRackId": "guid",
  "sourceRoomName": "机房A",
  "targetPortId": "guid",
  "targetPortName": "GE0/0/24",
  "targetServerName": "net-core-sw-01",
  "targetServerId": "guid",
  "targetRackCode": "A01",
  "targetRackId": "guid",
  "targetRoomName": "机房A",
  "cableType": "光纤",
  "color": "黄色",
  "length": "3m",
  "notes": null
}
```

**POST /api/cables** request body:
```json
{
  "sourcePortId": "guid",
  "targetPortId": "guid",
  "cableType": "光纤",
  "color": "黄色",
  "length": "3m"
}
```

**GET /api/rooms/{id}/cables** response (for floorplan):
```json
{
  "links": [
    {
      "cableId": "guid",
      "cableType": "光纤",
      "color": "黄色",
      "source": { "rackId": "guid", "rackCode": "A01", "x": 0, "y": 0 },
      "target": { "rackId": "guid", "rackCode": "B03", "x": 1200, "y": 1200 }
    }
  ]
}
```
Only returns links where source and target are in *different* racks (cross-rack). Intra-rack cables are visible in the cable list but not drawn on the floorplan.

## Frontend

### 1. Cable List Page (`/cables`)

New route and view.

- **Table columns:** Source server/port → Target server/port → Cable type → Color → Length
- **Filters:** room, rack, cable type dropdowns
- **New cable form:** select source port + target port from pickers, set cable properties
- **Delete:** confirmation dialog
- Component: `CableListView.vue`

### 2. Device Detail — Ports Panel

Extension to `ServerDetailView.vue`.

- New card section below "当前位置": **端口与连接**
- Lists all ports with port name, type, speed
- Each port shows:
  - **Connected:** "→ serverName (portName) [cableType]" with link to that server
  - **Available:** "未连接" gray text
- Button: "添加端口" opens inline form (portName, portType, speed)
- Button: "连接" on unconnected ports → opens drawer to select target port and create cable
- Component changes: new Port/Cable reactive state + template additions in `ServerDetailView.vue`

### 3. Floorplan Cable Layer

Extension to `FloorplanCanvas.vue`.

- New `cableLayer` (Konva.Layer)
- Loads `GET /api/rooms/{id}/cables` when room changes
- Draws straight lines between rack centers
- Line color by cableType: `"铜缆"` → `#e67e22`, `"光纤"` → `#f1c40f`, `"DAC"` → `#3498db`
- Line opacity: 0.6, strokeWidth: 2
- Hover: tooltip showing cable count between those racks + cable types
- Toggle: cable visibility controlled by a checkbox in FloorplanToolbar or via a layer toggle

### 4. Navigation

- App nav bar: add "线缆管理" link → `/cables`
- Server detail: port connections link to target server detail
- Cable detail row: links to source/target server details

## Backend Implementation

### New Files
- `Models/Port.cs` — entity
- `Models/Cable.cs` — entity
- `Controllers/PortsController.cs` — CRUD + batch import
- `Controllers/CablesController.cs` — CRUD + room-cables query
- EF Migration (auto-generated)

### Modified Files
- `Data/AppDbContext.cs` — add DbSet<Port>, DbSet<Cable>, configure constraints
- `Controllers/ServersController.cs` — no change (ports handled by separate controller)

## Cable Type Colors (Frontend)

```typescript
// In deviceColors.ts or a new cableColors.ts
const CABLE_TYPE_COLORS: Record<string, string> = {
  '铜缆': '#e67e22',
  '光纤': '#f1c40f',
  'DAC': '#3498db',
}
const DEFAULT_CABLE_COLOR = '#95a5a6'
```

## Error Handling

- Deleting a port that has a cable attached → 400 error: "端口已连接线缆，请先删除线缆"
- Creating a cable to a port that already has a cable → 400 error: "目标端口已被占用"
- Creating a cable between two ports on the same server → allowed (loopback for testing)
- Duplicate port name on same server → 400 error: "端口名称已存在"

## Testing

- Backend: API tests for ports CRUD and cables CRUD
- Frontend: unit tests for CableListView, integration tests for port panel in ServerDetail
- EF constraint tests: unique port name per server, unique sourcePortId, unique targetPortId
