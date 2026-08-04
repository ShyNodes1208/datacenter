#!/usr/bin/env python3
"""Seed datacenter-dev.db: one switch per rack + servers to ~60% U occupancy."""

from __future__ import annotations

import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "src/backend/Datacenter.Api/.data/datacenter-dev.db"

TARGET_FILL_RATIO = 0.60
HEIGHT_MIX = [2, 2, 2, 2, 2, 1, 1, 1, 4, 4]  # 50% 2U, 30% 1U, 20% 4U
SWITCH_PORTS = 24


def uid() -> str:
    return str(uuid.uuid4()).upper()


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def occupied_units(positions: list[tuple[int, int]]) -> set[int]:
    occupied: set[int] = set()
    for start_u, end_u in positions:
        lo, hi = min(start_u, end_u), max(start_u, end_u)
        for u in range(lo, hi + 1):
            occupied.add(u)
    return occupied


def block_free(occupied: set[int], start_u: int, height: int) -> bool:
    end_u = start_u + height - 1
    for u in range(start_u, end_u + 1):
        if u in occupied:
            return False
    return True


def mark_occupied(occupied: set[int], start_u: int, height: int) -> None:
    end_u = start_u + height - 1
    for u in range(start_u, end_u + 1):
        occupied.add(u)


def highest_free_start(occupied: set[int], height_u: int, device_height: int) -> int | None:
    """Place device as high as possible: StartU = bottom, EndU = top (API convention)."""
    for end_u in range(height_u, device_height - 1, -1):
        start_u = end_u - device_height + 1
        if start_u >= 1 and block_free(occupied, start_u, device_height):
            return start_u
    return None


def fix_inverted_positions(conn: sqlite3.Connection) -> int:
    """Legacy rows may have StartU > EndU; normalize to StartU <= EndU."""
    rows = conn.execute(
        "SELECT Id, StartU, EndU FROM ServerPositions WHERE EndU < StartU"
    ).fetchall()
    for pos_id, start_u, end_u in rows:
        conn.execute(
            "UPDATE ServerPositions SET StartU = ?, EndU = ? WHERE Id = ?",
            (end_u, start_u, pos_id),
        )
    return len(rows)


def rack_has_switch(conn: sqlite3.Connection, rack_id: str) -> bool:
    row = conn.execute(
        """
        SELECT 1
        FROM ServerPositions sp
        JOIN Servers s ON s.Id = sp.ServerId
        WHERE sp.RackId = ?
          AND sp.Status = '在架'
          AND (s.DeviceType LIKE '%交换%' OR lower(s.DeviceType) LIKE '%switch%')
        LIMIT 1
        """,
        (rack_id,),
    ).fetchone()
    return row is not None


def load_positions(conn: sqlite3.Connection, rack_id: str) -> list[tuple[int, int]]:
    return [
        (row[0], row[1])
        for row in conn.execute(
            """
            SELECT sp.StartU, sp.EndU
            FROM ServerPositions sp
            WHERE sp.RackId = ? AND sp.Status = '在架'
            """,
            (rack_id,),
        )
    ]


def ensure_unique_ip(conn: sqlite3.Connection, ip: str, rack_index: int, host: int) -> str:
    existing = {row[0] for row in conn.execute("SELECT ManagementIP FROM Servers")}
    candidate = ip
    suffix = 0
    while candidate in existing:
        suffix += 1
        candidate = f"10.0.{rack_index}.{host + suffix}"
    return candidate


def ensure_unique_name(existing: set[str], name: str) -> str:
    candidate = name
    n = 2
    while candidate in existing:
        candidate = f"{name}-{n}"
        n += 1
    return candidate


def create_server(
    conn: sqlite3.Connection,
    *,
    name: str,
    ip: str,
    device_type: str,
    device_height: int,
    existing_names: set[str],
    existing_ips: set[str],
) -> str:
    name = ensure_unique_name(existing_names, name)
    while ip in existing_ips:
        parts = ip.split(".")
        parts[-1] = str(int(parts[-1]) + 1)
        ip = ".".join(parts)

    server_id = uid()
    conn.execute(
        """
        INSERT INTO Servers (
            Id, Name, ManagementIP, AssetNumber, DeviceType, DeviceHeight,
            OperationalStatus, PositionStatus, System, Owner, Notes
        ) VALUES (?, ?, ?, NULL, ?, ?, '正常', '在架', NULL, NULL, NULL)
        """,
        (server_id, name, ip, device_type, device_height),
    )
    existing_names.add(name)
    existing_ips.add(ip)
    return server_id


