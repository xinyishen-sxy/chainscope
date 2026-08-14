"""Compute deterministic retrieval metrics from a ChainScope result file."""
from __future__ import annotations
import json, math, statistics, sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATASET = ROOT / "evaluation" / "questions.json"
PREDICTIONS = ROOT / "pipeline" / "output" / "predictions.json"
OUTPUT = ROOT / "pipeline" / "output" / "evaluation-latest.json"

def dcg(relevances: list[int], k: int) -> float:
    return sum(rel / math.log2(index + 2) for index, rel in enumerate(relevances[:k]))

def score(questions: list[dict], rows: list[dict]) -> dict:
    predictions = {item["id"]: item for item in rows}
    recalls, ndcgs, reciprocal, latencies = [], [], [], []
    true_positive = false_positive = false_negative = 0
    for question in questions:
        prediction = predictions.get(question["id"], {"source_ids": [], "refused": True, "latency_ms": 0})
        returned = prediction.get("source_ids", [])
        relevant = set(question["relevant_source_ids"])
        binary = [1 if source in relevant else 0 for source in returned]
        if relevant:
            recalls.append(len(set(returned[:5]) & relevant) / len(relevant))
            ideal = dcg([1] * min(len(relevant), 10), 10)
            ndcgs.append(dcg(binary, 10) / ideal if ideal else 0)
            reciprocal.append(next((1 / (i + 1) for i, hit in enumerate(binary) if hit), 0))
        actual_refusal = bool(question["unanswerable"])
        predicted_refusal = bool(prediction.get("refused"))
        true_positive += int(actual_refusal and predicted_refusal)
        false_positive += int(not actual_refusal and predicted_refusal)
        false_negative += int(actual_refusal and not predicted_refusal)
        latencies.append(float(prediction.get("latency_ms", 0)))
    precision = true_positive / max(1, true_positive + false_positive)
    refusal_recall = true_positive / max(1, true_positive + false_negative)
    return {"recallAt5":statistics.mean(recalls), "ndcgAt10":statistics.mean(ndcgs), "mrr":statistics.mean(reciprocal), "refusalF1":2*precision*refusal_recall/max(.000001, precision+refusal_recall), "searchP95Ms":sorted(latencies)[max(0, math.ceil(len(latencies) * .95) - 1)]}

def main() -> int:
    questions = json.loads(DATASET.read_text(encoding="utf-8"))
    if not PREDICTIONS.exists():
        print("predictions.json is absent; evaluation dataset validation passed, scoring skipped.")
        print(f"questions={len(questions)} answerable={sum(not q['unanswerable'] for q in questions)}")
        return 0
    payload = json.loads(PREDICTIONS.read_text(encoding="utf-8"))
    methods = payload.get("methods", {"rerank":payload if isinstance(payload, list) else []})
    scored = {method:score(questions, rows) for method, rows in methods.items()}
    primary = scored.get("rerank") or next(iter(scored.values()))
    primary.update({"citationAccuracy":0, "citationCoverage":0, "faithfulness":0, "generationP95Ms":0})
    comparisons = [{"method":method, "ndcgAt10":metrics["ndcgAt10"], "latencyP95Ms":metrics["searchP95Ms"]} for method, metrics in scored.items()]
    passed = primary["recallAt5"] >= .85 and primary["ndcgAt10"] >= .75 and primary["refusalF1"] >= .80
    result = {"version":"eval-0.2.0", "runAt":datetime.now(timezone.utc).isoformat(), "datasetSize":len(questions), "metrics":primary, "comparisons":comparisons, "state":"completed", "passed":passed, "notes":"Retrieval metrics are automated over 80 fixed questions. Citation accuracy, coverage and faithfulness remain 0 until generation evaluation and manual sampling are completed."}
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0

if __name__ == "__main__": sys.exit(main())
