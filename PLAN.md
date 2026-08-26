# Homework Coach — World-Beater Plan

A phased roadmap to take Homework Coach from a charming demo to the homework app every family wants: one kids love using, parents genuinely trust, and that measurably teaches.

## Where we are today

**Strengths worth protecting:** a warm, well-scoped concept; seven subjects with genuinely good Socratic system prompts; a friendly mobile-first UI; a small codebase that's easy to move fast in; one-click Railway deploys.

**Critical gaps found in the audit** (file references are to the current code):

1. **Every visitor shares one app instance.** Sessions and parent data live in global in-memory Maps (`homework-coach/server/index.js:26-27`). Anyone who opens the deployed URL sees the *same* parent dashboard — including snippets of kids' messages, since `/api/parent/summary` is unauthenticated. For a kids' product this is the #1 issue: it's a privacy problem (COPPA-adjacent) and all data evaporates on every deploy or restart.
2. **The chat endpoint is an open Claude proxy.** `/api/chat` has no auth, no rate limit, and no usage cap. Anyone who finds the URL can burn the API key at will.
3. **Dated model, no streaming.** The model is hardcoded to `claude-sonnet-4-20250514` (`server/index.js:281`) — several generations behind. Kids stare at a typing indicator until the whole response lands, and `max_tokens: 500` can truncate replies mid-sentence.
4. **Cheat detection is regex theater; struggle tracking is noise.** The regex list is trivially bypassed ("what does x equal?") and false-positives on innocent phrasing ("just tell me if I'm right"). Worse, the struggle heuristic flags any message containing "help" (`server/index.js:296-301`) — and the app's own suggested starter is *"I need help with fractions"*, so nearly every session opens by logging a false struggle. The parent dashboard is built on noise.
5. **Practice hints aren't actually hidden.** The server asks Claude for `[HINT]` markers described as "hidden" (`server/index.js:322-324`), but the client renders the raw text (`client/src/components/PracticeMode.js:96`) — hints show immediately, defeating the exercise. Chat has the sibling problem: Claude's markdown renders as literal asterisks (`ChatRoom.js:202-206`).
6. **Small bugs and broken promises.** Grade buttons read "3th" (`SubjectSelect.js:79`); the README promises a PWA but there's no manifest or service worker; setup says `cp .env.example .env` but no `.env.example` exists; a cheat-flagged first message returns a `sessionId` that maps to no stored session and the exchange is never saved (`server/index.js:244-253`); the `parentData` map is declared and never used; the dashboard's "Sessions" stat counts all-time while the page claims "this week."
7. **Repo and tooling debt.** Everything is nested one level deep under `homework-coach/` (artifact of the "Add files via upload" commit), so `railway.toml`/`nixpacks.toml` aren't at the repo root where Railway auto-detect looks. Create React App (`react-scripts`) is deprecated/EOL.

## What "world beater" means here

Kid-facing education products win on three fronts, and the phases below map to them:

- **Kids come back** — it feels alive, fast, and rewarding (streaming, voice, photos, streaks).
- **Parents trust and pay** — real privacy, real safety, and a dashboard that reflects reality.
- **It actually teaches** — adaptive difficulty, memory across sessions, spaced repetition; not just a chatbot with a nice prompt.

---

## Phase 0 — Stop the bleeding (~1 day) — ✅ shipped in PR #1

Small fixes that repair today's experience and close the worst holes. All are independent and low-risk.

- [x] Fix ordinal labels ("3rd", not "3th") in the grade picker.
- [x] Render markdown in chat and practice output (`react-markdown`) so Claude's formatting stops appearing as literal `**asterisks**`.
- [x] Parse `[HINT]` and hide hints behind a tap-to-reveal button.
- [x] Remove `"help"` from the struggle heuristic (real fix in Phase 2) so the dashboard stops logging every session as a struggle.
- [x] Record cheat-flagged exchanges in the session and return a real session id.
- [x] Add `.env.example`; fail fast at startup with a clear message when `ANTHROPIC_API_KEY` is missing; check `response.ok` in client fetches.
- [x] Basic abuse guard: `express-rate-limit` on `/api/*`, cap message length, restrict CORS to the app's own origin.
- [x] Flatten the repo so `package.json` and the Railway configs sit at the root (or document the Railway root-directory setting) — right now a fresh deploy from the repo root fails auto-detection.
- [x] Re-enable pinch zoom (drop `maximum-scale=1, user-scalable=no`) — accessibility basics for a kids' app.

## Phase 1 — Foundation: from demo to product (~1–2 weeks) — ✅ shipped in PR #2

The unlock phase. Everything later depends on this. (Prompt caching intentionally waits for Phase 2's richer prompts; deploy note: the Railway service's Root Directory setting must be cleared after the Phase 0 repo flatten.)

