#!/usr/bin/env python3
"""Create (or fetch) the dsh end user in a MemoryBear workspace.

POST {base}/v1/end_user/create is idempotent per other_id: calling it again
returns the existing end user. Prints the response; never prints the key.

    MB_ENV=test uv run python scripts/create_end_user.py [other_id]
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

from run_dsh import SECRETS, read_env


def main() -> int:
    """Create the end user and print its id.

    Returns:
        int: 0 when the service returns code 0, else 1.
    """
    file_env = read_env(SECRETS)
    prefix = "TEST_" if os.environ.get("MB_ENV") == "test" else ""
    base = file_env.get(prefix + "MEMORY_SERVICE_BASE_URL", "").rstrip("/")
    if not base.endswith("/v1"):
        base += "/v1"
    other_id = sys.argv[1] if len(sys.argv) > 1 else "dsh-memorybear"
    req = urllib.request.Request(
        f"{base}/end_user/create",
        data=json.dumps({"other_id": other_id, "other_name": "dsh-memorybear"}).encode(),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {file_env.get(prefix + 'MEMORY_SERVICE_API_KEY', '')}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            status, text = res.status, res.read().decode()
    except urllib.error.HTTPError as err:
        status, text = err.code, err.read().decode(errors="replace")
    print(f"MemoryBear env: {'test' if prefix else 'dev'} HTTP {status}")
    print(text)
    try:
        return 0 if json.loads(text).get("code") == 0 else 1
    except ValueError:
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
