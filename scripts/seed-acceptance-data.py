#!/usr/bin/env python3
"""Idempotent acceptance seed: 3 rooms × 10 racks + device fill (TASK-20260813-170555)."""

from __future__ import annotations

import re
import sqlite3
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "src/backend/Datacenter.Api/.data/datacenter-dev.db"

SHANGHAI_ROOM_ID = "64D083F6-CFFB-408E-AE45-5EA0E1914A51"
SHANGHAI_LEGACY_NAME = "页面验证机房"
SHANGHAI_NAME = "上海机房"
SHANGHAI_LOCATION = "上海张江DC1"

# (name, location, abbr, rack_prefix)
KEPT_ROOMS = [
    (SHANGHAI_NAME, SHANGHAI_LOCATION, "SH", "R1"),
    ("北京机房", "北京", "BJ", "R2"),
    ("广州机房", "广州", "GZ", "R3"),
]

RACK_U = 42
RACKS_PER_ROOM = 10
TARGET_PER_RACK = 19  # 18–20
SYNTHETIC_TYPES = [
    ("服务器", "SRV"),
    ("交换机", "SW"),
    ("防火墙", "FW"),
    ("存储", "STG"),
    ("服务器", "DB"),
]
SYNTHETIC_HEIGHTS = [1, 2, 2, 2, 3, 4]
SYNTHETIC_NAME_RE = re.compile(r"^(SRV|SW|FW|STG|DB)-(SH|BJ|GZ)-\d{3}$")
CABLE_TYPES = ["光纤", "DAC", "铜缆"]
CABLE_PURPOSES = ["业务网络", "上联", "存储网络", "管理网络"]
CABLE_STATUSES = ["正常", "正常", "正常", "告警"]


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
            "UPDATE Rooms SET Location = COALESCE(Location, ?), Status = '启用' WHERE Id = ?",
            (location, existing),
        )
        return existing, False
    rid = uid()
    conn.execute(
        "INSERT INTO Rooms (Id, Name, Status, Location, TopologyX, TopologyY) VALUES (?, ?, '启用', ?, 0, 0)",
        (rid, name, location),
    )
    return rid, True