1. **Model + API upgrade.**
   - Move off `claude-sonnet-4-20250514` to the current generation, configurable via env var (`CLAUDE_MODEL`). Default to `claude-opus-5` ($5/$25 per MTok) for tutoring quality; `claude-sonnet-5` ($2/$10) is the budget alternative, and `claude-haiku-4-5` ($1/$5) powers cheap classifier calls in Phase 2. A typical tutoring turn is a few thousand input tokens, so even Opus lands around ~$0.02/turn.
   - **Stream responses** (SSE from Express, `client.messages.stream()` server-side). Perceived speed is the single cheapest UX win available — kids watch the coach "type" instantly instead of waiting.
   - Raise `max_tokens` sensibly and window the conversation history sent per turn (keep the last N exchanges) so long chats don't grow linearly in cost.
   - Add prompt caching (`cache_control`) once system prompts grow past the ~1K-token minimum — they'll get there in Phase 2 with richer pedagogy.
2. **Persistence.** SQLite via `better-sqlite3` (zero-ops, perfect at this scale; Railway volume for durability). Schema: `families`, `children`, `sessions`, `messages`, `struggles`, `practice_attempts`. This is what makes streaks, memory, mastery, and honest dashboards possible.
3. **Families & privacy.** Family signup, per-child profiles (name, grade — grade stops being a query param), and a parent PIN gating the dashboard. Kid transcripts become reachable only by their own family. This is table stakes for trust, and trust is the moat in this market.
4. **Hardening.** `helmet`, per-family daily token budget with a friendly "we've done a lot of learning today!" stop, input validation on all routes.
5. **Engineering hygiene.** Vitest + Supertest API tests (cheat paths, session lifecycle, summary math), ESLint + Prettier, GitHub Actions CI, and migrate CRA → Vite (react-scripts is EOL; Vite halves build times and unblocks modern tooling).

## Phase 2 — The learning-experience leap (the differentiators) — ✅ shipped in PR #3

1. **📸 Snap your homework.** Claude is multimodal — let kids photograph the worksheet instead of typing out a word problem. The coach sees exactly what the kid sees. This is the single most differentiating feature in the plan and the one families will tell other families about.
2. **Real math rendering.** KaTeX in chat and practice — a math tutor that can't typeset a fraction isn't a serious math tutor.
3. **Interactive practice.** Replace the wall-of-text generator with structured outputs (JSON: problem, hint, answer, explanation, difficulty). Render one problem per card with tap-to-reveal hints, an answer box, model-checked feedback that celebrates the *method*, and a "give me a similar one" button.
4. **Smart cheat & frustration detection.** Replace the regex with a `claude-haiku-4-5` classifier (or a structured flag returned alongside the tutor call): catches answer-fishing semantically, kills the false positives, and grades frustration so the coach can soften tone or simplify *before* the kid gives up. This also makes dashboard data honest for the first time.
5. **Memory across sessions.** Persisted history per child plus a rolling summary: "Last time we worked on equivalent fractions — want to keep going?" Returning to a coach who *remembers you* is the retention feature.
6. **Voice in, voice out.** Web Speech API dictation for slow typists; optional read-aloud for kids reading below grade level. Both are browser-native — no new dependencies.
7. **Adaptive difficulty.** Track per-topic correct/incorrect from practice, maintain a simple mastery score, and generate problems at the edge of each kid's ability.

## Phase 3 — Retention & parent value

1. **Streaks, XP, badges, daily challenge** — the Duolingo playbook, tuned gentle (effort-based, no punishing streak loss for a 9-year-old).
2. **Spaced repetition** — missed practice problems return on an expanding schedule (already on the README wishlist; Phase 1's database makes it a small feature).
3. **Parent dashboard v2** — real time-on-task, per-topic mastery trends, week-over-week charts, and a weekly email digest so value lands in the inbox without anyone remembering to check.
4. **Deliver the PWA promise** — manifest, service worker, offline shell, install prompt. The README already advertises it; make it true.

## Phase 4 — Scale & polish

1. TypeScript migration, structured logging, error tracking (Sentry).
2. Postgres on Railway when SQLite is outgrown (schema ports cleanly).
3. Cost engineering: route classification/answer-checking to Haiku, tutoring to Opus/Sonnet; batch API for digest generation.
4. More subjects and custom coach personas ("make me a chess coach"); i18n for the interface itself.
5. Accessibility pass: ARIA on interactive elements, dyslexia-friendly font option, reduced-motion support.

---

## Sequencing and what to measure

**Order:** Phase 0 immediately (a day, huge experience repair) → Phase 1 (the unlock) → Phase 2.1 photo input early, because it's the wow feature — then the rest of Phase 2 → 3 → 4.

**North-star metrics:** kid D7 return rate, sessions per child per week, hint-usage vs. answer-fishing ratio (learning health), parent weekly dashboard/digest opens, and cost per session.

The current codebase is a genuinely good seed — the pedagogy in the prompts is the hard part and it's already thoughtful. The plan above turns that seed into a product: safe by design, alive to use, and demonstrably teaching.