def create_position(
    conn: sqlite3.Connection,
    *,
    server_id: str,
    rack_id: str,
    start_u: int,
    device_height: int,
) -> None:
    end_u = start_u + device_height - 1
    conn.execute(
        """
        INSERT INTO ServerPositions (Id, ServerId, RackId, StartU, EndU, Status, InstalledAt)
        VALUES (?, ?, ?, ?, ?, '在架', ?)
        """,
        (uid(), server_id, rack_id, start_u, end_u, now_iso()),
    )


def create_switch_ports(conn: sqlite3.Connection, server_id: str) -> None:
    for i in range(1, SWITCH_PORTS + 1):
        port_name = f"GE0/0/{i}"
        exists = conn.execute(
            "SELECT 1 FROM Ports WHERE ServerId = ? AND PortName = ?",
            (server_id, port_name),
        ).fetchone()
        if exists:
            continue
        conn.execute(
            """
            INSERT INTO Ports (Id, ServerId, PortName, PortType, Speed, Notes)
            VALUES (?, ?, ?, 'SFP+', '10G', NULL)
            """,
            (uid(), server_id, port_name),
        )


def add_switch_if_missing(
    conn: sqlite3.Connection,
    *,
    rack_id: str,
    rack_code: str,
    height_u: int,
    rack_global_index: int,
    existing_names: set[str],
    existing_ips: set[str],
) -> tuple[bool, str | None]:
    if rack_has_switch(conn, rack_id):
        return False, None

    positions = load_positions(conn, rack_id)
    occupied = occupied_units(positions)
    start_u = highest_free_start(occupied, height_u, 1)
    if start_u is None:
        print(f"  WARN: {rack_code} 无可用 U 位放置交换机，跳过")
        return False, None

    name = f"{rack_code}-sw-01"
    ip = ensure_unique_ip(
        conn,
        f"10.0.{rack_global_index}.1",
        rack_global_index,
        1,
    )
    server_id = create_server(
        conn,
        name=name,
        ip=ip,
        device_type="交换机",
        device_height=1,
        existing_names=existing_names,
        existing_ips=existing_ips,
    )
    create_position(conn, server_id=server_id, rack_id=rack_id, start_u=start_u, device_height=1)
    create_switch_ports(conn, server_id)
    return True, server_id


def count_servers_in_rack(conn: sqlite3.Connection, rack_id: str) -> int:
    row = conn.execute(
        """
        SELECT COUNT(DISTINCT s.Id)
        FROM ServerPositions sp
        JOIN Servers s ON s.Id = sp.ServerId
        WHERE sp.RackId = ?
          AND sp.Status = '在架'
          AND NOT (s.DeviceType LIKE '%交换%' OR lower(s.DeviceType) LIKE '%switch%')
        """,
        (rack_id,),
    ).fetchone()
    return int(row[0]) if row else 0


def fill_servers_to_target(
    conn: sqlite3.Connection,
    *,
    rack_id: str,
    rack_code: str,
    height_u: int,
    room_index: int,
    rack_in_room_index: int,
    existing_names: set[str],
    existing_ips: set[str],
) -> int:
    positions = load_positions(conn, rack_id)
    occupied = occupied_units(positions)
    target_u = max(1, round(height_u * TARGET_FILL_RATIO))
    current_u = len(occupied)
    need_u = max(0, target_u - current_u)

    if need_u == 0:
        return 0

    srv_nn = 1
    created = 0
    mix_idx = 0

    while need_u > 0:
        placed = False
        for _ in range(len(HEIGHT_MIX)):
            height = HEIGHT_MIX[mix_idx % len(HEIGHT_MIX)]
            mix_idx += 1
            if height > need_u and height > 1:
                continue

            start_u = None
            for end_u in range(height_u, height - 1, -1):
                candidate = end_u - height + 1
                if candidate >= 1 and block_free(occupied, candidate, height):
                    start_u = candidate
                    break
            if start_u is None:
                continue

            while True:
                srv_name = f"{rack_code}-srv-{srv_nn:02d}"
                if srv_name not in existing_names:
                    break
                srv_nn += 1

            ip = f"10.{room_index}.{rack_in_room_index}.{100 + srv_nn}"
            server_id = create_server(
                conn,
                name=srv_name,
                ip=ip,
                device_type="服务器",
                device_height=height,
                existing_names=existing_names,
                existing_ips=existing_ips,
            )
            create_position(
                conn,
                server_id=server_id,
                rack_id=rack_id,
                start_u=start_u,
                device_height=height,
            )
            mark_occupied(occupied, start_u, height)
            need_u -= height
            srv_nn += 1
            created += 1
            placed = True
            break

        if not placed:
            break

    return created


