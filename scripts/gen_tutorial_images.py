"""Generate tutorial illustrations with the Gemini image API.

Reads GEMINI_API_KEY from ~/.config/redbear/secrets.env (never printed).

Usage:
    python3 scripts/gen_tutorial_images.py --list-models
    python3 scripts/gen_tutorial_images.py --only cover,architecture
"""

import argparse
import base64
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "docs" / "待阅读" / "AI" / "dsh-教程-img"
API = "https://generativelanguage.googleapis.com/v1beta"

STYLE = (
    "Clean modern technical illustration, flat vector style, soft gradients, "
    "dark navy background with teal, violet and amber accents, generous spacing, "
    "16:9 landscape. All labels in short ENGLISH words, spelled exactly as given, "
    "crisp legible sans-serif font. No extra text, no watermark, no logos."
)

PROMPTS = {
    "cover": (
        "Hero cover illustration for a developer tutorial titled 'DeepSeek Harness Plugin Guide'. "
        "A friendly glowing terminal window in the center, with plugin puzzle pieces snapping into "
        "it from around, one puzzle piece shaped like a small brain labelled 'memory'. "
        "Title text at top exactly: 'dsh plugins'."
    ),
    "architecture": (
        "Software architecture diagram. A large rounded container labelled 'Cordis app (dsh)'. Inside it, "
        "a row of five equal plugin blocks side by side with NO arrows between them, labelled "
        "'model adapter', 'tool registry', 'agent loop', 'session store', 'web server', all tagged 'built-in plugin'. "
        "Below that row, one highlighted amber block labelled 'your plugin' with three small tags: "
        "'ctx.tools.register', 'ctx.on', 'ctx.provide'. "
        "Outside the container: on top 'Terminal / Web / headless' with an arrow into the container; "
        "at the bottom 'LLM API' connected to 'model adapter'; on the right 'MemoryBear service' "
        "connected by a dashed arrow to 'your plugin'."
    ),
    "config-layers": (
        "Diagram of four stacked translucent glass sheets in isometric view, each a config layer, "
        "labelled bottom to top exactly: '1 bundle patch', '2 profile patch', '3 home patch', '4 CLI patch'. "
        "No other small text on the sheets. "
        "An arrow from the top sheet points to a final card labelled 'final config'."
    ),
    "turn-timeline": (
        "Horizontal timeline of one agent turn with EXACTLY seven milestone dots, each label used once, in order exactly: "
        "'turn/start', 'agent/pre-step', 'agent/request', 'llm/stream', 'tools/execute', 'tools/result', 'turn/end'. "
        "Small icon above each dot (flag, funnel, lock, cloud, wrench, check mark, finish flag). "
        "One long curved arrow ABOVE the timeline goes from the 'tools/result' dot back left to the "
        "'agent/pre-step' dot, labelled 'step 2'."
    ),
    "onion": (
        "Onion model diagram: two concentric rings around a core labelled 'built-in'. Outer ring labelled "
        "'plugin A', inner ring labelled 'plugin B'. A curved arrow goes inward labelled 'next()' and "
        "another arrow returns outward labelled 'return value'."
    ),
    "memory-flow": (
        "Data-flow diagram for a memory plugin, three columns left to right. "
        "Column 1 'first turn': box 'load profile (meta)' with arrow from a database cylinder 'MemoryBear'. "
        "Column 2 'during turn': box 'model' calling tool box 'memory_search' which queries the same 'MemoryBear' cylinder. "
        "Column 3 'turn/end': box 'write memory' with arrow back into the 'MemoryBear' cylinder. "
        "The single 'MemoryBear' cylinder sits below all three columns."
    ),
}


def load_key() -> str:
    """Read GEMINI_API_KEY from env or secrets.env without printing it.

    Returns:
        str: The API key.

    Raises:
        SystemExit: If the key cannot be found.
    """
    key = os.environ.get("GEMINI_API_KEY")
    if key:
        return key
    path = Path.home() / ".config" / "redbear" / "secrets.env"
    for line in path.read_text().splitlines():
        m = re.match(r"\s*(?:export\s+)?GEMINI_API_KEY\s*=\s*['\"]?([^'\"\s]+)", line)
        if m:
            return m.group(1)
    sys.exit("GEMINI_API_KEY not found")


def request(url: str, key: str, body: dict | None = None) -> dict:
    """Send a JSON request to the Gemini API.

    Args:
        url: Full endpoint URL.
        key: API key (sent as header, never in URL).
        body: Optional JSON body; GET when None.

    Returns:
        dict: Parsed JSON response.
    """
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url, data=data, headers={"x-goog-api-key": key, "Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        return json.loads(resp.read())


def main() -> None:
    """Entry point: list image models or generate selected images."""
    ap = argparse.ArgumentParser()
    ap.add_argument("--list-models", action="store_true")
    ap.add_argument("--model", default="gemini-3-pro-image-preview,gemini-3-pro-image,gemini-3.1-flash-image")
    ap.add_argument("--only", default=",".join(PROMPTS))
    ap.add_argument("--retries", type=int, default=4)
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    key = load_key()

    if args.list_models:
        models = request(f"{API}/models?pageSize=1000", key)["models"]
        for m in models:
            if "image" in m["name"] or "imagen" in m["name"]:
                print(m["name"], m.get("supportedGenerationMethods"))
        return

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    models = args.model.split(",")
    for name in args.only.split(","):
        if not args.force and any(OUT_DIR.glob(f"{name}.*")):
            print(name, "exists, skip", flush=True)
            continue
        body = {
            "contents": [{"parts": [{"text": PROMPTS[name] + " " + STYLE}]}],
            "generationConfig": {"responseModalities": ["IMAGE"], "imageConfig": {"aspectRatio": "16:9"}},
        }
        resp = None
        # 503 "high demand" is common: retry each model a few times, then fall back to the next.
        for attempt in range(args.retries * len(models)):
            model = models[attempt // args.retries]
            try:
                resp = request(f"{API}/models/{model}:generateContent", key, body)
                print(name, "model", model, flush=True)
                break
            except urllib.error.HTTPError as e:
                print(name, model, "HTTP", e.code, flush=True)
                time.sleep(15)
            except (urllib.error.URLError, TimeoutError) as e:
                print(name, model, type(e).__name__, flush=True)
                time.sleep(15)
        if resp is None:
            continue
        parts = resp.get("candidates", [{}])[0].get("content", {}).get("parts", [])
        img = next((p["inlineData"] for p in parts if "inlineData" in p), None)
        if not img:
            print(name, "no image", json.dumps(resp)[:300])
            continue
        ext = "png" if "png" in img["mimeType"] else "jpg"
        out = OUT_DIR / f"{name}.{ext}"
        out.write_bytes(base64.b64decode(img["data"]))
        print(name, "ok", out.name, out.stat().st_size)


if __name__ == "__main__":
    main()
