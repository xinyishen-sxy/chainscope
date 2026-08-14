"""Publish reviewed D1 content or a completed evaluation without exposing tokens."""
from __future__ import annotations
import json, os, sys, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def post(path: str, payload: dict) -> dict:
    base = os.environ["CHAIN_SCOPE_BASE_URL"].rstrip("/")
    request = urllib.request.Request(base + path, data=json.dumps(payload).encode(), headers={"Authorization":f"Bearer {os.environ['INGEST_ADMIN_TOKEN']}", "Content-Type":"application/json"}, method="POST")
    with urllib.request.urlopen(request, timeout=120) as response: return json.load(response)

def main() -> int:
    if not os.getenv("CHAIN_SCOPE_BASE_URL") or not os.getenv("INGEST_ADMIN_TOKEN"):
        print("publish skipped; CHAIN_SCOPE_BASE_URL or INGEST_ADMIN_TOKEN missing")
        return 0
    target = sys.argv[1] if len(sys.argv) > 1 else "bundle"
    if target == "bundle":
        path = ROOT / "pipeline/output/ingestion-bundle.json"
        if not path.exists(): print("bundle publish skipped; artifact missing"); return 0
        payload = json.loads(path.read_text(encoding="utf-8"))
        result = post("/api/admin/sync", payload)
    elif target == "evaluation":
        path = ROOT / "pipeline/output/evaluation-latest.json"
        if not path.exists(): print("evaluation publish skipped; artifact missing"); return 0
        payload = json.loads(path.read_text(encoding="utf-8"))
        result = post("/api/admin/evaluations", payload)
    else:
        raise SystemExit("target must be bundle or evaluation")
    print(json.dumps(result, ensure_ascii=False))
    return 0

if __name__ == "__main__": raise SystemExit(main())