def main() -> None:
    if not DB_PATH.exists():
        raise SystemExit(f"Database not found: {DB_PATH}")

    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")

    fixed = fix_inverted_positions(conn)
    if fixed:
        print(f"已修正 {fixed} 条 StartU/EndU 颠倒的 ServerPosition 记录")
        conn.commit()

    existing_names = {row[0] for row in conn.execute("SELECT Name FROM Servers")}
    existing_ips = {row[0] for row in conn.execute("SELECT ManagementIP FROM Servers")}

    racks = conn.execute(
        """
        SELECT r.Id, r.Code, r.HeightU, r.RoomId, rm.Name AS RoomName
        FROM Racks r
        JOIN Rooms rm ON rm.Id = r.RoomId
        ORDER BY rm.Name, r.Code
        """
    ).fetchall()

    room_order: dict[str, int] = {}
    room_rack_counter: dict[str, int] = {}

    stats_rows: list[dict] = []
    total_servers_added = 0
    total_switches_added = 0
    total_occ = 0
    total_u = 0

    for global_idx, (rack_id, rack_code, height_u, _room_id, room_name) in enumerate(racks):
        if room_name not in room_order:
            room_order[room_name] = len(room_order) + 1
            room_rack_counter[room_name] = 0
        room_rack_counter[room_name] += 1
        room_index = room_order[room_name]
        rack_in_room_index = room_rack_counter[room_name]

        switch_added, _ = add_switch_if_missing(
            conn,
            rack_id=rack_id,
            rack_code=rack_code,
            height_u=height_u,
            rack_global_index=global_idx + 1,
            existing_names=existing_names,
            existing_ips=existing_ips,
        )
        if switch_added:
            total_switches_added += 1

        servers_before = count_servers_in_rack(conn, rack_id)
        added = fill_servers_to_target(
            conn,
            rack_id=rack_id,
            rack_code=rack_code,
            height_u=height_u,
            room_index=room_index,
            rack_in_room_index=rack_in_room_index,
            existing_names=existing_names,
            existing_ips=existing_ips,
        )
        total_servers_added += added

        positions = load_positions(conn, rack_id)
        occ = len(occupied_units(positions))
        pct = round(occ / height_u * 100) if height_u else 0
        has_sw = rack_has_switch(conn, rack_id)
        srv_count = count_servers_in_rack(conn, rack_id)

        stats_rows.append(
            {
                "code": rack_code,
                "occ": occ,
                "height_u": height_u,
                "pct": pct,
                "has_sw": has_sw,
                "servers": srv_count,
            }
        )
        total_occ += occ
        total_u += height_u

        print(
            f"机柜 {rack_code}: {occ}/{height_u}U ({pct}%), "
            f"交换机{'✅' if has_sw else '❌'}, 服务器:{srv_count}"
            + (f" (+{added} 新增)" if added else "")
        )

    conn.commit()

    total_servers = conn.execute(
        """
        SELECT COUNT(*) FROM Servers
        WHERE NOT (DeviceType LIKE '%交换%' OR lower(DeviceType) LIKE '%switch%')
        """
    ).fetchone()[0]
    total_switches = conn.execute(
        """
        SELECT COUNT(*) FROM Servers
        WHERE DeviceType LIKE '%交换%' OR lower(DeviceType) LIKE '%switch%'
        """
    ).fetchone()[0]
    overall_pct = round(total_occ / total_u * 100) if total_u else 0

    print()
    print(
        f"总计: {total_servers} 台服务器, {total_switches} 台交换机, "
        f"{total_occ} U 占用 / {total_u} U 总计 ({overall_pct}%)"
    )
    if total_servers_added or total_switches_added:
        print(
            f"本次新增: 服务器 {total_servers_added} 台, 交换机 {total_switches_added} 台"
        )

    conn.close()


if __name__ == "__main__":
    main()
