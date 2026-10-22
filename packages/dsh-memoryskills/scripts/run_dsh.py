#!/usr/bin/env python3
"""Run dsh on the `memoryskills` profile with credentials from secrets.env.

Keys are read from ~/.config/redbear/secrets.env and passed only through the
child environment -- never on the command line or in the profile config.

    uv run python scripts/run_dsh.py "<task text>"                 # one headless turn
    uv run python scripts/run_dsh.py --session <id> "<task text>"  # resume a session
    DSH_PROFILE=memoryskills-web uv run python scripts/run_dsh.py --host 127.0.0.1 --port 8791 --no-open
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

SECRETS = Path.home() / ".config/redbear/secrets.env"
PASSTHROUGH = (
    "MEMORYSKILLS_BASE_URL",
    "MEMORYSKILLS_API_KEY",
    "DASHSCOPE_API_KEY",
    "SPEEDBEAR_API_KEY",
    "NEWAPI_API_KEY",
)


def read_env(path: Path) -> dict[str, str]:
    """Parse a dotenv file into a mapping, ignoring comments and blank lines.

    Args:
        path: dotenv file to read; a missing file yields an empty mapping.

    Returns:
        dict[str, str]: key/value pairs with surrounding quotes stripped.
    """
    if not path.exists():
        return {}
    values: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        values[key.strip().removeprefix("export ").strip()] = value.strip().strip("'\"")
    return values


def main() -> int:
    """Resolve credentials and run `dsh --profile memoryskills <args>`.

    Returns:
        int: dsh's exit status, or 1/2 on missing credentials/usage.
    """
    if len(sys.argv) < 2:
        print("usage: run_dsh.py <dsh args...>", file=sys.stderr)
        return 2
    secrets = read_env(SECRETS)
    env = dict(os.environ)
    for name in PASSTHROUGH:
        value = os.environ.get(name) or secrets.get(name)
        if value:
            env[name] = value
    if not env.get("MEMORYSKILLS_API_KEY"):
        print("missing MEMORYSKILLS_API_KEY", file=sys.stderr)
        return 1
    portal = env.get("MEMORYSKILLS_BASE_URL", "https://memoryskills.redbearai.com (default)")
    print(f"[run_dsh] MemorySkills portal: {portal}", file=sys.stderr)
    profile = os.environ.get("DSH_PROFILE", "memoryskills")
    return subprocess.run(["dsh", "--profile", profile, *sys.argv[1:]], env=env, check=False).returncode


if __name__ == "__main__":
    raise SystemExit(main())