def ensure_shanghai_room(conn: sqlite3.Connection) -> str:
    """Keep Shanghai on the spec ID. Do not merge mismatched name/id rows."""
    by_id = conn.execute(
        "SELECT Id, Name FROM Rooms WHERE Id = ?",
        (SHANGHAI_ROOM_ID,),
    ).fetchone()
    by_name = conn.execute(
        "SELECT Id, Name FROM Rooms WHERE Name = ?",
        (SHANGHAI_NAME,),
    ).fetchone()
    if by_id and by_name and by_id[0].upper() != by_name[0].upper():
        raise SystemExit(
            "BLOCKER: Shanghai Id "
            f"{SHANGHAI_ROOM_ID} is named '{by_id[1]}', but '{SHANGHAI_NAME}' "
            f"is a different row {by_name[0]}. Do not guess merge."
        )
    if by_name and by_name[0].upper() != SHANGHAI_ROOM_ID.upper() and not by_id:
        raise SystemExit(
            f"BLOCKER: room '{SHANGHAI_NAME}' exists with Id={by_name[0]}, "
            f"spec requires {SHANGHAI_ROOM_ID}. Existing Id must not change."
        )
    legacy = conn.execute(
        "SELECT Id FROM Rooms WHERE Name = ? AND Id != ?",
        (SHANGHAI_LEGACY_NAME, SHANGHAI_ROOM_ID),
    ).fetchone()
    if legacy:
        raise SystemExit(
            f"BLOCKER: leftover legacy room '{SHANGHAI_LEGACY_NAME}' Id={legacy[0]} "
            "is not the Shanghai spec Id. Do not rename/merge without a product decision."
        )
    if by_id:
        conn.execute(
            "UPDATE Rooms SET Name = ?, Location = ?, Status = '启用' WHERE Id = ?",
            (SHANGHAI_NAME, SHANGHAI_LOCATION, SHANGHAI_ROOM_ID),
        )
        return SHANGHAI_ROOM_ID
    conn.execute(
        "INSERT INTO Rooms (Id, Name, Status, Location, TopologyX, TopologyY) VALUES (?, ?, '启用', ?, 0, 0)",
        (SHANGHAI_ROOM_ID, SHANGHAI_NAME, SHANGHAI_LOCATION),
    )
    return SHANGHAI_ROOM_ID


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
        conn.execute(
            "UPDATE Racks SET HeightU = 42, X = 0, Y = 0, Z = 0, Status = '启用' WHERE Id = ?",
            (row[0],),
        )
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
    """Idempotent 在架 placement: move existing row or insert. One 在架 row per server."""
    end_u = start_u + height - 1
    rows = conn.execute(
        "SELECT Id, RackId, StartU, EndU FROM ServerPositions WHERE ServerId = ? AND Status = '在架'",
        (server_id,),
    ).fetchall()
    if rows:
        first = rows[0]
        extra_ids = [r[0] for r in rows[1:]]
        if extra_ids:
            conn.executemany("DELETE FROM ServerPositions WHERE Id = ?", [(i,) for i in extra_ids])
        if first[1] == rack_id and first[2] == start_u and first[3] == end_u:
            conn.execute(
                "UPDATE Servers SET PositionStatus = '在架' WHERE Id = ?",
                (server_id,),
            )
            return False
        conn.execute(
            "UPDATE ServerPositions SET RackId = ?, StartU = ?, EndU = ?, Status = '在架' WHERE Id = ?",
            (rack_id, start_u, end_u, first[0]),
        )
        conn.execute(
            "UPDATE Servers SET PositionStatus = '在架' WHERE Id = ?",
            (server_id,),
        )
        return True
    conn.execute(
        """
        INSERT INTO ServerPositions (Id, ServerId, RackId, StartU, EndU, Status, InstalledAt)
        VALUES (?, ?, ?, ?, ?, '在架', ?)
        """,
        (uid(), server_id, rack_id, start_u, end_u, now_iso()),
    )
    conn.execute(
        "UPDATE Servers SET PositionStatus = '在架' WHERE Id = ?",
        (server_id,),
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


def first_free_port(conn: sqlite3.Connection, server_id: str) -> str | None:
    rows = conn.execute(
        "SELECT Id FROM Ports WHERE ServerId = ? ORDER BY PortName",
        (server_id,),
    ).fetchall()
    for (pid,) in rows:
        if not port_connected(conn, pid):
            return pid
    return None


def devices_already_cabled(conn: sqlite3.Connection, server_a: str, server_b: str) -> bool:
    row = conn.execute(
        """
        SELECT 1 FROM Cables c
        JOIN Ports pa ON pa.Id = c.SourcePortId
        JOIN Ports pb ON pb.Id = c.TargetPortId
        WHERE (pa.ServerId = ? AND pb.ServerId = ?)
           OR (pa.ServerId = ? AND pb.ServerId = ?)
        LIMIT 1
        """,
        (server_a, server_b, server_b, server_a),
    ).fetchone()
    return row is not None


def parse_stub_name(name: str) -> tuple[str, str, str] | None:
    if not name.startswith("__stub__"):
        return None
    parts = name.split("__")
    # ['', 'stub', roomA, roomB, ..., 'a'|'b']
    if len(parts) < 5:
        return None
    suffix = parts[-1].lower()
    if suffix not in ("a", "b"):
        return None
    return parts[2], parts[3], suffix


def map_stub_room(room_id: str, other_id: str, kept_ids: list[str]) -> str:
    kept_upper = {k.upper(): k for k in kept_ids}
    if room_id.upper() in kept_upper:
        return kept_upper[room_id.upper()]
    other = kept_upper.get(other_id.upper())
    candidates = [k for k in kept_ids if k != other] or list(kept_ids)
    idx = sum(ord(c) for c in room_id.upper()) % len(candidates)
    return candidates[idx]


def next_free_u(occupancy: dict[str, int], rack_id: str) -> int:
    return occupancy.get(rack_id, 1)


def can_fit(occupancy: dict[str, int], rack_id: str, height: int) -> bool:
    start = next_free_u(occupancy, rack_id)
    return start >= 1 and start + height - 1 <= RACK_U


def remaining_u(occupancy: dict[str, int], rack_id: str) -> int:
    return RACK_U - next_free_u(occupancy, rack_id) + 1


def pick_rack(
    rack_ids: list[str],
    occupancy: dict[str, int],
    counts: dict[str, int],
    height: int,
    respect_target: bool,
) -> str | None:
    """Stable pick: lowest used U, then lowest count, then original order."""
    candidates: list[tuple[int, int, int, str]] = []
    for idx, rack_id in enumerate(rack_ids):
        if respect_target and counts.get(rack_id, 0) >= TARGET_PER_RACK:
            continue
        if not can_fit(occupancy, rack_id, height):
            continue
        used = next_free_u(occupancy, rack_id) - 1
        candidates.append((used, counts.get(rack_id, 0), idx, rack_id))
    if not candidates:
        return None
    candidates.sort()
    return candidates[0][3]


def place_into(
    conn: sqlite3.Connection,
    occupancy: dict[str, int],
    counts: dict[str, int],
    server_id: str,
    rack_id: str,
    height: int,
) -> None:
    start = next_free_u(occupancy, rack_id)
    ensure_position(conn, server_id, rack_id, start, height)
    occupancy[rack_id] = start + height
    counts[rack_id] = counts.get(rack_id, 0) + 1


def delete_non_live_positions(conn: sqlite3.Connection) -> int:
    """Drop 已下架 (and any non-在架) rows so old racks can be deleted. Cables untouched."""
    cur = conn.execute("DELETE FROM ServerPositions WHERE Status != '在架'")
    return cur.rowcount or 0


def clear_synthetic_live_positions(conn: sqlite3.Connection) -> int:
    """Drop 在架 rows for synthetic devices before rebuild.

    occupancy is rebuilt from scratch and does not load existing synthetic rows;
    stale placements left after fill_synthetic_devices can_fit breaks cause U overlaps
    on re-runs when non-synthetic inventory changes. Cleared synthetics are re-placed
    by fill_synthetic_devices / place_stragglers. Cables untouched.
    """
    rows = conn.execute("SELECT Id, Name FROM Servers").fetchall()
    synth_ids = [sid for sid, name in rows if SYNTHETIC_NAME_RE.match(name or "")]
    if not synth_ids:
        return 0
    ph = ",".join("?" * len(synth_ids))
    cur = conn.execute(
        f"DELETE FROM ServerPositions WHERE Status = '在架' AND ServerId IN ({ph})",
        synth_ids,
    )
    deleted = cur.rowcount or 0
    if deleted:
        conn.execute(
            f"UPDATE Servers SET PositionStatus = '未上架' WHERE Id IN ({ph})",
            synth_ids,
        )
    return deleted


def seed_kept_rooms_and_racks(conn: sqlite3.Connection) -> tuple[list[dict], list[str]]:
    """Return room dicts and flat rack id list (Shanghai R1-01.. then BJ then GZ)."""
    shanghai_id = ensure_shanghai_room(conn)
    rooms: list[dict] = []
    flat_racks: list[str] = []
    for name, location, abbr, prefix in KEPT_ROOMS:
        if name == SHANGHAI_NAME:
            rid = shanghai_id
            created = False
        else:
            rid, created = ensure_room(conn, name, location)
        log("CREATE" if created else "SKIP", f"room {name} ({rid})")
        rack_ids: list[str] = []
        for i in range(1, RACKS_PER_ROOM + 1):
            code = f"{prefix}-{i:02d}"
            rack_id, rack_new = ensure_rack(conn, rid, code)
            rack_ids.append(rack_id)
            flat_racks.append(rack_id)
            if rack_new:
                log("CREATE", f"rack {name}/{code}")
        rooms.append(
            {
                "id": rid,
                "name": name,
                "abbr": abbr,
                "prefix": prefix,
                "rack_ids": rack_ids,
            }
        )
    return rooms, flat_racks


def load_servers(conn: sqlite3.Connection) -> list[tuple[str, str, int]]:
    """(id, name, height) for every server."""
    rows = conn.execute(
        "SELECT Id, Name, DeviceHeight FROM Servers ORDER BY Name, Id"
    ).fetchall()
    out: list[tuple[str, str, int]] = []
    for sid, name, height in rows:
        h = int(height or 1)
        if h < 1:
            h = 1
        if h > RACK_U:
            raise SystemExit(f"BLOCKER: server {name} DeviceHeight={h} exceeds {RACK_U}U")
        out.append((sid, name, h))
    return out


def place_existing_servers(
    conn: sqlite3.Connection,
    rooms: list[dict],
    flat_racks: list[str],
    occupancy: dict[str, int],
    counts: dict[str, int],
) -> None:
    kept_ids = [r["id"] for r in rooms]
    servers = load_servers(conn)
    stubs: list[tuple[str, str, int]] = []
    base: list[tuple[str, str, int]] = []
    for sid, name, height in servers:
        if SYNTHETIC_NAME_RE.match(name):
            continue
        if parse_stub_name(name):
            stubs.append((sid, name, height))
        else:
            base.append((sid, name, height))

    for sid, name, height in stubs:
        parsed = parse_stub_name(name)
        assert parsed is not None
        room_a, room_b, suffix = parsed
        endpoint = room_a if suffix == "a" else room_b
        other = room_b if suffix == "a" else room_a
        target_room = map_stub_room(endpoint, other, kept_ids)
        room = next(r for r in rooms if r["id"] == target_room)
        rack_id = pick_rack(room["rack_ids"], occupancy, counts, height, True) or pick_rack(
            flat_racks, occupancy, counts, height, False
        )
        if not rack_id:
            raise SystemExit(f"BLOCKER: no U slot for stub {name} height={height}")
        place_into(conn, occupancy, counts, sid, rack_id, height)

    base_sorted = sorted(base, key=lambda t: (-t[2], t[1], t[0]))
    for sid, name, height in base_sorted:
        rack_id = pick_rack(flat_racks, occupancy, counts, height, True) or pick_rack(
            flat_racks, occupancy, counts, height, False
        )
        if not rack_id:
            raise SystemExit(f"BLOCKER: no U slot for existing server {name} height={height}")
        place_into(conn, occupancy, counts, sid, rack_id, height)


def fill_synthetic_devices(
    conn: sqlite3.Connection,
    rooms: list[dict],
    occupancy: dict[str, int],
    counts: dict[str, int],
) -> int:
    """Create-or-reuse deterministic SRV/SW/FW/STG/DB-{abbr}-{n:03d} and fill to 18–20/rack."""
    created_servers = 0
    for room_index, room in enumerate(rooms, start=1):
        n = 1
        for rack_n, rack_id in enumerate(room["rack_ids"], start=1):
            while counts.get(rack_id, 0) < TARGET_PER_RACK:
                remaining = remaining_u(occupancy, rack_id)
                if remaining < 1:
                    break
                dtype, prefix = SYNTHETIC_TYPES[(n - 1) % len(SYNTHETIC_TYPES)]
                planned = SYNTHETIC_HEIGHTS[(n - 1) % len(SYNTHETIC_HEIGHTS)]
                needed = TARGET_PER_RACK - counts.get(rack_id, 0)
                max_h = max(1, remaining // needed) if needed else remaining
                height = min(planned, max_h, remaining, 4)
                name = f"{prefix}-{room['abbr']}-{n:03d}"
                ip = f"10.{room_index}.{rack_n}.{min(n, 254)}"
                sid, new = ensure_server(conn, name, dtype, height, ip)
                if not new:
                    row = conn.execute(
                        "SELECT DeviceHeight FROM Servers WHERE Id = ?",
                        (sid,),
                    ).fetchone()
                    height = int(row[0]) if row else height
                    if not can_fit(occupancy, rack_id, height):
                        break
                else:
                    created_servers += 1
                    for p in range(1 + (n - 1) % 4):
                        ensure_port(conn, sid, f"eth{p}")
                if not can_fit(occupancy, rack_id, height):
                    break
                place_into(conn, occupancy, counts, sid, rack_id, height)
                n += 1
            while counts.get(rack_id, 0) < 18:
                remaining = remaining_u(occupancy, rack_id)
                if remaining < 1:
                    break
                dtype, prefix = SYNTHETIC_TYPES[(n - 1) % len(SYNTHETIC_TYPES)]
                name = f"{prefix}-{room['abbr']}-{n:03d}"
                ip = f"10.{room_index}.{rack_n}.{min(n, 254)}"
                sid, new = ensure_server(conn, name, dtype, 1, ip)
                if not new:
                    row = conn.execute(
                        "SELECT DeviceHeight FROM Servers WHERE Id = ?",
                        (sid,),
                    ).fetchone()
                    height = int(row[0]) if row else 1
                    if not can_fit(occupancy, rack_id, height):
                        break
                else:
                    created_servers += 1
                    ensure_port(conn, sid, "eth0")
                    height = 1
                if not can_fit(occupancy, rack_id, height):
                    break
                place_into(conn, occupancy, counts, sid, rack_id, height)
                n += 1
    return created_servers


def place_stragglers(
    conn: sqlite3.Connection,
    flat_racks: list[str],
    occupancy: dict[str, int],
    counts: dict[str, int],
) -> int:
    """Any server still without a 在架 row is overflow-placed (stable name order)."""
    rows = conn.execute(
        """
        SELECT s.Id, s.Name, s.DeviceHeight
        FROM Servers s
        WHERE NOT EXISTS (
            SELECT 1 FROM ServerPositions p
            WHERE p.ServerId = s.Id AND p.Status = '在架'
        )
        ORDER BY s.Name, s.Id
        """
    ).fetchall()
    placed_n = 0
    for sid, name, height in rows:
        h = int(height or 1)
        placed = False
        for rack_id in flat_racks:
            if can_fit(occupancy, rack_id, h):
                place_into(conn, occupancy, counts, sid, rack_id, h)
                placed = True
                placed_n += 1
                break
        if not placed:
            raise SystemExit(f"BLOCKER: no U slot for unpositioned server {name} height={h}")
    return placed_n


def wire_intra_room(
    conn: sqlite3.Connection,
    rooms: list[dict],
) -> int:
    """Same-rack adjacent + consecutive cross-rack cables. Existing cables kept."""
    created = 0
    cable_i = 0
    for room in rooms:
        rack_first_server: list[str | None] = []
        for rack_id in room["rack_ids"]:
            devices = conn.execute(
                """
                SELECT s.Id
                FROM ServerPositions p
                JOIN Servers s ON s.Id = p.ServerId
                WHERE p.RackId = ? AND p.Status = '在架'
                ORDER BY p.StartU, s.Name
                """,
                (rack_id,),
            ).fetchall()
            ids = [r[0] for r in devices]
            rack_first_server.append(ids[0] if ids else None)
            adjacent = min(3, max(0, len(ids) - 1))
            for i in range(adjacent):
                a, b = ids[i], ids[i + 1]
                if devices_already_cabled(conn, a, b):
                    continue
                pa = first_free_port(conn, a)
                pb = first_free_port(conn, b)
                if not pa or not pb:
                    continue
                ctype = CABLE_TYPES[cable_i % len(CABLE_TYPES)]
                purpose = CABLE_PURPOSES[cable_i % len(CABLE_PURPOSES)]
                status = CABLE_STATUSES[cable_i % len(CABLE_STATUSES)]
                if ensure_cable(conn, pa, pb, ctype, purpose, status):
                    created += 1
                cable_i += 1
        for i in range(len(rack_first_server) - 1):
            a = rack_first_server[i]
            b = rack_first_server[i + 1]
            if not a or not b:
                continue
            if devices_already_cabled(conn, a, b):
                continue
            pa = first_free_port(conn, a)
            pb = first_free_port(conn, b)
            if not pa or not pb:
                continue
            ctype = CABLE_TYPES[cable_i % len(CABLE_TYPES)]
            purpose = CABLE_PURPOSES[cable_i % len(CABLE_PURPOSES)]
            status = "正常"
            if ensure_cable(conn, pa, pb, ctype, purpose, status):
                created += 1
            cable_i += 1
    return created


def wire_inter_room(conn: sqlite3.Connection, rooms: list[dict]) -> int:
    """Ensure a few kept-room cross links using free ports (stubs already cover BJ↔SH, SH↔GZ)."""
    created = 0
    pairs = [(0, 1), (1, 2), (0, 2)]
    for a_i, b_i in pairs:
        rack_a = rooms[a_i]["rack_ids"][0]
        rack_b = rooms[b_i]["rack_ids"][1] if len(rooms[b_i]["rack_ids"]) > 1 else rooms[b_i]["rack_ids"][0]
        sa = conn.execute(
            """
            SELECT s.Id FROM ServerPositions p
            JOIN Servers s ON s.Id = p.ServerId
            WHERE p.RackId = ? AND p.Status = '在架'
            ORDER BY p.StartU, s.Name LIMIT 1
            """,
            (rack_a,),
        ).fetchone()
        sb = conn.execute(
            """
            SELECT s.Id FROM ServerPositions p
            JOIN Servers s ON s.Id = p.ServerId
            WHERE p.RackId = ? AND p.Status = '在架'
            ORDER BY p.StartU, s.Name LIMIT 1
            """,
            (rack_b,),
        ).fetchone()
        if not sa or not sb:
            continue
        if devices_already_cabled(conn, sa[0], sb[0]):
            continue
        pa = first_free_port(conn, sa[0])
        pb = first_free_port(conn, sb[0])
        if not pa or not pb:
            continue
        if ensure_cable(conn, pa, pb, "光纤", "业务网络", "正常"):
            created += 1
    return created


def delete_extra_racks_and_rooms(
    conn: sqlite3.Connection,
    kept_room_ids: list[str],
    kept_rack_ids: list[str],
) -> tuple[int, int]:
    rack_ph = ",".join("?" * len(kept_rack_ids))
    room_ph = ",".join("?" * len(kept_room_ids))
    # DevicePositions FK RESTRICT on Racks; table is normally empty.
    dp = conn.execute(
        f"DELETE FROM DevicePositions WHERE RackId NOT IN ({rack_ph})",
        kept_rack_ids,
    )
    leftover_pos = conn.execute(
        f"SELECT COUNT(*) FROM ServerPositions WHERE RackId NOT IN ({rack_ph})",
        kept_rack_ids,
    ).fetchone()[0]
    if leftover_pos:
        raise SystemExit(
            f"BLOCKER: {leftover_pos} ServerPositions still reference racks outside the kept 30"
        )
    racks_deleted = conn.execute(
        f"DELETE FROM Racks WHERE Id NOT IN ({rack_ph})",
        kept_rack_ids,
    ).rowcount or 0
    leftover_racks = conn.execute(
        f"SELECT COUNT(*) FROM Racks WHERE RoomId NOT IN ({room_ph})",
        kept_room_ids,
    ).fetchone()[0]
    if leftover_racks:
        raise SystemExit(
            f"BLOCKER: {leftover_racks} racks still belong to rooms outside the kept 3"
        )
    rooms_deleted = conn.execute(
        f"DELETE FROM Rooms WHERE Id NOT IN ({room_ph})",
        kept_room_ids,
    ).rowcount or 0
    if dp.rowcount:
        log("DELETE", f"{dp.rowcount} DevicePositions on extra racks")
    return racks_deleted, rooms_deleted


def u_overlap_count(conn: sqlite3.Connection) -> int:
    rows = conn.execute(
        """
        SELECT a.RackId
        FROM ServerPositions a
        JOIN ServerPositions b
          ON a.RackId = b.RackId
         AND a.Id < b.Id
         AND a.Status = '在架' AND b.Status = '在架'
         AND a.StartU <= b.EndU AND b.StartU <= a.EndU
        """
    ).fetchall()
    return len(rows)


def print_summary(conn: sqlite3.Connection, kept_room_ids: list[str]) -> bool:
    room_ph = ",".join("?" * len(kept_room_ids))
    room_count = conn.execute("SELECT COUNT(*) FROM Rooms").fetchone()[0]
    rack_count = conn.execute("SELECT COUNT(*) FROM Racks").fetchone()[0]
    server_count = conn.execute("SELECT COUNT(*) FROM Servers").fetchone()[0]
    cable_count = conn.execute("SELECT COUNT(*) FROM Cables").fetchone()[0]
    print("=== SEED SUMMARY ===")
    print(f"Rooms: {room_count}")
    per_room_racks: list[int] = []
    per_room_devices: list[tuple[str, int]] = []
    for rid, name in conn.execute(
        "SELECT Id, Name FROM Rooms ORDER BY CASE Name WHEN '上海机房' THEN 0 WHEN '北京机房' THEN 1 ELSE 2 END"
    ):
        n_racks = conn.execute("SELECT COUNT(*) FROM Racks WHERE RoomId = ?", (rid,)).fetchone()[0]
        n_dev = conn.execute(
            """
            SELECT COUNT(*) FROM ServerPositions p
            JOIN Racks k ON k.Id = p.RackId
            WHERE k.RoomId = ? AND p.Status = '在架'
            """,
            (rid,),
        ).fetchone()[0]
        per_room_racks.append(n_racks)
        per_room_devices.append((name, n_dev))
        print(f"  {name} id={rid} racks={n_racks} devices={n_dev}")
    print(f"Racks total: {rack_count}")
    print(f"Servers total: {server_count}")
    rack_counts = [
        r[0]
        for r in conn.execute(
            """
            SELECT COUNT(p.Id) FROM Racks k
            LEFT JOIN ServerPositions p ON p.RackId = k.Id AND p.Status = '在架'
            GROUP BY k.Id
            """
        )
    ]
    rmin = min(rack_counts) if rack_counts else 0
    rmax = max(rack_counts) if rack_counts else 0
    print(f"Devices per rack: min={rmin} max={rmax}")
    print(f"Cables total: {cable_count}")

    dangling_port = conn.execute(
        """
        SELECT COUNT(*) FROM Cables c
        WHERE NOT EXISTS (SELECT 1 FROM Ports p WHERE p.Id = c.SourcePortId)
           OR NOT EXISTS (SELECT 1 FROM Ports p WHERE p.Id = c.TargetPortId)
        """
    ).fetchone()[0]
    dangling_room = conn.execute(
        f"""
        SELECT COUNT(*) FROM Cables c
        JOIN Ports ps ON ps.Id = c.SourcePortId
        JOIN Ports pt ON pt.Id = c.TargetPortId
        LEFT JOIN ServerPositions sps ON sps.ServerId = ps.ServerId AND sps.Status = '在架'
        LEFT JOIN ServerPositions spt ON spt.ServerId = pt.ServerId AND spt.Status = '在架'
        LEFT JOIN Racks rks ON rks.Id = sps.RackId
        LEFT JOIN Racks rkt ON rkt.Id = spt.RackId
        WHERE sps.Id IS NULL OR spt.Id IS NULL
           OR rks.RoomId NOT IN ({room_ph})
           OR rkt.RoomId NOT IN ({room_ph})
        """,
        (*kept_room_ids, *kept_room_ids),
    ).fetchone()[0]
    overlaps = u_overlap_count(conn)
    oob = conn.execute(
        """
        SELECT COUNT(*) FROM ServerPositions
        WHERE Status = '在架' AND (StartU < 1 OR EndU > ? OR EndU < StartU)
        """,
        (RACK_U,),
    ).fetchone()[0]
    unpositioned = conn.execute(
        """
        SELECT COUNT(*) FROM Servers s
        WHERE NOT EXISTS (
            SELECT 1 FROM ServerPositions p WHERE p.ServerId = s.Id AND p.Status = '在架'
        )
        """
    ).fetchone()[0]
    extra_rooms = conn.execute(
        f"SELECT COUNT(*) FROM Rooms WHERE Id NOT IN ({room_ph})",
        kept_room_ids,
    ).fetchone()[0]
    print(f"Dangling cables (missing port): {dangling_port}")
    print(f"Cables to devices not in kept rooms / unpositioned: {dangling_room}")
    print(f"U overlaps: {overlaps}")
    print(f"U out of range: {oob}")
    print(f"Unpositioned servers: {unpositioned}")
    print(f"Extra rooms: {extra_rooms}")

    ok = True
    reasons: list[str] = []
    if room_count != 3:
        ok = False
        reasons.append(f"Rooms={room_count} expected 3")
    if rack_count != 30:
        ok = False
        reasons.append(f"Racks={rack_count} expected 30")
    if any(n != 10 for n in per_room_racks):
        ok = False
        reasons.append(f"per-room racks={per_room_racks} expected 10 each")
    if rmin < 1 or rmax > 42:
        ok = False
        reasons.append(f"per-rack device count min={rmin} max={rmax} out of bounds")
    if dangling_port != 0:
        ok = False
        reasons.append(f"dangling port cables={dangling_port}")
    if dangling_room != 0:
        ok = False
        reasons.append(f"cables outside kept rooms={dangling_room}")
    if overlaps != 0:
        ok = False
        reasons.append(f"U overlaps={overlaps}")
    if oob != 0:
        ok = False
        reasons.append(f"U out of range={oob}")
    if unpositioned != 0:
        ok = False
        reasons.append(f"unpositioned servers={unpositioned}")
    if extra_rooms != 0:
        ok = False
        reasons.append(f"extra rooms={extra_rooms}")
    if rmin < 18 or rmax > 20:
        # soft: still fail summary if we missed the 18–20 target and U remains
        print(f"NOTE: per-rack target 18–20 not met (min={rmin} max={rmax})")
        if rmin < 18:
            ok = False
            reasons.append(f"per-rack min={rmin} < 18")
        if rmax > 20:
            ok = False
            reasons.append(f"per-rack max={rmax} > 20")
    print("=== RESULT: PASS ===" if ok else "=== RESULT: FAIL ===")
    for r in reasons:
        print(f"  - {r}")
    return ok


def snapshot_counts(conn: sqlite3.Connection) -> tuple:
    return (
        conn.execute("SELECT COUNT(*) FROM Rooms").fetchone()[0],
        conn.execute("SELECT COUNT(*) FROM Racks").fetchone()[0],
        conn.execute("SELECT COUNT(*) FROM Servers").fetchone()[0],
        conn.execute("SELECT COUNT(*) FROM ServerPositions WHERE Status = '在架'").fetchone()[0],
        conn.execute("SELECT COUNT(*) FROM Ports").fetchone()[0],
        conn.execute("SELECT COUNT(*) FROM Cables").fetchone()[0],
    )


def main() -> None:
    if not DB_PATH.exists():
        raise SystemExit(f"Database not found: {DB_PATH}")

    conn = sqlite3.connect(DB_PATH)
    conn.isolation_level = None
    conn.execute("PRAGMA foreign_keys = ON")
    before = snapshot_counts(conn)
    log("INFO", f"before counts rooms/racks/servers/pos/ports/cables={before}")

    try:
        conn.execute("BEGIN")
        dropped = delete_non_live_positions(conn)
        if dropped:
            log("DELETE", f"{dropped} non-在架 ServerPositions")

        rooms, flat_racks = seed_kept_rooms_and_racks(conn)
        cleared_synth = clear_synthetic_live_positions(conn)
        if cleared_synth:
            log("DELETE", f"{cleared_synth} synthetic 在架 ServerPositions (rebuild)")
        occupancy: dict[str, int] = {rid: 1 for rid in flat_racks}
        counts: dict[str, int] = {rid: 0 for rid in flat_racks}

        place_existing_servers(conn, rooms, flat_racks, occupancy, counts)
        created_s = fill_synthetic_devices(conn, rooms, occupancy, counts)
        if created_s:
            log("CREATE", f"{created_s} synthetic server(s)")
        stragglers = place_stragglers(conn, flat_racks, occupancy, counts)
        if stragglers:
            log("UPDATE", f"placed {stragglers} previously unpositioned server(s)")

        intra = wire_intra_room(conn, rooms)
        inter = wire_inter_room(conn, rooms)
        if intra or inter:
            log("CREATE", f"cables intra={intra} inter={inter}")

        racks_del, rooms_del = delete_extra_racks_and_rooms(
            conn,
            [r["id"] for r in rooms],
            flat_racks,
        )
        if racks_del:
            log("DELETE", f"{racks_del} extra rack(s)")
        if rooms_del:
            log("DELETE", f"{rooms_del} extra room(s)")

        ok = print_summary(conn, [r["id"] for r in rooms])
        if not ok:
            conn.execute("ROLLBACK")
            raise SystemExit("seed validation failed; transaction rolled back")
        conn.execute("COMMIT")
    except Exception:
        try:
            conn.execute("ROLLBACK")
        except sqlite3.Error:
            pass
        raise
    finally:
        after = snapshot_counts(conn)
        log("INFO", f"after counts rooms/racks/servers/pos/ports/cables={after}")
        conn.close()
    print("Done.")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        raise
