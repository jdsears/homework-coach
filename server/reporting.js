// Family summaries, per-child progress, and the weekly digest.
// Shared by the API routes and the weekly email scheduler.

const {
  computeXp,
  levelInfo,
  computeStreak,
  computeBadges,
  dailyChallenge,
} = require('./gamification');

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

function generateParentTip(strugglesBySubject) {
  const tips = [];
  const count = subject => (strugglesBySubject[subject] || []).length;

  if (count('math') > 2) {
    tips.push(
      'Your child is working hard on math! Consider using real-world examples at home, like measuring ingredients while cooking.'
    );
  }
  if (count('reading') > 2) {
    tips.push(
      'Reading practice is going great! Try reading together for 15 minutes before bed to build confidence.'
    );
  }
  if (count('science') > 2) {
    tips.push(
      "Science curiosity is blooming! Simple experiments at home can reinforce what they're learning."
    );
  }
  if (count('geography') > 2) {
    tips.push(
      'Geography is opening up the world! Consider getting a world map for their room, or exploring Google Earth together.'
    );
  }
  if (count('history') > 2) {
    tips.push(
      'History is coming alive! Watch age-appropriate documentaries together or visit a local museum.'
    );
  }
  if (count('french') > 2) {
    tips.push(
      'French is progressing! Try labeling items around the house in French, or watch French cartoons together.'
    );
  }
  if (count('spanish') > 2) {
    tips.push(
      '¡Muy bien! Spanish practice is going well. Try cooking a Spanish or Mexican recipe together and learning food vocabulary.'
    );
  }

  return tips.length > 0
    ? tips
    : ['Great week! Your child is making steady progress. Keep up the encouragement!'];
}

// Sum of capped gaps between consecutive messages within a session, plus a
// minute for opening each session - a fair approximation of time-on-task.
function timeOnTaskMinutes(rows) {
  let totalMs = 0;
  let prev = null;
  for (const row of rows) {
    if (prev && prev.session_id === row.session_id) {
      const gap = new Date(row.created_at) - new Date(prev.created_at);
      totalMs += Math.min(Math.max(gap, 0), 3 * 60 * 1000);
    } else {
      totalMs += 60 * 1000;
    }
    prev = row;
  }
  return Math.round(totalMs / 60000);
}

function childProgress(db, child) {
  const assistantMessages = db
    .prepare(
      `SELECT COUNT(*) AS total FROM messages m JOIN sessions s ON s.id = m.session_id
       WHERE s.child_id = ? AND m.role = 'assistant'`
    )
    .get(child.id).total;

  const attemptStats = db
    .prepare(
      `SELECT COUNT(*) AS attempts, COALESCE(SUM(correct), 0) AS correct
       FROM practice_attempts WHERE child_id = ?`
    )
    .get(child.id);

  const sessions = db
    .prepare('SELECT COUNT(*) AS total FROM sessions WHERE child_id = ?')
    .get(child.id).total;

  const messages = db
    .prepare(
      `SELECT COUNT(*) AS total FROM messages m JOIN sessions s ON s.id = m.session_id
       WHERE s.child_id = ?`
    )
    .get(child.id).total;

  const photos = db
    .prepare(
      `SELECT COUNT(*) AS total FROM messages m JOIN sessions s ON s.id = m.session_id
       WHERE s.child_id = ? AND m.has_image = 1`
    )
    .get(child.id).total;

  const subjectRows = db
    .prepare(
      `SELECT DISTINCT subject FROM (
         SELECT subject FROM sessions WHERE child_id = ?
         UNION SELECT subject FROM practice_attempts WHERE child_id = ?
       )`
    )
    .all(child.id, child.id);
  const subjects = subjectRows.map(row => row.subject);

  const challengeDays = db
    .prepare(
      `SELECT COUNT(*) AS total FROM (
         SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS c
         FROM practice_attempts WHERE child_id = ? GROUP BY day HAVING c >= 3
       )`
    )
    .get(child.id).total;

  const since = new Date(Date.now() - 60 * DAY_MS).toISOString();
  const activeDates = db
    .prepare(
      `SELECT DISTINCT day FROM (
         SELECT substr(m.created_at, 1, 10) AS day FROM messages m
         JOIN sessions s ON s.id = m.session_id WHERE s.child_id = ? AND m.created_at >= ?
         UNION
         SELECT substr(created_at, 1, 10) AS day FROM practice_attempts
         WHERE child_id = ? AND created_at >= ?
       ) ORDER BY day`
    )
    .all(child.id, since, child.id, since)
    .map(row => row.day);

  const streak = computeStreak(activeDates, today());

  const stats = {
    sessions,
    messages,
    attempts: attemptStats.attempts,
    correctAttempts: attemptStats.correct,
    subjectsTried: subjects.length,
    languagesTried: subjects.filter(subject => subject === 'french' || subject === 'spanish')
      .length,
    photos,
    streak,
  };

  const xp = computeXp({
    assistantMessages,
    attempts: attemptStats.attempts,
    correctAttempts: attemptStats.correct,
    challengeDays,
  });

  const weakTopic = db
    .prepare(
      `SELECT subject, topic, score FROM mastery
       WHERE child_id = ? AND attempts >= 3 AND score < 0.6
       ORDER BY score ASC LIMIT 1`
    )
    .get(child.id);

  const attemptsToday = db
    .prepare(
      `SELECT COUNT(*) AS total FROM practice_attempts
       WHERE child_id = ? AND substr(created_at, 1, 10) = ?`
    )
    .get(child.id, today()).total;

  const challenge = dailyChallenge({
    weakTopic: weakTopic || null,
    weekdayIndex: new Date().getUTCDay(),
  });

  return {
    xp,
    ...levelInfo(xp),
    streak,
    activeDates: activeDates.slice(-30),
    badges: computeBadges(stats),
    challenge: {
      ...challenge,
      progress: Math.min(attemptsToday, challenge.goal),
      done: attemptsToday >= challenge.goal,
    },
  };
}

