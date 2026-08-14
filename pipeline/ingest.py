"""Build an incremental, license-aware ChainScope ingestion bundle.

The bundle is intentionally provider-neutral JSONL. An administrator imports
it through /api/admin/sync after reviewing licenses. Secrets stay in CI/Sites.
"""
from __future__ import annotations
import hashlib, io, json, re, urllib.error, urllib.request
from pathlib import Path
from chunking import chunk_by_heading

try:
    from pypdf import PdfReader
except ImportError:  # The dependency is installed by GitHub Actions.
    PdfReader = None

ROOT = Path(__file__).resolve().parents[1]
DISCOVERIES = ROOT / "pipeline" / "output" / "discoveries.json"
OUTPUT = ROOT / "pipeline" / "output" / "ingestion-bundle.json"
OPEN_LICENSE_MARKERS = ("creative commons", "cc by", "arxiv", "public domain", "apache-2.0", "gpl")

def fetch_text(url: str) -> tuple[str, str]:
    req = urllib.request.Request(url, headers={"User-Agent":"ChainScope/0.3 open-access indexer"})
    with urllib.request.urlopen(req, timeout=25) as response:
        content_type = response.headers.get("content-type", "")
        payload = response.read(12_000_000)
    if "application/pdf" in content_type or url.lower().split("?")[0].endswith(".pdf"):
        if PdfReader is None:
            raise ValueError("pypdf is required for text PDF ingestion")
        pages = []
        for page_number, page in enumerate(PdfReader(io.BytesIO(payload)).pages, start=1):
            pages.append(f"\n# Page {page_number}\n{page.extract_text() or ''}")
        text = "\n".join(pages)
        if not text.strip():
            raise ValueError("PDF has no extractable text; OCR is intentionally disabled")
        return re.sub(r"[ \t]+", " ", text).strip(), content_type
    if "text/html" not in content_type and "text/plain" not in content_type:
        raise ValueError("only HTML, text and text-based PDF are processed")
    raw = payload.decode("utf-8", "ignore")
    text = re.sub(r"<script[\s\S]*?</script>|<style[\s\S]*?</style>", " ", raw, flags=re.I)
    text = re.sub(r"<h([1-6])[^>]*>", lambda m: "\n" + "#" * int(m.group(1)) + " ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"[ \t]+", " ", text).strip(), content_type

def main() -> int:
    payload = json.loads(DISCOVERIES.read_text(encoding="utf-8")) if DISCOVERIES.exists() else {"sources":[]}
    sources, chunks = [], []
    for source in payload.get("sources", []):
        license_name = str(source.get("license") or "metadata-only")
        open_url = source.get("open_access_url")
        content = source.get("abstract") or ""
        scope, error = ("abstract" if content else "metadata"), None
        if open_url and any(marker in license_name.lower() or marker in open_url.lower() for marker in OPEN_LICENSE_MARKERS):
            try: content, _ = fetch_text(open_url); scope = "open_fulltext"
            except (urllib.error.URLError, ValueError) as exc: error = str(exc)
        normalized = re.sub(r"\s+", " ", content).strip()
        content_hash = hashlib.sha256(normalized.encode()).hexdigest() if normalized else None
        source.update({"content_scope":scope, "content_hash":content_hash, "sync_error":error})
        sources.append(source)
        if normalized:
            for chunk in chunk_by_heading(content, 600, .15):
                chunk_id = hashlib.sha256(f"{source['id']}:{chunk['ordinal']}:{chunk['content']}".encode()).hexdigest()[:32]
                chunks.append({**chunk, "id":chunk_id, "source_id":source["id"], "title":source["title"], "url":source["url"], "topic":"lab", "source_type":"paper", "authors":source.get("authors", []), "year":source.get("year"), "language":"zh" if re.search(r"[\u3400-\u9fff]", chunk["content"]) else "en", "content_hash":hashlib.sha256(chunk["content"].encode()).hexdigest(), "vector_version":"text-embedding-v4-1024"})
    OUTPUT.write_text(json.dumps({"sources":sources, "chunks":chunks}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"sources={len(sources)} chunks={len(chunks)} bundle={OUTPUT}")
    return 0

if __name__ == "__main__": raise SystemExit(main())
