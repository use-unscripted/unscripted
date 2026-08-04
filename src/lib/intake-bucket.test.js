import { describe, it, expect } from 'vitest';
import { KNOWN_PATHS, bucketPath } from './intake-bucket';

const ALLOWED = new Set([...KNOWN_PATHS, 'other', 'none']);

describe('bucketPath', () => {
  it('never returns anything a student typed', () => {
    const typed = [
      'my uncle owns a dealership in Toledo',
      'ballet',
      'Investment banking at Goldman',
      'ART',
      'x',
      '',
      '   ',
      'law',
      'nonprofit work with kids',
      'a',
      'game design',
      'medicine',
      '<script>alert(1)</script>',
      'c++',
      '.*',
    ];
    for (const t of typed) {
      expect(ALLOWED.has(bucketPath(t)), `leaked for ${JSON.stringify(t)}`).toBe(true);
    }
  });

  it('survives regex characters without throwing', () => {
    expect(() => bucketPath('c++ (systems)')).not.toThrow();
    expect(() => bucketPath('[unclear]')).not.toThrow();
    expect(bucketPath('.*')).toBe('other');
  });

  it('reports nothing typed as none', () => {
    expect(bucketPath('')).toBe('none');
    expect(bucketPath('   ')).toBe('none');
    expect(bucketPath(null)).toBe('none');
    expect(bucketPath(undefined)).toBe('none');
  });

  it('matches a known path however it was capitalised or padded', () => {
    expect(bucketPath('law')).toBe('Law');
    expect(bucketPath('  LAW  ')).toBe('Law');
    expect(bucketPath('Medicine')).toBe('Medicine / healthcare');
  });

  it('matches on a word inside a longer label', () => {
    expect(bucketPath('banking')).toBe('Investment banking / finance');
    expect(bucketPath('consulting')).toBe('Management consulting');
  });

  it('matches when the student wrote a sentence around the path', () => {
    expect(bucketPath('I want to try investment banking this summer'))
      .toBe('Investment banking / finance');
  });

  it('does not match a fragment that lands mid-word', () => {
    // "art" is inside "marketing". It used to report someone interested in the
    // arts as marketing, which is a wrong answer, not a rough one.
    expect(bucketPath('art')).toBe('other');
    expect(bucketPath('ted')).toBe('other');
  });

  it('does not guess from one or two characters', () => {
    expect(bucketPath('a')).toBe('other');
    expect(bucketPath('la')).toBe('other');
  });

  it('reports anything genuinely unlisted as other', () => {
    expect(bucketPath('running a restaurant')).toBe('other');
    expect(bucketPath('ballet')).toBe('other');
  });
});
