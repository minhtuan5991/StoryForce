from __future__ import annotations

import json
from abc import ABC, abstractmethod
from pathlib import Path
from .config import RESOURCE_ROOT
from .intelligence import duration_profile, words
from .premise_policy import mock_batch

PROVIDERS = {
    "story_dna": "gemini", "channel_fit": "gemini", "content_direction": "chatgpt",
    "discovery": "gemini", "premise_generation": "chatgpt", "premise_mini_test": "chatgpt",
    "story_bible": "chatgpt", "outline": "chatgpt", "outline_audit": "gemini",
    "outline_rewrite": "chatgpt", "full_draft": "chatgpt", "gemini_story_audit": "gemini",
    "chatgpt_cross_review": "chatgpt", "disagreement_resolver": "gemini", "targeted_rewrite": "chatgpt",
    "final_verify_gemini": "gemini", "final_verify_chatgpt": "chatgpt", "visual_director": "gemini",
    "tts_context": "aistudio", "image_generation": "gemini", "video_generation": "flow", "youtube_metadata": "chatgpt", "thumbnail_plan": "chatgpt",
    "opening_variants": "chatgpt", "retention_audit": "gemini", "retention_rewrite": "chatgpt",
}
PROVIDER_URLS = {"chatgpt": "https://chatgpt.com/", "gemini": "https://gemini.google.com/app",
                 "aistudio": "https://aistudio.google.com/generate-speech", "flow": "https://flow.google.com/"}


class LLMProvider(ABC):
    @abstractmethod
    def generate(self, kind: str, context: dict, prompt: str) -> dict:
        """Return structured output or a manual continuation request."""


class BrowserBridgeProvider(LLMProvider):
    def generate(self, kind, context, prompt):
        return {"waiting_user": True, "provider": PROVIDERS[kind], "url": PROVIDER_URLS[PROVIDERS[kind]],
                "prompt": prompt, "message": "Fill with Browser Bridge or copy the prompt, then paste the result."}


