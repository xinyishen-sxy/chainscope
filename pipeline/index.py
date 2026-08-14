"""Embed reviewed chunks and upsert them to Cloudflare Vectorize."""
from __future__ import annotations
import json, os, urllib.request, uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUNDLE = ROOT / "pipeline" / "output" / "ingestion-bundle.json"

def post(url: str, token: str, payload: dict) -> dict:
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers={"Authorization":f"Bearer {token}", "Content-Type":"application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=60) as response: return json.load(response)

def upsert_ndjson(url: str, token: str, vectors: list[dict]) -> dict:
    boundary = f"chainscope-{uuid.uuid4().hex}"
    ndjson = ("\n".join(json.dumps(item, ensure_ascii=False, separators=(",", ":")) for item in vectors) + "\n").encode()
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"body\"; filename=\"vectors.ndjson\"\r\nContent-Type: application/x-ndjson\r\n\r\n".encode() + ndjson + f"\r\n--{boundary}--\r\n".encode())
    request = urllib.request.Request(url, data=body, headers={"Authorization":f"Bearer {token}", "Content-Type":f"multipart/form-data; boundary={boundary}"}, method="POST")
    with urllib.request.urlopen(request, timeout=120) as response: return json.load(response)

def main() -> int:
    required = ["DASHSCOPE_API_KEY", "DASHSCOPE_BASE_URL", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_VECTORIZE_TOKEN", "VECTORIZE_INDEX_NAME"]
    missing = [name for name in required if not os.getenv(name)]
    if missing: print("index skipped; missing=" + ",".join(missing)); return 0
    data = json.loads(BUNDLE.read_text(encoding="utf-8")); chunks = data.get("chunks", [])
    vectors = []
    for start in range(0, len(chunks), 10):
        batch = chunks[start:start + 10]
        response = post(os.environ["DASHSCOPE_BASE_URL"].rstrip("/") + "/embeddings", os.environ["DASHSCOPE_API_KEY"], {"model":"text-embedding-v4", "input":[item["content"] for item in batch], "dimensions":1024, "encoding_format":"float"})
        for item, embedding in zip(batch, response.get("data", [])):
            vectors.append({"id":item["id"], "values":embedding["embedding"], "metadata":{key:item.get(key) for key in ("source_id","title","url","section","topic","source_type","authors","year","language","content")}})
    url = f"https://api.cloudflare.com/client/v4/accounts/{os.environ['CLOUDFLARE_ACCOUNT_ID']}/vectorize/v2/indexes/{os.environ['VECTORIZE_INDEX_NAME']}/upsert"
    for start in range(0, len(vectors), 1000): upsert_ndjson(url, os.environ["CLOUDFLARE_VECTORIZE_TOKEN"], vectors[start:start + 1000])
    print(f"upserted={len(vectors)}")
    return 0

if __name__ == "__main__": raise SystemExit(main())
