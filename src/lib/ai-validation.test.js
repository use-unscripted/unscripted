import { describe, it, expect } from 'vitest';
import { toText, toTextList, toBoundedNumber, toEnum, isPlainObject, describeShape, LEVELS } from './ai-validation';

describe('toText', () => {
  it('trims a string', () => {
    expect(toText('  hello  ')).toBe('hello');
  });

  it('never returns [object Object] or raw JSON', () => {
    for (const value of [{}, { unknown: 'x' }, [], [1, 2], () => {}, Symbol('s')]) {
      const out = toText(value);
      expect(out).not.toMatch(/\[object/);
      expect(out).not.toMatch(/^[[{]/);
    }
  });

  it('mines a likely text key out of an object rather than dropping the sentence', () => {
    expect(toText({ step: 'Email three alumni' })).toBe('Email three alumni');
    expect(toText({ title: 'Book the call' })).toBe('Book the call');
    expect(toText({ description: 'Write the notes' })).toBe('Write the notes');
  });

  it('prefers the more specific key when several are present', () => {
    expect(toText({ description: 'long version', step: 'short version' })).toBe('short version');
  });

  it('returns an empty string for anything unusable', () => {
    for (const value of [null, undefined, '', '   ', NaN, Infinity, {}, [], true]) {
      expect(toText(value)).toBe('');
    }
  });

  it('renders a finite number', () => {
    expect(toText(42)).toBe('42');
    expect(toText(0)).toBe('0');
  });
});

describe('toTextList', () => {
  it('keeps only usable strings', () => {
    expect(toTextList(['a', '', null, 'b', 42, {}, []])).toEqual(['a', 'b', '42']);
  });

  it('converts a list of objects into a list of strings', () => {
    expect(toTextList([{ step: 'One' }, { step: 'Two' }])).toEqual(['One', 'Two']);
  });

  it('wraps a bare string, since one item is still an answer', () => {
    expect(toTextList('Just the one')).toEqual(['Just the one']);
  });

  it('returns an empty array for anything else', () => {
    for (const value of [null, undefined, 42, {}, true]) {
      expect(toTextList(value)).toEqual([]);
    }
  });
});

describe('toBoundedNumber', () => {
  it('accepts a number inside the range', () => {
    expect(toBoundedNumber(5, 0, 10)).toBe(5);
    expect(toBoundedNumber(0, 0, 10)).toBe(0);
    expect(toBoundedNumber(10, 0, 10)).toBe(10);
  });

  it('accepts a numeric string', () => {
    expect(toBoundedNumber('7', 0, 10)).toBe(7);
  });

  it('returns the fallback rather than clamping, so a wrong answer is not disguised as a plausible one', () => {
    expect(toBoundedNumber(74, 0, 10, null)).toBeNull();
    expect(toBoundedNumber(-1, 0, 10, null)).toBeNull();
    expect(toBoundedNumber(600, 1, 240, 15)).toBe(15);
  });

  it('rejects anything that is not a finite number', () => {
    for (const value of [null, undefined, NaN, Infinity, 'high', '', {}, []]) {
      expect(toBoundedNumber(value, 0, 10, null)).toBeNull();
    }
  });
});

describe('toEnum', () => {
  it('matches case-insensitively and trims', () => {
    expect(toEnum('  HIGH ', LEVELS)).toBe('high');
  });

  it('returns the fallback for a near miss', () => {
    expect(toEnum('moderate', LEVELS, 'medium')).toBe('medium');
    expect(toEnum('Medium-High', LEVELS, 'medium')).toBe('medium');
  });

  it('returns the fallback for a non-string', () => {
    for (const value of [null, undefined, 3, {}, []]) {
      expect(toEnum(value, LEVELS, 'medium')).toBe('medium');
    }
  });

  it('defaults to null when no fallback is given, so a caller can refuse to write', () => {
    expect(toEnum('moderate', LEVELS)).toBeNull();
  });
});

describe('isPlainObject and describeShape', () => {
  it('separates objects from arrays and primitives', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject('x')).toBe(false);
  });

  it('describes shape without ever quoting content', () => {
    expect(describeShape('a students private answer')).toBe('a string');
    expect(describeShape({ secret: 1 })).toBe('an object');
    expect(describeShape([1])).toBe('an array');
    expect(describeShape(null)).toBe('null');
    expect(describeShape(undefined)).toBe('undefined');
  });
});

describe('nothing throws, whatever the model returns', () => {
  it('survives hostile input', () => {
    const hostile = [
      null, undefined, NaN, Infinity, -0, '', [], {},
      Object.create(null),
      JSON.parse('{"__proto__": {"polluted": true}}'),
      { toString() { throw new Error('nope'); } },
    ];
    for (const value of hostile) {
      expect(() => toText(value)).not.toThrow();
      expect(() => toTextList(value)).not.toThrow();
      expect(() => toBoundedNumber(value, 0, 10)).not.toThrow();
      expect(() => toEnum(value, LEVELS)).not.toThrow();
      expect(() => describeShape(value)).not.toThrow();
    }
    expect({}.polluted).toBeUndefined();
  });
});
