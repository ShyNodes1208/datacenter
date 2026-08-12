#!/usr/bin/env python3
"""Idempotent acceptance seed for 2.5D topology demo (TASK-20260812-120000)."""

from __future__ import annotations

import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "src/backend/Datacenter.Api/.data/datacenter-dev.db"

SHANGHAI_ROOM_ID = "64D083F6-CFFB-408E-AE45-5EA0E1914A51"
SHANGHAI_LEGACY_NAME = "页面验证机房"
SHANGHAI_NAME = "上海机房"
SHANGHAI_LOCATION = "上海张江DC1"
LEGACY_RACK_PREFIX = "R-页面验证机房-"

ACCEPTANCE_ROOMS = [
    ("北京机房", "北京"),
    (SHANGHAI_NAME, SHANGHAI_LOCATION),
    ("广州机房", "广州"),
    ("成都机房", "成都"),
    ("深圳机房", "深圳"),
    ("杭州机房", "杭州"),
]

INTER_ROOM_CABLES = [
    ("北京机房", SHANGHAI_NAME, "光纤", "业务网络", "正常", 12),
    (SHANGHAI_NAME, "广州机房", "光纤", "业务网络", "正常", 8),
    ("北京机房", "成都机房", "DAC", "存储网络", "正常", 5),
    ("广州机房", "深圳机房", "铜缆", "管理网络", "正常", 15),
    ("成都机房", "杭州机房", "光纤", "业务网络", "正常", 6),
    ("深圳机房", "杭州机房", "DAC", "存储网络", "告警", 3),
]


def uid() -> str:
    return str(uuid.uuid4()).upper()


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def log(action: str, detail: str) -> None:
    print(f"[{action}] {detail}")


def room_by_name(conn: sqlite3.Connection, name: str) -> str | None:
    row = conn.execute("SELECT Id FROM Rooms WHERE Name = ?", (name,)).fetchone()
    return row[0] if row else None


def ensure_room(conn: sqlite3.Connection, name: str, location: str) -> tuple[str, bool]:
    existing = room_by_name(conn, name)
    if existing:
        conn.execute(
            "UPDATE Rooms SET Location = COALESCE(Location, ?) WHERE Id = ?",
            (location, existing),
        )
        return existing, False
    rid = uid()
    conn.execute(
        "INSERT INTO Rooms (Id, Name, Status, Location, TopologyX, TopologyY) VALUES (?, ?, '启用', ?, 0, 0)",
        (rid, name, location),
    )
    return rid, True


def ensure_server(
    conn: sqlite3.Connection,
    name: str,
    device_type: str,
    height: int,
    ip: str,
) -> tuple[str, bool]:
    row = conn.execute("SELECT Id FROM Servers WHERE Name = ?", (name,)).fetchone()
    if row:
        return row[0], False
    sid = uid()
    conn.execute(
        """
        INSERT INTO Servers (
            Id, Name, ManagementIP, AssetNumber, DeviceType, DeviceHeight,
            OperationalStatus, PositionStatus, System, Owner, Notes
        ) VALUES (?, ?, ?, NULL, ?, ?, '正常', '在架', NULL, NULL, NULL)
        """,
        (sid, name, ip, device_type, height),
    )
    return sid, True


def ensure_rack(conn: sqlite3.Connection, room_id: str, code: str) -> tuple[str, bool]:
    row = conn.execute(
        "SELECT Id FROM Racks WHERE RoomId = ? AND Code = ?",
        (room_id, code),
    ).fetchone()
    if row:
        return row[0], False
    rid = uid()
    conn.execute(
        """
        INSERT INTO Racks (Id, RoomId, Code, HeightU, Brand, Power, X, Y, Z, Status, Notes)
        VALUES (?, ?, ?, 42, '通用', 8, 0, 0, 0, '启用', NULL)
        """,
        (rid, room_id, code),
    )
    return rid, True


