# TASK-20260827-172017：设备详情显示已连接设备的位置

> 遵守 [Agent 工作流规范](../docs/architecture/AGENT-WORKFLOW.md)。

## 基本信息

- Status：READY_FOR_REVIEW
- Task Owner：Cursor Frontend
- Backend Owner：Codex Backend
- Frontend Owner：Cursor Frontend
- Reviewer：Codex Reviewer
- Branch：`feature/TASK-20260810-000003-topology-map`
- Requirement Source：用户 2026-08-27：在设备详情中显示每条已登记连接的对端设备、对端端口、机柜与 U 位；对端未上架时显示“未上架”。用户已于 2026-08-27 批准最小设计。
- Product Baseline：`docs/product/MVP-PRODUCT-BASELINE.md`（已登记设备、端口、线缆与位置数据）
- Architecture Reference：`docs/architecture/MVP-ARCHITECTURE-BASELINE.md`、`docs/architecture/AGENT-WORKFLOW.md`

## 用户结果

用户打开任一设备详情页时，在“端口与连接”中可直接看到每个已连接端口连接到的设备名、对端端口、机柜编码和 U 位范围。对端设备没有有效在架位置时，位置显示为“未上架”。

## 实施顺序与允许修改

### 阶段 A：后端（Codex Backend）

- `src/backend/Datacenter.Api/Controllers/PortsController.cs`
- `tests/backend/Datacenter.Api.Tests/IntegrationTests/ServerIntegrationTests.cs`

扩展既有 `GET /api/servers/{serverId}/ports` 的单个端口响应：

- 保留现有字段，包括 `connectedToServerName`、`connectedToServerId`、`connectedToPortName` 和 `connectedToRackCode`。
- 新增可空字符串 `connectedToURange`，其值为对端当前 `在架` 位置的 `StartU-EndU`；没有有效在架位置时为 `null`。
- 不新增端点、数据表、迁移或写操作。

### 阶段 B：前端（Cursor Frontend）

- `src/frontend/src/views/ServerDetailView.vue`
- `src/frontend/src/__tests__/router-and-views.test.ts`，或为本页新增最小前端测试文件

设备详情的现有“端口与连接”表在已连接行显示：

`对端设备（对端端口） · 机柜 <机柜编码> · U<起始>-U<结束>`

当 `connectedToRackCode` 或 `connectedToURange` 缺失时，显示 `未上架`。保留已有的对端设备详情跳转；不增加新的跳转、抽屉、筛选或编辑操作。

## 明确不做

- 不修改 `Cable`、`Port`、`ServerPosition` 数据模型和数据库迁移。
- 不修改线缆创建、删除、导入、拓扑画布、网络路径或机柜页面。
- 不引入依赖，不增加新页面、实时链路状态、流量或线路追踪能力。
- 不改变任何角色、认证、端口占用或审计规则。

## 需求追踪与验收标准

| ID | 要求 | 验收 |
|---|---|---|
| FR-01 | 已连接端口返回对端的机柜编码和 U 位范围。 | 对端在架时接口返回正确 `connectedToRackCode` 和 `connectedToURange`。 |
| FR-02 | 设备详情显示对端设备、端口、机柜和 U 位。 | 打开已连接设备详情时，用户无需进入拓扑页即可读到四项信息。 |
| FR-03 | 对端未上架时不显示伪造位置。 | 接口的 U 位为空，页面明确显示“未上架”。 |
| NFR-01 | 复用现有端口查询和详情页。 | 无新端点、无数据库变更、无新依赖。 |

## 验证命令

```powershell
dotnet test tests/backend/Datacenter.Api.Tests/
cd src/frontend; npm test; npm run typecheck; npm run build
pwsh -NoLogo -NoProfile -File ./scripts/validate-agent-workflow.ps1
git diff --check
```

## 状态迁移记录

| 时间 | 发起者 | 原状态 | 新状态 | 证据 |
|---|---|---|---|---|
| 2026-08-27 17:20 +08:00 | Codex + Terra | IDLE | DRAFT | 用户已描述目标；现有数据关联与显示入口已核对。 |
| 2026-08-27 17:20 +08:00 | Codex + Terra | DRAFT | READY | 用户批准最小设计；Owner/Reviewer 独立；无活跃模块锁冲突；范围、接口字段和验收完整。 |
| 2026-08-27 17:25 +08:00 | Codex + Terra | READY | IN_PROGRESS | 阶段 A/B Owner 已认领四条精确路径；无父子路径冲突。 |
| 2026-08-27 17:35 +08:00 | Codex + Terra（Owner-only handoff） | IN_PROGRESS | READY_FOR_REVIEW | 阶段 A `ServerIntegrationTests` 44/44；阶段 B 前端 221/221、typecheck、build、`git diff --check` 通过；四锁均为 `HANDED_OFF`。 |
| 2026-08-27 17:48 +08:00 | Codex + Terra | READY_FOR_REVIEW | BLOCKED | 独立 Reviewer 的实现审核为 PASS；本轮复验后端 44/44、前端 221/221、typecheck、build、`git diff --check` 均通过。工作流脚本无法执行：`pwsh: command not found`。四条锁保持 `HANDED_OFF`。 |
| 2026-08-27 17:49 +08:00 | Codex + Terra | BLOCKED | READY_FOR_REVIEW | 用户明确选择不安装 `pwsh`，并批准本任务将工作流脚本校验记为 N/A；业务验证与独立实现审核证据完整，四条锁继续 `HANDED_OFF`。 |

## 工作流校验豁免

- 用户裁决：2026-08-27，明确“不安装”。
- 适用范围：仅本任务的 `scripts/validate-agent-workflow.ps1` 校验。
- 处理：该命令记为批准的 N/A；不安装或变更任何系统依赖。
- 剩余完成门禁：用户执行提交与推送，并复核干净工作区和本地/远端哈希；四条模块锁继续保持 `HANDED_OFF`，直至最终完成或取消。

## 完成门禁

- 后端完成后，其锁必须 `HANDED_OFF`；前端只在确认接口字段后认领自身路径。
- 最终由独立 Codex Reviewer 审核；通过相关测试、工作流校验、`git diff --check`、提交与推送、锁释放和本地/远端哈希一致后才可转 `COMPLETED`。
