#!/usr/bin/env python3
"""Probe MemoryBear preference recall and graph endpoints (never prints the key).

    MB_ENV=test uv run python scripts/probe_pref_graph.py
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request

from run_dsh import SECRETS, read_env


def call(base: str, key: str, method: str, path: str, query: dict | None = None,
         body: dict | None = None, headers: dict | None = None) -> tuple[int, object]:
    """Send one request and return (status, parsed body or raw text).

    Args:
        base: base URL ending in /v1
        key: API key
        method: GET or POST
        path: path under /v1
        query: query parameters
        body: JSON body for POST
        headers: extra headers

    Returns:
        tuple[int, object]: HTTP status and decoded body
    """
    url = base + path + ("?" + urllib.parse.urlencode(query) if query else "")
    data = json.dumps(body).encode() if body is not None else None
    h = {"Authorization": f"Bearer {key}", **(headers or {})}
    if data is not None:
        h["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            raw = res.read().decode()
            status = res.status
    except urllib.error.HTTPError as e:
        raw, status = e.read().decode(), e.code
    try:
        return status, json.loads(raw)
    except ValueError:
        return status, raw[:300]


def main() -> int:
    """Run the probes and print truncated results.

    Returns:
        int: always 0
    """
    env = read_env(SECRETS)
    prefix = "TEST_" if os.environ.get("MB_ENV") == "test" else ""
    get = lambda k: os.environ.get(k) or env.get(prefix + k, "")  # noqa: E731
    base = get("MEMORY_SERVICE_BASE_URL").rstrip("/")
    if not base.endswith("/v1"):
        base += "/v1"
    key, uid = get("MEMORY_SERVICE_API_KEY"), get("MEMORY_ENDUSER_ID")
    show = lambda label, r: print(f"== {label}: HTTP {r[0]}\n{json.dumps(r[1], ensure_ascii=False)[:1500]}\n")  # noqa: E731

    s, users = call(base, key, "GET", "/dashboard/end_users", {"keyword": uid})
    row = next((x for x in (users.get("data") or {}).get("items", []) if x.get("end_user_id") == uid), None) \
        if isinstance(users, dict) else None
    print(f"== end_users row keys: {sorted(row.keys()) if row else None}")
    other_id = (row or {}).get("other_id") or ""
    print(f"other_id present: {bool(other_id)}\n")

    oid = {"X-End-User-Other-Id": other_id or uid}
    show("preference/recall/full", call(base, key, "GET", "/memory/preference/recall/full", headers=oid))
    show("preference/recall", call(base, key, "POST", "/memory/preference/recall",
                                   body={"current_user_message": "帮我写个 Python 脚本并安装依赖"}, headers=oid))
    r = call(base, key, "GET", "/memory/analytics/graph_data", {"end_user_id": uid, "limit": 30})
    d = r[1].get("data") if isinstance(r[1], dict) else None
    if isinstance(d, dict):
        print(f"== graph_data: HTTP {r[0]} keys={sorted(d.keys())} nodes={len(d.get('nodes', []))} "
              f"edges={len(d.get('edges', []))} stats={json.dumps(d.get('statistics'), ensure_ascii=False)[:400]}")
        if d.get("nodes"):
            print("node sample:", json.dumps(d["nodes"][0], ensure_ascii=False)[:500])
        if d.get("edges"):
            print("edge sample:", json.dumps(d["edges"][0], ensure_ascii=False)[:400])
        print()
    else:
        show("graph_data", r)
    r = call(base, key, "GET", "/memory/analytics/community_graph", {"end_user_id": uid})
    d = r[1].get("data") if isinstance(r[1], dict) else None
    print(f"== community_graph: HTTP {r[0]} keys={sorted(d.keys()) if isinstance(d, dict) else str(r[1])[:300]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
