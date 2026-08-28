import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createDb } from '../server/db';
import { createApp } from '../server/app';

const COACH_REPLY = 'Great question! What do you already know about it?';

const tick = (ms = 15) => new Promise(resolve => setTimeout(resolve, ms));

function makeFakeAnthropic() {
  const calls = { stream: [], parse: [] };

  // Mutable per-test knobs
  const state = {
    classifier: { answer_fishing: false, frustration: 0, topic: 'fractions' },
    grade: { correct: true, feedback: 'You lined the denominators up - nice!' },
  };

  const streamImpl = params => {
    calls.stream.push(params);
    const listeners = {};
    return {
      on(event, cb) {
        (listeners[event] ||= []).push(cb);
        return this;
      },
      async finalMessage() {
        for (const chunk of [COACH_REPLY.slice(0, 12), COACH_REPLY.slice(12)]) {
          (listeners.text || []).forEach(cb => cb(chunk));
        }
        return {
          content: [{ type: 'text', text: COACH_REPLY }],
          usage: { input_tokens: 10, output_tokens: 5 },
          stop_reason: 'end_turn',
        };
      },
    };
  };

  const parseImpl = async params => {
    calls.parse.push(params);
    const systemText =
      typeof params.system === 'string' ? params.system : JSON.stringify(params.system);
    let parsed;
    if (systemText.includes('You watch one message')) {
      parsed = { ...state.classifier };
    } else if (systemText.includes('You grade one practice-problem')) {
      parsed = { ...state.grade };
    } else if (systemText.includes("tutor's private memory")) {
      parsed = {
        memory: 'Maya has been working on equivalent fractions and is gaining confidence.',
      };
    } else {
      // Practice generation on a subject persona
      parsed = {
        problems: [
          {
            problem: 'What is $\\frac{1}{2} + \\frac{1}{4}$?',
            hint: 'Make the denominators match first.',
            answer: '3/4',
            explanation: 'Halves become quarters: 2/4 + 1/4 = 3/4.',
            difficulty: 1,
          },
          {
            problem: 'What is 2/3 of 12?',
            hint: 'Split 12 into 3 equal groups.',
            answer: '8',
            explanation: '12 ÷ 3 = 4, and two groups of 4 make 8.',
            difficulty: 2,
          },
          {
            problem: 'Which is bigger: 5/8 or 3/5?',
            hint: 'Give them the same denominator (40 works).',
            answer: '5/8',
            explanation: '5/8 = 25/40 and 3/5 = 24/40.',
            difficulty: 3,
          },
        ],
      };
    }
    return { parsed_output: parsed, usage: { input_tokens: 6, output_tokens: 3 } };
  };

  return {
    calls,
    state,
    messages: { stream: streamImpl, parse: parseImpl },
    beta: { messages: { stream: streamImpl } },
  };
}

function parseSse(text) {
  return text
    .split('\n\n')
    .filter(Boolean)
    .map(block => {
      let event = 'message';
      let data = '';
      for (const line of block.split('\n')) {
        if (line.startsWith('event: ')) event = line.slice(7);
        else if (line.startsWith('data: ')) data += line.slice(6);
      }
      return data ? { event, data: JSON.parse(data) } : null;
    })
    .filter(Boolean);
}

function build(config = {}) {
  const db = createDb(':memory:');
  const anthropic = makeFakeAnthropic();
  const app = createApp({
    db,
    anthropic,
    config: { rateLimits: false, isProd: false, cookieSecret: 'test-secret', ...config },
  });
  return { db, anthropic, app };
}

async function signupFamily(agent, overrides = {}) {
  const res = await agent.post('/api/family/signup').send({
    familyName: 'Testers',
    pin: '1234',
    curriculum: 'us',
    children: [{ name: 'Maya', grade: '5' }],
    ...overrides,
  });
  expect(res.status).toBe(200);
  return res.body;
}

