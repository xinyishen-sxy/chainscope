"""Run four retrieval ablations against the deployed, protected evaluation API."""
from __future__ import annotations
import json, os, time, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATASET = ROOT / "evaluation/questions.json"
OUTPUT = ROOT / "pipeline/output/predictions.json"

def main() -> int:
    base, token = os.getenv("CHAIN_SCOPE_BASE_URL"), os.getenv("EVALUATION_ADMIN_TOKEN")
    if not base or not token:
        print("retrieval evaluation skipped; deployment URL or token missing")
        return 0
    questions = json.loads(DATASET.read_text(encoding="utf-8")); methods = {}
    for method in ("keyword", "vector", "hybrid", "rerank"):
        rows = []
        for question in questions:
            params = urllib.parse.urlencode({"q":question["question"], "topic":question["topic"], "method":method})
            request = urllib.request.Request(f"{base.rstrip('/')}/api/search?{params}", headers={"Authorization":f"Bearer {token}"})
            started = time.perf_counter()
            try:
                with urllib.request.urlopen(request, timeout=30) as response: result = json.load(response)
                source_ids = [item["sourceId"] for item in result.get("results", [])]
            except Exception:
                source_ids = []
            rows.append({"id":question["id"], "source_ids":source_ids, "refused":not source_ids, "latency_ms":round((time.perf_counter() - started) * 1000)})
        methods[method] = rows
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps({"methods":methods}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {sum(len(rows) for rows in methods.values())} evaluation queries")
    return 0

if __name__ == "__main__": raise SystemExit(main())
