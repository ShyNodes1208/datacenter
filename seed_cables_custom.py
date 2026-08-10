#!/usr/bin/env python3
"""Create cross-rack cable connections between existing switches."""
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

# Login
r = api("POST", "/api/auth/login", {"username": "admin", "password": "admin123"})
print(f"Login: {r['body'].get('username')}")

# Get switches
servers = api("GET", "/api/servers")["body"]
switches = [s for s in servers if "交换" in (s.get("deviceType") or "") or "switch" in (s.get("deviceType") or "").lower()]
print(f"\nFound {len(switches)} switches")

# Ensure free ports (need 4 per switch)
print("\n=== Ensuring ports ===")
PORT_SPEEDS = ["10G", "10G", "1G", "1G", "10G", "10G", "10G", "10G"]
PORT_TYPES = ["SFP+", "SFP+", "RJ45", "RJ45", "SFP+", "SFP+", "SFP+", "SFP+"]

for sw in switches:
    ports = api("GET", f"/api/servers/{sw['id']}/ports")["body"]
    free = [p for p in ports if p.get("connectedCableId") == EMPTY_GUID]
    print(f"  {sw['name']}: {len(ports)} ports, {len(free)} free")

    next_num = len(ports) + 1
    while len(free) < 4:
        idx = (next_num - 1) % len(PORT_SPEEDS)
        name = f"GE0/0/{next_num}"
        r = api("POST", f"/api/servers/{sw['id']}/ports",
                {"portName": name, "portType": PORT_TYPES[idx], "speed": PORT_SPEEDS[idx]})
        if r["status"] in (200, 201):
            free.append(r["body"])
        else:
            print(f"    FAIL {name}: {r['status']}")
            break
        next_num += 1

# Create cables between switches in different racks
print("\n=== Creating cables ===")
port_pool = {}
for sw in switches:
    ports = api("GET", f"/api/servers/{sw['id']}/ports")["body"]
    port_pool[sw["id"]] = [p for p in ports if p.get("connectedCableId") == EMPTY_GUID]

connections = []
used_pairs = set()
for i, s1 in enumerate(switches):
    targets = [s for s in switches if s["rackCode"] != s1["rackCode"]]
    random.shuffle(targets)
    count = 0
    for s2 in targets:
        if count >= 3:
            break
        pair = tuple(sorted([s1["id"], s2["id"]]))
        if pair in used_pairs:
            continue
        used_pairs.add(pair)
        connections.append((
            s1["name"], s1["id"], s2["name"], s2["id"],
            random.choice(["光纤", "光纤", "铜缆", "DAC"]),
            random.choice(["黄色", "蓝色", "绿色"]),
            random.choice(["3m", "5m", "10m", "15m", "20m"]),
            random.choice(["正常", "正常", "正常", "上联", "存储"]),
        ))
        count += 1

print(f"Planned: {len(connections)}")

created = 0
for src_name, src_id, tgt_name, tgt_id, ctype, color, length, purpose in connections:
    sp = port_pool[src_id]
    tp = port_pool[tgt_id]
    if len(sp) < 1 or len(tp) < 1:
        print(f"  SKIP {src_name} -> {tgt_name}: out of ports")
        continue

    src_port = sp.pop(0)
    tgt_port = tp.pop(0)

    r = api("POST", "/api/cables", {
        "sourcePortId": src_port["id"],
        "targetPortId": tgt_port["id"],
        "cableType": ctype, "color": color, "length": length, "purpose": purpose,
    })

    if r["status"] in (200, 201):
        created += 1
        print(f"  OK  {src_name}:{src_port['portName']} -> {tgt_name}:{tgt_port['portName']}  ({ctype}/{purpose}/{length})")
    else:
        print(f"  FAIL {src_name}->{tgt_name}: {r['status']} {str(r.get('body',''))[:100]}")

cables = api("GET", "/api/cables")["body"]
print(f"\n=== Done ===")
print(f"Created: {created} cables")
print(f"Total: {len(cables)} cables")
from collections import Counter
tc = Counter(c["cableType"] for c in cables)
pc = Counter(c.get("purpose", "?") for c in cables)
print(f"Types: {dict(tc)}")
print(f"Purposes: {dict(pc)}")
print(f"View: http://localhost:5173/cables")
