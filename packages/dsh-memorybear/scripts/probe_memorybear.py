#!/usr/bin/env python3
"""Probe the real MemoryBear V1 service with credentials from secrets.env.

Reads MEMORY_SERVICE_BASE_URL / MEMORY_SERVICE_API_KEY / MEMORY_ENDUSER_ID from
~/.config/redbear/secrets.env (env overrides) and calls POST {base}/v1/memory/read/sync.
Prints status and a truncated body only; never prints the key.

    uv run python scripts/probe_memorybear.py "<question>"
    MB_ENV=test MB_SEARCH_SWITCH=meta MB_FULL=1 uv run python scripts/probe_memorybear.py "<question>"
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request

from run_dsh import SECRETS, read_env


def main() -> int:
    """Send one read/sync request and report the outcome.

    Returns:
        int: 0 on HTTP 2xx with code 0, else 1.
    """
    file_env = read_env(SECRETS)
    prefix = "TEST_" if os.environ.get("MB_ENV") == "test" else ""
    get = lambda k: os.environ.get(k) or file_env.get(prefix + k, "")  # noqa: E731
    print(f"MemoryBear env: {'test' if prefix else 'dev'}")
    base = get("MEMORY_SERVICE_BASE_URL").rstrip("/")
    if not base.endswith("/v1"):
        base += "/v1"
    query = sys.argv[1] if len(sys.argv) > 1 else "我喜欢什么？"
    write_mode = len(sys.argv) > 2 and sys.argv[2] == "--write"
    if write_mode:
        path = "/memory/write"
        body = json.dumps({
            "messages": [
                {"role": "user", "content": query},
                {"role": "assistant", "content": "已记住"},
            ],
            "end_user_id": get("MEMORY_ENDUSER_ID"),
        }).encode()
    else:
        path = "/memory/read/sync"
        body = json.dumps({
            "message": query,
            "search_switch": os.environ.get("MB_SEARCH_SWITCH", "express"),
            "end_user_id": get("MEMORY_ENDUSER_ID"),
        }).encode()
    req = urllib.request.Request(
        f"{base}{path}",
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {get('MEMORY_SERVICE_API_KEY')}",
            "X-Language-Type": "zh",
        },
    )
    started = time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            status, text = res.status, res.read().decode()
    except urllib.error.HTTPError as err:
        status, text = err.code, err.read().decode(errors="replace")
    print(f"HTTP {status} in {time.monotonic() - started:.2f}s")
    print(text if os.environ.get("MB_FULL") else text[:1500])
    try:
        return 0 if status < 300 and json.loads(text).get("code") == 0 else 1
    except ValueError:
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
