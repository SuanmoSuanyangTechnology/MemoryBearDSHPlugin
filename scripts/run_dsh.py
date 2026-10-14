#!/usr/bin/env python3
"""Run one dsh turn on the `memorybear` profile with credentials from env files.

Keys are read from ~/.config/redbear/secrets.env (falling back to the benchmark
project's .env) and passed only through the child environment -- never on the
command line or in the profile config.

    uv run python scripts/run_dsh.py "<task text>"            # real MemoryBear service
    MEMORY_SERVICE_BASE_URL=http://127.0.0.1:18765 MEMORY_SERVICE_API_KEY=mock \
        uv run python scripts/run_dsh.py "<task>"             # mock server
    DSH_PROFILE=memorybear-web uv run python scripts/run_dsh.py --host 127.0.0.1 --port 8790 --no-open  # web UI
    MB_ENV=test uv run python scripts/run_dsh.py "<task>"    # test env: reads TEST_MEMORY_* from secrets.env
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

SECRETS = Path.home() / ".config/redbear/secrets.env"
# Optional extra dotenv file, e.g. DSH_MEMORYBEAR_ENV_FILE=~/path/to/.env
_fallback = os.environ.get("DSH_MEMORYBEAR_ENV_FILE", "")
FALLBACK_ENV = Path(_fallback).expanduser() if _fallback else Path("/nonexistent")


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
    """Resolve credentials and exec `dsh --profile memorybear <args>`.

    Returns:
        int: dsh's exit status, or 1/2 on missing credentials/usage.
    """
    if len(sys.argv) < 2:
        print("usage: run_dsh.py <task text>", file=sys.stderr)
        return 2
    sources = [os.environ, read_env(SECRETS), read_env(FALLBACK_ENV)]

    def lookup(name: str) -> str | None:
        return next((src[name] for src in sources if src.get(name)), None)

    # MB_ENV=test reads TEST_MEMORY_* and passes them to dsh under the plain names.
    mb_env = os.environ.get("MB_ENV", "dev")
    if mb_env not in ("dev", "test"):
        print(f"MB_ENV must be dev or test, got {mb_env!r}", file=sys.stderr)
        return 2
    prefix = "TEST_" if mb_env == "test" else ""
    memory_names = ("MEMORY_SERVICE_BASE_URL", "MEMORY_SERVICE_API_KEY", "MEMORY_ENDUSER_ID")

    env = dict(os.environ)
    missing = []
    for name in ("SPEEDBEAR_API_KEY", *memory_names):
        source_name = prefix + name if name in memory_names else name
        # An explicit plain-name override in the shell (e.g. the mock URL) still wins.
        value = os.environ.get(name) or lookup(source_name)
        name_for_error = source_name
        if value:
            env[name] = value
        else:
            missing.append(name_for_error)
    if missing:
        print(f"missing credentials ({mb_env}): {', '.join(missing)}", file=sys.stderr)
        return 1
    print(f"[run_dsh] MemoryBear env: {mb_env}", file=sys.stderr)
    profile = os.environ.get("DSH_PROFILE", "memorybear")
    return subprocess.run(["dsh", "--profile", profile, *sys.argv[1:]], env=env, check=False).returncode


if __name__ == "__main__":
    raise SystemExit(main())
