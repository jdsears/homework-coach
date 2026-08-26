import { describe, it, expect } from 'vitest';
import {
  computeStreak,
  computeXp,
  levelInfo,
  computeBadges,
  dailyChallenge,
} from '../server/gamification.js';

describe('computeStreak', () => {
  const today = '2026-08-26';

  it('is 0 with no activity', () => {
    expect(computeStreak([], today)).toBe(0);
  });

  it('counts today when active', () => {
    expect(computeStreak(['2026-08-26'], today)).toBe(1);
  });

  it("doesn't punish an unfinished today", () => {
    expect(computeStreak(['2026-08-25', '2026-08-24'], today)).toBe(2);
  });

  it('forgives one rest day per week', () => {
    expect(computeStreak(['2026-08-25', '2026-08-24', '2026-08-22', '2026-08-21'], today)).toBe(4);
  });

  it('breaks on two missed days in a row', () => {
    expect(computeStreak(['2026-08-25', '2026-08-21'], today)).toBe(1);
  });

  it('handles a 30-day streak', () => {
    const dates = [];
    for (let i = 1; i <= 30; i++) {
      dates.push(new Date(Date.UTC(2026, 7, 26) - i * 86400000).toISOString().slice(0, 10));
    }
    expect(computeStreak(dates, today)).toBe(30);
  });
});

describe('xp & levels', () => {
  it('derives xp from activity', () => {
    expect(
      computeXp({ assistantMessages: 2, attempts: 3, correctAttempts: 1, challengeDays: 1 })
    ).toBe(2 * 5 + 3 * 10 + 1 * 5 + 1 * 25);
  });

  it('levels up every 150 xp', () => {
    expect(levelInfo(0).level).toBe(1);
    expect(levelInfo(149).level).toBe(1);
    expect(levelInfo(149).intoLevel).toBe(149);
    expect(levelInfo(150).level).toBe(2);
  });
});

describe('badges & challenge', () => {
  it('marks earned badges', () => {
    const badges = computeBadges({
      sessions: 1,
      messages: 60,
      attempts: 0,
      correctAttempts: 0,
      subjectsTried: 1,
      languagesTried: 0,
      photos: 0,
      streak: 0,
    });
    expect(badges.find(badge => badge.id === 'first-steps').earned).toBe(true);
    expect(badges.find(badge => badge.id === 'curious-mind').earned).toBe(true);
    expect(badges.find(badge => badge.id === 'problem-crusher').earned).toBe(false);
  });

  it('prefers a weak topic for the daily challenge, else rotates by weekday', () => {
    const weak = dailyChallenge({
      weakTopic: { subject: 'math', topic: 'long division' },
      weekdayIndex: 2,
    });
    expect(weak.title).toContain('long division');
    expect(dailyChallenge({ weakTopic: null, weekdayIndex: 2 }).subject).toBe('science');
  });
});
