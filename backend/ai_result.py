"""Read AI JSON; recover string quoting without inventing missing structure."""
import json
import logging
import re

_NEXT_LITERAL = re.compile(r'(?:true|false|null)\b')
_OBJECT_KEY = re.compile(r'"(?:[^"\\]|\\.)*"\s*:')


class _QuotedStrings:
    def __init__(self, text):
        self.text, self.index, self.repairs = text, 0, 0
        self.decoder = json.JSONDecoder()

    def space(self):
        while self.index < len(self.text) and self.text[self.index].isspace():
            self.index += 1

    def expect(self, token):
        self.space()
        if not self.text.startswith(token, self.index):
            raise ValueError('Missing JSON separator or closing delimiter')
        self.index += len(token)

    def value(self, depth=0):
        if depth > 128:
            raise ValueError('JSON nesting is too deep')
        self.space()
        token = self.text[self.index:self.index+1]
        if token == '{':
            self.index += 1
            result = {}
            self.space()
            if self.text[self.index:self.index+1] == '}':
                self.index += 1
                return result
            while True:
                self.space()
                if self.text[self.index:self.index+1] != '"':
                    raise ValueError('JSON object key is missing')
                key, self.index = self.decoder.raw_decode(self.text, self.index)
                if key in result:
                    raise ValueError('Ambiguous duplicate JSON key')
                self.expect(':')
                result[key] = self.value(depth+1)
                self.space()
                if self.text[self.index:self.index+1] == '}':
                    self.index += 1
                    return result
                self.expect(',')
        if token == '[':
            self.index += 1
            result = []
            self.space()
            if self.text[self.index:self.index+1] == ']':
                self.index += 1
                return result
            while True:
                result.append(self.value(depth+1))
                self.space()
                if self.text[self.index:self.index+1] == ']':
                    self.index += 1
                    return result
                self.expect(',')
        if token == '"':
            return self.string()
        result, self.index = self.decoder.raw_decode(self.text, self.index)
        return result

    def string(self):
        self.index += 1
        parts = ['"']
        while self.index < len(self.text):
            char = self.text[self.index]
            if char == '\\':
                # Keep existing escapes unchanged; invalid ones still fail json.loads.
                parts.append(self.text[self.index:self.index+2])
                self.index += 2
                continue
            if char == '"':
                tail = self.index + 1
                while tail < len(self.text) and self.text[tail].isspace():
                    tail += 1
                following = self.text[tail:tail+1]
                if not following or following in ',}]':
                    self.index += 1
                    return json.loads(''.join(parts) + '"')
                # Do not swallow another field/item to conceal a missing comma.
                if (following in ':"[{' or following in '-0123456789'
                        or _NEXT_LITERAL.match(self.text, tail)
                        or _OBJECT_KEY.match(self.text, self.index)):
                    raise ValueError('Ambiguous quote or missing JSON separator')
                parts.append('\\"')
                self.repairs += 1
            elif ord(char) < 32:
                parts.append(json.dumps(char)[1:-1])
                self.repairs += 1
            else:
                parts.append(char)
            self.index += 1
        raise ValueError('Unfinished JSON string')


def parse_ai_result(text):
    text = text.strip().lstrip('\ufeff')
    candidates = [text]
    candidates.extend(match.group(1).strip() for match in re.finditer(
        r'```(?:json)?\s*([\s\S]*?)```', text, re.IGNORECASE))
    # A prose introduction is fine; never extract a partial object from an array.
    if not text.startswith(('{', '[')):
        start, end = text.find('{'), text.rfind('}')
        if start >= 0 and end > start:
            candidates.append(text[start:end+1])
    original = None
    for candidate in candidates:
        try:
            result = json.loads(candidate)
        except ValueError as error:
            original = original or error
            continue
        if not isinstance(result, dict):
            raise ValueError('AI result must be a JSON object')
        return result
    for candidate in candidates:
        try:
            reader = _QuotedStrings(candidate)
            result = reader.value()
            reader.space()
            if reader.index != len(candidate) or not reader.repairs or not isinstance(result, dict):
                continue
            logging.getLogger('browser_bridge').info(
                'Recovered AI JSON string quoting (%s syntax escapes)', reader.repairs)
            return result
        except (ValueError, IndexError, RecursionError):
            continue
    raise original or ValueError('AI result must be a JSON object')
