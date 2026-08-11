#!/usr/bin/env python3
"""Seed server ports and intra-room cables for device-level topology visibility.
Run: python3 seed_device_cables.py"""
import requests
import random
import time

BASE = "http://localhost:5142/api"
s = requests.Session()

# Auth
csrf = s.get(f"{BASE}/auth/csrf").headers.get("X-XSRF-TOKEN", "")
r = s.post(f"{BASE}/auth/login", json={"username": "admin", "password": "admin123"}, headers={"X-XSRF-TOKEN": csrf})
assert r.status_code == 200, f"Login failed: {r.text}"
csrf = s.get(f"{BASE}/auth/csrf").headers.get("X-XSRF-TOKEN", "")
print("Auth OK")

# Get all servers
all_servers = s.get(f"{BASE}/servers?pageSize=500").json()
servers = all_servers if isinstance(all_servers, list) else all_servers.get("items", [])
print(f"Total servers: {len(servers)}")

# Get racks to organize by room
racks_resp = s.get(f"{BASE}/racks?pageSize=50").json()
racks = racks_resp if isinstance(racks_resp, list) else racks_resp.get("items", [])
print(f"Total racks: {len(racks)}")

# Group servers by rack
rack_servers = {}
for srv in servers:
    rc = srv.get("rackCode")
    if rc and srv.get("positionStatus") == "在架":
        rack_servers.setdefault(rc, []).append(srv)

print(f"Racks with servers: {len(rack_servers)}")
for rc, srvs in sorted(rack_servers.items()):
    print(f"  {rc}: {len(srvs)} servers")

# Group racks by room
rack_info = {}
for rk in racks:
    rack_info[rk["code"]] = rk

room_racks = {}
for rk in racks:
    rn = rk.get("roomName", rk.get("roomId", "?"))
    room_racks.setdefault(rn, []).append(rk["code"])

print(f"\nRooms with racks: {len(room_racks)}")
for rn, rks in sorted(room_racks.items()):
    print(f"  {rn}: {rks}")

PORT_SPEEDS = ["10G", "10G", "1G", "1G", "10G", "10G", "25G", "25G"]
PORT_TYPES = ["SFP+", "SFP+", "RJ45", "RJ45", "SFP+", "SFP+", "QSFP28", "QSFP28"]
CABLE_TYPES = ["光纤", "铜缆", "DAC"]
COLORS = ["蓝色", "黄色", "绿色", "橙色"]
PURPOSES = ["正常", "正常", "正常", "上联", "存储"]

def get_csrf():
    return s.get(f"{BASE}/auth/csrf").headers.get("X-XSRF-TOKEN", "")

def get_ports(server_id):
    r = s.get(f"{BASE}/servers/{server_id}/ports")
    return r.json() if r.status_code == 200 else []

def create_port(server_id, port_name, port_type, speed):
    csrf = get_csrf()
    r = s.post(f"{BASE}/servers/{server_id}/ports",
        json={"portName": port_name, "portType": port_type, "speed": speed},
        headers={"X-XSRF-TOKEN": csrf})
    return r.status_code in (200, 201)

def create_cable(src_port_id, tgt_port_id, cable_type, color, length, purpose):
    csrf = get_csrf()
    r = s.post(f"{BASE}/cables",
        json={
            "sourcePortId": src_port_id,
            "targetPortId": tgt_port_id,
            "cableType": cable_type,
            "color": color,
            "length": length,
            "purpose": purpose
        },
        headers={"X-XSRF-TOKEN": csrf})
    return r.status_code in (200, 201), r.text[:100] if r.status_code >= 400 else ""

# Ensure each server has at least min_ports available (unconnected) ports
total_ports = 0
total_cables = 0

print("\n=== Creating ports for servers ===")
for rack_code, srvs in sorted(rack_servers.items()):
    for srv in srvs:
        existing = get_ports(srv["id"])
        connected = [p for p in existing if p.get("connectedToServerName")]
        available = [p for p in existing if not p.get("connectedToServerName")]

        need = max(0, 4 - len(available))
        next_num = len(existing) + 1
        for i in range(need):
            idx = (next_num + i - 1) % len(PORT_SPEEDS)
            name = f"GE0/0/{next_num + i}"
            if create_port(srv["id"], name, PORT_TYPES[idx], PORT_SPEEDS[idx]):
                total_ports += 1
        if need > 0:
            print(f"  +{need} ports on {srv['name']} ({rack_code})")

print(f"\nTotal new ports created: {total_ports}")

