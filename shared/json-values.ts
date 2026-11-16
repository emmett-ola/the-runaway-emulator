import { CodecError } from './types';

export function pointer(parent: string, key: string | number): string {
  return `${parent}/${String(key).replace(/~/g, '~0').replace(/\//g, '~1')}`;
}

export function validateString(value: string, path: string, offset?: number): void {
  for (let index = 0; index < value.length; index++) {
    const unit = value.charCodeAt(index);
    if (unit === 0) throw new CodecError('NUL_CHARACTER', 'NUL is not supported by jsonb.', path, offset);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(++index);
      if (next >= 0xdc00 && next <= 0xdfff) continue;
    } else if (unit < 0xdc00 || unit > 0xdfff) {
      continue;
    }
    throw new CodecError('INVALID_UNICODE', 'Unpaired UTF-16 surrogate.', path, offset);
  }
}

/** JS's default sort is UTF-16 code-unit order, not Unicode code-point order. */
export function compareCodePoints(left: string, right: string): number {
  const a = left[Symbol.iterator]();
  const b = right[Symbol.iterator]();
  for (;;) {
    const x = a.next();
    const y = b.next();
    if (x.done || y.done) return x.done ? (y.done ? 0 : -1) : 1;
    const pointX = x.value.codePointAt(0);
    const pointY = y.value.codePointAt(0);
    if (pointX !== undefined && pointY !== undefined && pointX !== pointY) return pointX - pointY;
  }
}
