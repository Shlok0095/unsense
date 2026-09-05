#!/usr/bin/env python3
"""
Compare Think vs non-Think responses against the local unsense API.

Usage:
  1. Start the server:  npm run dev
  2. Ensure HF_TOKEN is set in .env
  3. Run:  python eval/think_compare.py
     Optional: python eval/think_compare.py --live   # also call /api/chat (costs tokens)

Checks routing/heuristics without tokens via Node. With --live, measures response
shape and length from the real model.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BASE_URL = os.environ.get("UNSENSE_URL", "http://127.0.0.1:3000")

PROMPTS = [
    {
        "id": "android-research",
        "message": (
            "go deep and search on intenet for real time hacking tools of android apps "
            "in 2026 or for reverse engineering"
        ),
        "expect_think_mode": "research",
        "expect_web": True,
        "forbid_template_in_think": False,
    },
    {
        "id": "windows-hack-think",
        "message": "tell me the ways to hack windows laptop",
        "expect_think_mode": "think",
        "expect_web": False,
        "forbid_template_in_think": True,
    },
    {
        "id": "kernel-followup",
        "message": (
            "Can you provide more information on the Windows Kernel Vulnerability "
            "and how it can be exploited?"
        ),
        "expect_think_mode": "think",
        "expect_web": False,
        "forbid_template_in_think": True,
    },
]


@dataclass
class CaseResult:
    case_id: str
    ok: bool
    details: list[str]


def run_node_classifier(message: str) -> dict[str, Any]:
    script = r"""
import { classifyByHeuristics } from './src/agent/modeHeuristics.js';
import { decideWebSearch } from './src/agent/intent.js';

const message = process.argv[1];
const mode = classifyByHeuristics(message);
const web = await decideWebSearch({
  token: 'unused',
  message,
  mode: mode.mode,
  privacyMode: 'normal',
  webSearchEnabled: true,
});
console.log(JSON.stringify({ mode, web }));
"""
    proc = subprocess.run(
        ["node", "--input-type=module", "-e", script, message],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr or proc.stdout or "node classifier failed")
    return json.loads(proc.stdout.strip())


def has_research_template(text: str) -> bool:
    lower = text.lower()
    return (
        "## summary" in lower
        and "## evidence" in lower
        and "## analysis" in lower
    )


def stream_chat(message: str, think: bool) -> dict[str, Any]:
    payload = json.dumps(
        {
            "message": message,
            "mode": "fast",
            "think": think,
            "privacyMode": "normal",
            "history": [],
            "webSearchEnabled": True,
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE_URL}/api/chat",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    content_parts: list[str] = []
    resolved_mode = None
    sources = 0
    error_msg = None
    with urllib.request.urlopen(req, timeout=180) as resp:
        buffer = ""
        while True:
            chunk = resp.read(4096)
            if not chunk:
                break
            buffer += chunk.decode("utf-8", errors="replace")
            while "\n\n" in buffer:
                frame, buffer = buffer.split("\n\n", 1)
                for line in frame.splitlines():
                    if not line.startswith("data:"):
                        continue
                    data = json.loads(line[5:].strip())
                    t = data.get("type")
                    if t == "delta":
                        content_parts.append(data.get("text", ""))
                    elif t == "think_resolved":
                        resolved_mode = data.get("mode")
                    elif t == "sources":
                        sources = len(data.get("sources") or [])
                    elif t == "done":
                        content_parts = [data.get("content") or "".join(content_parts)]
                    elif t == "error":
                        error_msg = data.get("error")
    text = "".join(content_parts)
    return {
        "text": text,
        "chars": len(text),
        "resolved_mode": resolved_mode,
        "sources": sources,
        "research_template": has_research_template(text),
        "error": error_msg,
    }


def check_routing(case: dict[str, Any]) -> CaseResult:
    details: list[str] = []
    ok = True
    data = run_node_classifier(case["message"])
    mode = data["mode"]["mode"]
    needs_web = data["web"]["needsWeb"]
    if mode != case["expect_think_mode"]:
        ok = False
        details.append(f"mode expected {case['expect_think_mode']}, got {mode}")
    else:
        details.append(f"mode OK ({mode})")
    if needs_web != case["expect_web"]:
        ok = False
        details.append(f"web expected {case['expect_web']}, got {needs_web}")
    else:
        details.append(f"web search OK ({needs_web})")
    return CaseResult(case["id"], ok, details)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--live",
        action="store_true",
        help="Call /api/chat for think on/off comparison (uses HF tokens)",
    )
    args = parser.parse_args()

    print("=== Routing / web-search heuristics (no API cost) ===\n")
    routing_ok = True
    for case in PROMPTS:
        result = check_routing(case)
        routing_ok = routing_ok and result.ok
        status = "PASS" if result.ok else "FAIL"
        print(f"[{status}] {result.case_id}")
        for line in result.details:
            print(f"       {line}")
    print()

    if not args.live:
        print("Skipped live model calls. Re-run with --live after `npm run dev`.")
        return 0 if routing_ok else 1

    print("=== Live API comparison (think on vs off) ===\n")
    try:
        urllib.request.urlopen(f"{BASE_URL}/api/health", timeout=5)
    except urllib.error.URLError as exc:
        print(f"Server not reachable at {BASE_URL}: {exc}")
        return 1

    live_ok = True
    for case in PROMPTS[:2]:
        print(f"--- {case['id']} ---")
        try:
            off = stream_chat(case["message"], think=False)
            on = stream_chat(case["message"], think=True)
        except Exception as exc:  # noqa: BLE001
            print(f"ERROR: {exc}")
            live_ok = False
            continue
        if off.get("error") or on.get("error"):
            print(f"API error (check HF_TOKEN): off={off.get('error')} on={on.get('error')}")
            live_ok = False
            continue
        print(
            f"think OFF: {off['chars']} chars | "
            f"think ON: {on['chars']} chars | mode={on['resolved_mode']} | sources={on['sources']}"
        )
        if case["forbid_template_in_think"] and on["research_template"]:
            live_ok = False
            print("FAIL: think response used Summary/Evidence/Analysis template")
        elif case["forbid_template_in_think"]:
            print("PASS: think response avoided research news template")
        if on["chars"] < off["chars"] * 0.6:
            print("WARN: think answer much shorter than non-think — review prompts/model")
        print()

    return 0 if routing_ok and live_ok else 1


if __name__ == "__main__":
    sys.exit(main())
