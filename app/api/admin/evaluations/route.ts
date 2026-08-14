import { runtimeDb } from "../../../../lib/runtime-data";
import { isAdmin } from "../../../../lib/security";
import type { EvaluationRun } from "../../../../lib/types";

export async function POST(request: Request) {
  if (!isAdmin(request)) return Response.json({ error:"admin access required" }, { status:403 });
  const db = runtimeDb(); if (!db) return Response.json({ error:"D1 unavailable" }, { status:503 });
  const run = await request.json() as EvaluationRun;
  if (!run.version || run.datasetSize !== 80 || !run.metrics) return Response.json({ error:"invalid evaluation run" }, { status:400 });
  await db.prepare("INSERT OR REPLACE INTO evaluation_runs (id, version, dataset_size, metrics_json, passed, run_at, notes) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(run.version, run.version, run.datasetSize, JSON.stringify({ metrics:run.metrics, comparisons:run.comparisons ?? [] }), run.passed ? 1 : 0, run.runAt, run.notes ?? null).run();
  return Response.json({ status:"published", version:run.version, passed:run.passed });
}
