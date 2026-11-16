// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { canonicalStringify, CodecError, decodeCanonical, encodeCanonical, validateInstant } from './codec';
import type { JsonValue } from './types';

function diagnosed(action: () => unknown, code: string, path?: string): void {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(CodecError);
    if (!(error instanceof CodecError)) throw error;
    expect(error.code).toBe(code);
    if (path !== undefined) expect(error.path).toBe(path);
    return;
  }
  throw new Error(`Expected ${code}.`);
}

function nested(containers: number): JsonValue {
  let value: JsonValue = 'leaf';
  for (let index = 0; index < containers; index++) value = [value];
  return value;
}

describe('run-json-1 canonical encoder', () => {
  it('sorts recursively by Unicode code points, including integer-looking keys', () => {
    const input = { '\u{10000}': 1, '': 2, z: { '2': 2, '10': 10, a: 1 }, a: [3, 2, 1] };
    expect(canonicalStringify(input)).toBe('{"a":[3,2,1],"z":{"10":10,"2":2,"a":1},"":2,"𐀀":1}');
    expect(canonicalStringify({ aa: 1, a: 2, '😀a': 3, '😀': 4 }))
      .toBe('{"a":2,"aa":1,"😀":4,"😀a":3}');
  });

  it('does not normalize strings and preserves arrays, scalars, and presence', () => {
    const input = { decomposed: 'é', composed: 'é', empty: {}, list: [null, false, '', []] };
    expect(decodeCanonical(encodeCanonical(input))).toEqual(input);
    expect(canonicalStringify({ a: null })).not.toBe(canonicalStringify({}));
    expect(canonicalStringify(['b', 'a', 'b'])).toBe('["b","a","b"]');
    expect(canonicalStringify('"\\\n\t\b\f\r')).toBe(JSON.stringify('"\\\n\t\b\f\r'));
  });

  it('uses ECMAScript number rendering with negative zero normalized', () => {
    const numbers = [-0, 1e-7, 1e-6, 1e20, 1e21, Number.MIN_VALUE, Number.MAX_VALUE, Number('333333333.33333329')];
    expect(canonicalStringify(numbers)).toBe(JSON.stringify(numbers));
    expect(canonicalStringify(-0)).toBe('0');
    expect(canonicalStringify({ recordVersion: '9223372036854775807' }))
      .toBe('{"recordVersion":"9223372036854775807"}');
  });

  it('emits exact UTF-8 without a BOM/newline and accepts null-prototype dictionaries', () => {
    expect(Array.from(encodeCanonical('é😀'))).toEqual([34, 195, 169, 240, 159, 152, 128, 34]);
    const dictionary: unknown = Object.create(null);
    if (dictionary === null || typeof dictionary !== 'object') throw new Error('Expected dictionary.');
    Object.defineProperty(dictionary, '__proto__', { value: 7, enumerable: true });
    expect(canonicalStringify(dictionary)).toBe('{"__proto__":7}');
    expect(Object.getPrototypeOf(dictionary)).toBeNull();
  });

  it.each([undefined, () => 1, Symbol('x'), 1n])('rejects unsupported value %s', value => {
    diagnosed(() => canonicalStringify({ payload: [value] }), 'UNSUPPORTED_VALUE', '$/payload/0');
  });

  it.each([NaN, Infinity, -Infinity])('rejects non-finite number %s', value => {
    diagnosed(() => canonicalStringify(value), 'NON_FINITE_NUMBER', '$');
  });

  it.each([new Date(0), new Map(), new Set(), /x/, new Uint8Array([1]), new Number(1)])(
    'rejects nonplain objects %s', value => {
      diagnosed(() => canonicalStringify(value), 'UNSUPPORTED_VALUE');
    });

  it('rejects unsupported properties without invoking getters or toJSON', () => {
    let calls = 0;
    const getter = { get x() { calls++; return 1; } };
    const toJson = { toJSON() { calls++; return 1; } };
    diagnosed(() => canonicalStringify(getter), 'UNSUPPORTED_VALUE', '$/x');
    diagnosed(() => canonicalStringify(toJson), 'UNSUPPORTED_VALUE', '$/toJSON');
    expect(calls).toBe(0);
    diagnosed(() => canonicalStringify({ [Symbol('hidden')]: 1 }), 'UNSUPPORTED_VALUE');
    diagnosed(() => canonicalStringify(Object.defineProperty({}, 'hidden', { value: 1 })), 'UNSUPPORTED_VALUE');
    diagnosed(() => canonicalStringify(new Array(2)), 'UNSUPPORTED_VALUE');
    const array = [1];
    Object.defineProperty(array, 'extra', { value: 2, enumerable: true });
    diagnosed(() => canonicalStringify(array), 'UNSUPPORTED_VALUE');
  });

  it('rejects cycles but permits repeated references without changing the source', () => {
    const cycle: { next?: unknown } = {};
    cycle.next = cycle;
    diagnosed(() => canonicalStringify(cycle), 'CYCLE', '$/next');
    const shared = Object.freeze({ x: 1 });
    const input = Object.freeze([shared, shared]);
    expect(canonicalStringify(input)).toBe('[{"x":1},{"x":1}]');
  });

  it('accepts 64 nested containers and rejects 65, regardless of leaf type', () => {
    expect(canonicalStringify(nested(64))).toBe(`${'['.repeat(64)}"leaf"${']'.repeat(64)}`);
    diagnosed(() => canonicalStringify(nested(65)), 'MAX_DEPTH');
    let empty: JsonValue = {};
    for (let index = 1; index < 65; index++) empty = { child: empty };
    diagnosed(() => canonicalStringify(empty), 'MAX_DEPTH');
  });

  it.each(['\ud800', '\udfff', 'a\ud800z', '\udc00\ud800'])('rejects unpaired surrogate %s', value => {
    diagnosed(() => canonicalStringify(value), 'INVALID_UNICODE');
    diagnosed(() => canonicalStringify({ [value]: 1 }), 'INVALID_UNICODE');
  });

  it('rejects embedded NUL in values and keys', () => {
    diagnosed(() => canonicalStringify({ x: '\0' }), 'NUL_CHARACTER', '$/x');
    diagnosed(() => canonicalStringify({ ['\0']: 1 }), 'NUL_CHARACTER');
  });
});

