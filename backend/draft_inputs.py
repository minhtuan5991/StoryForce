from copy import deepcopy


def full_draft_inputs(context: dict) -> dict:
    """Send the approved story inputs, without duplicate outlines or other stories."""
    result = {key: deepcopy(context[key]) for key in (
        'project', 'channel', 'selected_premise', 'story_origin',
        'duration_profile', 'payload', 'channel_guidance',
    ) if key in context}
    artifacts = context.get('artifacts', {})
    result['artifacts'] = {key: deepcopy(artifacts[key]) for key in (
        'story_bible', 'outline_rewrite', 'opening_choice',
    ) if key in artifacts}
    return result
