"""Shared creative direction for an early, truthful dramatic opening."""

OPENING_PROMPT = """
OPENING PACING POLICY:
Put the hook, the central curiosity gap and the first contradiction or conflict at the beginning,
not at 5% or 20% of the video. In the first 0–10 seconds, show a concrete unusual action, evidence
or incompatibility and make a specific unanswered question apparent. The question may be implicit;
do not stack rhetorical questions. By 10–30 seconds, make the immediate stakes and an obstructed
choice clear. Use the first 30 seconds as 2–3 connected ten-second beats: anomaly/question,
contradiction or resistance, then an urgent choice or consequence. Keep forward momentum through
30–60 seconds; weave only essential background into the action instead of restarting with a biography.
Increase drama modestly through precise verbs, observable reactions, opposing goals, deadlines already
supported by the story and a credible consequential choice. Match the channel's genre. Preserve Bible
facts, character knowledge and causality; do not invent threats, contradictions, monsters, false claims
or an unsupported countdown. A truthful cold open or brief preview is allowed, with an intelligible
transition. Build toward the MAIN CLIMAX AND CENTRAL PLOT TWIST at approximately 45–55% of the
story's narrated duration, rather than saving them for the last fifth. Make this a supported reversal
or consequential confrontation, not an unrelated shock or a fake-out. Establish necessary evidence
before it without revealing the answer in the opening. After the midpoint, develop the causal
explanation, changed understanding, practical consequences and a satisfying conclusion. The second
half must still progress through discoveries and decisions; never repeat an exposition dump or pad
the story after the twist. An open ending is optional when the story supports it: resolve the immediate
decision and establish what actually happened, while leaving one meaningful uncertainty for listeners
to infer. Do not force an open ending, contradict an explicit Bible ending or create an unearned sequel
cliffhanger. For an existing draft, structural relocation is not a license to rewrite unrelated passages
in a targeted repair; report the structural issue when local edits cannot safely fix it.
Timing is estimated from narration words/WPM, not measured audience retention.
""".strip()


def retention_map(seconds):
    return [
        {"label": "Hook", "seconds": 0},
        {"label": "Question", "seconds": 3},
        {"label": "Conflict", "seconds": 10},
        *({"label": label, "seconds": round(seconds * fraction)} for label, fraction in
          (("Escalation", .25), ("Climax", .45), ("Reveal", .5), ("Payoff", .95))),
    ]
