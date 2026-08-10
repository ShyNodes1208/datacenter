#!/usr/bin/env python3
"""Create comprehensive cable topology: all devices connected."""
import json, random, urllib.request, urllib.error, http.cookiejar

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

# ── Login ──
api("POST", "/api/auth/login", {"username": "admin", "password": "admin123"})

# ── Get all servers grouped by rack ──
servers = api("GET", "/api/servers")["body"]
switches = [s for s in servers if "交换" in (s.get("deviceType") or "") or "switch" in (s.get("deviceType") or "").lower()]
regular_servers = [s for s in servers if s["id"] not in {sw["id"] for sw in switches}]

# Group by rack
racks = {}
for s in servers:
    rk = s.get("rackCode") or "无"
    racks.setdefault(rk, {"switches": [], "servers": []})
    if s["id"] in {sw["id"] for sw in switches}:
        racks[rk]["switches"].append(s)
    else:
        racks[rk]["servers"].append(s)

print(f"Racks: {len(racks)}")
for rk, data in sorted(racks.items()):
    print(f"  {rk}: {len(data['switches'])} switch, {len(data['servers'])} servers")

# ── Ensure all devices have ports ──
print("\n=== Creating ports on servers ===")
PORT_SPEEDS = ["10G", "10G", "1G", "1G"]
PORT_TYPES = ["SFP+", "SFP+", "RJ45", "RJ45"]

for rk, data in sorted(racks.items()):
    for dev in data["servers"]:
        ports = api("GET", f"/api/servers/{dev['id']}/ports")["body"]
        free = [p for p in ports if p.get("connectedCableId") == EMPTY_GUID]
        if len(free) >= 2:
            continue
        # Create ports
        next_num = len(ports) + 1
        while len(free) < 2:
            idx = (next_num - 1) % len(PORT_SPEEDS)
            r = api("POST", f"/api/servers/{dev['id']}/ports",
                    {"portName": f"GE0/0/{next_num}", "portType": PORT_TYPES[idx], "speed": PORT_SPEEDS[idx]})
            if r["status"] in (200, 201):
                free.append(r["body"])
            else:
                break
            next_num += 1

# ── Rebuild port pool ──
port_pool = {}
for s in servers:
    ports = api("GET", f"/api/servers/{s['id']}/ports")["body"]
    free = [p for p in ports if p.get("connectedCableId") == EMPTY_GUID]
    port_pool[s["id"]] = free

# ── Phase 1: Server → Switch (intra-rack) ──
print("\n=== Phase 1: Server → Switch connections (intra-rack) ===")
created = 0
for rk, data in sorted(racks.items()):
    if not data["switches"] or not data["servers"]:
        continue
    sw_id = data["switches"][0]["id"]
    sw_name = data["switches"][0]["name"]
    sw_ports = port_pool[sw_id]
    for srv in data["servers"]:
        srv_ports = port_pool[srv["id"]]
        if len(sw_ports) < 1 or len(srv_ports) < 1:
            continue
        sp = sw_ports.pop(0)
        tp = srv_ports.pop(0)
        r = api("POST", "/api/cables", {
            "sourcePortId": sp["id"], "targetPortId": tp["id"],
            "cableType": "铜缆", "color": "蓝色", "length": "2m", "purpose": "正常"
        })
        if r["status"] in (200, 201):
            created += 1

print(f"Server→Switch: {created} new cables")

# ── Phase 2: Cross-rack server connections ──
print("\n=== Phase 2: Cross-rack server→server (20% of servers) ===")
# Refresh port pool
for s in servers:
    ports = api("GET", f"/api/servers/{s['id']}/ports")["body"]
    port_pool[s["id"]] = [p for p in ports if p.get("connectedCableId") == EMPTY_GUID]

cross_pairs = []
for rk1 in racks:
    for rk2 in racks:
        if rk1 >= rk2:
            continue
        srv1 = random.sample(racks[rk1]["servers"], min(2, len(racks[rk1]["servers"])))
        srv2 = random.sample(racks[rk2]["servers"], min(2, len(racks[rk2]["servers"])))
        for s1 in srv1:
            for s2 in srv2:
                if random.random() < 0.3:  # 30% chance per pair
                    cross_pairs.append((s1, s2))

cross_created = 0
for s1, s2 in cross_pairs:
    sp = port_pool.get(s1["id"], [])
    tp = port_pool.get(s2["id"], [])
    if len(sp) < 1 or len(tp) < 1:
        continue
    src_port = sp.pop(0)
    tgt_port = tp.pop(0)
    r = api("POST", "/api/cables", {
        "sourcePortId": src_port["id"], "targetPortId": tgt_port["id"],
        "cableType": random.choice(["光纤", "铜缆"]),
        "color": random.choice(["黄色", "蓝色", "绿色"]),
        "length": random.choice(["5m", "10m", "15m"]),
        "purpose": random.choice(["正常", "正常", "存储"])
    })
    if r["status"] in (200, 201):
        cross_created += 1

print(f"Cross-rack server→server: {cross_created} new cables")

# ── Phase 3: Extra switch→switch mesh for rooms with many servers ──
print("\n=== Phase 3: Extra switch→switch connections ===")
for s in servers:
    ports = api("GET", f"/api/servers/{s['id']}/ports")["body"]
    port_pool[s["id"]] = [p for p in ports if p.get("connectedCableId") == EMPTY_GUID]

mesh_created = 0
used_pairs = set()
sw_list = list(switches)
random.shuffle(sw_list)
for i, s1 in enumerate(sw_list):
    for s2 in sw_list[i+1:]:
        pair = tuple(sorted([s1["id"], s2["id"]]))
        if pair in used_pairs:
            continue
        sp = port_pool.get(s1["id"], [])
        tp = port_pool.get(s2["id"], [])
        if len(sp) < 1 or len(tp) < 1:
            continue
        used_pairs.add(pair)
        src_port = sp.pop(0)
        tgt_port = tp.pop(0)
        r = api("POST", "/api/cables", {
            "sourcePortId": src_port["id"], "targetPortId": tgt_port["id"],
            "cableType": random.choice(["光纤", "DAC"]),
            "color": random.choice(["黄色", "蓝色"]),
            "length": random.choice(["10m", "20m"]),
            "purpose": "上联"
        })
        if r["status"] in (200, 201):
            mesh_created += 1

print(f"Extra switch→switch: {mesh_created} new cables")

# ── Summary ──
cables = api("GET", "/api/cables")["body"]
from collections import Counter
tc = Counter(c["cableType"] for c in cables)
print(f"\n=== Done ===")
print(f"Total: {len(cables)} cables")
print(f"Types: {dict(tc)}")
print(f"View: http://localhost:5173/topology")
