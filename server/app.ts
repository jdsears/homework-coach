import express, { type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { pinoHttp } from 'pino-http';
import type Database from 'better-sqlite3';

import {
  SYSTEM_PROMPTS,
  CHEAT_REDIRECT,
  detectCheatAttempt,
  practiceSetPrompt,
  CLASSIFIER_SYSTEM,
  classifierUserPrompt,
  GRADER_SYSTEM,
  graderUserPrompt,
  MEMORY_SYSTEM,
  memoryUserPrompt,
  personaSystemPrompt,
} from './prompts';
import { streamChat, parseStructured, fastParse, extractText, totalInputTokens } from './claude';
import * as auth from './auth';
import { familySummary, childProgress } from './reporting';
import { digestForFamily } from './mailer';
import { logger } from './logger';
import type {
  AnthropicLike,
  ChildRow,
  MessageRow,
  PersonaRow,
  ProblemRow,
  ReviewRow,
  SessionRow,
} from './types';

const GRADES = ['3', '4', '5', '6', '7', '8'];
const HISTORY_WINDOW = 24; // messages sent to the model per turn
const MAX_MESSAGE_CHARS = 2000;
const MEMORY_EVERY_N_MESSAGES = 8; // refresh child memory this often per session
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PERSONAS = 5;

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_BASE64 = 5 * 1024 * 1024; // ~3.7MB of actual image
const PHOTO_HISTORY_NOTE = '[The student attached a photo of their homework with this message]';

// Spaced repetition: days until each next review after a miss enters the queue
const REVIEW_INTERVALS = [1, 3, 7, 14];

const now = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// Structured-output schemas
// ---------------------------------------------------------------------------

const PracticeSetSchema = z.object({
  problems: z
    .array(
      z.object({
        problem: z.string(),
        hint: z.string(),
        answer: z.string(),
        explanation: z.string(),
        difficulty: z.number(),
      })
    )
    .min(1)
    .max(5),
});
type PracticeSet = z.infer<typeof PracticeSetSchema>;

const GradeSchema = z.object({
  correct: z.boolean(),
  feedback: z.string(),
});
type GradeResult = z.infer<typeof GradeSchema>;

const ClassifierSchema = z.object({
  answer_fishing: z.boolean(),
  frustration: z.number(),
  topic: z.string(),
});
type ClassifierResult = z.infer<typeof ClassifierSchema>;

const MemorySchema = z.object({
  memory: z.string(),
});
type MemoryResult = z.infer<typeof MemorySchema>;

export interface AppConfig {
  isProd?: boolean;
  cookieSecret?: string;
  allowedOrigins?: string[];
  dailyTokenBudget?: number;
  rateLimits?: boolean;
  httpLogging?: boolean;
}

export function createApp({
  db,
  anthropic,
  config = {},
}: {
  db: Database.Database;
  anthropic: AnthropicLike;
  config?: AppConfig;
}) {
  const {
    isProd = process.env.NODE_ENV === 'production',
    cookieSecret = process.env.COOKIE_SECRET || 'dev-secret-change-me',
    allowedOrigins = process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
      : ['http://localhost:3000'],
    dailyTokenBudget = Number(process.env.DAILY_TOKEN_BUDGET || 300000),
    rateLimits = true,
    httpLogging = isProd,
  } = config;

  const app = express();
  app.set('trust proxy', 1);

  if (httpLogging) {
    app.use(
      pinoHttp({
        logger,
        autoLogging: { ignore: req => !(req.url || '').startsWith('/api') },
      })
    );
  }

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'"],
        },
      },
    })
  );
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(express.json({ limit: '6mb' })); // leaves room for a downscaled homework photo
  app.use(cookieParser(cookieSecret));

  if (rateLimits) {
    const apiLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        error: "Whoa, that's a lot of requests! Take a short break and try again soon. 🌟",
      },
    });
    const claudeLimiter = rateLimit({
      windowMs: 60 * 1000,
      limit: 20,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        error: "You're super fast! Give me a few seconds to catch up, then try again. 🌟",
      },
    });
    app.use('/api/', apiLimiter);
    app.use(['/api/chat', '/api/practice'], claudeLimiter);
  }

  const requireFamily = auth.makeRequireFamily(db);
  const requireParent = auth.makeRequireParent();

  const stmts = {
    insertFamily: db.prepare(
      'INSERT INTO families (id, name, code, pin_hash, created_at) VALUES (?, ?, ?, ?, ?)'
    ),
    familyByCode: db.prepare('SELECT * FROM families WHERE code = ?'),
    insertChild: db.prepare(
      'INSERT INTO children (id, family_id, name, grade, created_at) VALUES (?, ?, ?, ?, ?)'
    ),
    childrenByFamily: db.prepare(
      'SELECT id, name, grade FROM children WHERE family_id = ? ORDER BY created_at, id'
    ),
    childById: db.prepare('SELECT * FROM children WHERE id = ?'),
    updateChild: db.prepare('UPDATE children SET name = ?, grade = ? WHERE id = ?'),
    updateChildMemory: db.prepare('UPDATE children SET memory = ? WHERE id = ?'),
    insertSession: db.prepare(
      'INSERT INTO sessions (id, child_id, subject, started_at, last_active_at) VALUES (?, ?, ?, ?, ?)'
    ),
    sessionById: db.prepare('SELECT * FROM sessions WHERE id = ?'),
    touchSession: db.prepare('UPDATE sessions SET last_active_at = ? WHERE id = ?'),
    recentSessionsByChild: db.prepare(
      `SELECT s.id, s.subject, s.started_at, s.last_active_at,
              (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id) AS messageCount,
              (SELECT content FROM messages m WHERE m.session_id = s.id AND m.role = 'user' ORDER BY m.id LIMIT 1) AS preview
       FROM sessions s WHERE s.child_id = ? ORDER BY s.last_active_at DESC LIMIT 5`
    ),
    insertMessage: db.prepare(
      'INSERT INTO messages (session_id, role, content, input_tokens, output_tokens, created_at, has_image) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ),
    recentMessages: db.prepare(
      'SELECT role, content, has_image FROM messages WHERE session_id = ? ORDER BY id DESC LIMIT ?'
    ),
    sessionMessages: db.prepare(
      'SELECT role, content, has_image, created_at FROM messages WHERE session_id = ? ORDER BY id'
    ),
    sessionMessageCount: db.prepare('SELECT COUNT(*) AS total FROM messages WHERE session_id = ?'),
    insertStruggle: db.prepare(
      'INSERT INTO struggles (session_id, subject, type, context, created_at) VALUES (?, ?, ?, ?, ?)'
    ),
    insertUsage: db.prepare(
      'INSERT INTO usage_log (family_id, kind, input_tokens, output_tokens, created_at) VALUES (?, ?, ?, ?, ?)'
    ),
    familyTokensSince: db.prepare(
      'SELECT COALESCE(SUM(input_tokens + output_tokens), 0) AS total FROM usage_log WHERE family_id = ? AND created_at >= ?'
    ),
    insertProblem: db.prepare(
      `INSERT INTO practice_problems (child_id, subject, topic, difficulty, problem, hint, answer, explanation, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ),
    problemById: db.prepare('SELECT * FROM practice_problems WHERE id = ?'),
    insertAttempt: db.prepare(
      `INSERT INTO practice_attempts (child_id, subject, topic, difficulty, correct, problem, answer, problem_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ),
    masteryGet: db.prepare(
      'SELECT * FROM mastery WHERE child_id = ? AND subject = ? AND topic = ?'
    ),
    masteryUpsert: db.prepare(
      `INSERT INTO mastery (child_id, subject, topic, score, attempts, updated_at) VALUES (?, ?, ?, ?, 1, ?)
       ON CONFLICT(child_id, subject, topic) DO UPDATE SET
         score = excluded.score, attempts = mastery.attempts + 1, updated_at = excluded.updated_at`
    ),
    reviewByProblem: db.prepare('SELECT * FROM review_queue WHERE problem_id = ?'),
    insertReview: db.prepare(
      'INSERT INTO review_queue (child_id, problem_id, due_at, interval_index, retired, created_at) VALUES (?, ?, ?, 0, 0, ?)'
    ),
    resetReview: db.prepare(
      'UPDATE review_queue SET due_at = ?, interval_index = 0, retired = 0 WHERE id = ?'
    ),
    advanceReview: db.prepare(
      'UPDATE review_queue SET interval_index = ?, due_at = ? WHERE id = ?'
    ),
    retireReview: db.prepare('UPDATE review_queue SET retired = 1 WHERE id = ?'),
    dueReviews: db.prepare(
      `SELECT p.id, p.problem, p.hint, p.difficulty, p.subject, p.topic FROM review_queue rq
       JOIN practice_problems p ON p.id = rq.problem_id
       WHERE rq.child_id = ? AND rq.retired = 0 AND rq.due_at <= ?
       ORDER BY rq.due_at LIMIT 5`
    ),
    dueReviewCount: db.prepare(
      'SELECT COUNT(*) AS total FROM review_queue WHERE child_id = ? AND retired = 0 AND due_at <= ?'
    ),
    updateDigestEmail: db.prepare('UPDATE families SET digest_email = ? WHERE id = ?'),
    personasByFamily: db.prepare(
      'SELECT id, name, emoji, description FROM personas WHERE family_id = ? ORDER BY created_at, id'
    ),
    personaById: db.prepare('SELECT * FROM personas WHERE id = ?'),
    personaCount: db.prepare('SELECT COUNT(*) AS total FROM personas WHERE family_id = ?'),
    insertPersona: db.prepare(
      'INSERT INTO personas (id, family_id, name, emoji, description, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ),
    deletePersona: db.prepare('DELETE FROM personas WHERE id = ?'),
  };

  // A miss puts the problem in the review queue; each later success stretches
  // the interval (1d → 3d → 7d → 14d), and it retires after the last one.
  const updateReviewQueue = (childId: string, problemId: number, correct: boolean): void => {
    const row = stmts.reviewByProblem.get(problemId) as ReviewRow | undefined;
    if (correct) {
      if (!row || row.retired) return;
      const nextIndex = row.interval_index + 1;
      if (nextIndex >= REVIEW_INTERVALS.length) {
        stmts.retireReview.run(row.id);
      } else {
        stmts.advanceReview.run(
          nextIndex,
          new Date(Date.now() + REVIEW_INTERVALS[nextIndex] * DAY_MS).toISOString(),
          row.id
        );
      }
    } else {
      const due = new Date(Date.now() + REVIEW_INTERVALS[0] * DAY_MS).toISOString();
      if (row) stmts.resetReview.run(due, row.id);
      else stmts.insertReview.run(childId, problemId, due, now());
    }
  };

  const validKidInput = (kid: { name?: unknown; grade?: unknown } | null | undefined): boolean =>
    Boolean(
      kid &&
      typeof kid.name === 'string' &&
      kid.name.trim() &&
      kid.name.trim().length <= 40 &&
      GRADES.includes(String(kid.grade))
    );

  const overBudget = (familyId: string): boolean => {
    const since = new Date(Date.now() - DAY_MS).toISOString();
    return (
      (stmts.familyTokensSince.get(familyId, since) as { total: number }).total >= dailyTokenBudget
    );
  };

  const BUDGET_MESSAGE =
    "Wow, we've done a LOT of learning today! 🌟 The coaches need a rest - come back tomorrow!";

  const logUsage = (
    familyId: string,
    kind: string,
    usage: { input_tokens?: number; output_tokens?: number } | undefined
  ): void => {
    stmts.insertUsage.run(
      familyId,
      kind,
      totalInputTokens(usage),
      usage?.output_tokens || 0,
      now()
    );
  };

  const childForFamily = (childId: unknown, familyId: string): ChildRow | null => {
    const child = childId ? (stmts.childById.get(String(childId)) as ChildRow | undefined) : null;
    return child && child.family_id === familyId ? child : null;
  };

  const normalizeTopic = (topic: unknown): string =>
    String(topic || '')
      .trim()
      .toLowerCase()
      .slice(0, 100);

  // Resolve a subject key to a base system prompt. Built-in subjects use their
  // coach persona; "p:<id>" resolves to one of the family's custom coaches.
  const resolveSubject = (subject: unknown, familyId: string): string | null => {
    if (typeof subject !== 'string') return null;
    if (subject.startsWith('p:')) {
      const persona = stmts.personaById.get(subject.slice(2)) as PersonaRow | undefined;
      if (!persona || persona.family_id !== familyId) return null;
      return personaSystemPrompt(persona);
    }
    return SYSTEM_PROMPTS[subject as keyof typeof SYSTEM_PROMPTS] || null;
  };

  // Fire-and-forget: label the new message, log honest struggle signals.
  const classifyMessage = (
    session: { id: string },
    subject: string,
    history: Array<{ role: string; content: string }>,
    message: string,
    familyId: string
  ): void => {
    fastParse(anthropic, {
      system: CLASSIFIER_SYSTEM,
      messages: [{ role: 'user', content: classifierUserPrompt(history, message) }],
      format: zodOutputFormat(ClassifierSchema) as unknown as Record<string, unknown>,
      maxTokens: 300,
    })
      .then(response => {
        logUsage(familyId, 'classifier', response.usage);
        const result = response.parsed_output as ClassifierResult | null;
        if (!result) return;
        const topicNote = result.topic ? ` (${result.topic.slice(0, 50)})` : '';
        if (result.answer_fishing) {
          stmts.insertStruggle.run(
            session.id,
            subject,
            'Tried to get direct answer',
            `classifier${topicNote}`,
            now()
          );
        }
        if (result.frustration >= 2) {
          stmts.insertStruggle.run(
            session.id,
            subject,
            'Feeling frustrated',
            `level ${result.frustration}${topicNote}`,
            now()
          );
        }
      })
      .catch(error => logger.warn({ err: (error as Error).message }, 'classifier skipped'));
  };

  // Fire-and-forget: refresh the coach's memory of this child periodically.
  const maybeUpdateMemory = (session: SessionRow, child: ChildRow, familyId: string): void => {
    const count = (stmts.sessionMessageCount.get(session.id) as { total: number }).total;
    if (count === 0 || count % MEMORY_EVERY_N_MESSAGES !== 0) return;
    const transcript = (
      stmts.recentMessages.all(session.id, MEMORY_EVERY_N_MESSAGES + 4) as MessageRow[]
    )
      .reverse()
      .map(row => ({ role: row.role, content: row.content }));
    fastParse(anthropic, {
      system: MEMORY_SYSTEM,
      messages: [
        {
          role: 'user',
          content: memoryUserPrompt({
            childName: child.name,
            oldMemory: child.memory,
            subject: session.subject,
            transcript,
          }),
        },
      ],
      format: zodOutputFormat(MemorySchema) as unknown as Record<string, unknown>,
      maxTokens: 500,
    })
      .then(response => {
        logUsage(familyId, 'memory', response.usage);
        const memory = (response.parsed_output as MemoryResult | null)?.memory;
        if (memory) stmts.updateChildMemory.run(memory.slice(0, 2000), child.id);
      })
      .catch(error => logger.warn({ err: (error as Error).message }, 'memory update skipped'));
  };

  const buildSystemPrompt = (base: string, child: ChildRow): Array<Record<string, unknown>> => {
    const studentContext =
      `The student's name is ${child.name} and they are in grade ${child.grade}. ` +
      'Use their name naturally now and then.' +
      (child.memory
        ? `\n\nWhat you remember about ${child.name} from earlier sessions: ${child.memory}`
        : '');
    return [
      // Stable prompt block first so prompt caching can kick in as prompts grow
      { type: 'text', text: base, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: studentContext },
    ];
  };

  const masteryNoteFor = (child: ChildRow, subject: string, topic: string): string => {
    const row = stmts.masteryGet.get(child.id, subject, topic) as
      { score: number; attempts: number } | undefined;
    if (!row || row.attempts < 3) {
      return 'Mix difficulties 1-2 with one stretch problem.';
    }
    if (row.score < 0.35) {
      return `The student has found ${topic} tricky lately - keep problems gentle (difficulty 1, maybe one 2) and confidence-building.`;
    }
    if (row.score > 0.7) {
      return `The student is strong at ${topic} - stretch them (difficulty 2-3).`;
    }
    return 'Mix difficulties 1-2 with one stretch problem.';
  };

  // ---------------------------------------------------------------------------
  // Family & auth
  // ---------------------------------------------------------------------------

  app.post('/api/family/signup', (req: Request, res: Response) => {
    const { familyName, pin, children } = (req.body || {}) as {
      familyName?: unknown;
      pin?: unknown;
      children?: unknown;
    };

    if (
      !familyName ||
      typeof familyName !== 'string' ||
      !familyName.trim() ||
      familyName.trim().length > 60
    ) {
      return res.status(400).json({ error: 'Please give your family a name' });
    }
    if (!/^\d{4,8}$/.test(String(pin ?? ''))) {
      return res.status(400).json({ error: 'The parent PIN needs to be 4-8 digits' });
    }
    const kidList = (Array.isArray(children) ? children.slice(0, 8) : []) as Array<{
      name: string;
      grade: string;
    }>;
    if (!kidList.every(validKidInput)) {
      return res.status(400).json({ error: 'Each kid needs a name and a grade from 3 to 8' });
    }

    let code: string | null = null;
    for (let attempt = 0; attempt < 20 && !code; attempt++) {
      const candidate = auth.generateFamilyCode();
      if (!stmts.familyByCode.get(candidate)) code = candidate;
    }
    if (!code) {
      return res.status(500).json({ error: 'Could not create a family code - please try again' });
    }

    const familyId = uuidv4();
    const ts = now();
    const createdKids = db.transaction(() => {
      stmts.insertFamily.run(familyId, familyName.trim(), code, auth.hashPin(String(pin)), ts);
      return kidList.map(kid => {
        const id = uuidv4();
        stmts.insertChild.run(id, familyId, kid.name.trim(), String(kid.grade), ts);
        return { id, name: kid.name.trim(), grade: String(kid.grade) };
      });
    })();

    res.cookie(auth.FAMILY_COOKIE, familyId, auth.cookieOptions(isProd, auth.YEAR_MS));
    // The parent just set the PIN, so they're verified on this device for now
    res.cookie(auth.PARENT_COOKIE, familyId, auth.cookieOptions(isProd, auth.PARENT_WINDOW_MS));
    res.json({ family: { id: familyId, name: familyName.trim(), code }, children: createdKids });
  });

  app.post('/api/family/login', (req: Request, res: Response) => {
    const { code, pin } = (req.body || {}) as { code?: unknown; pin?: unknown };
    const normalized = auth.normalizeFamilyCode(code);
    const family = normalized
      ? (stmts.familyByCode.get(normalized) as
          { id: string; name: string; pin_hash: string } | undefined)
      : undefined;
    if (!family || !auth.verifyPin(pin, family.pin_hash)) {
      return res.status(401).json({ error: "That family code and PIN don't match" });
    }
    res.cookie(auth.FAMILY_COOKIE, family.id, auth.cookieOptions(isProd, auth.YEAR_MS));
    res.cookie(auth.PARENT_COOKIE, family.id, auth.cookieOptions(isProd, auth.PARENT_WINDOW_MS));
    res.json({
      family: { id: family.id, name: family.name },
      children: stmts.childrenByFamily.all(family.id),
    });
  });

  app.post('/api/family/logout', (req: Request, res: Response) => {
    res.clearCookie(auth.FAMILY_COOKIE);
    res.clearCookie(auth.PARENT_COOKIE);
    res.json({ ok: true });
  });

  app.get('/api/family/me', requireFamily, (req: Request, res: Response) => {
    res.json({
      family: { id: req.family.id, name: req.family.name },
      children: stmts.childrenByFamily.all(req.family.id),
      personas: stmts.personasByFamily.all(req.family.id),
      parentVerified: req.signedCookies[auth.PARENT_COOKIE] === req.family.id,
    });
  });

  app.post('/api/parent/verify', requireFamily, (req: Request, res: Response) => {
    const { pin } = (req.body || {}) as { pin?: unknown };
    if (!auth.verifyPin(pin, req.family.pin_hash)) {
      return res.status(401).json({ error: "That PIN doesn't match", needPin: true });
    }
    res.cookie(
      auth.PARENT_COOKIE,
      req.family.id,
      auth.cookieOptions(isProd, auth.PARENT_WINDOW_MS)
    );
    res.json({ ok: true });
  });

  app.post('/api/children', requireFamily, requireParent, (req: Request, res: Response) => {
    const kid = (req.body || {}) as { name?: string; grade?: string };
    if (!validKidInput(kid)) {
      return res.status(400).json({ error: 'A kid needs a name and a grade from 3 to 8' });
    }
    const id = uuidv4();
    stmts.insertChild.run(id, req.family.id, kid.name!.trim(), String(kid.grade), now());
    res.json({ id, name: kid.name!.trim(), grade: String(kid.grade) });
  });

  app.patch('/api/children/:id', requireFamily, requireParent, (req: Request, res: Response) => {
    const child = stmts.childById.get(req.params.id) as ChildRow | undefined;
    if (!child || child.family_id !== req.family.id) {
      return res.status(404).json({ error: 'No such kid in your family' });
    }
    const body = (req.body || {}) as { name?: unknown; grade?: unknown };
    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : child.name;
    const grade = GRADES.includes(String(body.grade)) ? String(body.grade) : child.grade;
    if (name.length > 40) {
      return res.status(400).json({ error: 'That name is a bit long!' });
    }
    stmts.updateChild.run(name, grade, child.id);
    res.json({ id: child.id, name, grade });
  });

  // ---------------------------------------------------------------------------
  // Custom coach personas
  // ---------------------------------------------------------------------------

  app.post('/api/personas', requireFamily, requireParent, (req: Request, res: Response) => {
    const body = (req.body || {}) as { name?: unknown; emoji?: unknown; description?: unknown };
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const emoji = typeof body.emoji === 'string' && body.emoji.trim() ? body.emoji.trim() : '🤖';
    const description = typeof body.description === 'string' ? body.description.trim() : '';

    if (!name || name.length > 30) {
      return res.status(400).json({ error: 'Give the coach a name (up to 30 characters)' });
    }
    if (emoji.length > 8) {
      return res.status(400).json({ error: 'Pick a single emoji for the coach' });
    }
    if (description.length < 3 || description.length > 200) {
      return res.status(400).json({ error: 'Describe what they coach (3-200 characters)' });
    }
    if ((stmts.personaCount.get(req.family.id) as { total: number }).total >= MAX_PERSONAS) {
      return res.status(400).json({ error: `You can have up to ${MAX_PERSONAS} custom coaches` });
    }

    const id = uuidv4();
    stmts.insertPersona.run(id, req.family.id, name, emoji, description, now());
    res.json({ id, name, emoji, description });
  });

  app.delete('/api/personas/:id', requireFamily, requireParent, (req: Request, res: Response) => {
    const persona = stmts.personaById.get(req.params.id) as PersonaRow | undefined;
    if (!persona || persona.family_id !== req.family.id) {
      return res.status(404).json({ error: 'No such coach' });
    }
    stmts.deletePersona.run(persona.id);
    res.json({ ok: true });
  });

  // ---------------------------------------------------------------------------
  // Session history (resume where you left off)
  // ---------------------------------------------------------------------------

  app.get('/api/sessions/recent', requireFamily, (req: Request, res: Response) => {
    const child = childForFamily(req.query.childId, req.family.id);
    if (!child) return res.status(400).json({ error: 'Pick who is learning first!' });
    const rows = stmts.recentSessionsByChild.all(child.id) as Array<
      SessionRow & { messageCount: number; preview: string | null }
    >;
    res.json({
      sessions: rows.map(session => ({
        id: session.id,
        subject: session.subject,
        startedAt: session.started_at,
        lastActiveAt: session.last_active_at,
        messageCount: session.messageCount,
        preview: (session.preview || '').slice(0, 80),
      })),
    });
  });

  app.get('/api/sessions/:id/messages', requireFamily, (req: Request, res: Response) => {
    const session = stmts.sessionById.get(req.params.id) as SessionRow | undefined;
    const child = session && childForFamily(session.child_id, req.family.id);
    if (!session || !child) return res.status(404).json({ error: 'No such session' });
    res.json({
      sessionId: session.id,
      subject: session.subject,
      messages: (stmts.sessionMessages.all(session.id) as MessageRow[]).map(row => ({
        role: row.role,
        content: row.content,
        hasImage: Boolean(row.has_image),
      })),
    });
  });

  // ---------------------------------------------------------------------------
  // Tutoring chat (Server-Sent Events)
  // ---------------------------------------------------------------------------

  app.post('/api/chat', requireFamily, async (req: Request, res: Response) => {
    const { childId, sessionId, subject, message, image } = (req.body || {}) as {
      childId?: unknown;
      sessionId?: unknown;
      subject?: unknown;
      message?: unknown;
      image?: { media_type?: string; data?: string } | null;
    };

    const child = childForFamily(childId, req.family.id);
    if (!child) {
      return res.status(400).json({ error: 'Pick who is learning first!' });
    }
    const systemBase = resolveSubject(subject, req.family.id);
    if (!systemBase) {
      return res.status(400).json({ error: 'Unknown subject' });
    }
    const subjectKey = subject as string;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }
    if (message.length > MAX_MESSAGE_CHARS) {
      return res.status(400).json({
        error: "That's a really long message! Try breaking it into smaller questions. 😊",
      });
    }
    if (image) {
      const okShape =
        typeof image === 'object' &&
        IMAGE_TYPES.includes(image.media_type || '') &&
        typeof image.data === 'string' &&
        image.data.length > 0 &&
        image.data.length <= MAX_IMAGE_BASE64;
      if (!okShape) {
        return res
          .status(400)
          .json({ error: "That photo didn't come through - try taking it again!" });
      }
    }
    if (overBudget(req.family.id)) {
      return res.status(429).json({ error: BUDGET_MESSAGE });
    }

    let session = sessionId
      ? (stmts.sessionById.get(String(sessionId)) as SessionRow | undefined)
      : undefined;
    if (session && session.child_id !== child.id) {
      session = undefined;
    }
    if (!session) {
      session = {
        id: uuidv4(),
        child_id: child.id,
        subject: subjectKey,
        started_at: now(),
        last_active_at: now(),
      };
      stmts.insertSession.run(
        session.id,
        child.id,
        subjectKey,
        session.started_at,
        session.last_active_at
      );
    } else {
      stmts.touchSession.run(now(), session.id);
    }

    // History BEFORE this message, for the classifier's context
    const priorHistory = (stmts.recentMessages.all(session.id, 6) as MessageRow[])
      .reverse()
      .map(row => ({ role: row.role, content: row.content }));

    stmts.insertMessage.run(session.id, 'user', message, 0, 0, now(), image ? 1 : 0);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    const send = (event: string, data: unknown) =>
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    if (detectCheatAttempt(message)) {
      stmts.insertStruggle.run(
        session.id,
        subjectKey,
        'Tried to get direct answer',
        message.substring(0, 100),
        now()
      );
      stmts.insertMessage.run(session.id, 'assistant', CHEAT_REDIRECT, 0, 0, now(), 0);
      send('meta', { sessionId: session.id, cheatDetected: true });
      send('delta', { text: CHEAT_REDIRECT });
      send('done', { sessionId: session.id });
      return res.end();
    }

    // Semantic labeling runs alongside the reply; it never blocks the stream.
    classifyMessage(session, subjectKey, priorHistory, message, req.family.id);

    send('meta', { sessionId: session.id });

    try {
      const rows = stmts.recentMessages.all(session.id, HISTORY_WINDOW) as MessageRow[];
      const history = rows.reverse().map((row, index, all) => {
        const isCurrentTurn = index === all.length - 1 && row.role === 'user';
        if (isCurrentTurn && image) {
          return {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: image.media_type, data: image.data },
              },
              { type: 'text', text: row.content },
            ],
          };
        }
        // Older photo turns replay as a text note - we don't store image bytes
        const content = row.has_image ? `${PHOTO_HISTORY_NOTE}\n${row.content}` : row.content;
        return { role: row.role, content };
      });

      const stream = streamChat(anthropic, {
        system: buildSystemPrompt(systemBase, child),
        messages: history,
      });
      stream.on('text', text => send('delta', { text }));
      const final = await stream.finalMessage();

      let assistantText = extractText(final);
      if (final.stop_reason === 'refusal') {
        const redirect =
          (assistantText ? '\n\n' : '') +
          "Hmm, I'd better not go further with that one. Let's get back to your schoolwork - what are you working on? 😊";
        send('delta', { text: redirect });
        assistantText += redirect;
      }

      const usage = final.usage || {};
      stmts.insertMessage.run(
        session.id,
        'assistant',
        assistantText,
        totalInputTokens(usage),
        usage.output_tokens || 0,
        now(),
        0
      );
      logUsage(req.family.id, 'chat', usage);
      maybeUpdateMemory(session, child, req.family.id);

      send('done', { sessionId: session.id });
      res.end();
    } catch (error) {
      logger.error({ err: (error as Error).message }, 'chat error');
      send('error', { error: 'Something went wrong. Please try again!' });
      res.end();
    }
  });

  // ---------------------------------------------------------------------------
  // Interactive practice
  // ---------------------------------------------------------------------------

  app.post('/api/practice/generate', requireFamily, async (req: Request, res: Response) => {
    try {
      const { childId, subject, topic } = (req.body || {}) as {
        childId?: unknown;
        subject?: unknown;
        topic?: unknown;
      };

      const child = childForFamily(childId, req.family.id);
      if (!child) return res.status(400).json({ error: 'Pick who is practicing first!' });
      if (typeof subject !== 'string' || !(subject in SYSTEM_PROMPTS)) {
        return res.status(400).json({ error: 'Unknown subject' });
      }
      if (topic && (typeof topic !== 'string' || topic.length > 100)) {
        return res.status(400).json({ error: 'That topic is a bit too long - try a shorter one!' });
      }
      if (overBudget(req.family.id)) return res.status(429).json({ error: BUDGET_MESSAGE });

      const cleanTopic = normalizeTopic(topic || subject);
      const response = await parseStructured(anthropic, {
        system: SYSTEM_PROMPTS[subject as keyof typeof SYSTEM_PROMPTS],
        messages: [
          {
            role: 'user',
            content: practiceSetPrompt({
              grade: child.grade,
              subject,
              topic: cleanTopic,
              masteryNote: masteryNoteFor(child, subject, cleanTopic),
            }),
          },
        ],
        format: zodOutputFormat(PracticeSetSchema) as unknown as Record<string, unknown>,
        maxTokens: 2000,
      });
      logUsage(req.family.id, 'practice', response.usage);

      const set = response.parsed_output as PracticeSet | null;
      if (!set?.problems?.length) {
        return res.status(500).json({ error: 'Could not generate practice problems - try again!' });
      }

      const ts = now();
      const problems = set.problems.map(problem => {
        const difficulty = Math.min(3, Math.max(1, Math.round(problem.difficulty || 1)));
        const result = stmts.insertProblem.run(
          child.id,
          subject,
          cleanTopic,
          difficulty,
          problem.problem,
          problem.hint,
          problem.answer,
          problem.explanation,
          ts
        );
        return {
          id: result.lastInsertRowid,
          problem: problem.problem,
          hint: problem.hint,
          difficulty,
        };
      });

      res.json({ topic: cleanTopic, problems });
    } catch (error) {
      logger.error({ err: (error as Error).message }, 'practice generation error');
      res.status(500).json({ error: 'Could not generate practice problems' });
    }
  });

  app.post('/api/practice/answer', requireFamily, async (req: Request, res: Response) => {
    try {
      const { problemId, answer } = (req.body || {}) as { problemId?: unknown; answer?: unknown };
      const problem = problemId
        ? (stmts.problemById.get(Number(problemId)) as ProblemRow | undefined)
        : undefined;
      const child = problem && childForFamily(problem.child_id, req.family.id);
      if (!problem || !child) return res.status(404).json({ error: 'No such practice problem' });
      if (!answer || typeof answer !== 'string' || answer.length > 300) {
        return res.status(400).json({ error: 'Type an answer first!' });
      }
      if (overBudget(req.family.id)) return res.status(429).json({ error: BUDGET_MESSAGE });

      const response = await fastParse(anthropic, {
        system: GRADER_SYSTEM,
        messages: [
          {
            role: 'user',
            content: graderUserPrompt({
              problem: problem.problem,
              answer: problem.answer,
              studentAnswer: answer,
              grade: child.grade,
            }),
          },
        ],
        format: zodOutputFormat(GradeSchema) as unknown as Record<string, unknown>,
        maxTokens: 300,
      });
      logUsage(req.family.id, 'grading', response.usage);

      const grade = response.parsed_output as GradeResult | null;
      if (!grade) {
        return res.status(500).json({ error: 'Could not check that answer - try again!' });
      }

      stmts.insertAttempt.run(
        child.id,
        problem.subject,
        problem.topic,
        problem.difficulty,
        grade.correct ? 1 : 0,
        problem.problem,
        answer,
        problem.id,
        now()
      );

      // Nudge the mastery score: slow to rise, a little quicker to catch struggle
      const current = stmts.masteryGet.get(child.id, problem.subject, problem.topic) as
        { score: number } | undefined;
      const score = current ? current.score : 0.5;
      const nextScore = Math.min(1, Math.max(0, score + (grade.correct ? 0.08 : -0.1)));
      stmts.masteryUpsert.run(child.id, problem.subject, problem.topic, nextScore, now());
      updateReviewQueue(child.id, problem.id, grade.correct);

      res.json({
        correct: grade.correct,
        feedback: grade.feedback,
        explanation: grade.correct ? problem.explanation : null,
      });
    } catch (error) {
      logger.error({ err: (error as Error).message }, 'practice grading error');
      res.status(500).json({ error: 'Could not check that answer' });
    }
  });

  app.post('/api/practice/reveal', requireFamily, (req: Request, res: Response) => {
    const { problemId } = (req.body || {}) as { problemId?: unknown };
    const problem = problemId
      ? (stmts.problemById.get(Number(problemId)) as ProblemRow | undefined)
      : undefined;
    const child = problem && childForFamily(problem.child_id, req.family.id);
    if (!problem || !child) return res.status(404).json({ error: 'No such practice problem' });

    // Giving up still teaches - show the answer WITH the explanation, and score it
    stmts.insertAttempt.run(
      child.id,
      problem.subject,
      problem.topic,
      problem.difficulty,
      0,
      problem.problem,
      '(revealed)',
      problem.id,
      now()
    );
    const current = stmts.masteryGet.get(child.id, problem.subject, problem.topic) as
      { score: number } | undefined;
    const score = current ? current.score : 0.5;
    stmts.masteryUpsert.run(
      child.id,
      problem.subject,
      problem.topic,
      Math.max(0, score - 0.06),
      now()
    );
    updateReviewQueue(child.id, problem.id, false);

    res.json({ answer: problem.answer, explanation: problem.explanation });
  });

  // Problems the child missed earlier that are due for another look
  app.get('/api/practice/review', requireFamily, (req: Request, res: Response) => {
    const child = childForFamily(req.query.childId, req.family.id);
    if (!child) return res.status(400).json({ error: 'Pick who is practicing first!' });
    const nowTs = now();
    res.json({
      due: stmts.dueReviews.all(child.id, nowTs),
      total: (stmts.dueReviewCount.get(child.id, nowTs) as { total: number }).total,
    });
  });

  app.post('/api/practice/similar', requireFamily, async (req: Request, res: Response) => {
    try {
      const { problemId } = (req.body || {}) as { problemId?: unknown };
      const original = problemId
        ? (stmts.problemById.get(Number(problemId)) as ProblemRow | undefined)
        : undefined;
      const child = original && childForFamily(original.child_id, req.family.id);
      if (!original || !child) return res.status(404).json({ error: 'No such practice problem' });
      if (overBudget(req.family.id)) return res.status(429).json({ error: BUDGET_MESSAGE });

      const response = await parseStructured(anthropic, {
        system: SYSTEM_PROMPTS[original.subject as keyof typeof SYSTEM_PROMPTS],
        messages: [
          {
            role: 'user',
            content:
              `Create 1 practice problem very similar to this one (same skill, same difficulty ${original.difficulty}, different numbers/details) for a grade ${child.grade} student:\n\n` +
              `${original.problem}\n\nProvide problem, hint, answer, explanation, difficulty as requested.`,
          },
        ],
        format: zodOutputFormat(PracticeSetSchema) as unknown as Record<string, unknown>,
        maxTokens: 800,
      });
      logUsage(req.family.id, 'practice', response.usage);

      const problem = (response.parsed_output as PracticeSet | null)?.problems?.[0];
      if (!problem) {
        return res.status(500).json({ error: 'Could not make a similar one - try again!' });
      }

      const result = stmts.insertProblem.run(
        child.id,
        original.subject,
        original.topic,
        original.difficulty,
        problem.problem,
        problem.hint,
        problem.answer,
        problem.explanation,
        now()
      );

      res.json({
        problem: {
          id: result.lastInsertRowid,
          problem: problem.problem,
          hint: problem.hint,
          difficulty: original.difficulty,
        },
      });
    } catch (error) {
      logger.error({ err: (error as Error).message }, 'similar problem error');
      res.status(500).json({ error: 'Could not make a similar one' });
    }
  });

  // ---------------------------------------------------------------------------
  // Progress: XP, streaks, badges, daily challenge
  // ---------------------------------------------------------------------------

  app.get('/api/progress', requireFamily, (req: Request, res: Response) => {
    const child = childForFamily(req.query.childId, req.family.id);
    if (!child) return res.status(400).json({ error: 'Pick who is learning first!' });
    res.json(childProgress(db, child));
  });

  // ---------------------------------------------------------------------------
  // Parent dashboard
  // ---------------------------------------------------------------------------

  app.get('/api/parent/summary', requireFamily, requireParent, (req: Request, res: Response) => {
    res.json(familySummary(db, req.family));
  });

  app.get('/api/parent/digest', requireFamily, requireParent, (req: Request, res: Response) => {
    res.json({ html: digestForFamily(db, req.family) });
  });

  app.post('/api/parent/settings', requireFamily, requireParent, (req: Request, res: Response) => {
    const digestEmail = String((req.body as { digestEmail?: unknown })?.digestEmail ?? '').trim();
    if (digestEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(digestEmail)) {
      return res.status(400).json({ error: "That email doesn't look right" });
    }
    if (digestEmail.length > 120) {
      return res.status(400).json({ error: 'That email is too long' });
    }
    stmts.updateDigestEmail.run(digestEmail, req.family.id);
    res.json({ ok: true, digestEmail });
  });

  // ---------------------------------------------------------------------------
  // Static client (production)
  // ---------------------------------------------------------------------------

  if (isProd) {
    const clientDir = path.join(__dirname, '../client/dist');
    app.use(express.static(clientDir));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(clientDir, 'index.html'));
    });
  }

  return app;
}
