import { latestEvaluation } from "../../../../lib/runtime-data";
import { EMPTY_EVALUATION } from "../../../../lib/demo-data";
export async function GET() { return Response.json((await latestEvaluation()) ?? EMPTY_EVALUATION, { headers:{ "cache-control":"no-store" } }); }
