"""Deterministic local reasoning: duration, semantic boundaries, fit and novelty.

Scores in this module are transparent heuristics, never YouTube observations.
"""
from __future__ import annotations

import hashlib
import json
import math
import re


def digest(value) -> str:
    text = value if isinstance(value, str) else json.dumps(value, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


WORD_PATTERN = re.compile(r"\b[\w]+(?:['’\-][\w]+)*\b")


def words(text: str) -> list[str]:
    return WORD_PATTERN.findall(text)


def duration_profile(minutes: float, wpm: int = 150) -> dict:
    if not 1 <= minutes <= 240 or not 80 <= wpm <= 240:
        raise ValueError("Duration must be 1–240 minutes; narration speed 80–240 WPM")
    if minutes <= 5:
        characters, subplots, scenes, twists = [1, 3], 0, [6, 10], [1, 1]
    elif minutes <= 10:
        characters, subplots, scenes, twists = [2, 4], 1, [10, 16], [1, 2]
    elif minutes <= 30:
        characters, subplots, scenes, twists = [3, 6], 2, [18, 30], [2, 3]
    else:
        characters, subplots, scenes, twists = [4, 9], 3, [35, max(50, math.ceil(minutes * .84))], [3, 5]
    target = round(minutes * wpm)
    return {"minutes": minutes, "wpm": wpm, "target_words": target,
            "word_range": [round(target * .92), round(target * 1.08)],
            "characters": characters, "max_subplots": subplots, "scenes": scenes, "twists": twists,
            "tts_chunks": max(1, round(minutes / 3)),
            "retention_map": [{"label": label, "seconds": round(minutes * 60 * fraction)}
                for label, fraction in [("Hook", 0), ("Question", .05), ("Conflict", .2), ("Escalation", .4), ("Reveal", .65), ("Climax", .8), ("Payoff", .95)]]}


def recommend_duration(premise: dict) -> dict:
    complexity = len(premise.get("characters", [])) + 2 * len(premise.get("subplots", [])) + len(premise.get("twists", []))
    lower, upper = (5, 10) if complexity <= 4 else (20, 30) if complexity <= 8 else (45, 60)
    return {"range": [lower, upper], "recommended": lower, "reason": "Local complexity heuristic; accept or override before drafting."}


def sentence_units(text: str) -> list[dict]:
    units = []
    cursor = 0
    # Protect common abbreviations without changing string length/offsets.
    protected = re.sub(r"\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|U\.S)\.", lambda m: m[0].replace(".", "\ue000"), text)
    protected = re.sub(r"(?<=\d)\.(?=\d)", "\ue000", protected)
    for match in re.finditer(r".+?(?:[.!?]+[\"'”’)]*(?=\s|$)|$)", protected, re.S):
        start, end = match.span()
        raw = text[start:end].strip()
        if not raw:
            continue
        following = text[end:]
        paragraph = bool(re.match(r"[ \t]*\r?\n[ \t]*\r?\n", following))
        transition = bool(re.search(r"\b(?:later|next morning|at dawn|meanwhile|across town|that evening|hours passed)\b", following[:110], re.I))
        reveal = bool(re.match(r"\s*(?:But then|Suddenly|The truth|What she saw|What he saw)", following, re.I))
        quotes = text[:end].count('"') % 2 or (text[:end].count('“') > text[:end].count('”'))
        reasons = ["Sentence complete"]
        score = 0
        if paragraph:
            score += 3
            reasons.append("Paragraph boundary")
        if transition:
            score += 4
            reasons.append("Time or location transition")
        if re.search(r"\n\s*(?:\[Scene|SCENE|\*\*\*)", following[:50]):
            score += 5
            reasons.append("Scene boundary")
        if quotes:
            score -= 5
            reasons.append("Dialogue continues")
        elif raw.endswith(('"', '”')):
            score += 2
            reasons.append("Dialogue exchange complete")
        if reveal:
            score -= 5
            reasons.append("Before reveal — avoided when possible")
        wc = len(words(raw))
        units.append({"text": raw, "start": start, "end": end, "words": wc,
                      "pause": len(re.findall(r"[,;:]", raw)) * .12 + .24,
                      "score": score, "reasons": reasons})
        cursor = end
    return units


def chunk_text(text: str, wpm: int = 150, voice: dict | None = None) -> list[dict]:
    units = sentence_units(text)
    if not units:
        raise ValueError("There is no narration to chunk")
    durations = [u["words"] * 60 / wpm + u["pause"] for u in units]
    if max(durations) > 240:
        raise ValueError("One sentence exceeds the 4-minute hard limit. Add a sentence boundary before chunking.")
    total = sum(durations)
    chunks, start = [], 0
    while start < len(units):
        elapsed, candidates = 0.0, []
        for end in range(start, len(units)):
            elapsed += durations[end]
            if elapsed > 240:
                break
            remaining = sum(durations[end + 1:])
            if elapsed >= 60 or end == len(units) - 1:
                target = total / 2 if 240 < total <= 330 else min(180, total)
                score = units[end]["score"] * 6 - abs(elapsed - target) / 3
                if 0 < remaining < 60:
                    score -= 80
                if end == len(units) - 1:
                    score += 5
                candidates.append((score, end, elapsed))
        if not candidates:
            # All legal sentences fit but a single trailing group is shorter than a minute.
            candidates = [(0, start, durations[start])]
        _, end, duration = max(candidates, key=lambda c: c[0])
        raw = text[units[start]["start"]:units[end]["end"]].strip()
        chunks.append({"number": len(chunks) + 1, "text": raw, "word_count": len(words(raw)),
                       "estimated_duration": round(duration, 3), "reasons": units[end]["reasons"],
                       "previous_context": units[start - 1]["text"] if start else "Beginning of story.",
                       "next_context": units[end + 1]["text"] if end + 1 < len(units) else "End of story.",
                       "voice_profile": voice or {"voice_name": "Kore", "style": "Warm American English, consistent pace"}})
        start = end + 1
    return chunks


STOPWORDS = set("the a an and or to of in on for with is are was were it that this from as by at her his she he they their when after before into".split())


def tokens(text: str) -> set[str]:
    return {w.lower() for w in words(text) if len(w) > 2 and w.lower() not in STOPWORDS}


def similarity(a: str | list, b: str | list) -> float:
    left = tokens(a) if isinstance(a, str) else set(a)
    right = tokens(b) if isinstance(b, str) else set(b)
    return len(left & right) / max(1, len(left | right))


def novelty_check(text: str, signature: dict, memory: list[dict], channel_id: str) -> list[dict]:
    warnings = []
    for item in memory:
        shared = [f"{key}: {value}" for key, value in signature.items() if value and item.get("signature", {}).get(key) == value]
        score = max(similarity(text, item.get("tokens", [])), len(shared) / max(1, len(signature)))
        if score >= .45:
            warnings.append({"scope": "CHANNEL" if item["channel_id"] == channel_id else "CROSS_CHANNEL",
                             "project_id": item["project_id"], "title": item["title"], "score": round(score * 100), "shared": shared,
                             "level": "BLOCK" if score >= .85 else "WARNING"})
    return sorted(warnings, key=lambda w: -w["score"])


def channel_fit(source_dna: dict, channel: dict, history: list[dict], calendar: list[dict]) -> dict:
    dna = channel.get("dna", {})
    source_terms = tokens(json.dumps(source_dna))
    preferred = tokens(" ".join(dna.get("primary_genres", []) + dna.get("core_tropes", []) + [channel.get("niche", "")]))
    avoid = tokens(" ".join(dna.get("avoid_genres", []) + dna.get("avoid_tropes", [])))
    overlap, conflicts = source_terms & preferred, source_terms & avoid
    score = min(98, 45 + len(overlap) * 8) - len(conflicts) * 15
    repetitions = sum(1 for h in history if similarity(json.dumps(source_dna), h.get("tokens", [])) > .4)
    score -= min(20, repetitions * 5)
    return {"channel_id": channel["id"], "channel_name": channel["name"], "score": max(0, score),
            "reasons": [f"Shared motif: {t}" for t in sorted(overlap)] or ["Broad exploratory fit; more channel DNA will improve this heuristic."],
            "conflicts": [f"Avoided motif: {t}" for t in sorted(conflicts)],
            "adaptation_opportunity": f"Create an original {channel.get('niche') or 'discovery'} direction with new characters, setting and beat sequence.",
            "history_size": len(history), "planned_videos": len(calendar), "basis": "Heuristic, not observed YouTube performance"}