function familySummary(db, family) {
  const weekAgo = new Date(Date.now() - WEEK_MS).toISOString();

  const subjectBreakdown = {
    math: 0,
    reading: 0,
    science: 0,
    geography: 0,
    history: 0,
    french: 0,
    spanish: 0,
  };
  const subjectRows = db
    .prepare(
      `SELECT s.subject AS subject, COUNT(m.id) AS count FROM messages m
       JOIN sessions s ON s.id = m.session_id
       JOIN children c ON c.id = s.child_id
       WHERE c.family_id = ? AND m.created_at >= ?
       GROUP BY s.subject`
    )
    .all(family.id, weekAgo);
  for (const row of subjectRows) subjectBreakdown[row.subject] = row.count;

  // Struggle *types* only - kids' raw words stay out of API responses
  const struggles = {};
  const struggleRows = db
    .prepare(
      `SELECT st.subject AS subject, st.type AS type, st.created_at AS timestamp FROM struggles st
       JOIN sessions s ON s.id = st.session_id
       JOIN children c ON c.id = s.child_id
       WHERE c.family_id = ? AND st.created_at >= ?
       ORDER BY st.created_at DESC`
    )
    .all(family.id, weekAgo);
  for (const row of struggleRows) {
    if (!struggles[row.subject]) struggles[row.subject] = [];
    struggles[row.subject].push({ type: row.type, timestamp: row.timestamp, subject: row.subject });
  }

  const totalSessions = db
    .prepare(
      `SELECT COUNT(*) AS total FROM sessions s
       JOIN children c ON c.id = s.child_id
       WHERE c.family_id = ? AND s.started_at >= ?`
    )
    .get(family.id, weekAgo).total;

  const childRows = db
    .prepare('SELECT id, name, grade FROM children WHERE family_id = ? ORDER BY created_at, id')
    .all(family.id);

  const children = childRows.map(child => {
    const messageRows = db
      .prepare(
        `SELECT m.session_id, m.created_at FROM messages m
         JOIN sessions s ON s.id = m.session_id
         WHERE s.child_id = ? AND m.created_at >= ?
         ORDER BY m.session_id, m.id`
      )
      .all(child.id, weekAgo);

    const attemptsThisWeek = db
      .prepare(
        'SELECT COUNT(*) AS total FROM practice_attempts WHERE child_id = ? AND created_at >= ?'
      )
      .get(child.id, weekAgo).total;

    const masteryRows = db
      .prepare('SELECT subject, topic, score FROM mastery WHERE child_id = ? AND attempts >= 3')
      .all(child.id);

    return {
      ...child,
      messageCount: messageRows.length,
      practiceCount: attemptsThisWeek,
      minutes: timeOnTaskMinutes(messageRows),
      strengths: masteryRows
        .filter(row => row.score >= 0.7)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(row => row.topic),
      focusAreas: masteryRows
        .filter(row => row.score <= 0.4)
        .sort((a, b) => a.score - b.score)
        .slice(0, 3)
        .map(row => row.topic),
    };
  });

  // Last 14 days of activity for the chart: messages + practice per day
  const since14 = new Date(Date.now() - 14 * DAY_MS).toISOString();
  const perDay = new Map();
  for (let i = 13; i >= 0; i--) {
    const day = new Date(Date.now() - i * DAY_MS).toISOString().slice(0, 10);
    perDay.set(day, { date: day, messages: 0, practice: 0 });
  }
  const messageDays = db
    .prepare(
      `SELECT substr(m.created_at, 1, 10) AS day, COUNT(*) AS c FROM messages m
       JOIN sessions s ON s.id = m.session_id
       JOIN children c2 ON c2.id = s.child_id
       WHERE c2.family_id = ? AND m.created_at >= ? GROUP BY day`
    )
    .all(family.id, since14);
  for (const row of messageDays) if (perDay.has(row.day)) perDay.get(row.day).messages = row.c;
  const practiceDays = db
    .prepare(
      `SELECT substr(pa.created_at, 1, 10) AS day, COUNT(*) AS c FROM practice_attempts pa
       JOIN children c2 ON c2.id = pa.child_id
       WHERE c2.family_id = ? AND pa.created_at >= ? GROUP BY day`
    )
    .all(family.id, since14);
  for (const row of practiceDays) if (perDay.has(row.day)) perDay.get(row.day).practice = row.c;

  return {
    weekStart: weekAgo,
    weekEnd: now(),
    familyName: family.name,
    familyCode: family.code,
    digestEmail: family.digest_email || '',
    totalSessions,
    totalMinutes: children.reduce((sum, child) => sum + child.minutes, 0),
    subjectBreakdown,
    struggles,
    children,
    dailyActivity: Array.from(perDay.values()),
    encouragement: generateParentTip(struggles),
  };
}

