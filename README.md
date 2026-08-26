# 📚 Homework Coach

A kid-safe AI tutoring app that helps children learn through the Socratic method - guiding them to answers instead of just giving them away.

![Homework Coach](https://img.shields.io/badge/Made%20for-Kids-brightgreen)
![Powered by Claude](https://img.shields.io/badge/Powered%20by-Claude%20AI-blue)

## ✨ Features

### For Kids
- **🧮 Math Coach** - Fractions, algebra, word problems with guided discovery
- **📖 Reading & Writing Coach** - Essay help, comprehension, vocabulary building  
- **🔬 Science Coach** - Explore how the world works through inquiry
- **✨ Practice Mode** - Generate custom practice problems on any topic
- **🎯 Grade-appropriate** - Content tailored for grades 3-8

### For Parents
- **📊 Weekly Dashboard** - See what subjects your child is working on
- **⚠️ Struggle Alerts** - Know when they need extra support
- **🛡️ Cheat Detection** - Redirects "just give me the answer" requests to learning

## 🚀 Deploy to Railway

### Step 1: Push to GitHub
```bash
# Create a new GitHub repository, then:
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/homework-coach.git
git push -u origin main
```

### Step 2: Deploy on Railway

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your `homework-coach` repository
4. Railway will auto-detect the configuration

### Step 3: Add Environment Variables

In Railway dashboard:
1. Click on your project
2. Go to **Variables** tab
3. Add: `ANTHROPIC_API_KEY` = your API key from [console.anthropic.com](https://console.anthropic.com)

### Step 4: Get Your URL

Railway will automatically generate a URL like `homework-coach-abc123.up.railway.app`

That's it! Your app is live! 🎉

## 🔧 Local Development

### Prerequisites
- Node.js 18 or higher
- npm

### Setup
```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/homework-coach.git
cd homework-coach

# Install dependencies
npm run install-all

# Create .env file
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# Start development servers
npm run dev
```

The app will run at:
- Frontend: http://localhost:3000
- Backend: http://localhost:3001

## 📱 Mobile Use

This is a Progressive Web App optimized for mobile:
1. Open the Railway URL on your phone
2. Tap "Add to Home Screen" in your browser menu
3. It works just like a native app!

## 🛡️ Safety Features

### Cheat Detection
The app detects phrases like:
- "Give me the answer"
- "Just tell me"
- "Do it for me"
- "Help me cheat"

When detected, it gently redirects kids back to learning mode.

### Socratic Method
Coaches never give direct answers. Instead, they:
1. Ask guiding questions
2. Break problems into steps
3. Use relatable examples
4. Celebrate effort, not just correct answers

## 🗂️ Project Structure

```
homework-coach/
├── server/
│   └── index.js          # Express backend + Claude API
├── client/
│   ├── public/
│   │   └── index.html
│   └── src/
│       ├── App.js        # Main app with routing
│       ├── App.css       # All styles
│       └── components/
│           ├── SubjectSelect.js   # Home screen
│           ├── ChatRoom.js        # Tutoring chat
│           ├── PracticeMode.js    # Problem generator
│           └── ParentDashboard.js # Weekly summary
├── package.json
├── railway.toml          # Railway config
└── nixpacks.toml         # Build config
```

## 🔮 Future Enhancements

- [ ] Spaced repetition quizzes
- [ ] Reading comprehension companion
- [ ] Progress streaks and badges
- [ ] More subjects (history, languages)
- [ ] Database for persistent data
- [ ] Parent authentication

## 📄 License

MIT License - feel free to modify for your family!

---

Built with ❤️ for kids who want to learn (not just get answers!)
