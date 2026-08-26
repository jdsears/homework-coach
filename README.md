# 📚 Homework Coach

A kid-safe AI tutoring app that helps children learn through the Socratic method - guiding them to answers instead of just giving them away.

![Homework Coach](https://img.shields.io/badge/Made%20for-Kids-brightgreen)
![Powered by Claude](https://img.shields.io/badge/Powered%20by-Claude%20AI-blue)

## ✨ Features

### For Kids

- **🧮 Math Coach** - Fractions, algebra, word problems with guided discovery
- **📖 Reading & Writing Coach** - Essay help, comprehension, vocabulary building
- **🔬 Science Coach** - Explore how the world works through inquiry
- **🌍 Geography, 🏛️ History, 🇫🇷 French, 🇪🇸 Spanish** - Seven coaches in all
- **✨ Practice Mode** - Custom practice problems with tap-to-reveal hints
- **⚡ Live streaming replies** - The coach starts "typing" instantly
- **🎯 Grade-appropriate** - Each kid has a profile with their grade (3-8)

### For Families

- **👨‍👩‍👧 Family accounts** - Sign up once, add each kid, sign in anywhere with your family code + parent PIN
- **🔒 Private by design** - Kids' conversations belong to your family only; the parent dashboard is PIN-protected and never shows kids' raw words
- **📊 Weekly dashboard** - Sessions, per-subject activity, and per-kid summaries
- **⚠️ Struggle signals** - Know when they need extra support
- **🛡️ Answer-fishing detection** - Redirects "just give me the answer" requests back to learning
- **💰 Daily budget** - A per-family token budget keeps API costs predictable

## 🚀 Deploy to Railway

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
3. Add a **volume** (so the database survives deploys) and mount it at `/data`
4. Set environment variables:
   - `ANTHROPIC_API_KEY` - from [console.anthropic.com](https://console.anthropic.com)
   - `COOKIE_SECRET` - a long random string (`openssl rand -hex 32`)
   - `DATABASE_PATH` - `/data/homework-coach.db` (to use the volume)
5. Railway auto-detects the build via `nixpacks.toml` and gives you a URL

## 🔧 Local Development

### Prerequisites

- Node.js 18+ and npm

### Setup

```bash
npm run install-all      # installs server + client dependencies

cp .env.example .env     # then add your ANTHROPIC_API_KEY

npm run dev              # server on :3001, Vite client on :3000
```

### Scripts

| Command                | What it does                              |
| ---------------------- | ----------------------------------------- |
| `npm run dev`          | Server + client dev servers, live reload  |
| `npm test`             | API test suite (Vitest + Supertest)       |
| `npm run lint`         | ESLint over server, client, and tests     |
| `npm run format`       | Prettier over the repo                    |
| `npm run build`        | Production client build (Vite → `client/dist`) |

## 🗂️ Project Structure

```
homework-coach/
├── server/
│   ├── index.js          # Bootstrap: env checks, db, listen
│   ├── app.js            # Express app factory: routes, SSE chat, auth wiring
│   ├── db.js             # SQLite schema (better-sqlite3)
│   ├── auth.js           # Family cookies, PIN hashing, family codes
│   ├── claude.js         # Claude client, model config, streaming
│   └── prompts.js        # Coach personas + practice prompt
├── client/
│   ├── index.html        # Vite entry
│   └── src/
│       ├── App.jsx           # Routing + family gate
│       ├── FamilyContext.jsx # Family/children/active-kid state
│       ├── api.js            # fetch + SSE helpers
│       └── components/
│           ├── FamilySetup.jsx    # Signup / sign-in
│           ├── ChildPicker.jsx    # "Who's learning today?"
│           ├── SubjectSelect.jsx  # Home screen
│           ├── ChatRoom.jsx       # Streaming tutoring chat
│           ├── PracticeMode.jsx   # Problem generator
│           └── ParentDashboard.jsx# PIN-gated weekly summary
├── tests/api.test.js     # API tests with a mocked Claude client
└── .github/workflows/ci.yml
```

## 🛡️ Safety & Privacy

- **Socratic method** - Coaches never hand over final answers; they ask guiding questions, break problems into steps, and celebrate effort.
- **Answer-fishing detection** - "Just tell me the answer" gets a friendly redirect and shows up for parents as a tricky moment.
- **Family isolation** - Every session, message, and struggle belongs to one family. There is no shared global state.
- **Parent dashboard shows types, not transcripts** - Parents see *"Expressed confusion - math - Tuesday"*, never the kid's raw words.
- **Hardening** - Helmet CSP, rate limits, input validation, per-family daily token budget, PIN-gated parent routes.

## 🔮 Roadmap

See [PLAN.md](./PLAN.md) - homework photo input, KaTeX math, interactive practice, smarter struggle detection, memory across sessions, streaks and spaced repetition are next.

## 📄 License

MIT License - feel free to modify for your family!

---

Built with ❤️ for kids who want to learn (not just get answers!)