const escapeHtml = text =>
  String(text).replace(
    /[&<>"']/g,
    ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]
  );

// Inline-styled HTML that renders decently in every mail client.
function buildDigestHtml(family, summary, progressByChildId) {
  const kidBlocks = summary.children
    .map(child => {
      const progress = progressByChildId[child.id];
      const strengths = child.strengths.length
        ? `<p style="margin:4px 0;color:#065f46;">💪 Strong: ${escapeHtml(child.strengths.join(', '))}</p>`
        : '';
      const focus = child.focusAreas.length
        ? `<p style="margin:4px 0;color:#92400e;">🎯 Working on: ${escapeHtml(child.focusAreas.join(', '))}</p>`
        : '';
      return `
      <div style="background:#f8fafc;border-radius:12px;padding:16px;margin:12px 0;">
        <h3 style="margin:0 0 6px;font-size:16px;">${escapeHtml(child.name)} (grade ${escapeHtml(child.grade)})</h3>
        <p style="margin:4px 0;">🕐 ${child.minutes} min on task · 💬 ${child.messageCount} messages · ✏️ ${child.practiceCount} practice problems</p>
        ${progress ? `<p style="margin:4px 0;">🔥 ${progress.streak}-day streak · ⭐ Level ${progress.level}</p>` : ''}
        ${strengths}${focus}
      </div>`;
    })
    .join('');

  const tips = summary.encouragement
    .map(tip => `<p style="margin:6px 0;">💡 ${escapeHtml(tip)}</p>`)
    .join('');

  return `
  <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;color:#1e293b;">
    <div style="background:linear-gradient(135deg,#667eea,#764ba2);border-radius:16px;padding:24px;color:white;text-align:center;">
      <h1 style="margin:0;font-size:22px;">📚 The ${escapeHtml(family.name)} family's learning week</h1>
      <p style="margin:8px 0 0;opacity:0.9;">${summary.totalSessions} sessions · ${summary.totalMinutes} minutes of focused learning</p>
    </div>
    ${kidBlocks}
    <div style="background:#ecfdf5;border-radius:12px;padding:16px;margin:12px 0;">
      <h3 style="margin:0 0 6px;font-size:15px;">Tips for this week</h3>
      ${tips}
    </div>
    <p style="color:#64748b;font-size:12px;text-align:center;">Sent by your family's Homework Coach. Manage this digest from the parent dashboard.</p>
  </div>`;
}

module.exports = { familySummary, childProgress, buildDigestHtml, generateParentTip };
