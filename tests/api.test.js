import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createDb } from '../server/db.js';
import { createApp } from '../server/app.js';

const COACH_REPLY = 'Great question! What do you already know about it?';
const PRACTICE_REPLY =
  'Problem 1: What is 2+2?\n[HINT] Count on your fingers\nLearning goal: addition';

function makeFakeAnthropic() {
  const calls = { stream: [], create: [] };

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

  return {
    calls,
    messages: {
      stream: streamImpl,
      create: async params => {
        calls.create.push(params);
        return {
          content: [{ type: 'text', text: PRACTICE_REPLY }],
          usage: { input_tokens: 8, output_tokens: 4 },
        };
      },
    },
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
    expect(secondCall.system).toContain('Maya');
    expect(secondCall.system).toContain('grade 5');
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

describe('practice', () => {
  it('generates problems for the active child and logs usage', async () => {
    const ctx = build();
    const agent = request.agent(ctx.app);
    const { children } = await signupFamily(agent);

    const res = await agent
      .post('/api/practice')
      .send({ childId: children[0].id, subject: 'math', topic: 'fractions' });

    expect(res.status).toBe(200);
    expect(res.body.problems).toContain('[HINT]');
    expect(ctx.anthropic.calls.create[0].messages[0].content).toContain('grade 5');

    const usage = ctx.db.prepare("SELECT * FROM usage_log WHERE kind = 'practice'").all();
    expect(usage).toHaveLength(1);
  });
});

describe('parent summary', () => {
  it('reports weekly activity scoped to the family, without kids raw words', async () => {
    const ctx = build();
    const agent = request.agent(ctx.app);
    const { children } = await signupFamily(agent);

    await agent
      .post('/api/chat')
      .send({
        childId: children[0].id,
        subject: 'science',
        message: "I'm so confused about clouds",
      });

    // A second family with its own activity that must NOT leak into the first
    const otherAgent = request.agent(ctx.app);
    const other = await signupFamily(otherAgent, { familyName: 'Others' });
    await otherAgent
      .post('/api/chat')
      .send({ childId: other.children[0].id, subject: 'math', message: 'hi there' });

    const summary = await agent.get('/api/parent/summary');
    expect(summary.status).toBe(200);
    expect(summary.body.subjectBreakdown.science).toBe(2); // user + assistant
    expect(summary.body.subjectBreakdown.math).toBe(0);
    expect(summary.body.totalSessions).toBe(1);
    expect(summary.body.children[0].messageCount).toBe(2);
    expect(summary.body.familyCode).toMatch(/^[A-Z2-9]{3}-[A-Z2-9]{3}$/);

    const struggleItems = Object.values(summary.body.struggles).flat();
    expect(struggleItems.length).toBeGreaterThan(0);
    for (const item of struggleItems) {
      expect(item).not.toHaveProperty('context');
    }
  });
});
