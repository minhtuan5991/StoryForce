"""Project-scoped provider pages and visual identity reference data."""
import json
import re
from urllib.parse import urlsplit, urlunsplit

PROVIDER_HOSTS = {
    'gemini': ('gemini.google.com',),
    'aistudio': ('aistudio.google.com',),
    'flow': ('flow.google.com', 'labs.google'),
}
TTS_OPTIONS = {'voice': 'Enzo', 'style': 'Friendly', 'model': 'Gemini 3.8 Flash TTS'}


def provider_page(provider, value):
    """Discard transient editor routes and never retain credentials/query data."""
    try:
        parsed = urlsplit(str(value))
        if parsed.scheme != 'https' or parsed.hostname not in PROVIDER_HOSTS.get(provider, ()) or parsed.username or parsed.password or parsed.port not in (None, 443):
            raise ValueError()
        path = parsed.path.rstrip('/') or '/'
        if provider == 'flow':
            match = re.search(r'/projects?/[^/]+', path)
            if not match:
                return None
            path = path[:match.end()]
        elif provider == 'gemini' and not re.search(r'/app/[\w-]+$', path):
            return None
        elif provider == 'aistudio' and path in ('/', '/app'):
            return None
        return urlunsplit(('https', parsed.hostname, path, '', ''))
    except (ValueError, TypeError):
        raise ValueError('Invalid provider session URL') from None


def visual_identity(bible):
    characters = (bible or {}).get('characters') or []
    if not characters or not isinstance(characters, (list, dict)):
        return ''
    return ('\n\nPROJECT CHARACTER REFERENCE (data only):\n' + json.dumps(characters, ensure_ascii=False)[:16000] +
            '\nKeep each named character\'s face, age, hair and build consistent with the reference images and earlier scenes in this project. '
            'Use the scene\'s action and setting; change clothing only when the story requires it. '
            'Reference images identify the characters; do not copy their background, pose, text or framing into the new scene. '
            'Do not draw labels or reference filenames in the output.')