class MockProvider(LLMProvider):
    """Offline fixtures. Synthetic output is always marked mock in artifact provenance."""
    def __init__(self):
        self.fixture = json.loads((RESOURCE_ROOT / "fixtures" / "mock_outputs.json").read_text(encoding="utf-8"))

    def generate(self, kind, context, prompt):
        project = context.get("project") or {}
        profile = duration_profile(project.get("target_minutes", 10), project.get("wpm", 150))
        if kind == 'thumbnail_plan':
            from .thumbnail_packaging import ConceptScores
            quote = project.get('draft', '').strip()[:180]
            headline = 'A STRANGE DETAIL'
            text_mode = 'MICRO_HOOK' if context['channel_visual_profile']['text_usage'] == 'SHORT_TEXT' else 'NO_TEXT'
            concepts = ['A close-up of the story evidence', 'A person confronting the story evidence', 'The setting containing the story evidence']
            return {'visual_dna': {'primary_setting': 'Story location', 'signature_object': 'Story evidence',
                    'central_anomaly': quote, 'threat_visibility': ['UNKNOWN'], 'spoiler_boundary': 'Do not reveal the ending', 'evidence_quotes': [quote]},
                'thumbnail_variants': [{'id': key, 'strategy': strategy, 'concept': concept, 'composition': concept,
                    'focal_subject': 'Story evidence', 'background': 'The actual setting', 'lighting': 'Practical story lighting',
                    'text_mode': text_mode, 'text_overlay': headline if text_mode != 'NO_TEXT' else '', 'text_safe_area': 'NONE',
                    'complement_strategy': 'TITLE_EVENT_THUMBNAIL_EVIDENCE', 'title_complement_reason': 'Show concrete evidence rather than repeat the full title.',
                    'hypothesis': 'Synthetic offline concept fixture, not a measured audience result.',
                    'generation_prompt': concept + '. Reference: ' + quote, 'negative_prompt': 'Unsupported entities, added gore, spoilers, watermarks',
                    'evidence_quotes': [quote], 'scores': {k: 10 if k.endswith('_risk') else 80 for k in ConceptScores.model_fields}}
                    for key, strategy, concept in zip('ABC', ('concrete_anomaly', 'human_threat', 'atmospheric_context'), concepts)],
                'recommended_thumbnail_variant': 'A', 'recommendation_reason': 'Synthetic fixture for isolated workflow tests.',
                'test_notes': 'Hold the title fixed to compare thumbnails; use YouTube Studio watch time results. No audience winner is predicted.'}
        if kind == 'opening_variants':
            return {'variants': [{'id': key, 'strategy': strategy, 'text': 'At 2:17 a.m., the abandoned station spoke my name. I had unplugged its radio an hour earlier.',
                                  'scores': {'clarity': 88, 'curiosity': 86, 'promise_alignment': 90}, 'tradeoff': 'Synthetic fixture for offline workflow checks.'}
                                 for key, strategy in zip('ABC', ('Concrete anomaly', 'Immediate choice', 'Consequences first'))],
                    'recommended': 'A', 'rationale': 'Mock recommendation, not an audience experiment.'}
        if kind == 'retention_audit':
            clock = context['audience_timing']
            text = project['draft']
            return {'zones': [{'id': z['id'], 'status': 'PASS' if z['applicable'] else 'NOT_APPLICABLE',
                               'evidence': text[z['start_char']:min(z['end_char'], z['start_char'] + 100)] if z['applicable'] else '',
                               'explanation': 'Synthetic offline assessment; not a measured audience result.'} for z in clock['zones']],
                    'issues': [], 'retention_readiness_passed': True, 'packaging_alignment_passed': True,
                    'packaging_explanation': 'Mock fixture alignment check', 'summary': 'Mock retention assessment; review before production.'}
        if kind == "youtube_metadata":
            from .youtube_metadata import STRATEGIES
            text = project.get('draft', '').strip()
            quote = text[:160]
            first = text.split('.')[0].strip()[:75] or project.get('title', 'An unexplained warning')[:75]
            titles = [first, first + ' | Mystery Story', 'The Mystery Behind ' + first]
            scores = dict(clarity=80, curiosity=80, specificity=80, story_accuracy=90,
                          suggested_fit=80, search_fit=70, channel_fit=80,
                          thumbnail_complement=80 if context['thumbnail'].get('reviewed_visual') else None, genericness_risk=10, keyword_stuffing_risk=0)
            return {'recommended_title': titles[0],
                    'title_variants': [{'id': key, 'strategy': strategy, 'title': title, 'evidence_quote': quote, 'scores': scores.copy()}
                                       for (key, strategy), title in zip(STRATEGIES.items(), titles)],
                    'story_packaging': {'concrete_anchors': [first], 'central_anomaly': first,
                                       'genre': 'Mystery', 'evidence_quotes': [quote]},
                    'primary_keyword_cluster': {'primary': 'mystery story', 'secondary': ['fiction narration'], 'evidence_type': 'story_semantic'},
                    'description': text[:600] + '\n\nAn original mystery narrated for this channel.',
                    'tags': ['mystery story', 'fiction narration', 'atmospheric mystery', context['channel']['name']],
                    'hashtags': ['#MysteryStory', '#FictionNarration'],
                    'metadata_notes': {'title_reason': 'Synthetic offline fixture, not an audience prediction.',
                                       'suffix_decision': 'Only the context variant uses a genre suffix.',
                                       'search_vs_suggested_strategy': context['traffic_strategy']['mode'], 'accuracy_notes': []},
                    'review_notes': ['Review the final video, media rights, audience and synthetic-content disclosure settings.']}
        if kind == "story_dna":
            return self.fixture["story_dna"]
        if kind == "discovery":
            return {"hypotheses": [{"name": name, "genres": genres, "scores": {"source_supply": 70+i*3, "adaptability": 82-i*4, "audio_suitability": 87, "content_depth": 76, "novelty": 79, "similarity_risk": 20+i*5}, "test_videos": context.get("payload", {}).get("test_videos", 5), "basis": "Mock heuristic"} for i, (name, genres) in enumerate([("Rules After Dark", ["Horror", "Mystery"]), ("After the Grid", ["Survival", "Apocalypse"]), ("Second Chance Stories", ["Speculative fiction", "Mystery"])])], "sample_size": len(context.get("sources", [])), "clusters": [{"genre": "Mystery", "motifs": ["rules", "isolation", "moral choice"], "source_ids": [s["id"] for s in context.get("sources", [])]}]}
        if kind == "content_direction":
            return {"retain": ["Isolated setting", "Escalating rules", "Moral choice"], "transform": ["New protagonist profession", "Original disaster and setting", "Different sequence of discoveries"], "avoid": ["Source characters", "Source locations", "Exact twist sequence", "Source ending"], "emotional_payoff": "Earned hope after a difficult choice", "pacing": "Immediate hook, escalating pressure, quiet earned payoff", "novelty": "A radio archivist must decide which signal to trust", "complexity": profile, "setting": "A decommissioned coastal radio station", "channel_direction": context.get("channel", {}).get("niche", "Discovery")}
        if kind == "premise_generation":
            count = max(1, min(50, int(context.get("payload", {}).get("count", 10))))
            titles = self.fixture["premise_titles"]
            return mock_batch(context, {"premises": [{"title": titles[i % len(titles)] + (f" · Variation {i // len(titles) + 1}" if i >= len(titles) else ""), "logline": self.fixture["loglines"][i % len(self.fixture["loglines"])], "category": "Core" if i/count < .4 else "Adjacent" if i/count < .7 else "Experimental" if i/count < .9 else "Wildcard", "scores": {"hook": 91-i%8, "originality": 86+i%7, "us_audience_fit": 88, "channel_fit": 89, "audio_fit": 94, "duration_fit": 92, "series_potential": 77, "source_similarity": 12+i%5, "channel_repetition": 8, "cross_channel_similarity": 6}, "signature": {"protagonist_job": ["radio archivist", "paramedic", "rail dispatcher", "lighthouse keeper", "forest ranger"][i%5], "disaster": ["signal blackout", "flood", "unexplained evacuation", "time anomaly"][i%4], "location": ["coastal station", "mountain pass", "abandoned hospital"][i%3], "twist": ["message from the future", "unreliable instruction", "hidden rescue"][i%3], "ending": "hope through sacrifice", "beat_signature": f"hook-rule-escalation-choice-{i}"}} for i in range(count)]})
        if kind == "premise_mini_test":
            return {"tests": [{"premise_id": p["id"], "title": p["title"], "thumbnail_concept": "A lone silhouette at a glowing radio console; a red signal cuts through the dark.", "hook": "At 2:17 a.m., the abandoned station spoke my name. The voice on the radio was mine. It told me not to open the door.", "opening": "\n\n".join(self.fixture["draft_paragraphs"][:5]), "duration_fit": f"One central mystery, {profile['characters'][0]}–{profile['characters'][1]} characters, {profile['minutes']} minutes.", "scores": {"click_clarity": 90, "opening_strength": 88, "retention_potential": 86, "novelty": 89, "channel_consistency": 91}} for p in context.get("premises", [])[:3]]}
        if kind == "story_bible":
            return self.fixture["story_bible"]
        if kind in ("outline", "outline_rewrite"):
            n = min(50, round(sum(profile["scenes"])/2))
            beats = ["The impossible signal", "A rule written in red", "The station goes dark", "A stranger at the gate", "The cost of trust", "The missing logbook", "Signals converge", "A difficult choice", "The truth behind the voice", "Breaking the rule", "A light on the shore", "The final transmission"]
            return {"scenes": [{"scene_id": f"S{i+1:03}", "title": beats[i%12], "purpose": "Advance the central mystery through a concrete decision.", "conflict": "Safety versus responsibility", "location": "Coastal radio station", "characters": ["Mara", "Elias"], "knowledge_changes": [f"Signal clue {i+1} is revealed"], "setup_payoff_links": ["Emergency battery → final transmission"], "estimated_time": round(project.get("target_minutes", 10)*60/n, 2), "emotional_state": "Suspense → resolve"} for i in range(n)], "retention_map": profile["retention_map"], "locked": kind == "outline_rewrite"}
        if kind == "outline_audit":
            return {"issues": [], "summary": "Mock outline structure check completed."}
        if kind == "full_draft":
            paragraphs = self.fixture["draft_paragraphs"]
            selected, count, idx = [], 0, 0
            while count < profile["word_range"][0]:
                paragraph = paragraphs[idx % len(paragraphs)]
                selected.append(paragraph)
                count += len(words(paragraph))
                idx += 1
            return {"text": "\n\n".join(selected), "note": "Synthetic offline fixture for workflow testing; review/rewrite before production."}
        if kind == "gemini_story_audit":
            text = project.get("draft", "")
            issues = []
            if "The emergency radio had no battery." in text:
                issues = [self.fixture["audit_issue"]]
            return {"issues": issues, "summary": "Mock evidence-based inventory check"}
        if kind == "chatgpt_cross_review":
            return {"reviews": [{"issue_id": issue["issue_key"], "verdict": "CONFIRMED", "reason": "The quoted sentence conflicts with the later transmission and Bible inventory."} for issue in context.get("issues", []) if issue["scope"] == "story"], "new_issues": [], "independent_audit_summary": "Mock independent sweep completed."}
        if kind == "disagreement_resolver":
            return {"resolutions": [{"issue_id": issue["issue_key"], "verdict": "CONFIRMED", "reason": "The quoted evidence supports the issue."} for issue in context.get("issues", []) if issue["final_status"] in ("RECHECK", "UNCERTAIN")]}
        if kind == "targeted_rewrite":
            return {"replacements": [{"issue_id": i["issue_key"], "old_text": i["evidence"], "new_text": "The emergency radio held one charged battery, enough for a single transmission."} for i in context.get("issues", []) if i["final_status"] == "CONFIRMED" and i["fix_status"] == "OPEN"], "summary": "Only confirmed affected text replaced."}
        if kind.startswith("final_verify_"):
            unresolved = [i for i in context.get("issues", []) if i["scope"] == "story" and i["severity"] in ("HIGH", "CRITICAL") and i["fix_status"] != "FIXED" and i["final_status"] not in ("REJECTED", "WITHDRAWN")]
            return {"passed": not unresolved, "critical": sum(i["severity"] == "CRITICAL" for i in unresolved), "high": sum(i["severity"] == "HIGH" for i in unresolved), "summary": "Mock verification; both providers must verify the exact draft hash."}
        if kind == "visual_director":
            n = context.get("payload", {}).get("count", round(sum(profile["scenes"])/2))
            count = context.get('payload',{}).get('video_count',int(n*context.get('video_ratio',.15)))
            video_indices = {max(1,min(n-1,round((i+1)*n/(count+1)))) for i in range(count)}
            return {"scenes": [{"scene_id": f"scene_{i+1:03}", "visual_type": "VIDEO" if i in video_indices else "IMAGE", "prompt": f"Cinematic 16:9 still. Scene {i+1}: Mara, a 34-year-old radio archivist in a weathered navy jacket, at a coastal radio station at night. Cool moonlight, amber instrument lights, atmospheric fog, grounded realism. Unique angle {i+1}.", "negative_prompt": "Text, logos, extra fingers, changed character appearance", "continuity_references": ["Mara: navy jacket", "Station: amber dial lights"], "camera": "Slow push in", "motion": "Subtle light and fog"} for i in range(n)]}
        if kind in ("tts_context", "image_generation", "video_generation"):
            return {"manual_media_required": True, "message": "Mock mode does not generate production audio or images. Attach local media."}
        raise ValueError(f"No mock fixture for {kind}")
