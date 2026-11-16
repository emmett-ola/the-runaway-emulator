import { CodecError, MAX_JSON_DEPTH } from './types';
import type { JsonValue } from './types';
import { pointer, validateString } from './json-values';

/** Parses without JSON.parse: duplicate decoded keys can never be overwritten. */
export function parseJson(source: string): JsonValue {
  let position = 0;
  const fail = (message: string, path: string): never => {
    throw new CodecError('INVALID_JSON', message, path, position);
  };
  const whitespace = () => {
    while (' \t\r\n'.includes(source[position] ?? '￿')) position++;
  };
  const string = (path: string): string => {
    const start = position++;
    let result = '';
    while (position < source.length) {
      const character = source[position++];
      if (character === '"') {
        validateString(result, path, start);
        return result;
      }
      if (character === '\\') {
        const escape = source[position++];
        if (escape === 'u') {
          const digits = source.slice(position, position + 4);
          if (!/^[0-9a-fA-F]{4}$/.test(digits)) fail('Invalid Unicode escape.', path);
          result += String.fromCharCode(Number.parseInt(digits, 16));
          position += 4;
        } else {
          switch (escape) {
            case '"': result += '"'; break;
            case '\\': result += '\\'; break;
            case '/': result += '/'; break;
            case 'b': result += '\b'; break;
            case 'f': result += '\f'; break;
            case 'n': result += '\n'; break;
            case 'r': result += '\r'; break;
            case 't': result += '\t'; break;
            default: fail('Invalid string escape.', path);
          }
        }
      } else {
        if (character.charCodeAt(0) < 0x20) fail('Unescaped control character.', path);
        result += character;
      }
    }
    return fail('Unterminated string.', path);
  };
  const value = (path: string, depth: number): JsonValue => {
    whitespace();
    const token = source[position];
    if (token === '"') return string(path);
    if (token === '{' || token === '[') {
      if (depth >= MAX_JSON_DEPTH) {
        throw new CodecError('MAX_DEPTH', 'JSON container nesting exceeds 64.', path, position);
      }
      position++;
      whitespace();
      if (token === '[') {
        const result: JsonValue[] = [];
        if (source[position] === ']') { position++; return result; }
        for (;;) {
          result.push(value(pointer(path, result.length), depth + 1));
          whitespace();
          const separator = source[position++];
          if (separator === ']') return result;
          if (separator !== ',') fail('Expected comma or closing bracket.', path);
        }
      }
      const result: { [key: string]: JsonValue } = {};
      const keys = new Set<string>();
      if (source[position] === '}') { position++; return result; }
      for (;;) {
        whitespace();
        if (source[position] !== '"') fail('Expected object key.', path);
        const keyStart = position;
        const key = string(path);
        const childPath = pointer(path, key);
        if (keys.has(key)) {
          throw new CodecError('DUPLICATE_KEY', 'Duplicate object key.', childPath, keyStart);
        }
        keys.add(key);
        whitespace();
        if (source[position++] !== ':') fail('Expected colon after key.', childPath);
        const child = value(childPath, depth + 1);
        Object.defineProperty(result, key, {
          value: child, enumerable: true, configurable: true, writable: true,
        });
        whitespace();
        const separator = source[position++];
        if (separator === '}') return result;
        if (separator !== ',') fail('Expected comma or closing brace.', path);
      }
    }
    for (const [literal, decoded] of [['null', null], ['true', true], ['false', false]]) {
      if (typeof literal === 'string' && source.startsWith(literal, position)) {
        position += literal.length;
        if (decoded === null || typeof decoded === 'boolean') return decoded;
      }
    }
    const match = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(source.slice(position));
    if (!match) return fail('Expected a JSON value.', path);
    position += match[0].length;
    const number = Number(match[0]);
    if (!Number.isFinite(number)) {
      throw new CodecError('NON_FINITE_NUMBER', 'Number is not finite IEEE-754.', path, position);
    }
    return Object.is(number, -0) ? 0 : number;
  };
  const result = value('$', 0);
  whitespace();
  if (position !== source.length) fail('Unexpected trailing input.', '$');
  return result;
}
