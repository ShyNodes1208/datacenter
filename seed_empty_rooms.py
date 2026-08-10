#!/usr/bin/env python3
"""Fill empty rooms with racks, servers, switches, and cables."""
import json, random, uuid, urllib.request, urllib.error, http.cookiejar

BASE = "http://localhost:5142"
EMPTY_GUID = "00000000-0000-0000-0000-000000000000"
CJ = http.cookiejar.CookieJar()
OP = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(CJ))

def csrf():
    return OP.open(urllib.request.Request(f"{BASE}/api/auth/csrf")).headers.get("X-Xsrf-Token", "")

def api(method, path, body=None):
    url = f"{BASE}{path}"
    token = csrf()
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(url, data=data, method=method)
    if body: r.add_header("Content-Type", "application/json")
    if token: r.add_header("X-XSRF-TOKEN", token)
    try:
        resp = OP.open(r)
        raw = resp.read().decode()
        return {"status": resp.status, "body": json.loads(raw) if raw else None}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try: j = json.loads(raw)
        except: j = {"raw": raw}
        return {"status": e.code, "body": j}

def uid(): return str(uuid.uuid4())

# ── Login ──
api("POST", "/api/auth/login", {"username": "admin", "password": "admin123"})

# ── Get current state ──
rooms = api("GET", "/api/rooms")["body"]
racks = api("GET", "/api/racks")["body"]
servers = api("GET", "/api/servers")["body"]

# Find empty/underpopulated rooms
room_racks = {}
for rk in racks:
    room_racks.setdefault(rk["roomId"], []).append(rk)

# Also count servers per room
rack_ids_by_room = {}
for rid, rks in room_racks.items():
    rack_ids_by_room[rid] = {r["id"] for r in rks}

empty_rooms = []
for room in rooms:
    rid = room["id"]
    rk_count = len(room_racks.get(rid, []))
    if rk_count == 0:
        empty_rooms.append(room)

print(f"Empty rooms to fill: {len(empty_rooms)}")
for r in empty_rooms:
    print(f"  {r['name']} ({r['id'][:8]}...)")

# ── Fill each empty room ──
PORT_SPEEDS = ["10G", "10G", "1G", "1G"]
PORT_TYPES = ["SFP+", "SFP+", "RJ45", "RJ45"]

existing_names = {s["name"] for s in servers}
existing_ips = {s.get("managementIP", "") for s in servers}

total_racks = 0
total_servers = 0
total_switches = 0
all_new_switch_ids = []

for room in empty_rooms:
    rid = room["id"]
    rname = room["name"]
    # 1-2 racks per room
    n_racks = random.randint(1, 2)
    room_rack_ids = []

    for i in range(n_racks):
        rcode = f"R-{rname[:6].upper()}-{i+1:02d}"
        r = api("POST", "/api/racks", {
            "roomId": rid, "code": rcode, "heightU": 42,
            "status": "启用", "x": random.uniform(0, 5), "y": random.uniform(0, 5), "z": 0
        })
        if r["status"] in (200, 201):
            rack_id = r["body"]["id"]
            room_rack_ids.append(rack_id)
            total_racks += 1

    if not room_rack_ids:
        continue

    # Create switch + servers in each rack
    for rack_id in room_rack_ids:
        rcode = next((rk["code"] for rk in api("GET", "/api/racks")["body"] if rk["id"] == rack_id), f"R-{rname[:4]}")

        # Create switch
        sw_name = f"{rcode}-sw-01"
        while sw_name in existing_names:
            sw_name = f"{rcode}-sw-{random.randint(2,99):02d}"
        sw_ip = f"10.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,250)}"
        while sw_ip in existing_ips:
            sw_ip = f"10.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,250)}"

        sw = api("POST", "/api/servers", {
            "name": sw_name, "managementIP": sw_ip,
            "deviceType": "交换机", "deviceHeight": 1
        })
        if sw["status"] == 201:
            sw_id = sw["body"]["id"]
            existing_names.add(sw_name)
            existing_ips.add(sw_ip)
            all_new_switch_ids.append(sw_id)
            total_switches += 1

            # Install switch in rack at U1
            api("POST", f"/api/servers/{sw_id}/rack", {"rackId": rack_id, "startU": 1})

            # Create ports on switch
            for pn in range(1, 33):
                idx = (pn - 1) % len(PORT_SPEEDS)
                api("POST", f"/api/servers/{sw_id}/ports",
                    {"portName": f"GE0/0/{pn}", "portType": PORT_TYPES[idx], "speed": PORT_SPEEDS[idx]})

        # Fill servers to 60-80%
        target_ratio = random.uniform(0.60, 0.80)
        target_u = max(1, round(42 * target_ratio))
        current_u = 1  # switch occupies U1
        srv_num = 1

        while current_u < target_u:
            h = random.choice([2, 2, 2, 2, 2, 1, 1, 1, 4, 4])
            if current_u + h > 42:
                continue

            srv_name = f"{rcode}-srv-{srv_num:02d}"
            while srv_name in existing_names:
                srv_num += 1
                srv_name = f"{rcode}-srv-{srv_num:02d}"

            srv_ip = f"10.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(100,250)}"
            while srv_ip in existing_ips:
                srv_ip = f"10.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(100,250)}"

            r = api("POST", "/api/servers", {
                "name": srv_name, "managementIP": srv_ip,
                "deviceType": "服务器", "deviceHeight": h
            })
            if r["status"] != 201:
                continue

            srv_id = r["body"]["id"]
            existing_names.add(srv_name)
            existing_ips.add(srv_ip)
            total_servers += 1

            # Install in rack
            api("POST", f"/api/servers/{srv_id}/rack", {"rackId": rack_id, "startU": current_u + 1})

            # Create ports
            for pn in range(1, 3):
                idx = (pn - 1) % len(PORT_SPEEDS)
                api("POST", f"/api/servers/{srv_id}/ports",
                    {"portName": f"GE0/0/{pn}", "portType": PORT_TYPES[idx], "speed": PORT_SPEEDS[idx]})

            current_u += h
            srv_num += 1

        print(f"  {rcode}: {current_u}/42U ({round(current_u/42*100)}%)")

