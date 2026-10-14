#!/usr/bin/env python3
"""Find which MemoryBear workspace the API key / end user belong to (read-only).

Calls GET {base}/v1/memory_config/read_all_config and GET {base}/v1/end_user/mapping,
printing only workspace/config/end-user identifiers. Never prints the key.

    uv run python scripts/probe_workspace.py
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request

from run_dsh import SECRETS, read_env


def _get(base: str, path: str, key: str) -> tuple[int, dict | str]:
    """Send one authenticated GET.

    Args:
        base: Base URL ending in /v1.
        path: Path with optional query string.
        key: API key used as Bearer token.

    Returns:
        tuple[int, dict | str]: HTTP status and parsed JSON (or raw text).
    """
    req = urllib.request.Request(
        f"{base}{path}",
        headers={"Authorization": f"Bearer {key}", "X-Language-Type": "zh"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            status, text = res.status, res.read().decode()
    except urllib.error.HTTPError as err:
        status, text = err.code, err.read().decode(errors="replace")
    try:
        return status, json.loads(text)
    except ValueError:
        return status, text[:500]


def main() -> int:
    """Print workspace identifiers seen by this API key.

    Returns:
        int: 0 always (diagnostic script).
    """
    file_env = read_env(SECRETS)
    get = lambda k: os.environ.get(k) or file_env.get(k, "")  # noqa: E731
    base = get("MEMORY_SERVICE_BASE_URL").rstrip("/")
    if not base.endswith("/v1"):
        base += "/v1"
    key, end_user = get("MEMORY_SERVICE_API_KEY"), get("MEMORY_ENDUSER_ID")
    print("host:", urllib.parse.urlparse(base).netloc, "| end_user_id:", end_user)

    status, body = _get(base, "/memory_config/read_all_config", key)
    print(f"\n[read_all_config] HTTP {status}")
    data = body.get("data") if isinstance(body, dict) else body
    items = data if isinstance(data, list) else (data or {}).get("items", data) if isinstance(data, dict) else data
    if isinstance(items, list):
        for c in items:
            print({k: c.get(k) for k in ("workspace_id", "config_id", "config_name", "is_default") if k in c})
    else:
        print(json.dumps(body, ensure_ascii=False)[:800])

    q = urllib.parse.urlencode({"end_user_id": end_user})
    status, body = _get(base, f"/end_user/mapping?{q}", key)
    print(f"\n[end_user/mapping] HTTP {status}")
    print(json.dumps(body.get("data") if isinstance(body, dict) else body, ensure_ascii=False)[:800])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