describe('family auth', () => {
  let ctx;
  beforeEach(() => {
    ctx = build();
  });

  it('signs up a family with kids and signs the device in', async () => {
    const agent = request.agent(ctx.app);
    const body = await signupFamily(agent);

    expect(body.family.code).toMatch(/^[A-Z2-9]{3}-[A-Z2-9]{3}$/);
    expect(body.children).toHaveLength(1);

    const me = await agent.get('/api/family/me');
    expect(me.status).toBe(200);
    expect(me.body.family.name).toBe('Testers');
    expect(me.body.children[0].name).toBe('Maya');
    expect(me.body.parentVerified).toBe(true);
  });

  it('rejects bad pins and empty family names', async () => {
    const agent = request.agent(ctx.app);
    expect(
      (await agent.post('/api/family/signup').send({ familyName: 'X', pin: '12' })).status
    ).toBe(400);
    expect(
      (await agent.post('/api/family/signup').send({ familyName: '  ', pin: '1234' })).status
    ).toBe(400);
  });

  it('logs in with family code + PIN, rejects wrong PIN', async () => {
    const setupAgent = request.agent(ctx.app);
    const { family } = await signupFamily(setupAgent);

    const wrong = await request(ctx.app)
      .post('/api/family/login')
      .send({ code: family.code, pin: '9999' });
    expect(wrong.status).toBe(401);

    const agent = request.agent(ctx.app);
    const ok = await agent
      .post('/api/family/login')
      .send({ code: family.code.toLowerCase(), pin: '1234' });
    expect(ok.status).toBe(200);
    expect((await agent.get('/api/family/me')).status).toBe(200);
  });

  it('requires sign-in for family data', async () => {
    const res = await request(ctx.app).get('/api/family/me');
    expect(res.status).toBe(401);
    expect(res.body.needFamily).toBe(true);
  });

  it('gates the parent dashboard behind the PIN when only the family cookie is present', async () => {
    const agent = request.agent(ctx.app);
    const signup = await agent.post('/api/family/signup').send({
      familyName: 'Testers',
      pin: '1234',
      children: [{ name: 'Maya', grade: '5' }],
    });

    // Rebuild a cookie jar containing ONLY the family cookie (drop the parent one)
    const familyCookie = signup.headers['set-cookie'].find(c => c.startsWith('hc_family='));
    const bare = familyCookie.split(';')[0];

    const summary = await request(ctx.app).get('/api/parent/summary').set('Cookie', bare);
    expect(summary.status).toBe(401);
    expect(summary.body.needPin).toBe(true);

    const verifyWrong = await request(ctx.app)
      .post('/api/parent/verify')
      .set('Cookie', bare)
      .send({ pin: '0000' });
    expect(verifyWrong.status).toBe(401);

    const verify = await request(ctx.app)
      .post('/api/parent/verify')
      .set('Cookie', bare)
      .send({ pin: '1234' });
    expect(verify.status).toBe(200);
  });

  it('lets a verified parent add and edit kids', async () => {
    const agent = request.agent(ctx.app);
    await signupFamily(agent);

    const added = await agent.post('/api/children').send({ name: 'Leo', grade: '3' });
    expect(added.status).toBe(200);

    const me = await agent.get('/api/family/me');
    expect(me.body.children).toHaveLength(2);

    const patched = await agent.patch(`/api/children/${added.body.id}`).send({ grade: '4' });
    expect(patched.status).toBe(200);
    expect(patched.body.grade).toBe('4');
  });
});

