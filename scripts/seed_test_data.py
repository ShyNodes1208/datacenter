#!/usr/bin/env python3
"""Seed the datacenter-dev SQLite database with realistic test data."""

import sqlite3
import uuid
from datetime import datetime, timezone

DB_PATH = "src/backend/Datacenter.Api/.data/datacenter-dev.db"

conn = sqlite3.connect(DB_PATH)
conn.execute("PRAGMA foreign_keys = ON")


def uid() -> str:
    return str(uuid.uuid4()).upper()


def now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


# ── Rooms ──────────────────────────────────────────────────────────────
rooms = {}

# Check existing
for row in conn.execute("SELECT Id, Name FROM Rooms"):
    rooms[row[1]] = row[0]

to_add = [
    ("网络机房", "启用"),
    ("灾备机房", "启用"),
]
for name, status in to_add:
    if name not in rooms:
        rid = uid()
        conn.execute(
            "INSERT INTO Rooms (Id, Name, Status) VALUES (?, ?, ?)",
            (rid, name, status),
        )
        rooms[name] = rid
        print(f"Room: {name}")

# Refresh
for row in conn.execute("SELECT Id, Name FROM Rooms"):
    rooms[row[1]] = row[0]

# ── Racks ──────────────────────────────────────────────────────────────
existing_codes = {
    row[0]
    for row in conn.execute("SELECT Code FROM Racks")
}

rack_defs = [
    # 机房A — row A (华为, 42U, y=0)
    ("A04", "机房A", 42, "华为", 10, 1800, 0, 0, None),
    ("A05", "机房A", 42, "华为", 10, 2400, 0, 0, None),
    ("A06", "机房A", 42, "华为", 10, 3000, 0, 0, None),
    # 机房A — row B (HP, 42/47U, y=1200)
    ("B04", "机房A", 42, "HP", 8, 1800, 1200, 0, None),
    ("B05", "机房A", 47, "HP", 8, 2400, 1200, 0, None),
    # 机房A — row C (杂牌, 42U, y=2400)
    ("C02", "机房A", 42, "浪潮", 8, 600, 2400, 0, None),
    ("C03", "机房A", 42, "浪潮", 8, 1200, 2400, 0, None),
    # 网络机房
    ("N01", "网络机房", 42, "华为", 8, 0, 0, 0, None),
    ("N02", "网络机房", 42, "华为", 8, 600, 0, 0, None),
    ("N03", "网络机房", 42, "华为", 8, 1200, 0, 0, None),
    ("N04", "网络机房", 42, "华为", 8, 1800, 0, 0, None),
    # 灾备机房
    ("D01", "灾备机房", 42, "DELL", 10, 0, 0, 0, None),
    ("D02", "灾备机房", 42, "DELL", 10, 600, 0, 0, None),
    ("D03", "灾备机房", 47, "DELL", 10, 1200, 0, 0, None),
    ("D04", "灾备机房", 47, "DELL", 10, 1800, 0, 0, None),
]