print(f"\nCreated: {total_racks} racks, {total_switches} switches, {total_servers} servers")

# ── Phase 2: Cable all new devices ──
print("\n=== Cabling new devices ===")

servers = api("GET", "/api/servers")["body"]
switches = [s for s in servers if "交换" in (s.get("deviceType") or "") or "switch" in (s.get("deviceType") or "").lower()]
regular_srv = [s for s in servers if s["id"] not in {sw["id"] for sw in switches}]

# Build port pool
port_pool = {}
for s in servers:
    ports = api("GET", f"/api/servers/{s['id']}/ports")["body"]
    port_pool[s["id"]] = [p for p in ports if p.get("connectedCableId") == EMPTY_GUID]

# Server → switch (intra-rack)
racks_by_code = {}
for rk in api("GET", "/api/racks")["body"]:
    racks_by_code[rk["code"]] = rk["id"]

srv_by_rack = {}
for s in regular_srv:
    rcode = s.get("rackCode") or "?"
    srv_by_rack.setdefault(rcode, []).append(s)

intra_created = 0
for rcode, srvs in srv_by_rack.items():
    sw = next((s for s in switches if s.get("rackCode") == rcode), None)
    if not sw:
        continue
    sw_ports = port_pool.get(sw["id"], [])
    for srv in srvs:
        sp = port_pool.get(srv["id"], [])
        if len(sw_ports) < 1 or len(sp) < 1:
            continue
        r = api("POST", "/api/cables", {
            "sourcePortId": sw_ports.pop(0)["id"],
            "targetPortId": sp.pop(0)["id"],
            "cableType": "铜缆", "color": "蓝色", "length": "2m", "purpose": "正常"
        })
        if r["status"] in (200, 201):
            intra_created += 1

print(f"Intra-rack server→switch: {intra_created}")

# Refresh pool
for s in servers:
    ports = api("GET", f"/api/servers/{s['id']}/ports")["body"]
    port_pool[s["id"]] = [p for p in ports if p.get("connectedCableId") == EMPTY_GUID]

# Cross-rack: new switches connect to existing switches
cross_created = 0
old_switches = [s for s in switches if s["id"] not in all_new_switch_ids]
for new_sw_id in all_new_switch_ids:
    targets = random.sample(old_switches, min(3, len(old_switches)))
    for tgt in targets:
        sp = port_pool.get(new_sw_id, [])
        tp = port_pool.get(tgt["id"], [])
        if len(sp) < 1 or len(tp) < 1:
            continue
        r = api("POST", "/api/cables", {
            "sourcePortId": sp.pop(0)["id"],
            "targetPortId": tp.pop(0)["id"],
            "cableType": random.choice(["光纤", "DAC"]),
            "color": random.choice(["黄色", "蓝色"]),
            "length": random.choice(["10m", "20m"]),
            "purpose": "上联"
        })
        if r["status"] in (200, 201):
            cross_created += 1

print(f"Cross-rack switch→switch: {cross_created}")

# ── Final stats ──
cables = api("GET", "/api/cables")["body"]
servers_final = api("GET", "/api/servers")["body"]
racks_final = api("GET", "/api/racks")["body"]
print(f"\n=== Final ===")
print(f"Rooms: {len(rooms)}")
print(f"Racks: {len(racks_final)}")
print(f"Servers: {len(servers_final)}")
print(f"Cables: {len(cables)}")
print(f"View topology: http://localhost:5173/topology")