# Create cables: within each rack, chain servers together
print("\n=== Creating intra-rack cables ===")
for rack_code, srvs in sorted(rack_servers.items()):
    if len(srvs) < 2:
        continue

    # Sort servers by name for consistent ordering
    srvs.sort(key=lambda s: s["name"])

    cable_count = 0
    for i in range(len(srvs) - 1):
        src = srvs[i]
        tgt = srvs[i + 1]

        ps = get_ports(src["id"])
        pt = get_ports(tgt["id"])

        src_avail = [p for p in ps if not p.get("connectedToServerName")]
        tgt_avail = [p for p in pt if not p.get("connectedToServerName")]

        if not src_avail or not tgt_avail:
            continue

        sp = src_avail[0]
        tp = tgt_avail[0]

        ct = random.choice(CABLE_TYPES)
        ok, err = create_cable(sp["id"], tp["id"], ct,
            random.choice(COLORS), f"{random.randint(1,5)}m", random.choice(PURPOSES))
        if ok:
            cable_count += 1
            total_cables += 1

    if cable_count > 0:
        print(f"  {rack_code}: {cable_count} intra-rack cables ({len(srvs)} servers)")

# Create cross-rack cables within same room
print("\n=== Creating cross-rack cables (same room) ===")
for room_name, rack_codes in sorted(room_racks.items()):
    if len(rack_codes) < 2:
        continue

    for i in range(len(rack_codes) - 1):
        rc_a = rack_codes[i]
        rc_b = rack_codes[i + 1]

        srvs_a = rack_servers.get(rc_a, [])
        srvs_b = rack_servers.get(rc_b, [])

        if not srvs_a or not srvs_b:
            continue

        # Connect middle server from each rack
        s_a = srvs_a[len(srvs_a)//2]
        s_b = srvs_b[len(srvs_b)//2]

        ps_a = get_ports(s_a["id"])
        ps_b = get_ports(s_b["id"])

        a_avail = [p for p in ps_a if not p.get("connectedToServerName")]
        b_avail = [p for p in ps_b if not p.get("connectedToServerName")]

        if not a_avail or not b_avail:
            continue

        ok, err = create_cable(a_avail[0]["id"], b_avail[0]["id"],
            random.choice(CABLE_TYPES), random.choice(COLORS),
            f"{random.randint(5,15)}m", random.choice(PURPOSES))
        if ok:
            total_cables += 1
            print(f"  {rc_a} <-> {rc_b} ({s_a['name']} -> {s_b['name']})")

# Create a few cross-room cables
print("\n=== Creating cross-room cables ===")
room_list = sorted(room_racks.items())
for i in range(min(5, len(room_list) - 1)):
    rn_a, rks_a = room_list[i]
    rn_b, rks_b = room_list[i + 1]

    if not rks_a or not rks_b:
        continue

    srvs_a = rack_servers.get(rks_a[0], [])
    srvs_b = rack_servers.get(rks_b[0], [])

    if not srvs_a or not srvs_b:
        continue

    s_a = srvs_a[0]
    s_b = srvs_b[0]

    ps_a = get_ports(s_a["id"])
    ps_b = get_ports(s_b["id"])

    a_avail = [p for p in ps_a if not p.get("connectedToServerName")]
    b_avail = [p for p in ps_b if not p.get("connectedToServerName")]

    if not a_avail or not b_avail:
        continue

    ok, err = create_cable(a_avail[0]["id"], b_avail[0]["id"],
        "光纤", "黄色", f"{random.randint(10,30)}m", "上联")
    if ok:
        total_cables += 1
        print(f"  {rn_a} <-> {rn_b} ({s_a['name']} -> {s_b['name']})")

print(f"\n=== Summary ===")
print(f"New ports: {total_ports}")
print(f"New cables: {total_cables}")

# Verify cable-scene for AC-7b5ccb
print("\n=== Verify cable-scene (AC-7b5ccb) ===")
room_id = None
for rk in racks:
    if rk.get("roomName") == "AC-7b5ccb":
        room_id = rk.get("roomId")
        break

if room_id:
    r = s.get(f"{BASE}/rooms/{room_id}/cable-scene")
    data = r.json()
    print(f"  Devices: {len(data.get('devices', []))}")
    print(f"  Cables: {len(data.get('cables', []))}")
    print(f"  Device types: {list(set(d['deviceType'] for d in data.get('devices', [])))}")
    # Count cables by source/target to see server-server connections
    server_cables = 0
    for c in data.get("cables", []):
        src = c.get("source", {})
        tgt = c.get("target", {})
        if "srv" in src.get("deviceName", "").lower() and "srv" in tgt.get("deviceName", "").lower():
            server_cables += 1
    print(f"  Server-to-server cables: {server_cables}")
else:
    print("  Room not found")