rack_ids = {}
for code, room_name, height, brand, power, x, y, z, notes in rack_defs:
    if code in existing_codes:
        continue
    rid = uid()
    conn.execute(
        """INSERT INTO Racks (Id, RoomId, Code, HeightU, Brand, Power, X, Y, Z, Notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (rid, rooms[room_name], code, height, brand, power, x, y, z, notes),
    )
    rack_ids[code] = rid
    print(f"Rack: {code} ({room_name}, {height}U, {brand or '-'})")

# Load all rack IDs
for row in conn.execute("SELECT Id, Code FROM Racks"):
    if row[1] not in rack_ids:
        rack_ids[row[1]] = row[0]

# ── Servers ────────────────────────────────────────────────────────────
existing_servers = {
    row[0] for row in conn.execute("SELECT Name FROM Servers")
}

server_defs = [
    # (name, ip, asset, type, height, op_status, pos_status, system, owner, notes)
    # -- 应用服务器 (racked in A01-A03) --
    ("app-web-01", "10.1.1.11", "ASSET-001", "服务器", 2, "正常", "在架", "CentOS 7.9", "张三", "Nginx 反向代理"),
    ("app-web-02", "10.1.1.12", "ASSET-002", "服务器", 2, "正常", "在架", "CentOS 7.9", "张三", "Nginx 反向代理"),
    ("app-api-01", "10.1.2.11", "ASSET-003", "服务器", 2, "正常", "在架", "Ubuntu 22.04", "李四", "业务 API 服务"),
    ("app-api-02", "10.1.2.12", "ASSET-004", "服务器", 2, "正常", "在架", "Ubuntu 22.04", "李四", "业务 API 服务"),
    ("app-api-03", "10.1.2.13", "ASSET-005", "服务器", 2, "正常", "在架", "Ubuntu 22.04", "李四", "业务 API 服务"),
    ("db-mysql-01", "10.1.3.11", "ASSET-006", "服务器", 4, "正常", "在架", "CentOS 7.9", "王五", "MySQL 主库"),
    ("db-mysql-02", "10.1.3.12", "ASSET-007", "服务器", 4, "正常", "在架", "CentOS 7.9", "王五", "MySQL 从库"),
    ("db-redis-01", "10.1.4.11", "ASSET-008", "服务器", 1, "正常", "在架", "CentOS 7.9", "赵六", "Redis 缓存"),
    ("db-redis-02", "10.1.4.12", "ASSET-009", "服务器", 1, "正常", "在架", "CentOS 7.9", "赵六", "Redis 缓存"),
    # -- 网络设备 (racked in N01-N02) --
    ("net-core-sw-01", "10.1.0.1", "ASSET-010", "交换机", 1, "正常", "在架", None, "网络组", "核心交换机 H3C"),
    ("net-core-sw-02", "10.1.0.2", "ASSET-011", "交换机", 1, "正常", "在架", None, "网络组", "核心交换机 H3C 备"),
    ("net-agg-sw-01", "10.1.0.11", "ASSET-012", "交换机", 1, "正常", "在架", None, "网络组", "汇聚交换机"),
    ("net-agg-sw-02", "10.1.0.12", "ASSET-013", "交换机", 1, "正常", "在架", None, "网络组", "汇聚交换机"),
    ("net-router-01", "10.1.0.254", "ASSET-014", "路由器", 2, "正常", "在架", "Huawei VRP", "网络组", "出口路由器"),
    ("net-fw-01", "10.1.0.253", "ASSET-015", "防火墙", 2, "正常", "在架", "Hillstone OS", "安全组", "边界防火墙"),
    # -- 存储 (racked in D01) --
    ("storage-nas-01", "10.2.1.11", "ASSET-016", "存储设备", 4, "正常", "在架", "Synology DSM", "存储组", "NAS 主存储"),
    ("storage-san-01", "10.2.1.21", "ASSET-017", "存储设备", 4, "正常", "在架", None, "存储组", "SAN 磁盘阵列"),
    # -- 灾备服务器 (racked in D02-D03) --
    ("dr-web-01", "10.2.2.11", "ASSET-018", "服务器", 2, "正常", "在架", "CentOS 7.9", "张三", "灾备 Web"),
    ("dr-api-01", "10.2.2.21", "ASSET-019", "服务器", 2, "正常", "在架", "Ubuntu 22.04", "李四", "灾备 API"),
    ("dr-db-01", "10.2.2.31", "ASSET-020", "服务器", 4, "正常", "在架", "CentOS 7.9", "王五", "灾备 MySQL"),
    # -- 未上架服务器 --
    ("app-web-03", "10.1.1.13", "ASSET-021", "服务器", 2, "正常", "未上架", "CentOS 7.9", "张三", "待上架 Web 服务器"),
    ("app-api-04", "10.1.2.14", "ASSET-022", "服务器", 2, "正常", "未上架", "Ubuntu 22.04", "李四", "待上架 API 服务器"),
    ("vm-host-01", "10.1.5.11", "ASSET-023", "服务器", 4, "维护", "未上架", "VMware ESXi 8", "虚拟化组", "虚拟化宿主机"),
    ("vm-host-02", "10.1.5.12", "ASSET-024", "服务器", 4, "维护", "未上架", "VMware ESXi 8", "虚拟化组", "虚拟化宿主机"),
    ("monitor-01", "10.1.6.11", "ASSET-025", "服务器", 1, "正常", "未上架", "CentOS 7.9", "运维组", "Zabbix 监控"),
    ("log-01", "10.1.6.21", "ASSET-026", "服务器", 2, "正常", "未上架", "CentOS 7.9", "运维组", "ELK 日志"),
    ("backup-01", "10.2.1.31", "ASSET-027", "存储设备", 4, "正常", "未上架", None, "存储组", "备份存储"),
    ("dev-server-01", "10.3.1.11", "ASSET-028", "服务器", 2, "异常", "已下架", "Ubuntu 22.04", "开发组", "开发测试机（故障）"),
    ("test-db-01", "10.3.1.21", "ASSET-029", "服务器", 2, "正常", "已下架", "CentOS 7.9", "测试组", "测试数据库"),
    ("old-web-01", "10.1.1.1", "ASSET-030", "服务器", 2, "正常", "已下架", "CentOS 6.10", "张三", "已退役旧服务器"),
]

server_ids = {}
for name, ip, asset, dtype, height, op_status, pos_status, system, owner, notes in server_defs:
    if name in existing_servers:
        continue
    sid = uid()
    conn.execute(
        """INSERT INTO Servers (Id, Name, ManagementIP, AssetNumber, DeviceType, DeviceHeight,
           OperationalStatus, PositionStatus, System, Owner, Notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (sid, name, ip, asset, dtype, height, op_status, pos_status, system, owner, notes),
    )
    server_ids[name] = sid
    print(f"Server: {name} ({dtype} {height}U, {pos_status})")

# Load all server IDs
for row in conn.execute("SELECT Id, Name FROM Servers"):
    if row[1] not in server_ids:
        server_ids[row[1]] = row[0]

# ── Server Positions (上架记录) ────────────────────────────────────────
existing_positions = {
    row[0] for row in conn.execute("SELECT ServerId FROM ServerPositions WHERE Status = '在架'")
}

# (server_name, rack_code, startU)
position_defs = [
    # A01 — 网络层 U41-U42
    ("net-core-sw-01", "A01", 42),
    ("net-core-sw-02", "A01", 41),
    # A01 — 应用层 U35-U40
    ("app-web-01", "A01", 39),
    ("app-web-02", "A01", 37),
    ("app-api-01", "A01", 35),
    # A02 — 应用层
    ("app-api-02", "A02", 40),
    ("app-api-03", "A02", 38),
    ("db-redis-01", "A02", 37),
    ("db-redis-02", "A02", 36),
    # A02 — 数据库
    ("db-mysql-01", "A02", 32),
    ("db-mysql-02", "A02", 28),
    # N01 — 网络核心
    ("net-agg-sw-01", "N01", 42),
    ("net-agg-sw-02", "N01", 41),
    # N02 — 网络边界
    ("net-router-01", "N02", 42),
    ("net-fw-01", "N02", 40),
    # D01 — 存储
    ("storage-nas-01", "D01", 42),
    ("storage-san-01", "D01", 38),
    # D02 — 灾备
    ("dr-web-01", "D02", 40),
    ("dr-api-01", "D02", 38),
    ("dr-db-01", "D03", 40),
    # 机房A — 用于平面图跨机柜线缆演示
    ("app-web-01", "A04", 40),
    ("app-api-01", "A05", 40),
    ("app-web-02", "B04", 40),
    ("db-mysql-01", "B05", 42),
]

for server_name, rack_code, start_u in position_defs:
    sid = server_ids.get(server_name)
    rid = rack_ids.get(rack_code)
    if not sid or not rid:
        print(f"SKIP position: {server_name} -> {rack_code} (missing server or rack)")
        continue
    if sid in existing_positions:
        continue

    height = 1
    for row in conn.execute("SELECT DeviceHeight FROM Servers WHERE Id = ?", (sid,)):
        height = row[0]
    end_u = start_u - height + 1

    conn.execute(
        """INSERT INTO ServerPositions (Id, ServerId, RackId, StartU, EndU, Status, InstalledAt)
           VALUES (?, ?, ?, ?, ?, '在架', ?)""",
        (uid(), sid, rid, start_u, end_u, now()),
    )
    # Update server position status
    conn.execute("UPDATE Servers SET PositionStatus = '在架' WHERE Id = ?", (sid,))
    print(f"Position: {server_name} -> {rack_code} U{start_u}-U{end_u} ({height}U)")


# ── Ports ──────────────────────────────────────────────────────────────
existing_ports = {
    (row[0], row[1])
    for row in conn.execute(
        "SELECT p.ServerId, p.PortName FROM Ports p"
    )
}

port_defs = [
    # (server_name, port_name, port_type, speed)
    ("app-web-01", "GE0/0/1", "RJ45", "1G"),
    ("app-web-01", "GE0/0/2", "RJ45", "1G"),
    ("app-web-02", "GE0/0/1", "RJ45", "1G"),
    ("app-api-01", "GE0/0/1", "RJ45", "1G"),
    ("app-api-01", "GE0/0/2", "RJ45", "1G"),
    ("app-api-02", "GE0/0/1", "RJ45", "1G"),
    ("db-mysql-01", "GE0/0/1", "SFP+", "10G"),
    ("db-mysql-01", "GE0/0/2", "SFP+", "10G"),
    ("net-core-sw-01", "GE0/0/1", "SFP+", "10G"),
    ("net-core-sw-01", "GE0/0/2", "SFP+", "10G"),
    ("net-core-sw-01", "GE0/0/3", "SFP+", "10G"),
    ("net-agg-sw-01", "GE0/0/1", "SFP+", "10G"),
    ("net-agg-sw-02", "GE0/0/1", "SFP+", "10G"),
    ("dr-web-01", "GE0/0/1", "RJ45", "1G"),
]

port_ids: dict[tuple[str, str], str] = {}
for server_name, port_name, port_type, speed in port_defs:
    sid = server_ids.get(server_name)
    if not sid:
        print(f"SKIP port: {server_name}/{port_name} (missing server)")
        continue
    key = (sid, port_name)
    if key in existing_ports:
        for row in conn.execute(
            "SELECT Id FROM Ports WHERE ServerId = ? AND PortName = ?",
            (sid, port_name),
        ):
            port_ids[(server_name, port_name)] = row[0]
        continue
    pid = uid()
    conn.execute(
        """INSERT INTO Ports (Id, ServerId, PortName, PortType, Speed, Notes)
           VALUES (?, ?, ?, ?, ?, NULL)""",
        (pid, sid, port_name, port_type, speed),
    )
    port_ids[(server_name, port_name)] = pid
    print(f"Port: {server_name}/{port_name} ({port_type} {speed})")

# Load all port IDs
for row in conn.execute(
    """SELECT s.Name, p.PortName, p.Id FROM Ports p
       JOIN Servers s ON s.Id = p.ServerId"""
):
    port_ids[(row[0], row[1])] = row[2]


# ── Cables ─────────────────────────────────────────────────────────────
existing_cables = {
    (row[0], row[1])
    for row in conn.execute(
        "SELECT SourcePortId, TargetPortId FROM Cables"
    )
}

cable_defs = [
    # (source_server, source_port, target_server, target_port, cable_type, color, length)
    ("app-web-01", "GE0/0/1", "net-core-sw-01", "GE0/0/1", "铜缆", "蓝色", "3m"),
    ("app-api-01", "GE0/0/1", "net-core-sw-01", "GE0/0/2", "铜缆", "蓝色", "3m"),
    ("app-api-02", "GE0/0/1", "net-core-sw-01", "GE0/0/3", "铜缆", "蓝色", "3m"),
    ("db-mysql-01", "GE0/0/1", "net-agg-sw-01", "GE0/0/1", "光纤", "黄色", "5m"),
    ("dr-web-01", "GE0/0/1", "net-agg-sw-02", "GE0/0/1", "光纤", "黄色", "10m"),
    # 机房A 跨机柜
    ("app-web-01", "GE0/0/2", "app-api-01", "GE0/0/2", "DAC", "灰色", "2m"),
    ("app-web-02", "GE0/0/1", "db-mysql-01", "GE0/0/2", "光纤", "黄色", "5m"),
]

for src_srv, src_port, tgt_srv, tgt_port, cable_type, color, length in cable_defs:
    src_id = port_ids.get((src_srv, src_port))
    tgt_id = port_ids.get((tgt_srv, tgt_port))
    if not src_id or not tgt_id:
        print(f"SKIP cable: {src_srv}/{src_port} -> {tgt_srv}/{tgt_port} (missing port)")
        continue
    if (src_id, tgt_id) in existing_cables or (tgt_id, src_id) in existing_cables:
        continue
    conn.execute(
        """INSERT INTO Cables (Id, SourcePortId, TargetPortId, CableType, Color, Length, Notes)
           VALUES (?, ?, ?, ?, ?, ?, NULL)""",
        (uid(), src_id, tgt_id, cable_type, color, length),
    )
    print(f"Cable: {src_srv}/{src_port} -> {tgt_srv}/{tgt_port} ({cable_type})")


conn.commit()
conn.close()

print("\n✅ Seed complete.")
print("Rooms: 机房A, 网络机房, 灾备机房")
print("Racks: 21 total across 3 rooms")
print("Servers: 30 total (应用/网络/存储/未上架/已下架)")
print("ServerPositions: 20+ servers racked")
print("Ports & Cables: seeded for cable management demo")
