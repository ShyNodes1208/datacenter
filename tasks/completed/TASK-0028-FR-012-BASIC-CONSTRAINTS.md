# TASK-0028: FR-012 基本信息变更防误操作约束

## Requirements (from MVP-PRODUCT-BASELINE.md FR-012)

1. **机柜中有在架服务器时，不能删除该机柜**
2. **机房中有机柜时，不能删除该机房**
3. **编辑机柜 U 位总数时，校验不会导致现有在架服务器占用超限**

## Current state

- RacksController has `POST import` / `POST import-preview` / `GET` / `GET availability` — no DELETE or PUT endpoints
- RoomsController has `GET` / `POST` / `PUT` — no DELETE endpoint
- DB already has `ON DELETE RESTRICT` for FK relationships

## Tasks

### 1. Backend: RacksController
- Add `DELETE /api/racks/{id}` — reject if rack has active ServerPositions (Status="在架")
- Add `PUT /api/racks/{id}` — update rack properties; if HeightU is reduced, reject if it would truncate existing in-rack servers

### 2. Backend: RoomsController
- Add `DELETE /api/rooms/{id}` — reject if room has any racks

### 3. Frontend: RackDeviceView + HomeView
- Add delete button for racks (if user has edit role)
- Add delete button for rooms (if user has edit role)
- Show clear error message when delete is rejected

### 4. Tests
- Integration tests for DELETE/PUT rack constraints
- Integration tests for DELETE room constraints

## Constraints

- No over-engineering
- No over-development
- Auth: RoomAdministrator + Operations for write operations
- CSRF required for POST/PUT/DELETE
