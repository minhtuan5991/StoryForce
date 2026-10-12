"""Project workflow labels are separate from the story's creative title."""
import re

LABELS = {'full_step': 'Full Step', 'extend': 'Extend', 'customize': 'Customize'}
PREFIX = re.compile(r'^(?:(?:Full Step|Extend|Customize)\s*-\s*)+', re.I)


def field(project, key, default=None):
    return project.get(key, default) if isinstance(project, dict) else getattr(project, key, default)


def base_title(title):
    return PREFIX.sub('', str(title or '').strip()).strip()


def project_type(project):
    settings = field(project, 'settings') or {}
    if settings.get('premise_origin'):
        return 'extend'
    if settings.get('entry_mode') == 'existing_bible':
        return 'customize'
    return settings.get('project_type') if settings.get('project_type') in LABELS else 'full_step'


def story_title(project):
    return base_title(field(project, 'title'))


def name_project(project, title=None):
    kind = project_type(project)
    base = base_title(field(project, 'title') if title is None else title)
    if not base:
        raise ValueError('Project title must include a story name')
    if len(base) > 300:
        raise ValueError('Story title must contain at most 300 characters')
    full = f'{LABELS[kind]} - {base}'
    settings = {**(field(project, 'settings') or {}), 'project_type': kind, 'story_title': base}
    changed = full != field(project, 'title') or settings != field(project, 'settings')
    if isinstance(project, dict):
        project.update(title=full, settings=settings)
    else:
        project.title, project.settings = full, settings
    return changed


def story_context(project):
    if not project:
        return {}
    result = {**project, 'title': story_title(project)}
    result['settings'] = {k: v for k, v in (project.get('settings') or {}).items()
                          if k not in ('project_type', 'story_title')}
    return result
