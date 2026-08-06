#!/usr/bin/env python3
"""Create cross-room cables. Dynamically discovers switch IDs. Run: python3 seed_cables.py"""
import requests

BASE = "http://localhost:5142/api"
s = requests.Session()

# Auth
csrf = s.get(f"{BASE}/auth/csrf").headers.get("X-XSRF-TOKEN", "")
r = s.post(f"{BASE}/auth/login", json={"username": "admin", "password": "admin123"}, headers={"X-XSRF-TOKEN": csrf})
assert r.status_code == 200, f"Login failed: {r.text}"
csrf = s.get(f"{BASE}/auth/csrf").headers.get("X-XSRF-TOKEN", "")
print("Auth OK")

# Get all servers and find switches dynamically
servers = s.get(f"{BASE}/servers").json()

def is_switch(s):
    t = (s.get("deviceType") or "").lower()
    return any(k in t for k in ["交换", "switch", "路由", "router"])

def find_switch(name_pattern):
    for s in servers:
        if s["name"] == name_pattern and is_switch(s):
            return s["id"], s["name"], s.get("rackCode", "?")
    return None, None, None

TARGET_SWITCHES = [
    "net-core-sw-01", "net-core-sw-02",
    "net-agg-sw-01", "net-agg-sw-02",
    "net-router-01",
    "A02-sw-01", "B01-sw-01",
    "C01-sw-01", "D01-sw-01",
]

switch_ids = {}
for name in TARGET_SWITCHES:
    sid, sname, rack = find_switch(name)
    if sid:
        switch_ids[name] = sid
        print(f"  {name}: {sid[:8]}... rack={rack}")
    else:
        print(f"  {name}: NOT FOUND")

PORT_SPEEDS = ["10G", "10G", "1G", "1G", "10G", "10G", "10G", "10G"]
PORT_TYPES_PORT = ["SFP+", "SFP+", "RJ45", "RJ45", "SFP+", "SFP+", "SFP+", "SFP+"]

def ensure_ports(server_id, server_name, need=4):
    """Ensure server has at least `need` available (unconnected) ports."""
    r = s.get(f"{BASE}/servers/{server_id}/ports")
    ports = r.json() if r.status_code == 200 else []
    avail = [p for p in ports if not p.get("connectedCableId")]

    # Create new ports with incrementing numbers
    next_num = len(ports) + 1
    while len(avail) < need and next_num <= len(ports) + 8:
        idx = (next_num - 1) % len(PORT_SPEEDS)
        name = f"GE0/0/{next_num}"
        r = s.post(f"{BASE}/servers/{server_id}/ports",
            json={"portName": name, "portType": PORT_TYPES_PORT[idx], "speed": PORT_SPEEDS[idx]},
            headers={"X-XSRF-TOKEN": csrf})
        if r.status_code in (200, 201):
            p = r.json()
            avail.append(p)
            print(f"    + {name} on {server_name}")
        else:
            print(f"    FAIL {name} on {server_name}: {r.status_code} {r.text[:80]}")
            break  # Stop on unexpected error
        next_num += 1

    return avail

print("\n=== Ensuring ports ===")
port_pool = {}
for name, sid in switch_ids.items():
    port_pool[name] = ensure_ports(sid, name, need=4)
    print(f"  {name}: {len(port_pool[name])} available ports")

# Cross-room cable connections
CONNECTIONS = [
    ("net-core-sw-01", "net-agg-sw-01", "光纤", "黄色", "10m", "上联"),
    ("net-core-sw-02", "net-agg-sw-02", "光纤", "黄色", "10m", "上联"),
    ("net-agg-sw-01", "net-router-01", "光纤", "蓝色", "3m", "正常"),
    ("net-agg-sw-02", "net-router-01", "光纤", "蓝色", "3m", "正常"),
    ("A02-sw-01", "net-core-sw-01", "铜缆", "蓝色", "5m", "正常"),
    ("B01-sw-01", "net-core-sw-01", "铜缆", "蓝色", "5m", "正常"),
    ("net-router-01", "C01-sw-01", "光纤", "黄色", "20m", "上联"),
    ("net-router-01", "D01-sw-01", "光纤", "黄色", "20m", "上联"),
    ("C01-sw-01", "D01-sw-01", "光纤", "蓝色", "5m", "正常"),
    ("net-core-sw-01", "net-router-01", "光纤", "黄色", "15m", "上联"),
    ("net-core-sw-02", "net-agg-sw-01", "光纤", "黄色", "15m", "上联"),
    ("net-agg-sw-01", "net-agg-sw-02", "DAC", "绿色", "3m", "存储"),
]

print("\n=== Creating cables ===")
created = 0
for src_name, tgt_name, ctype, color, length, purpose in CONNECTIONS:
    src_ports = port_pool.get(src_name, [])
    tgt_ports = port_pool.get(tgt_name, [])

    if len(src_ports) < 1 or len(tgt_ports) < 1:
        print(f"  SKIP {src_name} -> {tgt_name}: need more available ports")
        continue

    sp = src_ports.pop(0)
    tp = tgt_ports.pop(0)

    r = s.post(f"{BASE}/cables",
        json={"sourcePortId": sp["id"], "targetPortId": tp["id"],
              "cableType": ctype, "color": color, "length": length, "purpose": purpose},
        headers={"X-XSRF-TOKEN": csrf})

    if r.status_code in (200, 201):
        created += 1
        print(f"  OK  {src_name}:{sp['portName']} -> {tgt_name}:{tp['portName']} ({ctype} / {purpose})")
    else:
        print(f"  FAIL {src_name} -> {tgt_name}: {r.status_code} {r.text[:120]}")

r = s.get(f"{BASE}/cables")
total = len(r.json()) if r.status_code == 200 else "?"
print(f"\nCreated {created} new cables. Total cables: {total}")
print("View: http://localhost:5173/cables")
