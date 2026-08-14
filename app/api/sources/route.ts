import { listSources } from "../../../lib/runtime-data";
export async function GET() {
  const sources = await listSources();
  return Response.json(
    { sources, summary:{ total:sources.length, lab:sources.filter((source) => source.collection === "lab").length, openFulltext:sources.filter((source) => source.contentScope === "open_fulltext").length, abstractIndexed:sources.filter((source) => source.contentScope === "abstract").length } },
    { headers:{ "cache-control":"no-store" } },
  );
}