def ensure_position(
    conn: sqlite3.Connection,
    server_id: str,
    rack_id: str,
    start_u: int,
    height: int,
) -> bool:
    row = conn.execute(
        "SELECT 1 FROM ServerPositions WHERE ServerId = ? AND RackId = ? AND Status = '在架'",
        (server_id, rack_id),
    ).fetchone()
    if row:
        return False
    end_u = start_u + height - 1
    conn.execute(
        """
        INSERT INTO ServerPositions (Id, ServerId, RackId, StartU, EndU, Status, InstalledAt)
        VALUES (?, ?, ?, ?, ?, '在架', ?)
        """,
        (uid(), server_id, rack_id, start_u, end_u, now_iso()),
    )
    return True


def ensure_port(conn: sqlite3.Connection, server_id: str, port_name: str) -> tuple[str, bool]:
    row = conn.execute(
        "SELECT Id FROM Ports WHERE ServerId = ? AND PortName = ?",
        (server_id, port_name),
    ).fetchone()
    if row:
        return row[0], False
    pid = uid()
    conn.execute(
        """
        INSERT INTO Ports (Id, ServerId, PortName, PortType, Speed, Notes)
        VALUES (?, ?, ?, 'SFP+', '10G', NULL)
        """,
        (pid, server_id, port_name),
    )
    return pid, True


def port_connected(conn: sqlite3.Connection, port_id: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM Cables WHERE SourcePortId = ? OR TargetPortId = ?",
        (port_id, port_id),
    ).fetchone()
    return row is not None


def ensure_cable(
    conn: sqlite3.Connection,
    source_port: str,
    target_port: str,
    cable_type: str,
    purpose: str,
    status: str,
) -> bool:
    row = conn.execute(
        """
        SELECT 1 FROM Cables
        WHERE SourcePortId = ? AND TargetPortId = ?
           OR SourcePortId = ? AND TargetPortId = ?
        """,
        (source_port, target_port, target_port, source_port),
    ).fetchone()
    if row:
        return False
    conn.execute(
        """
        INSERT INTO Cables (Id, SourcePortId, TargetPortId, CableType, Color, Length, Notes, Purpose, Status)
        VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, ?)
        """,
        (uid(), source_port, target_port, cable_type, purpose, status),
    )
    return True


_stub_u_tracker: dict[str, int] = {}


def _next_stub_u(conn: sqlite3.Connection, rack_id: str) -> int:
    """Return the next available U slot in a STUB rack, starting at 1."""
    key = rack_id
    cur = _stub_u_tracker.get(key, 0)
    if cur == 0:
        row = conn.execute(
            "SELECT COALESCE(MAX(EndU), 0) FROM ServerPositions WHERE RackId = ? AND Status = '在架'",
            (rack_id,),
        ).fetchone()
        cur = (row[0] if row else 0) + 1
    else:
        cur += 1
    _stub_u_tracker[key] = cur
    return cur


def ensure_inter_room_stub(
    conn: sqlite3.Connection,
    room_a: str,
    room_b: str,
    cable_type: str,
    purpose: str,
    status: str,
    count: int,
) -> int:
    """Create aggregated inter-room cables via stub devices (one pair per bundle entry)."""
    created = 0
    stub_a = f"__stub__{room_a}__{room_b}__{cable_type}__{purpose}__{status}__a"
    stub_b = f"__stub__{room_a}__{room_b}__{cable_type}__{purpose}__{status}__b"
    rack_a, _ = ensure_rack(conn, room_a, f"STUB-{room_a[:2]}")
    rack_b, _ = ensure_rack(conn, room_b, f"STUB-{room_b[:2]}")
    dev_a, _ = ensure_server(conn, stub_a, "交换机", 1, f"10.99.{hash(room_a) % 200}.{hash(room_b) % 200}")
    dev_b, _ = ensure_server(conn, stub_b, "交换机", 1, f"10.99.{hash(room_b) % 200}.{hash(room_a) % 200}")
    # Assign non-overlapping U positions within the STUB rack
    u_slot_a = _next_stub_u(conn, rack_a)
    u_slot_b = _next_stub_u(conn, rack_b)
    ensure_position(conn, dev_a, rack_a, u_slot_a, 1)
    ensure_position(conn, dev_b, rack_b, u_slot_b, 1)
    port_a, _ = ensure_port(conn, dev_a, "link")
    port_b, _ = ensure_port(conn, dev_b, "link")
    for i in range(count):
        pa, _ = ensure_port(conn, dev_a, f"agg{i}")
        pb, _ = ensure_port(conn, dev_b, f"agg{i}")
        if ensure_cable(conn, pa, pb, cable_type, purpose, status):
            created += 1
    return created