describe('run-json-1 diagnostic decoder', () => {
  it('accepts noncanonical JSON without treating parsed bytes as integrity authority', () => {
    const source = ' \n { "z" : [ -0, true, false, null, 1.20e+2 ], "a":"\\u0061" } \t';
    expect(canonicalStringify(decodeCanonical(source))).toBe('{"a":"a","z":[0,true,false,null,120]}');
    expect(Object.is(decodeCanonical('-0'), -0)).toBe(false);
  });

  it.each(['{"a":1,"a":2}', '{"a":1,"\\u0061":2}', '{"𐀀":1,"\\ud800\\udc00":2}'])(
    'rejects duplicate decoded keys before they can be overwritten', source => {
      diagnosed(() => decodeCanonical(source), 'DUPLICATE_KEY');
    });

  it('diagnoses nested duplicate keys with escaped JSON Pointer path and offset', () => {
    const source = '{"payload":[{"a/b~":1,"a/b~":2}]}';
    try {
      decodeCanonical(source);
      throw new Error('Expected duplicate key.');
    } catch (error) {
      if (!(error instanceof CodecError)) throw error;
      expect(error.code).toBe('DUPLICATE_KEY');
      expect(error.path).toBe('$/payload/0/a~1b~0');
      expect(error.offset).toBe(source.lastIndexOf('"a/b~"'));
    }
  });

  it('preserves dangerous-looking keys as own data without prototype pollution', () => {
    const decoded = decodeCanonical('{"__proto__":{"polluted":true},"constructor":7}');
    if (decoded === null || typeof decoded !== 'object') throw new Error('Expected object.');
    expect(Object.getPrototypeOf(decoded)).toBe(Object.prototype);
    expect(Object.hasOwn(decoded, '__proto__')).toBe(true);
    expect(canonicalStringify(decoded)).toBe('{"__proto__":{"polluted":true},"constructor":7}');
    expect(Object.hasOwn({}, 'polluted')).toBe(false);
  });

  it.each(['', 'undefined', 'NaN', 'Infinity', '{', '[1,]', '{"a":1,}', '{"a":}', '01', '+1', '.1', '1.',
    '1e', 'true false', '"\\x00"', '"\\u123"', '"line\nbreak"', '﻿{}'])(
    'rejects invalid JSON %s', source => {
      diagnosed(() => decodeCanonical(source), 'INVALID_JSON');
    });

  it.each(['"\\ud800"', '"\\udc00"', '"\ud800"', '{"\\ud800":1}'])(
    'rejects lone surrogates after unescaping', source => {
      diagnosed(() => decodeCanonical(source), 'INVALID_UNICODE');
    });

  it('rejects decoded NUL and non-finite exponent values', () => {
    diagnosed(() => decodeCanonical('"\\u0000"'), 'NUL_CHARACTER');
    diagnosed(() => decodeCanonical('{"\\u0000":0}'), 'NUL_CHARACTER');
    diagnosed(() => decodeCanonical('1e400'), 'NON_FINITE_NUMBER');
    expect(decodeCanonical('"\\ud800\\udc00"')).toBe('𐀀');
  });

  it('rejects malformed UTF-8 instead of substituting replacement characters', () => {
    for (const bytes of [[34, 0xff, 34], [34, 0xc0, 0x80, 34], [34, 0xed, 0xa0, 0x80, 34], [34, 0xe2, 34]]) {
      diagnosed(() => decodeCanonical(new Uint8Array(bytes)), 'INVALID_UTF8');
    }
    diagnosed(() => decodeCanonical(new Uint8Array([0xef, 0xbb, 0xbf, 123, 125])), 'INVALID_JSON');
    expect(decodeCanonical(encodeCanonical('�'))).toBe('�');
  });

  it('bounds parser nesting before allocating a deeper tree', () => {
    const atLimit = `${'['.repeat(64)}0${']'.repeat(64)}`;
    expect(canonicalStringify(decodeCanonical(atLimit))).toBe(atLimit);
    diagnosed(() => decodeCanonical(`${'['.repeat(65)}0${']'.repeat(65)}`), 'MAX_DEPTH');
    const keys = '{"x":'.repeat(65) + '0' + '}'.repeat(65);
    diagnosed(() => decodeCanonical(keys), 'MAX_DEPTH');
  });
});

describe('domain instants', () => {
  it.each([-8_640_000_000_000_000, -1, -0, 0, 1, 8_640_000_000_000_000])('accepts %s', value => {
    expect(validateInstant(value)).toBe(true);
  });
  it.each([-8_640_000_000_000_001, 8_640_000_000_000_001, 0.5, NaN, Infinity, null, '0', new Date(0)])(
    'rejects %s', value => {
      expect(validateInstant(value)).toBe(false);
    });
});
