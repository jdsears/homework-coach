// Pure gamification logic. XP is DERIVED from activity, never stored - it can't
// drift, and improvements apply retroactively.

const DAY_MS = 24 * 60 * 60 * 1000;

const XP_VALUES = {
  chatReply: 5, // each coach reply earned
  attempt: 10, // each practice problem tried
  correctBonus: 5, // extra for getting it right
  challengeBonus: 25, // any day with 3+ practice problems
};

const LEVEL_SIZE = 150;

function computeXp({
  assistantMessages = 0,
  attempts = 0,
  correctAttempts = 0,
  challengeDays = 0,
}) {
  return (
    assistantMessages * XP_VALUES.chatReply +
    attempts * XP_VALUES.attempt +
    correctAttempts * XP_VALUES.correctBonus +
    challengeDays * XP_VALUES.challengeBonus
  );
}

function levelInfo(xp) {
  return {
    level: Math.floor(xp / LEVEL_SIZE) + 1,
    intoLevel: xp % LEVEL_SIZE,
    levelSize: LEVEL_SIZE,
  };
}

function previousDay(dateStr) {
  const date = new Date(`${dateStr}T00:00:00Z`);
  return new Date(date.getTime() - DAY_MS).toISOString().slice(0, 10);
}

// Consecutive active days, scored gently:
// - today doesn't count against the streak until it's over
// - one missed "rest day" is forgiven per rolling week of streak
function computeStreak(activeDates, today) {
  const active = new Set(activeDates);
  let streak = 0;
  let restAvailable = 1;
  let cursor = active.has(today) ? today : previousDay(today);

  for (let walked = 1; ; walked++) {
    if (active.has(cursor)) {
      streak++;
    } else if (streak > 0 && restAvailable > 0) {
      restAvailable--;
    } else {
      break;
    }
    if (walked % 7 === 0) restAvailable = 1;
    cursor = previousDay(cursor);
  }
  return streak;
}

const BADGES = [
  {
    id: 'first-steps',
    emoji: '🌱',
    name: 'First Steps',
    description: 'Started your first session',
    test: s => s.sessions >= 1,
  },
  {
    id: 'curious-mind',
    emoji: '💬',
    name: 'Curious Mind',
    description: '50 messages with your coaches',
    test: s => s.messages >= 50,
  },
  {
    id: 'problem-crusher',
    emoji: '🧩',
    name: 'Problem Crusher',
    description: 'Tried 25 practice problems',
    test: s => s.attempts >= 25,
  },
  {
    id: 'sharp-shooter',
    emoji: '🎯',
    name: 'Sharp Shooter',
    description: 'Got 10 practice problems right',
    test: s => s.correctAttempts >= 10,
  },
  {
    id: 'explorer',
    emoji: '🗺️',
    name: 'Explorer',
    description: 'Tried 4 different subjects',
    test: s => s.subjectsTried >= 4,
  },
  {
    id: 'on-fire',
    emoji: '🔥',
    name: 'On Fire',
    description: 'A 7-day learning streak',
    test: s => s.streak >= 7,
  },
  {
    id: 'marathon',
    emoji: '🏆',
    name: 'Marathon Learner',
    description: 'A 30-day learning streak',
    test: s => s.streak >= 30,
  },
  {
    id: 'photo-detective',
    emoji: '📸',
    name: 'Photo Detective',
    description: 'Snapped your first homework photo',
    test: s => s.photos >= 1,
  },
  {
    id: 'world-speaker',
    emoji: '🌍',
    name: 'World Speaker',
    description: 'Practiced both French and Spanish',
    test: s => s.languagesTried >= 2,
  },
];

function computeBadges(stats) {
  return BADGES.map(({ id, emoji, name, description, test }) => ({
    id,
    emoji,
    name,
    description,
    earned: Boolean(test(stats)),
  }));
}

const CHALLENGE_SUBJECTS = [
  'math',
  'reading',
  'science',
  'math',
  'geography',
  'history',
  'spanish',
];

// A weak topic (when there is one) beats the weekday rotation.
function dailyChallenge({ weakTopic, weekdayIndex }) {
  if (weakTopic) {
    return {
      title: `Practice 3 problems on ${weakTopic.topic}`,
      subject: weakTopic.subject,
      topic: weakTopic.topic,
      goal: 3,
    };
  }
  const subject = CHALLENGE_SUBJECTS[((weekdayIndex % 7) + 7) % 7];
  return { title: `Try 3 practice problems in ${subject}`, subject, topic: '', goal: 3 };
}

module.exports = {
  XP_VALUES,
  LEVEL_SIZE,
  computeXp,
  levelInfo,
  computeStreak,
  computeBadges,
  dailyChallenge,
  previousDay,
};
