"""A supplied Bible is the story input, without generating a premise pool."""
from copy import deepcopy
import json
from .ai_result import parse_ai_result


def imported_bible(project):
    return (project.settings or {}).get('entry_mode') == 'existing_bible'


def validate_import(value):
    if isinstance(value, str):
        if len(value.encode('utf-8')) > 2_000_000:
            raise ValueError('Story Bible JSON must be smaller than 2 MB')
        value = parse_ai_result(value.lstrip('\ufeff'))
    if not isinstance(value, dict):
        raise ValueError('Paste a Story Bible JSON object')
    if 'characters' not in value:
        if isinstance(value.get('story_bible'), dict):
            value = value['story_bible']
        elif value.get('kind') == 'story_bible' and isinstance(value.get('content'), dict):
            value = value['content']
    if len(json.dumps(value, ensure_ascii=False).encode('utf-8')) > 2_000_000:
        raise ValueError('Story Bible JSON must be smaller than 2 MB')
    if not isinstance(value.get('summary'), str) or not value['summary'].strip():
        raise ValueError('Story Bible requires a non-empty summary')
    characters = value.get('characters')
    if not isinstance(characters, list) or not characters:
        raise ValueError('Story Bible requires a characters array with at least one named character')
    names = []
    for character in characters:
        if not isinstance(character, dict) or not isinstance(character.get('name'), str) or not character['name'].strip():
            raise ValueError('Each Story Bible character requires a non-empty name')
        names.append(character['name'].strip().casefold())
    if len(names) != len(set(names)):
        raise ValueError('Story Bible character names must be unique')
    rules = value.get('world_rules')
    if not isinstance(rules, list) or not rules or any(
        not (isinstance(rule, str) and rule.strip() or isinstance(rule, dict) and rule) for rule in rules
    ):
        raise ValueError('Story Bible requires a non-empty world_rules array')
    return deepcopy(value)
