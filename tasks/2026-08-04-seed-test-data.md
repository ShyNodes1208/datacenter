# 造测试数据脚本

## 目标

为 22 个机柜填充测试数据：每机柜 1 台交换机 + 服务器填充到 ~60% 占用率。

## 文件

新建 `scripts/seed-test-data.py`

## 数据库

- 路径: `src/backend/Datacenter.Api/.data/datacenter-dev.db`
- 使用标准库: `sqlite3` + `uuid`（无需额外依赖）

## 表结构

```
Servers: Id(TEXT/GUID PK), Name(TEXT UNIQUE), ManagementIP(TEXT UNIQUE),
         DeviceType(TEXT), DeviceHeight(INTEGER>=1),
         OperationalStatus(TEXT DEFAULT '正常'), PositionStatus(TEXT DEFAULT '未上架'),
         System/Owner/Notes/AssetNumber (TEXT nullable)

ServerPositions: Id(TEXT/GUID PK), ServerId(FK), RackId(FK), StartU(INTEGER>=1),
                 EndU(INTEGER), Status(TEXT DEFAULT '在架'), InstalledAt(TEXT/datetime)

Ports: Id(TEXT/GUID PK), ServerId(FK), PortName(TEXT), PortType(TEXT),
       Speed(TEXT nullable), Notes(TEXT nullable)
       UNIQUE(ServerId, PortName)

Racks: Id(TEXT/GUID PK), Code(TEXT), RoomId(FK), HeightU(INTEGER)
```

## Step 1: 为缺少交换机的机柜添加交换机

对每个 Rack：
1. 查询该 Rack 是否已有在架交换机（ServerPositions JOIN Servers WHERE RackId=rackId AND Status='在架' AND (DeviceType LIKE '%交换%' OR DeviceType LIKE '%switch%')）
2. 如果没有：
   - 创建 Server: name=`{rackCode}-sw-01`, managementIP=`10.0.{index}.1`, deviceType=`交换机`, deviceHeight=`1`, positionStatus=`在架`
   - 创建 ServerPosition: rackId, startU=该机柜最高可用 U 位, endU=startU (1U设备), status=`在架`, installedAt=当前UTC时间
   - 创建 24 个 Ports: GE0/0/1~GE0/0/24, portType=`SFP+`, speed=`10G`

## Step 2: 填充服务器到 ~60% 占用率

对每个 Rack：
1. 查询当前已占用 U 位集合（ServerPositions WHERE RackId=rackId AND Status='在架'）
2. 计算空闲 U 位列表（1..HeightU 中未被占用的）
3. 目标填充到 ~60%。计算还需填充的 U 数
4. 从空闲 U 位的高位向低位逐个填充：
   - 设备高度 mix: 2U (50%), 1U (30%), 4U (20%)
   - 随机选择高度，检查该 U 范围完全空闲 → 创建 Server + ServerPosition
   - 命名: `{rackCode}-srv-{nn}` (nn 从 01 递增)
   - IP: `10.{roomIndex}.{rackIndex}.{100+nn}` (确保唯一)
   - deviceType: `服务器`
   - 跳过无法容纳的碎片空闲 U 位

## Step 3: 输出统计

```
机柜 A01: 26/42U (62%), 交换机✅, 服务器:12
机柜 A02: 25/42U (60%), 交换机✅, 服务器:10
...
总计: N 台服务器, M 台交换机, X U 占用 / Y U 总计 (Z%)
```

## 验证

```bash
cd /home/shy/projects/datacenter-layout
python3 scripts/seed-test-data.py

# API 验证
curl -s -b /tmp/cookies.txt http://localhost:5173/api/dashboard/stats | python3 -m json.tool
# occupiedU 应 > 472 (50% of 944)
```