def deactivate_legacy_shanghai_racks(conn: sqlite3.Connection, room_id: str) -> None:
    """Mark old acceptance racks as 停用 (do not touch device positions)."""
    updated = conn.execute(
        "UPDATE Racks SET Status = '停用' WHERE RoomId = ? AND Code LIKE ?",
        (room_id, LEGACY_RACK_PREFIX + "%"),
    ).rowcount
    if updated:
        log("UPDATE", f"deactivated {updated} legacy rack(s) in Shanghai room")


def seed_shanghai_room(conn: sqlite3.Connection, room_id: str) -> None:
    floor_rack, floor_new = ensure_rack(conn, room_id, "FLOOR")
    if floor_new:
        log("CREATE", "rack FLOOR (floor devices)")

    racks = {}
    for code in ("R3-01", "R3-02", "R3-03", "R3-04"):
        rid, created = ensure_rack(conn, room_id, code)
        racks[code] = rid
        if created:
            log("CREATE", f"rack {code}")

    devices: dict[str, str] = {}
    device_defs = [
        ("APP-01", "服务器", 2, racks["R3-01"], 5, "10.10.3.1"),
        ("APP-02", "服务器", 2, racks["R3-01"], 10, "10.10.3.2"),
        ("DB-01", "服务器", 2, racks["R3-03"], 5, "10.10.3.3"),
        ("DB-02", "服务器", 2, racks["R3-03"], 10, "10.10.3.4"),
        ("SW-CORE-01", "交换机", 1, floor_rack, 1, "10.10.3.10"),
        ("SW-CORE-02", "交换机", 1, floor_rack, 2, "10.10.3.11"),
        ("FW-01", "防火墙", 1, floor_rack, 3, "10.10.3.12"),
        ("STORAGE-01", "存储", 2, floor_rack, 4, "10.10.3.13"),
        ("BAK-01", "备份设备", 2, floor_rack, 6, "10.10.3.14"),
    ]
    for name, dtype, height, rack_id, start_u, ip in device_defs:
        sid, created = ensure_server(conn, name, dtype, height, ip)
        devices[name] = sid
        if created:
            log("CREATE", f"device {name}")
        if ensure_position(conn, sid, rack_id, start_u, height):
            log("CREATE", f"position {name} @ U{start_u}")

    port_defs: dict[str, list[str]] = {
        "APP-01": ["eth0", "eth1"],
        "APP-02": ["eth0", "eth1"],
        "DB-01": ["eth0", "eth1"],
        "DB-02": ["eth0", "eth1"],
        "SW-CORE-01": ["GE0/1", "GE0/2", "GE0/3", "GE0/4"],
        "SW-CORE-02": ["GE0/1", "GE0/2", "GE0/3", "GE0/4", "GE0/5"],
        "FW-01": ["GE0/0", "GE0/1"],
        "STORAGE-01": ["FC1", "FC2"],
        "BAK-01": ["eth0"],
    }
    ports: dict[str, dict[str, str]] = {}
    for dev_name, port_names in port_defs.items():
        ports[dev_name] = {}
        for pname in port_names:
            pid, created = ensure_port(conn, devices[dev_name], pname)
            ports[dev_name][pname] = pid
            if created:
                log("CREATE", f"port {dev_name}/{pname}")

    cable_defs = [
        ("APP-01", "eth0", "SW-CORE-01", "GE0/1", "光纤", "业务网络", "正常"),
        ("APP-02", "eth0", "SW-CORE-01", "GE0/2", "光纤", "业务网络", "正常"),
        ("DB-01", "eth0", "SW-CORE-02", "GE0/1", "光纤", "业务网络", "正常"),
        ("DB-02", "eth0", "SW-CORE-02", "GE0/2", "光纤", "业务网络", "正常"),
        ("SW-CORE-01", "GE0/3", "FW-01", "GE0/0", "光纤", "管理网络", "正常"),
        ("FW-01", "GE0/1", "SW-CORE-02", "GE0/3", "光纤", "管理网络", "正常"),
        ("SW-CORE-01", "GE0/4", "STORAGE-01", "FC1", "DAC", "存储网络", "正常"),
        ("SW-CORE-02", "GE0/4", "STORAGE-01", "FC2", "DAC", "存储网络", "告警"),
        # GE0/4 already used; schema allows one cable per port — BAK uses GE0/5 (see IMPLEMENTATION.md)
        ("SW-CORE-02", "GE0/5", "BAK-01", "eth0", "铜缆", "管理网络", "正常"),
    ]
    for src_dev, src_port, tgt_dev, tgt_port, ctype, purpose, status in cable_defs:
        sp = ports[src_dev][src_port]
        tp = ports[tgt_dev][tgt_port]
        if ensure_cable(conn, sp, tp, ctype, purpose, status):
            log("CREATE", f"cable {src_dev}/{src_port} → {tgt_dev}/{tgt_port}")


