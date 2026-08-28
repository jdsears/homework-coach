import { describe, it, expect } from 'vitest';
import { resolveSubjectId, visibleSubjectIds } from '../client/src/subjects';

describe('which subjects a kid is offered', () => {
  it('gives US families one English coach at every grade', () => {
    const grade5 = visibleSubjectIds('us', 5);
    expect(grade5).toContain('reading');
    expect(grade5).not.toContain('englishlang');
    expect(grade5).not.toContain('englishlit');
    expect(grade5).not.toContain('furthermaths');
    // US grades stop at 8, but the rules must not leak UK-only subjects anyway
    expect(visibleSubjectIds('us', 8)).toContain('reading');
  });

  it('keeps English as one subject up to Year 9', () => {
    for (const year of [3, 7, 9]) {
      const subjects = visibleSubjectIds('uk', year);
      expect(subjects).toContain('reading');
      expect(subjects).not.toContain('englishlang');
      expect(subjects).not.toContain('englishlit');
    }
  });

  it('splits English into two GCSEs from Year 10', () => {
    for (const year of [10, 11, 12, 13]) {
      const subjects = visibleSubjectIds('uk', year);
      expect(subjects).toContain('englishlang');
      expect(subjects).toContain('englishlit');
      expect(subjects).not.toContain('reading');
    }
  });

  it('offers Further Maths from Year 9 only', () => {
    expect(visibleSubjectIds('uk', 8)).not.toContain('furthermaths');
    expect(visibleSubjectIds('uk', 9)).toContain('furthermaths');
    expect(visibleSubjectIds('uk', 13)).toContain('furthermaths');
  });

  it('keeps the core subjects at every year', () => {
    for (const year of [3, 11, 13]) {
      const subjects = visibleSubjectIds('uk', year);
      for (const core of ['math', 'science', 'geography', 'history', 'french', 'spanish']) {
        expect(subjects).toContain(core);
      }
    }
  });
});

describe('resolving a challenge subject onto what is offered', () => {
  it('reads "reading" as English Language at GCSE', () => {
    expect(resolveSubjectId('reading', 'uk', 11)).toBe('englishlang');
  });

  it('leaves a subject alone when it is offered', () => {
    expect(resolveSubjectId('reading', 'uk', 7)).toBe('reading');
    expect(resolveSubjectId('reading', 'us', 5)).toBe('reading');
    expect(resolveSubjectId('history', 'uk', 11)).toBe('history');
  });

  it('falls back to the first offered subject for anything unavailable', () => {
    expect(resolveSubjectId('furthermaths', 'uk', 4)).toBe('math');
    expect(resolveSubjectId('englishlit', 'us', 5)).toBe('math');
  });
});
