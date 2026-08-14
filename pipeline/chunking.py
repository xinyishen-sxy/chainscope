"""Heading-aware text chunking used by ingestion experiments."""
from __future__ import annotations
import re

def chunk_by_heading(text: str, target_tokens: int = 600, overlap_ratio: float = .15) -> list[dict]:
    if target_tokens not in {350, 600, 900}: raise ValueError("target_tokens must be 350, 600, or 900")
    sections, current = [], {"heading":"Document", "lines":[]}
    for line in text.splitlines():
        if re.match(r"^#{1,6}\s+", line):
            if current["lines"]: sections.append(current)
            current = {"heading":line.lstrip("# ").strip(), "lines":[]}
        else: current["lines"].append(line)
    if current["lines"]: sections.append(current)
    output, ordinal = [], 0
    for section in sections:
        words = "\n".join(section["lines"]).split()
        step = max(1, int(target_tokens * (1 - overlap_ratio)))
        for start in range(0, len(words), step):
            content = " ".join(words[start:start + target_tokens]).strip()
            if not content: continue
            output.append({"section":section["heading"], "content":content, "token_count":len(content.split()), "ordinal":ordinal})
            ordinal += 1
            if start + target_tokens >= len(words): break
    return output