def main() -> None:
    if not DB_PATH.exists():
        raise SystemExit(f"Database not found: {DB_PATH}")

    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")

    # Rename legacy Shanghai room if present
    legacy = conn.execute(
        "SELECT Id FROM Rooms WHERE Id = ? OR Name = ?",
        (SHANGHAI_ROOM_ID, SHANGHAI_LEGACY_NAME),
    ).fetchone()
    if legacy:
        conn.execute(
            "UPDATE Rooms SET Name = ?, Location = ? WHERE Id = ? OR Name = ?",
            (SHANGHAI_NAME, SHANGHAI_LOCATION, legacy[0], SHANGHAI_LEGACY_NAME),
        )
        shanghai_id = legacy[0]
        log("UPDATE", f"renamed {SHANGHAI_LEGACY_NAME} → {SHANGHAI_NAME}")
    else:
        existing_sh = room_by_name(conn, SHANGHAI_NAME)
        if existing_sh:
            shanghai_id = existing_sh
            log("SKIP", f"room {SHANGHAI_NAME} exists")
        else:
            shanghai_id = uid()
            conn.execute(
                "INSERT INTO Rooms (Id, Name, Status, Location, TopologyX, TopologyY) VALUES (?, ?, '启用', ?, 0, 0)",
                (shanghai_id, SHANGHAI_NAME, SHANGHAI_LOCATION),
            )
            log("CREATE", f"room {SHANGHAI_NAME}")

    room_ids: dict[str, str] = {SHANGHAI_NAME: shanghai_id}
    for name, location in ACCEPTANCE_ROOMS:
        if name == SHANGHAI_NAME:
            continue
        rid, created = ensure_room(conn, name, location)
        room_ids[name] = rid
        log("CREATE" if created else "SKIP", f"room {name}")

    deactivate_legacy_shanghai_racks(conn, shanghai_id)
    seed_shanghai_room(conn, shanghai_id)

    for room_a, room_b, ctype, purpose, status, count in INTER_ROOM_CABLES:
        ra = room_ids.get(room_a)
        rb = room_ids.get(room_b)
        if not ra or not rb:
            log("SKIP", f"inter-room {room_a}↔{room_b} (room missing)")
            continue
        created = ensure_inter_room_stub(conn, ra, rb, ctype, purpose, status, count)
        log("CREATE" if created else "SKIP", f"inter-room {room_a}↔{room_b} ×{created}/{count}")

    conn.commit()
    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
