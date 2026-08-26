const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const { SYSTEM_PROMPTS, CHEAT_REDIRECT, detectCheatAttempt, practicePrompt } = require('./prompts');
const { streamChat, createCompletion, extractText, totalInputTokens } = require('./claude');
const auth = require('./auth');

const GRADES = ['3', '4', '5', '6', '7', '8'];
const HISTORY_WINDOW = 24; // messages sent to the model per turn
const MAX_MESSAGE_CHARS = 2000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const now = () => new Date().toISOString();

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

function createApp({ db, anthropic, config = {} }) {
  const {
    isProd = process.env.NODE_ENV === 'production',
    cookieSecret = process.env.COOKIE_SECRET || 'dev-secret-change-me',
    allowedOrigins = process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
      : ['http://localhost:3000'],
    dailyTokenBudget = Number(process.env.DAILY_TOKEN_BUDGET || 300000),
    rateLimits = true,
  } = config;

  const app = express();
  app.set('trust proxy', 1);

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
  app.use(express.json({ limit: '100kb' }));
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
    insertSession: db.prepare(
      'INSERT INTO sessions (id, child_id, subject, started_at, last_active_at) VALUES (?, ?, ?, ?, ?)'
    ),
    sessionById: db.prepare('SELECT * FROM sessions WHERE id = ?'),
    touchSession: db.prepare('UPDATE sessions SET last_active_at = ? WHERE id = ?'),
    insertMessage: db.prepare(
      'INSERT INTO messages (session_id, role, content, input_tokens, output_tokens, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ),
    recentMessages: db.prepare(
      'SELECT role, content FROM messages WHERE session_id = ? ORDER BY id DESC LIMIT ?'
    ),
    insertStruggle: db.prepare(
      'INSERT INTO struggles (session_id, subject, type, context, created_at) VALUES (?, ?, ?, ?, ?)'
    ),
    insertUsage: db.prepare(
      'INSERT INTO usage_log (family_id, kind, input_tokens, output_tokens, created_at) VALUES (?, ?, ?, ?, ?)'
    ),
    familyTokensSince: db.prepare(
      'SELECT COALESCE(SUM(input_tokens + output_tokens), 0) AS total FROM usage_log WHERE family_id = ? AND created_at >= ?'
    ),
    weeklySessions: db.prepare(
      `SELECT COUNT(*) AS total FROM sessions s
       JOIN children c ON c.id = s.child_id
       WHERE c.family_id = ? AND s.started_at >= ?`
    ),
    weeklySubjectCounts: db.prepare(
      `SELECT s.subject AS subject, COUNT(m.id) AS count FROM messages m
       JOIN sessions s ON s.id = m.session_id
       JOIN children c ON c.id = s.child_id
       WHERE c.family_id = ? AND m.created_at >= ?
       GROUP BY s.subject`
    ),
    weeklyStruggles: db.prepare(
      `SELECT st.subject AS subject, st.type AS type, st.created_at AS timestamp FROM struggles st
       JOIN sessions s ON s.id = st.session_id
       JOIN children c ON c.id = s.child_id
       WHERE c.family_id = ? AND st.created_at >= ?
       ORDER BY st.created_at DESC`
    ),
    weeklyChildActivity: db.prepare(
      `SELECT c.id AS id, c.name AS name, c.grade AS grade,
              (SELECT COUNT(*) FROM messages m
               JOIN sessions s ON s.id = m.session_id
               WHERE s.child_id = c.id AND m.created_at >= ?) AS messageCount
       FROM children c WHERE c.family_id = ? ORDER BY c.created_at, c.id`
    ),
  };

  const validKidInput = kid =>
    kid &&
    typeof kid.name === 'string' &&
    kid.name.trim() &&
    kid.name.trim().length <= 40 &&
    GRADES.includes(String(kid.grade));

  const overBudget = familyId => {
    const since = new Date(Date.now() - DAY_MS).toISOString();
    return stmts.familyTokensSince.get(familyId, since).total >= dailyTokenBudget;
  };

  const BUDGET_MESSAGE =
    "Wow, we've done a LOT of learning today! 🌟 The coaches need a rest - come back tomorrow!";

  // ---------------------------------------------------------------------------
  // Family & auth
  // ---------------------------------------------------------------------------

  app.post('/api/family/signup', (req, res) => {
    const { familyName, pin, children } = req.body || {};

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
    const kidList = Array.isArray(children) ? children.slice(0, 8) : [];
    if (!kidList.every(validKidInput)) {
      return res.status(400).json({ error: 'Each kid needs a name and a grade from 3 to 8' });
    }

    let code = null;
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
      stmts.insertFamily.run(familyId, familyName.trim(), code, auth.hashPin(pin), ts);
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

  app.post('/api/family/login', (req, res) => {
    const { code, pin } = req.body || {};
    const normalized = auth.normalizeFamilyCode(code);
    const family = normalized ? stmts.familyByCode.get(normalized) : null;
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

  app.post('/api/family/logout', (req, res) => {
    res.clearCookie(auth.FAMILY_COOKIE);
    res.clearCookie(auth.PARENT_COOKIE);
    res.json({ ok: true });
  });

  app.get('/api/family/me', requireFamily, (req, res) => {
    res.json({
      family: { id: req.family.id, name: req.family.name },
      children: stmts.childrenByFamily.all(req.family.id),
      parentVerified: req.signedCookies[auth.PARENT_COOKIE] === req.family.id,
    });
  });

  app.post('/api/parent/verify', requireFamily, (req, res) => {
    const { pin } = req.body || {};
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

  app.post('/api/children', requireFamily, requireParent, (req, res) => {
    const kid = req.body || {};
    if (!validKidInput(kid)) {
      return res.status(400).json({ error: 'A kid needs a name and a grade from 3 to 8' });
    }
    const id = uuidv4();
    stmts.insertChild.run(id, req.family.id, kid.name.trim(), String(kid.grade), now());
    res.json({ id, name: kid.name.trim(), grade: String(kid.grade) });
  });

  app.patch('/api/children/:id', requireFamily, requireParent, (req, res) => {
    const child = stmts.childById.get(req.params.id);
    if (!child || child.family_id !== req.family.id) {
      return res.status(404).json({ error: 'No such kid in your family' });
    }
    const name =
      typeof req.body?.name === 'string' && req.body.name.trim()
        ? req.body.name.trim()
        : child.name;
    const grade = GRADES.includes(String(req.body?.grade)) ? String(req.body.grade) : child.grade;
    if (name.length > 40) {
      return res.status(400).json({ error: 'That name is a bit long!' });
    }
    stmts.updateChild.run(name, grade, child.id);
    res.json({ id: child.id, name, grade });
  });

  // ---------------------------------------------------------------------------
  // Tutoring chat (Server-Sent Events)
  // ---------------------------------------------------------------------------

  app.post('/api/chat', requireFamily, async (req, res) => {
    const { childId, sessionId, subject, message } = req.body || {};

    const child = childId ? stmts.childById.get(childId) : null;
    if (!child || child.family_id !== req.family.id) {
      return res.status(400).json({ error: 'Pick who is learning first!' });
    }
    if (!SYSTEM_PROMPTS[subject]) {
      return res.status(400).json({ error: 'Unknown subject' });
    }
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }
    if (message.length > MAX_MESSAGE_CHARS) {
      return res.status(400).json({
        error: "That's a really long message! Try breaking it into smaller questions. 😊",
      });
    }
    if (overBudget(req.family.id)) {
      return res.status(429).json({ error: BUDGET_MESSAGE });
    }

    let session = sessionId ? stmts.sessionById.get(sessionId) : null;
    if (session) {
      const sessionChild = stmts.childById.get(session.child_id);
      if (!sessionChild || sessionChild.family_id !== req.family.id) session = null;
    }
    if (!session) {
      session = { id: uuidv4(), child_id: child.id, subject };
      stmts.insertSession.run(session.id, child.id, subject, now(), now());
    } else {
      stmts.touchSession.run(now(), session.id);
    }

    stmts.insertMessage.run(session.id, 'user', message, 0, 0, now());

    // Struggle heuristic (a semantic classifier replaces this in Phase 2).
    const lowered = message.toLowerCase();
    if (
      lowered.includes("don't understand") ||
      lowered.includes("don't get it") ||
      lowered.includes('confused') ||
      lowered.includes('stuck') ||
      lowered.includes('give up')
    ) {
      stmts.insertStruggle.run(
        session.id,
        subject,
        'Expressed confusion',
        message.substring(0, 100),
        now()
      );
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    if (detectCheatAttempt(message)) {
      stmts.insertStruggle.run(
        session.id,
        subject,
        'Tried to get direct answer',
        message.substring(0, 100),
        now()
      );
      stmts.insertMessage.run(session.id, 'assistant', CHEAT_REDIRECT, 0, 0, now());
      send('meta', { sessionId: session.id, cheatDetected: true });
      send('delta', { text: CHEAT_REDIRECT });
      send('done', { sessionId: session.id });
      return res.end();
    }

    send('meta', { sessionId: session.id });

    try {
      const history = stmts.recentMessages
        .all(session.id, HISTORY_WINDOW)
        .reverse()
        .map(row => ({ role: row.role, content: row.content }));

      const systemPrompt =
        `${SYSTEM_PROMPTS[subject]}\n\n` +
        `The student's name is ${child.name} and they are in grade ${child.grade}. ` +
        'Use their name naturally now and then.';

      const stream = streamChat(anthropic, { system: systemPrompt, messages: history });
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
      const inputTokens = totalInputTokens(usage);
      stmts.insertMessage.run(
        session.id,
        'assistant',
        assistantText,
        inputTokens,
        usage.output_tokens || 0,
        now()
      );
      stmts.insertUsage.run(req.family.id, 'chat', inputTokens, usage.output_tokens || 0, now());

      send('done', { sessionId: session.id });
      res.end();
    } catch (error) {
      console.error('Chat error:', error);
      send('error', { error: 'Something went wrong. Please try again!' });
      res.end();
    }
  });

  // ---------------------------------------------------------------------------
  // Practice problems
  // ---------------------------------------------------------------------------

  app.post('/api/practice', requireFamily, async (req, res) => {
    try {
      const { childId, subject, topic } = req.body || {};

      const child = childId ? stmts.childById.get(childId) : null;
      if (!child || child.family_id !== req.family.id) {
        return res.status(400).json({ error: 'Pick who is practicing first!' });
      }
      if (!SYSTEM_PROMPTS[subject]) {
        return res.status(400).json({ error: 'Unknown subject' });
      }
      if (topic && (typeof topic !== 'string' || topic.length > 100)) {
        return res.status(400).json({ error: 'That topic is a bit too long - try a shorter one!' });
      }
      if (overBudget(req.family.id)) {
        return res.status(429).json({ error: BUDGET_MESSAGE });
      }

      const response = await createCompletion(anthropic, {
        system: SYSTEM_PROMPTS[subject],
        messages: [{ role: 'user', content: practicePrompt(child.grade, topic || subject) }],
      });

      stmts.insertUsage.run(
        req.family.id,
        'practice',
        totalInputTokens(response.usage),
        response.usage?.output_tokens || 0,
        now()
      );

      res.json({ problems: extractText(response) });
    } catch (error) {
      console.error('Practice generation error:', error);
      res.status(500).json({ error: 'Could not generate practice problems' });
    }
  });

  // ---------------------------------------------------------------------------
  // Parent dashboard
  // ---------------------------------------------------------------------------

  app.get('/api/parent/summary', requireFamily, requireParent, (req, res) => {
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
    for (const row of stmts.weeklySubjectCounts.all(req.family.id, weekAgo)) {
      subjectBreakdown[row.subject] = row.count;
    }

    // Struggle *types* only - kids' raw words stay out of API responses
    const struggles = {};
    for (const row of stmts.weeklyStruggles.all(req.family.id, weekAgo)) {
      if (!struggles[row.subject]) struggles[row.subject] = [];
      struggles[row.subject].push({
        type: row.type,
        timestamp: row.timestamp,
        subject: row.subject,
      });
    }

    res.json({
      weekStart: weekAgo,
      weekEnd: now(),
      familyName: req.family.name,
      familyCode: req.family.code,
      totalSessions: stmts.weeklySessions.get(req.family.id, weekAgo).total,
      subjectBreakdown,
      struggles,
      children: stmts.weeklyChildActivity.all(weekAgo, req.family.id),
      encouragement: generateParentTip(struggles),
    });
  });

  // ---------------------------------------------------------------------------
  // Static client (production)
  // ---------------------------------------------------------------------------

  if (isProd) {
    const clientDir = path.join(__dirname, '../client/dist');
    app.use(express.static(clientDir));
    app.get('*', (req, res) => {
      res.sendFile(path.join(clientDir, 'index.html'));
    });
  }

  return app;
}

module.exports = { createApp };
