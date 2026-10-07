# YouTube metadata packaging — 2026-10-07

This implementation uses the creator's supplied packaging proposal as an editorial brief. Its examples and competitor conventions are hypotheses, not evidence that a concrete noun, suffix or description length caused performance.

Official sources checked:

- [Thumbnail and title tips](https://support.google.com/youtube/answer/12340300): accurate, succinct titles; searchable and intriguing strategies; review actual audience data.
- [Tags](https://support.google.com/youtube/answer/146402): title, thumbnail and description matter more; tags have a minimal discovery role except useful spelling corrections.
- [A/B testing](https://support.google.com/youtube/answer/16391400): up to three title/thumbnail variants, evaluated using watch time. StoryForge creates candidates; it does not run tests or predict outcomes.
- [Hashtags](https://support.google.com/youtube/answer/6390658): relevant hashtags without spaces; avoid over-tagging and misleading associations.
- [Video resource limits](https://developers.google.com/youtube/v3/docs/videos): title at most 100 characters; description at most 5000 UTF-8 bytes; combined tags at most 500 characters, including separators and quotes around multiword tags.

Implementation choices, not YouTube ranking guarantees:

- Three editorial strategies: concrete anomaly, useful search/context, first-person/curiosity. Require an exact supporting quote for each strategy and preserve a concrete story anchor. A genre suffix is optional.
- One semantic keyword cluster; usually 4–8 tags and 2–3 hashtags. Description length is an information-density guideline, not a hard word target.
- Optional creator-supplied Suggested/Browse/Search percentages. Unknown percentages remain null; compare only known categories. Without a complete profile, default to accurate story packaging.
- Creator-supplied Analytics, search research and observed phrase evidence retain their provenance. The app does not independently verify search demand or collect competitor analytics. Inference is explicitly labeled.
- AI quality/risk scores are editorial rubrics (0–100), not CTR or retention probabilities. Thumbnail word overlap is a local meaningful-word ratio, not a semantic or audience measurement. After the creator confirms an actual image matches its thumbnail concept, AI can assess semantic title/image pairing separately. Unknown actual thumbnail text stays unknown; planned headlines never substitute for verified text.
- StoryForge adapts fiction. No verification mechanism for true events exists; source inspiration cannot authorize a factual claim. Fiction disclosure is configurable per channel, default enabled.
- Metadata changes neither the draft nor publishing settings until the user applies fields. Existing metadata remains readable/exportable; new generation uses contract 2. Changing relevant inputs invalidates existing/pending metadata.
