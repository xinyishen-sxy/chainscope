"""Discover public lab works from ORCID and enrich DOI metadata when possible.

ORCID is the source of truth for lab membership. Optional OpenAlex and Semantic
Scholar enrichment is best-effort: rate limits never prevent an ORCID sync.
Only metadata is emitted; full text is never downloaded by this workflow.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "pipeline" / "output" / "discoveries.json"
USER_AGENT = "ChainScope/0.2 (research knowledge base; public metadata sync)"
DEFAULT_ORCIDS = ["0000-0001-5870-5730"]


def fetch_json(url: str, accept: str = "application/json", attempts: int = 3) -> dict:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": accept})
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            if error.code != 429 or attempt == attempts - 1:
                raise
            time.sleep(2 ** attempt)
    return {}


def canonical_url(value: str) -> str:
    parsed = urllib.parse.urlsplit(value.strip())
    path = re.sub(r"/+", "/", parsed.path).rstrip("/")
    return urllib.parse.urlunsplit((parsed.scheme.lower(), parsed.netloc.lower(), path, "", ""))


def stable_id(doi: str | None, url: str, title: str) -> str:
    identity = (doi or f"{title.lower()}|{canonical_url(url)}").encode("utf-8")
    return hashlib.sha256(identity).hexdigest()[:20]


def nested_value(value: object, *keys: str) -> str | None:
    current = value
    for key in keys:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return str(current) if current not in (None, "") else None


def orcid_works(orcid: str) -> list[dict]:
    orcid = orcid.removeprefix("https://orcid.org/").strip()
    data = fetch_json(f"https://pub.orcid.org/v3.0/{orcid}/record")
    groups = (((data.get("activities-summary") or {}).get("works") or {}).get("group") or [])
    records: list[dict] = []
    for group in groups:
        summaries = group.get("work-summary") or []
        if not summaries:
            continue
        work = summaries[0]
        title = nested_value(work, "title", "title", "value") or "Untitled"
        year_value = nested_value(work, "publication-date", "year", "value")
        external_ids = {}
        for item in ((work.get("external-ids") or {}).get("external-id") or []):
            external_ids[str(item.get("external-id-type", "")).lower()] = item.get("external-id-value")
        doi = external_ids.get("doi")
        url = nested_value(work, "url", "value") or (f"https://doi.org/{doi}" if doi else f"https://orcid.org/{orcid}")
        records.append({
            "id": stable_id(doi, url, title), "title": title, "url": canonical_url(url),
            "doi": doi, "year": int(year_value) if year_value and year_value.isdigit() else None,
            "work_type": work.get("type"), "authors": ["Xiangfu Zhao et al."],
            "license": "metadata-only", "is_open_access": False, "status": "pending_review",
            "provider": "orcid", "topic": "lab", "collection": "lab", "orcid": orcid,
        })
    return records


def semantic_scholar_enrich(record: dict) -> dict:
    doi = record.get("doi")
    if not doi:
        return record
    encoded = urllib.parse.quote(doi, safe="")
    fields = "title,authors,year,citationCount,openAccessPdf,abstract"
    try:
        data = fetch_json(f"https://api.semanticscholar.org/graph/v1/paper/DOI:{encoded}?fields={fields}", attempts=1)
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError):
        return record
    authors = [item.get("name", "") for item in data.get("authors", []) if item.get("name")]
    oa_url = nested_value(data, "openAccessPdf", "url")
    return {
        **record, "authors": authors or record["authors"], "abstract": data.get("abstract"),
        "cited_by_count": data.get("citationCount"), "citation_provider": "Semantic Scholar",
        "open_access_url": oa_url, "is_open_access": bool(oa_url),
    }


def crossref_enrich(record: dict) -> dict:
    doi = record.get("doi")
    if not doi or record.get("abstract"):
        return record
    try:
        data = fetch_json(f"https://api.crossref.org/works/{urllib.parse.quote(doi, safe='')}", attempts=1).get("message", {})
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError):
        return record
    abstract = data.get("abstract")
    if abstract:
        abstract = re.sub(r"<[^>]+>", " ", abstract)
        abstract = re.sub(r"\s+", " ", abstract).strip()
    licenses = data.get("license") or []
    license_url = licenses[0].get("URL") if licenses else None
    links = data.get("link") or []
    open_url = next((link.get("URL") for link in links if "text/html" in str(link.get("content-type", "")) or "unspecified" in str(link.get("content-type", ""))), None)
    return {**record, "abstract": abstract, "license": license_url or record.get("license"), "open_access_url": open_url if license_url else record.get("open_access_url")}


def main() -> int:
    configured = [item.strip() for item in os.getenv("ORCID_IDS", "").split(",") if item.strip()]
    orcids = configured or DEFAULT_ORCIDS
    enrich = os.getenv("ENRICH_CITATIONS", "1") != "0"
    found: dict[str, dict] = {}
    warnings: list[str] = []
    for orcid in orcids:
        try:
            for record in orcid_works(orcid):
                enriched = semantic_scholar_enrich(record) if enrich else record
                found[record["id"]] = crossref_enrich(enriched)
                time.sleep(0.12)
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as error:
            warnings.append(f"ORCID {orcid}: {error}")
    sources = sorted(found.values(), key=lambda item: (item.get("year") or 0, item.get("title", "")), reverse=True)
    payload = {"generated_at": datetime.now(timezone.utc).isoformat(), "count": len(sources), "warnings": warnings, "sources": sources}
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(sources)} ORCID review candidates to {OUTPUT}")
    for warning in warnings:
        print(f"warning: {warning}", file=sys.stderr)
    return 0 if sources else 1


if __name__ == "__main__":
    sys.exit(main())
