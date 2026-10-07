# Thumbnail research and visual packaging — 2026-10-07

The supplied upgrade proposal is an editorial brief, not a verified dataset of competitor results. The app separates official platform guidance, creator-supplied observations/analytics and editorial hypotheses. No live competitor research, causal performance claim or CTR prediction is fabricated.

Official sources checked:

- [Thumbnail and title tips](https://support.google.com/youtube/answer/12340300): accurate packaging, readable typography, restrained complexity and an audience-specific visual style.
- [A/B tests](https://support.google.com/youtube/answer/16391400): eligible desktop Studio users can compare up to three titles, thumbnails or combinations. Tests evaluate watch time, not CTR alone; results may be inconclusive. StoryForge does not submit tests.
- [Custom thumbnails](https://support.google.com/youtube/answer/72431): YouTube supports 16:9 thumbnail images and currently recommends 3840 × 2160. StoryForge checks 16:9 and at least 1280 × 720 as a comparison baseline, not as a claim that this is the latest maximum/recommended resolution.

Implementation choices:

- Extract Visual DNA from the locked final draft, Bible and revised outline. Require exact supporting quotes from this project's story; source inspirations cannot authorize invented physical evidence, monsters or true-event claims.
- A emphasizes a concrete anomaly; B emphasizes human stakes; C emphasizes atmosphere in a concrete setting. B/C can adapt to other evidence with an explicit story-specific reason. Do not impose faces, red, night-shift wording or a visible threat on every story.
- Overlay text can be absent or 1–4 words. Preserve the creator's prior 2–3 typeface/two-accent treatment as optional channel preferences; offer one bold font and story-driven color. Natural document labels remain possible with no overlay headline.
- Generate one selected/recommended image by default. Three images require an explicit request and are queued sequentially through the existing project-scoped Gemini session. Scene confirmations, narration, Flow settings and rendering remain unchanged.
- Scores describe proposed concepts only. Technical QA checks the actual file and dimensions; a real 320 × 180 preview supports creator review. Content accuracy, character identity, prop text and spoiler safety remain human checks, bound to the asset checksum and plan fingerprint. No OCR or semantic image analyzer is claimed.
- Once the creator confirms the image matches its concept, metadata can evaluate semantic title/image pairing. Keep literal word overlap as a separately labeled diagnostic; repetition of a meaningful room number can improve clarity rather than automatically imply weak packaging.
- Preserve existing thumbnails, titles and story data. Changing relevant story/title/channel inputs makes concepts stale; changing only later title hypotheses does not cause an image/metadata regeneration loop. Failed variants are reported independently.
- Export concepts, sources, hypotheses, checks and image review records as JSON for manual Studio experiments. A recommendation is never reported as an experiment winner.