describe('tutoring chat', () => {
  let ctx;
  let agent;
  let child;

  beforeEach(async () => {
    ctx = build();
    agent = request.agent(ctx.app);
    const body = await signupFamily(agent);
    child = body.children[0];
  });

  it('streams a coach reply over SSE and persists both sides', async () => {
    const res = await agent
      .post('/api/chat')
      .send({ childId: child.id, subject: 'math', message: 'I need help with fractions' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');

    const events = parseSse(res.text);
    const meta = events.find(e => e.event === 'meta');
    expect(meta.data.sessionId).toBeTruthy();
    expect(events.filter(e => e.event === 'delta').length).toBeGreaterThan(1);
    expect(events.some(e => e.event === 'done')).toBe(true);

    const rows = ctx.db
      .prepare('SELECT role, content FROM messages WHERE session_id = ? ORDER BY id')
      .all(meta.data.sessionId);
    expect(rows.map(r => r.role)).toEqual(['user', 'assistant']);
    expect(rows[1].content).toBe(COACH_REPLY);
  });

  it('sends conversation history on later turns and includes the child in the system prompt', async () => {
    const first = await agent
      .post('/api/chat')
      .send({ childId: child.id, subject: 'math', message: 'What are fractions?' });
    const sessionId = parseSse(first.text).find(e => e.event === 'meta').data.sessionId;

    await agent
      .post('/api/chat')
      .send({ childId: child.id, sessionId, subject: 'math', message: 'Can you say more?' });

    expect(ctx.anthropic.calls.stream).toHaveLength(2);
    const secondCall = ctx.anthropic.calls.stream[1];
    expect(secondCall.messages).toHaveLength(3); // user, assistant, user
    const systemText = JSON.stringify(secondCall.system);
    expect(systemText).toContain('Maya');
    expect(systemText).toContain('grade 5');
  });

  it('passes an attached photo to the model and replays it as a note later', async () => {
    const res = await agent.post('/api/chat').send({
      childId: child.id,
      subject: 'math',
      message: 'Can you help me with this worksheet?',
      image: { media_type: 'image/jpeg', data: 'aGVsbG8=' },
    });
    expect(res.status).toBe(200);

    const call = ctx.anthropic.calls.stream[0];
    const content = call.messages[call.messages.length - 1].content;
    expect(Array.isArray(content)).toBe(true);
    expect(content[0]).toMatchObject({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: 'aGVsbG8=' },
    });

    const sessionId = parseSse(res.text).find(e => e.event === 'meta').data.sessionId;
    const row = ctx.db
      .prepare('SELECT has_image FROM messages WHERE session_id = ? ORDER BY id LIMIT 1')
      .get(sessionId);
    expect(row.has_image).toBe(1);

    // Next turn: the old photo replays as a text note, not image bytes
    await agent
      .post('/api/chat')
      .send({ childId: child.id, sessionId, subject: 'math', message: 'Thanks!' });
    const second = ctx.anthropic.calls.stream[1];
    const firstHistory = second.messages[0];
    expect(typeof firstHistory.content).toBe('string');
    expect(firstHistory.content).toContain('photo');
  });

  it('rejects malformed photos', async () => {
    const res = await agent.post('/api/chat').send({
      childId: child.id,
      subject: 'math',
      message: 'look',
      image: { media_type: 'image/tiff', data: 'x' },
    });
    expect(res.status).toBe(400);
  });

  it('redirects answer-fishing without calling the model and logs a struggle', async () => {
    const res = await agent
      .post('/api/chat')
      .send({ childId: child.id, subject: 'math', message: 'just give me the answer' });

    const events = parseSse(res.text);
    expect(events.find(e => e.event === 'meta').data.cheatDetected).toBe(true);
    expect(ctx.anthropic.calls.stream).toHaveLength(0);

    const struggles = ctx.db.prepare('SELECT type FROM struggles').all();
    expect(struggles.some(s => s.type === 'Tried to get direct answer')).toBe(true);
  });

  it('logs classifier-detected frustration and answer fishing', async () => {
    ctx.anthropic.state.classifier = {
      answer_fishing: true,
      frustration: 3,
      topic: 'long division',
    };

    await agent
      .post('/api/chat')
      .send({ childId: child.id, subject: 'math', message: 'this is impossible, I hate it' });
    await tick();

    const struggles = ctx.db.prepare('SELECT type, context FROM struggles').all();
    expect(struggles.some(s => s.type === 'Feeling frustrated')).toBe(true);
    expect(struggles.some(s => s.type === 'Tried to get direct answer')).toBe(true);
    // Classifier context never contains the kid's raw message
    for (const struggle of struggles) {
      expect(struggle.context).not.toContain('impossible');
    }
  });

  it('updates the child memory after enough messages', async () => {
    let sessionId = null;
    for (let i = 0; i < 4; i++) {
      const res = await agent
        .post('/api/chat')
        .send({ childId: child.id, sessionId, subject: 'math', message: `Question number ${i}` });
      sessionId = parseSse(res.text).find(e => e.event === 'meta').data.sessionId;
    }
    await tick(30);

    const row = ctx.db.prepare('SELECT memory FROM children WHERE id = ?').get(child.id);
    expect(row.memory).toContain('equivalent fractions');

    // The refreshed memory flows into the next system prompt
    await agent
      .post('/api/chat')
      .send({ childId: child.id, sessionId, subject: 'math', message: 'One more!' });
    const lastCall = ctx.anthropic.calls.stream.at(-1);
    expect(JSON.stringify(lastCall.system)).toContain('equivalent fractions');
  });

  it("refuses another family's child", async () => {
    const otherAgent = request.agent(ctx.app);
    const other = await signupFamily(otherAgent, {
      familyName: 'Others',
      children: [{ name: 'Zoe', grade: '6' }],
    });

    const res = await agent
      .post('/api/chat')
      .send({ childId: other.children[0].id, subject: 'math', message: 'hello' });
    expect(res.status).toBe(400);
  });

  it('stops when the family daily token budget is spent', async () => {
    const tight = build({ dailyTokenBudget: 12 });
    const tightAgent = request.agent(tight.app);
    const { children } = await signupFamily(tightAgent);

    const first = await tightAgent
      .post('/api/chat')
      .send({ childId: children[0].id, subject: 'math', message: 'hello' });
    expect(first.status).toBe(200);

    const second = await tightAgent
      .post('/api/chat')
      .send({ childId: children[0].id, subject: 'math', message: 'hello again' });
    expect(second.status).toBe(429);
  });

  it('validates subject and message length', async () => {
    expect(
      (
        await agent
          .post('/api/chat')
          .send({ childId: child.id, subject: 'astrology', message: 'hi' })
      ).status
    ).toBe(400);
    expect(
      (
        await agent
          .post('/api/chat')
          .send({ childId: child.id, subject: 'math', message: 'x'.repeat(2001) })
      ).status
    ).toBe(400);
  });
});

describe('session resume', () => {
  it('lists recent sessions and returns their messages, scoped to the family', async () => {
    const ctx = build();
    const agent = request.agent(ctx.app);
    const { children } = await signupFamily(agent);

    const chat = await agent
      .post('/api/chat')
      .send({ childId: children[0].id, subject: 'science', message: 'Why is the sky blue?' });
    const sessionId = parseSse(chat.text).find(e => e.event === 'meta').data.sessionId;

    const recent = await agent.get(`/api/sessions/recent?childId=${children[0].id}`);
    expect(recent.status).toBe(200);
    expect(recent.body.sessions[0]).toMatchObject({
      id: sessionId,
      subject: 'science',
      messageCount: 2,
    });
    expect(recent.body.sessions[0].preview).toContain('Why is the sky');

    const messages = await agent.get(`/api/sessions/${sessionId}/messages`);
    expect(messages.status).toBe(200);
    expect(messages.body.messages).toHaveLength(2);

    // Another family can't read it
    const otherAgent = request.agent(ctx.app);
    await signupFamily(otherAgent, { familyName: 'Others' });
    expect((await otherAgent.get(`/api/sessions/${sessionId}/messages`)).status).toBe(404);
  });
});

describe('interactive practice', () => {
  let ctx;
  let agent;
  let child;

  beforeEach(async () => {
    ctx = build();
    agent = request.agent(ctx.app);
    const body = await signupFamily(agent);
    child = body.children[0];
  });

  it('generates a stored problem set without leaking answers', async () => {
    const res = await agent
      .post('/api/practice/generate')
      .send({ childId: child.id, subject: 'math', topic: 'Fractions' });

    expect(res.status).toBe(200);
    expect(res.body.topic).toBe('fractions');
    expect(res.body.problems).toHaveLength(3);
    for (const problem of res.body.problems) {
      expect(problem.id).toBeTruthy();
      expect(problem.problem).toBeTruthy();
      expect(problem.hint).toBeTruthy();
      expect(problem).not.toHaveProperty('answer');
      expect(problem).not.toHaveProperty('explanation');
    }

    const stored = ctx.db.prepare('SELECT * FROM practice_problems').all();
    expect(stored).toHaveLength(3);
    expect(stored[0].answer).toBe('3/4');
  });

  it('grades answers, records attempts, and moves mastery', async () => {
    const generated = await agent
      .post('/api/practice/generate')
      .send({ childId: child.id, subject: 'math', topic: 'fractions' });
    const problem = generated.body.problems[0];

    const graded = await agent
      .post('/api/practice/answer')
      .send({ problemId: problem.id, answer: '3/4' });
    expect(graded.status).toBe(200);
    expect(graded.body.correct).toBe(true);
    expect(graded.body.explanation).toBeTruthy();

    const attempts = ctx.db.prepare('SELECT * FROM practice_attempts').all();
    expect(attempts).toHaveLength(1);
    expect(attempts[0].correct).toBe(1);

    const mastery = ctx.db.prepare('SELECT * FROM mastery').get();
    expect(mastery.topic).toBe('fractions');
    expect(mastery.score).toBeGreaterThan(0.5);
  });

  it('reveal returns the answer and counts as a miss', async () => {
    const generated = await agent
      .post('/api/practice/generate')
      .send({ childId: child.id, subject: 'math', topic: 'fractions' });
    const problem = generated.body.problems[0];

    const revealed = await agent.post('/api/practice/reveal').send({ problemId: problem.id });
    expect(revealed.status).toBe(200);
    expect(revealed.body.answer).toBe('3/4');

    const mastery = ctx.db.prepare('SELECT * FROM mastery').get();
    expect(mastery.score).toBeLessThan(0.5);
  });

  it('produces a similar problem tied to the same child and topic', async () => {
    const generated = await agent
      .post('/api/practice/generate')
      .send({ childId: child.id, subject: 'math', topic: 'fractions' });
    const problem = generated.body.problems[1];

    const similar = await agent.post('/api/practice/similar').send({ problemId: problem.id });
    expect(similar.status).toBe(200);
    expect(similar.body.problem.id).toBeTruthy();
    expect(similar.body.problem).not.toHaveProperty('answer');

    const stored = ctx.db
      .prepare('SELECT * FROM practice_problems WHERE id = ?')
      .get(similar.body.problem.id);
    expect(stored.child_id).toBe(child.id);
    expect(stored.topic).toBe('fractions');
  });

  it("won't grade another family's problem", async () => {
    const generated = await agent
      .post('/api/practice/generate')
      .send({ childId: child.id, subject: 'math', topic: 'fractions' });
    const problem = generated.body.problems[0];

    const otherAgent = request.agent(ctx.app);
    await signupFamily(otherAgent, { familyName: 'Others' });
    const res = await otherAgent
      .post('/api/practice/answer')
      .send({ problemId: problem.id, answer: '3/4' });
    expect(res.status).toBe(404);
  });

  it('steers generation using mastery history', async () => {
    // Three misses on the topic push the score low enough to trigger the gentle note
    for (let i = 0; i < 3; i++) {
      const generated = await agent
        .post('/api/practice/generate')
        .send({ childId: child.id, subject: 'math', topic: 'fractions' });
      await agent.post('/api/practice/reveal').send({ problemId: generated.body.problems[0].id });
    }

    await agent
      .post('/api/practice/generate')
      .send({ childId: child.id, subject: 'math', topic: 'fractions' });

    const lastGenCall = ctx.anthropic.calls.parse
      .filter(call => JSON.stringify(call.messages).includes('practice problems for a grade'))
      .at(-1);
    expect(lastGenCall.messages[0].content).toContain('tricky');
  });
});

describe('parent summary', () => {
  it('reports weekly activity scoped to the family, without kids raw words', async () => {
    const ctx = build();
    const agent = request.agent(ctx.app);
    const { children } = await signupFamily(agent);

    await agent.post('/api/chat').send({
      childId: children[0].id,
      subject: 'science',
      message: "I'm so confused about clouds",
    });
    await tick();

    // A second family with its own activity that must NOT leak into the first
    const otherAgent = request.agent(ctx.app);
    const other = await signupFamily(otherAgent, { familyName: 'Others' });
    await otherAgent
      .post('/api/chat')
      .send({ childId: other.children[0].id, subject: 'math', message: 'hi there' });
    await tick();

    const summary = await agent.get('/api/parent/summary');
    expect(summary.status).toBe(200);
    expect(summary.body.subjectBreakdown.science).toBe(2); // user + assistant
    expect(summary.body.subjectBreakdown.math).toBe(0);
    expect(summary.body.totalSessions).toBe(1);
    expect(summary.body.children[0].messageCount).toBe(2);
    expect(summary.body.familyCode).toMatch(/^[A-Z2-9]{3}-[A-Z2-9]{3}$/);

    const struggleItems = Object.values(summary.body.struggles).flat();
    for (const item of struggleItems) {
      expect(item).not.toHaveProperty('context');
    }
  });
});

describe('progress & gamification API', () => {
  it('reports XP, streak, badges and daily challenge for a child', async () => {
    const ctx = build();
    const agent = request.agent(ctx.app);
    const { children } = await signupFamily(agent);

    await agent
      .post('/api/chat')
      .send({ childId: children[0].id, subject: 'math', message: 'hi!' });

    const res = await agent.get(`/api/progress?childId=${children[0].id}`);
    expect(res.status).toBe(200);
    expect(res.body.xp).toBeGreaterThan(0);
    expect(res.body.level).toBeGreaterThanOrEqual(1);
    expect(res.body.streak).toBe(1);
    expect(res.body.badges.find(badge => badge.id === 'first-steps').earned).toBe(true);
    expect(res.body.challenge.goal).toBe(3);
    expect(res.body.challenge.done).toBe(false);
  });

  it("won't serve another family's progress", async () => {
    const ctx = build();
    const agent = request.agent(ctx.app);
    const { children } = await signupFamily(agent);
    const otherAgent = request.agent(ctx.app);
    await signupFamily(otherAgent, { familyName: 'Others' });
    expect((await otherAgent.get(`/api/progress?childId=${children[0].id}`)).status).toBe(400);
  });
});

describe('spaced repetition', () => {
  it('queues misses, serves due reviews without answers, and advances on success', async () => {
    const ctx = build();
    const agent = request.agent(ctx.app);
    const { children } = await signupFamily(agent);
    const child = children[0];

    const generated = await agent
      .post('/api/practice/generate')
      .send({ childId: child.id, subject: 'math', topic: 'fractions' });
    const problem = generated.body.problems[0];

    // A reveal counts as a miss and queues the problem for tomorrow
    await agent.post('/api/practice/reveal').send({ problemId: problem.id });
    const queued = ctx.db
      .prepare('SELECT * FROM review_queue WHERE problem_id = ?')
      .get(problem.id);
    expect(queued).toBeTruthy();
    expect(queued.interval_index).toBe(0);

    // Nothing due yet
    let review = await agent.get(`/api/practice/review?childId=${child.id}`);
    expect(review.body.total).toBe(0);

    // Time-travel: make it due now
    ctx.db
      .prepare('UPDATE review_queue SET due_at = ? WHERE problem_id = ?')
      .run('2020-01-01T00:00:00.000Z', problem.id);
    review = await agent.get(`/api/practice/review?childId=${child.id}`);
    expect(review.body.total).toBe(1);
    expect(review.body.due[0].id).toBe(problem.id);
    expect(review.body.due[0]).not.toHaveProperty('answer');

    // Getting it right stretches the interval instead of retiring immediately
    await agent.post('/api/practice/answer').send({ problemId: problem.id, answer: '3/4' });
    const advanced = ctx.db
      .prepare('SELECT * FROM review_queue WHERE problem_id = ?')
      .get(problem.id);
    expect(advanced.interval_index).toBe(1);
    expect(advanced.retired).toBe(0);
    expect(new Date(advanced.due_at).getTime()).toBeGreaterThan(Date.now());
  });
});

describe('parent dashboard v2', () => {
  it('adds minutes, mastery fields, 14-day activity and digest settings', async () => {
    const ctx = build();
    const agent = request.agent(ctx.app);
    const { children } = await signupFamily(agent);

    await agent
      .post('/api/chat')
      .send({ childId: children[0].id, subject: 'math', message: 'hello' });

    const summary = await agent.get('/api/parent/summary');
    expect(summary.body.totalMinutes).toBeGreaterThanOrEqual(1);
    expect(summary.body.dailyActivity).toHaveLength(14);
    expect(summary.body.children[0]).toHaveProperty('minutes');
    expect(summary.body.children[0]).toHaveProperty('strengths');
    expect(summary.body.digestEmail).toBe('');

    expect(
      (await agent.post('/api/parent/settings').send({ digestEmail: 'not-an-email' })).status
    ).toBe(400);
    expect(
      (await agent.post('/api/parent/settings').send({ digestEmail: 'p@example.com' })).status
    ).toBe(200);
    const after = await agent.get('/api/parent/summary');
    expect(after.body.digestEmail).toBe('p@example.com');

    const digest = await agent.get('/api/parent/digest');
    expect(digest.status).toBe(200);
    expect(digest.body.html).toContain('Testers');
    expect(digest.body.html).toContain('Maya');
  });
});

describe('custom coach personas', () => {
  it('creates, lists, chats with, and deletes a family coach', async () => {
    const ctx = build();
    const agent = request.agent(ctx.app);
    const { children } = await signupFamily(agent);

    const created = await agent
      .post('/api/personas')
      .send({ name: 'Coach Pawn', emoji: '♟️', description: 'chess strategy for beginners' });
    expect(created.status).toBe(200);

    const me = await agent.get('/api/family/me');
    expect(me.body.personas).toHaveLength(1);

    // Chatting with the persona injects its scaffolded prompt
    const res = await agent.post('/api/chat').send({
      childId: children[0].id,
      subject: `p:${created.body.id}`,
      message: 'teach me openings',
    });
    expect(res.status).toBe(200);
    const call = ctx.anthropic.calls.stream.at(-1);
    const system = JSON.stringify(call.system);
    expect(system).toContain('Coach Pawn');
    expect(system).toContain('chess strategy');
    expect(system).toContain('NEVER give final answers');

    // Another family can't chat with it
    const otherAgent = request.agent(ctx.app);
    const other = await signupFamily(otherAgent, { familyName: 'Others' });
    const stolen = await otherAgent
      .post('/api/chat')
      .send({ childId: other.children[0].id, subject: `p:${created.body.id}`, message: 'hi' });
    expect(stolen.status).toBe(400);

    const del = await agent.delete(`/api/personas/${created.body.id}`);
    expect(del.status).toBe(200);
    expect((await agent.get('/api/family/me')).body.personas).toHaveLength(0);
  });

  it('validates persona input and caps the count at 5', async () => {
    const ctx = build();
    const agent = request.agent(ctx.app);
    await signupFamily(agent);

    expect(
      (await agent.post('/api/personas').send({ name: '', description: 'chess things' })).status
    ).toBe(400);
    expect(
      (await agent.post('/api/personas').send({ name: 'Coach A', description: 'xy' })).status
    ).toBe(400);

    for (let i = 0; i < 5; i++) {
      expect(
        (
          await agent
            .post('/api/personas')
            .send({ name: `Coach ${i}`, description: 'something fun to learn' })
        ).status
      ).toBe(200);
    }
    expect(
      (await agent.post('/api/personas').send({ name: 'One Too Many', description: 'sorry pal' }))
        .status
    ).toBe(400);
  });
});

describe('UK curriculum & Further Maths', () => {
  it('signs up a UK family with school years and validates grades per curriculum', async () => {
    const ctx = build();
    const agent = request.agent(ctx.app);
    const body = await signupFamily(agent, {
      familyName: 'Sears Family',
      curriculum: 'uk',
      children: [{ name: 'Grace', grade: '10' }],
    });
    expect(body.family.curriculum).toBe('uk');

    const me = await agent.get('/api/family/me');
    expect(me.body.family.curriculum).toBe('uk');
    expect(me.body.children[0].grade).toBe('10');

    // Year 14 isn't a thing, even for UK families
    const tooHigh = await request(ctx.app)
      .post('/api/family/signup')
      .send({
        familyName: 'X',
        pin: '1234',
        curriculum: 'uk',
        children: [{ name: 'A', grade: '14' }],
      });
    expect(tooHigh.status).toBe(400);

    // A US family can't register a grade-10 kid (US grades stop at 8)
    const usGrade10 = await request(ctx.app)
      .post('/api/family/signup')
      .send({
        familyName: 'Y',
        pin: '1234',
        curriculum: 'us',
        children: [{ name: 'B', grade: '10' }],
      });
    expect(usGrade10.status).toBe(400);
  });

  it('coaches UK kids with year groups and British conventions', async () => {
    const ctx = build();
    const agent = request.agent(ctx.app);
    const { children } = await signupFamily(agent, { curriculum: 'uk' });

    await agent
      .post('/api/chat')
      .send({ childId: children[0].id, subject: 'math', message: 'Help me with fractions' });

    const system = JSON.stringify(ctx.anthropic.calls.stream.at(-1).system);
    expect(system).toContain('Year 5');
    expect(system).toContain('British English');
    expect(system).not.toContain('grade 5');
  });

  it('offers Further Maths GCSE coaching with Coach Ada', async () => {
    const ctx = build();
    const agent = request.agent(ctx.app);
    const { children } = await signupFamily(agent, {
      curriculum: 'uk',
      children: [{ name: 'Grace', grade: '10' }],
    });

    const res = await agent.post('/api/chat').send({
      childId: children[0].id,
      subject: 'furthermaths',
      message: 'Help me find the stationary points of $y = x^3 - 3x$',
    });
    expect(res.status).toBe(200);

    const system = JSON.stringify(ctx.anthropic.calls.stream.at(-1).system);
    expect(system).toContain('Coach Ada');
    expect(system).toContain('AQA Level 2 Certificate');
    expect(system).toContain('Calculus');
    expect(system).toContain('Year 10');
  });

  it('lets a parent switch school systems and coaching follows', async () => {
    const ctx = build();
    const agent = request.agent(ctx.app);
    const { children } = await signupFamily(agent); // defaults to US

    expect((await agent.get('/api/family/me')).body.family.curriculum).toBe('us');
    expect((await agent.post('/api/parent/settings').send({ curriculum: 'mars' })).status).toBe(
      400
    );

    const switched = await agent.post('/api/parent/settings').send({ curriculum: 'uk' });
    expect(switched.status).toBe(200);
    expect(switched.body.curriculum).toBe('uk');
    expect((await agent.get('/api/family/me')).body.family.curriculum).toBe('uk');

    // The same stored grade now reads as a school year in coaching
    await agent
      .post('/api/chat')
      .send({ childId: children[0].id, subject: 'math', message: 'hello' });
    expect(JSON.stringify(ctx.anthropic.calls.stream.at(-1).system)).toContain('Year 5');

    // And Years 9-11 become valid for editing kids
    const patched = await agent.patch(`/api/children/${children[0].id}`).send({ grade: '11' });
    expect(patched.status).toBe(200);
    expect(patched.body.grade).toBe('11');
  });

  it('generates UK-flavoured practice sets', async () => {
    const ctx = build();
    const agent = request.agent(ctx.app);
    const { children } = await signupFamily(agent, {
      curriculum: 'uk',
      children: [{ name: 'Grace', grade: '10' }],
    });

    const res = await agent
      .post('/api/practice/generate')
      .send({ childId: children[0].id, subject: 'furthermaths', topic: 'differentiation' });
    expect(res.status).toBe(200);
    expect(res.body.problems).toHaveLength(3);

    const genCall = ctx.anthropic.calls.parse
      .filter(call => JSON.stringify(call.messages).includes('practice problems for a Year'))
      .at(-1);
    expect(genCall).toBeTruthy();
    expect(genCall.messages[0].content).toContain('Year 10');
    expect(genCall.messages[0].content).toContain('British English');
  });
  it('coaches sixth-formers at A-level standard', async () => {
    const ctx = build();
    const agent = request.agent(ctx.app);
    const { children } = await signupFamily(agent, {
      curriculum: 'uk',
      children: [
        { name: 'Grace', grade: '12' },
        { name: 'Tom', grade: '13' },
      ],
    });

    await agent.post('/api/chat').send({
      childId: children[0].id,
      subject: 'math',
      message: 'Help me integrate by parts',
    });
    let system = JSON.stringify(ctx.anthropic.calls.stream.at(-1).system);
    expect(system).toContain('Year 12');
    expect(system).toContain('A-level Mathematics');
    expect(system).toContain('sixth form');

    await agent.post('/api/chat').send({
      childId: children[1].id,
      subject: 'science',
      message: 'Quiz me on the practical endorsement',
    });
    system = JSON.stringify(ctx.anthropic.calls.stream.at(-1).system);
    expect(system).toContain('Year 13');
    expect(system).toContain('practical endorsement');
  });

  it('teaches A-level Further Maths to Years 12-13', async () => {
    const ctx = build();
    const agent = request.agent(ctx.app);
    const { children } = await signupFamily(agent, {
      curriculum: 'uk',
      children: [{ name: 'Grace', grade: '13' }],
    });

    const res = await agent.post('/api/chat').send({
      childId: children[0].id,
      subject: 'furthermaths',
      message: 'Explain De Moivre',
    });
    expect(res.status).toBe(200);

    const system = JSON.stringify(ctx.anthropic.calls.stream.at(-1).system);
    expect(system).toContain('A-level Further Mathematics');
    expect(system).toContain('complex numbers');
    expect(system).toContain('Year 13');
  });
  it('defaults new families to the UK school system', async () => {
    const ctx = build();
    const agent = request.agent(ctx.app);
    const res = await agent.post('/api/family/signup').send({
      familyName: 'Defaults',
      pin: '1234',
      children: [{ name: 'Amelia', grade: '13' }], // Year 13 only exists under UK
    });
    expect(res.status).toBe(200);
    expect(res.body.family.curriculum).toBe('uk');
    expect((await agent.get('/api/family/me')).body.family.curriculum).toBe('uk');
  });
});
describe('exam boards & exam-style practice', () => {
  it('stores a kid exam board and course notes, and rejects unknown boards', async () => {
    const ctx = build();
    const agent = request.agent(ctx.app);
    const { children } = await signupFamily(agent, {
      curriculum: 'uk',
      children: [{ name: 'Grace', grade: '11' }],
    });

    expect(
      (await agent.patch(`/api/children/${children[0].id}`).send({ examBoard: 'cambridge' })).status
    ).toBe(400);

    const patched = await agent.patch(`/api/children/${children[0].id}`).send({
      examBoard: 'aqa',
      courseNotes: 'English Lit: Macbeth, A Christmas Carol, Power & Conflict',
    });
    expect(patched.status).toBe(200);
    expect(patched.body.examBoard).toBe('aqa');

    const me = await agent.get('/api/family/me');
    expect(me.body.children[0].examBoard).toBe('aqa');
    expect(me.body.children[0].courseNotes).toContain('Macbeth');
  });

  it('feeds the board and set texts into coaching', async () => {
    const ctx = build();
    const agent = request.agent(ctx.app);
    const { children } = await signupFamily(agent, {
      curriculum: 'uk',
      children: [{ name: 'Grace', grade: '11' }],
    });
    await agent.patch(`/api/children/${children[0].id}`).send({
      examBoard: 'aqa',
      courseNotes: 'English Lit: Macbeth and A Christmas Carol',
    });

    await agent.post('/api/chat').send({
      childId: children[0].id,
      subject: 'reading',
      message: 'Help me revise Macbeth themes',
    });

    const system = JSON.stringify(ctx.anthropic.calls.stream.at(-1).system);
    expect(system).toContain('their GCSEs');
    expect(system).toContain('AQA');
    expect(system).toContain('Macbeth and A Christmas Carol');
  });

  it('generates exam-style practice for Year 10+ UK kids only', async () => {
    const ctx = build();
    const agent = request.agent(ctx.app);
    const { children } = await signupFamily(agent, {
      curriculum: 'uk',
      children: [{ name: 'Grace', grade: '11' }],
    });
    await agent.patch(`/api/children/${children[0].id}`).send({ examBoard: 'aqa' });

    const res = await agent.post('/api/practice/generate').send({
      childId: children[0].id,
      subject: 'math',
      topic: 'quadratics',
      examStyle: true,
    });
    expect(res.status).toBe(200);

    const ukGen = ctx.anthropic.calls.parse
      .filter(call => JSON.stringify(call.messages).includes('practice problems for a Year'))
      .at(-1);
    expect(ukGen.messages[0].content).toContain('mark allocation');
    expect(ukGen.messages[0].content).toContain('AQA-style');

    // A US family asking for examStyle gets plain problems
    const usAgent = request.agent(ctx.app);
    const usFamily = await signupFamily(usAgent, { familyName: 'Others' });
    await usAgent.post('/api/practice/generate').send({
      childId: usFamily.children[0].id,
      subject: 'math',
      topic: 'fractions',
      examStyle: true,
    });
    const usGen = ctx.anthropic.calls.parse
      .filter(call => JSON.stringify(call.messages).includes('practice problems for a grade'))
      .at(-1);
    expect(usGen.messages[0].content).not.toContain('mark allocation');
  });
});
