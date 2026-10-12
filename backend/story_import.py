"""A supplied Bible is the story input, without generating a premise pool."""
from copy import deepcopy
import json
import re
from .ai_result import parse_ai_result


def imported_bible(project):
    return (project.settings or {}).get('entry_mode') == 'existing_bible'


def bible_title(content):
    """Use an explicit title or an unambiguous title heading in a legacy Bible."""
    for data in (content, content.get('metadata'), content.get('story')):
        if not isinstance(data, dict):
            continue
        for key in ('title', 'story_title', 'working_title'):
            value = data.get(key)
            if isinstance(value, str) and value.strip():
                title = re.sub(r'\s+', ' ', value).strip()
                if len(title) > 300 or any(ord(c) < 32 for c in title):
                    raise ValueError('Story Bible title must be at most 300 characters')
                return title
    # Older supplied Bibles have no title field. Do not turn an ordinary
    # opening sentence into a project name; accept only a quoted/capitalized
    # title explicitly introduced as a story, as in "TITLE is a ... story".
    summary = str(content.get('summary') or '').strip()
    match = re.match(r'^(?:["“](.{3,300}?)["”]|([A-Z][A-Z0-9 \-\u2014\u2019\x27:]{2,299}))\s+is\s+(?:a|an)\s+', summary)
    if match and len((match.group(1) or match.group(2)).split()) >= 2:
        return (match.group(1) or match.group(2)).strip()
    return None


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
    bible_title(value)
    return deepcopy(value)
