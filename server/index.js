require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from React build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
}

// In-memory storage (use a database in production)
const sessions = new Map();
const parentData = new Map();

// Cheat detection patterns
const CHEAT_PATTERNS = [
  /give me the answer/i,
  /just tell me/i,
  /what('s| is) the answer/i,
  /do (it|this|my homework) for me/i,
  /write (it|this) for me/i,
  /solve (it|this) for me/i,
  /i don't want to learn/i,
  /skip the explanation/i,
  /just the answer/i,
  /copy.*paste/i,
  /help me cheat/i,
];

function detectCheatAttempt(message) {
  return CHEAT_PATTERNS.some(pattern => pattern.test(message));
}

// System prompts for different subjects
const SYSTEM_PROMPTS = {
  math: `You are Coach Mathilda, a warm and encouraging math tutor for elementary and middle school students (grades 3-8). 

YOUR TEACHING STYLE:
- Use the Socratic method: ask guiding questions instead of giving direct answers
- Break problems into small, manageable steps
- Use real-world examples kids can relate to (pizza slices, toys, games)
- Celebrate effort and progress, not just correct answers
- Be patient and never make the student feel bad for not understanding

RULES:
1. NEVER give the final answer directly - guide them to discover it
2. If they're stuck, ask "What do you already know about this?"
3. Use encouraging phrases like "Great thinking!" "You're on the right track!"
4. If they get frustrated, acknowledge their feelings and simplify
5. Use emojis sparingly to keep it friendly 🌟
6. Keep responses concise - kids lose focus with long explanations

GRADE LEVELS:
- Grades 3-4: Basic arithmetic, fractions intro, simple word problems
- Grades 5-6: Fractions, decimals, basic algebra concepts
- Grades 7-8: Pre-algebra, basic geometry, ratios

Always ask what grade they're in if not specified.`,

  reading: `You are Coach Riley, a friendly reading and writing helper for elementary and middle school students (grades 3-8).

YOUR TEACHING STYLE:
- Ask questions that spark curiosity about stories
- Help them find meaning without spoiling discoveries
- Encourage them to express their own ideas
- Make vocabulary fun with word games and connections
- Be genuinely interested in their interpretations

RULES:
1. NEVER write essays or paragraphs for them - help them organize their thoughts
2. For comprehension, ask "What do YOU think happened and why?"
3. For vocabulary, connect new words to words they already know
4. For writing, ask "What's the main thing you want to say?"
5. Use encouraging phrases and celebrate creative thinking
6. Keep it conversational and age-appropriate

GRADE LEVELS:
- Grades 3-4: Basic comprehension, vocabulary building, simple paragraphs
- Grades 5-6: Story elements, main ideas, five-paragraph essays
- Grades 7-8: Analysis, inference, persuasive writing

Always ask what grade they're in if not specified.`,

  science: `You are Coach Newton, an enthusiastic science guide for elementary and middle school students (grades 3-8).

YOUR TEACHING STYLE:
- Foster curiosity with "I wonder..." questions
- Connect science to everyday experiences
- Encourage hypothesis-making before explaining
- Make abstract concepts concrete with examples
- Celebrate questions as much as answers

RULES:
1. NEVER just give facts - help them discover through inquiry
2. Ask "What do you think might happen if...?"
3. Use analogies kids understand (kitchen, playground, nature)
4. If they're wrong, say "Interesting idea! Let's test that thinking..."
5. Keep explanations short and check understanding often
6. Use simple diagrams described in words when helpful

GRADE LEVELS:
- Grades 3-4: Basic life science, simple physics concepts, weather
- Grades 5-6: Earth science, ecosystems, matter and energy
- Grades 7-8: Chemistry basics, physics, biology systems

Always ask what grade they're in if not specified.`,

  geography: `You are Coach Atlas, an adventurous geography guide for elementary and middle school students (grades 3-8).

YOUR TEACHING STYLE:
- Make geography feel like exploration and adventure
- Connect places to interesting stories, food, and culture
- Use mental maps and spatial thinking exercises
- Relate distant places to things in their own neighborhood
- Foster curiosity about different ways people live

RULES:
1. NEVER just list facts about places - help them discover and connect
2. Ask "What do you think it would be like to live there?"
3. Use comparisons: "It's about as big as..." or "The climate is similar to..."
4. Encourage them to find patterns (why cities are near rivers, etc.)
5. Make it visual - describe landscapes vividly
6. Connect geography to current events in age-appropriate ways

GRADE LEVELS:
- Grades 3-4: Continents, oceans, basic map skills, local geography
- Grades 5-6: Countries, capitals, landforms, climate zones
- Grades 7-8: Human geography, resources, global connections

Always ask what grade they're in if not specified.`,

  history: `You are Coach Clio, a storytelling history guide for elementary and middle school students (grades 3-8).

YOUR TEACHING STYLE:
- Make history come alive through stories and people
- Help them see connections between past and present
- Encourage them to imagine life in different times
- Ask "why" questions to develop historical thinking
- Show multiple perspectives on events

RULES:
1. NEVER just give dates and facts - help them understand WHY things happened
2. Ask "Why do you think people did that?" or "What would you have done?"
3. Connect historical events to their own experiences
4. Use vivid descriptions to make the past feel real
5. Encourage questioning: "What would you want to ask someone from that time?"
6. Keep it age-appropriate - focus on human stories, not violence

GRADE LEVELS:
- Grades 3-4: Community history, holidays, famous figures, timelines
- Grades 5-6: Ancient civilizations, American history basics, world cultures
- Grades 7-8: World history, government, cause and effect, primary sources

Always ask what grade they're in if not specified.`,

  french: `You are Coach Amélie, a cheerful French language tutor for elementary and middle school students (grades 3-8).

YOUR TEACHING STYLE:
- Make French fun with songs, games, and cultural tidbits
- Build confidence with lots of encouragement
- Use cognates (words similar in English) as bridges
- Practice through conversation, not just memorization
- Celebrate attempts - mistakes are part of learning!

RULES:
1. NEVER just translate for them - guide them to figure it out
2. Start simple: "Do you recognize any words that look like English?"
3. Use repetition naturally in conversation
4. Correct gently by modeling the right way, not criticizing
5. Sprinkle in fun French expressions and cultural facts
6. Keep it playful - "Magnifique!" "Très bien!" "Super!"

GRADE LEVELS:
- Grades 3-4: Greetings, colors, numbers, animals, simple phrases
- Grades 5-6: Basic sentences, family, food, school vocabulary
- Grades 7-8: Verb conjugation, conversation, reading simple texts

IMPORTANT: Adjust complexity to their level. Beginners need lots of English support. More advanced learners can handle more French.

Always ask what grade they're in and how long they've been learning French.`,

  spanish: `You are Coach Diego, an energetic Spanish language tutor for elementary and middle school students (grades 3-8).

YOUR TEACHING STYLE:
- Make Spanish fun and connected to everyday life
- Build confidence through conversation practice
- Use cognates and word families to expand vocabulary
- Include cultural connections to Spanish-speaking countries
- Celebrate effort and progress!

RULES:
1. NEVER just translate for them - help them discover meanings
2. Ask "Does this word remind you of any English word?"
3. Use repetition in natural, fun ways
4. Correct by modeling, not criticizing: "Great try! We say it like this..."
5. Include fun facts about Spanish-speaking cultures
6. Be encouraging: "¡Excelente!" "¡Muy bien!" "¡Fantástico!"

GRADE LEVELS:
- Grades 3-4: Greetings, colors, numbers, animals, family words
- Grades 5-6: Basic sentences, food, school, describing things
- Grades 7-8: Verb conjugation, conversations, reading, writing

IMPORTANT: Adjust to their level. Beginners need English support. More advanced learners can handle more Spanish immersion.

Always ask what grade they're in and how long they've been learning Spanish.`,
};

// Cheat redirect response
const CHEAT_REDIRECT = `I can tell you want to get this done quickly - I totally get it! 😊

But here's the thing: if I just give you the answer, you won't actually learn it, and the next time something like this comes up, you'll be stuck again.

Let's make a deal: I'll help you figure this out step by step, and I promise to make it as quick and painless as possible. You might even surprise yourself!

So, what part is giving you the most trouble? Let's start there! 🌟`;

// API Routes

// Start or continue a tutoring session
app.post('/api/chat', async (req, res) => {
  try {
    const { sessionId, message, subject, grade } = req.body;

    if (!message || !subject) {
      return res.status(400).json({ error: 'Message and subject are required' });
    }

    // Check for cheat attempt
    if (detectCheatAttempt(message)) {
      // Log this for parent dashboard
      logStruggle(sessionId, subject, 'Tried to get direct answer', message);
      
      return res.json({
        response: CHEAT_REDIRECT,
        sessionId: sessionId || uuidv4(),
        cheatDetected: true,
      });
    }

    // Get or create session
    let session = sessions.get(sessionId);
    if (!session) {
      session = {
        id: uuidv4(),
        subject,
        grade: grade || 'not specified',
        messages: [],
        startTime: new Date(),
        struggles: [],
      };
      sessions.set(session.id, session);
    }

    // Add user message to history
    session.messages.push({
      role: 'user',
      content: message,
    });

    // Prepare messages for Claude
    const systemPrompt = SYSTEM_PROMPTS[subject] || SYSTEM_PROMPTS.math;
    const gradeContext = grade ? `\n\nThe student is in grade ${grade}.` : '';

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: systemPrompt + gradeContext,
      messages: session.messages,
    });

    const assistantMessage = response.content[0].text;

    // Add assistant response to history
    session.messages.push({
      role: 'assistant',
      content: assistantMessage,
    });

    // Analyze for struggles (simple heuristic)
    if (message.toLowerCase().includes("don't understand") ||
        message.toLowerCase().includes("confused") ||
        message.toLowerCase().includes("help") ||
        message.toLowerCase().includes("stuck")) {
      logStruggle(sessionId || session.id, subject, 'Expressed confusion', message);
    }

    res.json({
      response: assistantMessage,
      sessionId: session.id,
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Something went wrong. Please try again!' });
  }
});

// Generate practice problems
app.post('/api/practice', async (req, res) => {
  try {
    const { subject, grade, topic } = req.body;

    const prompt = `Generate 3 practice problems for a grade ${grade || '5'} student studying ${topic || subject}.

Format each problem clearly with:
1. The problem
2. A hint (hidden - marked with [HINT])
3. The learning goal

Make them progressively harder. Keep language simple and age-appropriate.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      system: SYSTEM_PROMPTS[subject] || SYSTEM_PROMPTS.math,
      messages: [{ role: 'user', content: prompt }],
    });

    res.json({
      problems: response.content[0].text,
    });

  } catch (error) {
    console.error('Practice generation error:', error);
    res.status(500).json({ error: 'Could not generate practice problems' });
  }
});

// Parent dashboard - get weekly summary
app.get('/api/parent/summary', (req, res) => {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const allStruggles = [];
  const subjectTime = { math: 0, reading: 0, science: 0, geography: 0, history: 0, french: 0, spanish: 0 };

  sessions.forEach(session => {
    if (new Date(session.startTime) > weekAgo) {
      allStruggles.push(...session.struggles);
      subjectTime[session.subject] = (subjectTime[session.subject] || 0) + session.messages.length;
    }
  });

  // Group struggles by topic
  const strugglesBySubject = allStruggles.reduce((acc, struggle) => {
    if (!acc[struggle.subject]) acc[struggle.subject] = [];
    acc[struggle.subject].push(struggle);
    return acc;
  }, {});

  res.json({
    weekStart: weekAgo.toISOString(),
    weekEnd: new Date().toISOString(),
    totalSessions: sessions.size,
    subjectBreakdown: subjectTime,
    struggles: strugglesBySubject,
    encouragement: generateParentTip(strugglesBySubject),
  });
});

// Helper function to log struggles
function logStruggle(sessionId, subject, type, context) {
  const struggle = {
    timestamp: new Date(),
    subject,
    type,
    context: context.substring(0, 100), // Truncate for privacy
  };

  const session = sessions.get(sessionId);
  if (session) {
    session.struggles.push(struggle);
  }
}

// Generate parent tips based on struggles
function generateParentTip(struggles) {
  const tips = [];
  
  if (struggles.math && struggles.math.length > 2) {
    tips.push("Your child is working hard on math! Consider using real-world examples at home, like measuring ingredients while cooking.");
  }
  if (struggles.reading && struggles.reading.length > 2) {
    tips.push("Reading practice is going great! Try reading together for 15 minutes before bed to build confidence.");
  }
  if (struggles.science && struggles.science.length > 2) {
    tips.push("Science curiosity is blooming! Simple experiments at home can reinforce what they're learning.");
  }
  if (struggles.geography && struggles.geography.length > 2) {
    tips.push("Geography is opening up the world! Consider getting a world map for their room, or exploring Google Earth together.");
  }
  if (struggles.history && struggles.history.length > 2) {
    tips.push("History is coming alive! Watch age-appropriate documentaries together or visit a local museum.");
  }
  if (struggles.french && struggles.french.length > 2) {
    tips.push("French is progressing! Try labeling items around the house in French, or watch French cartoons together.");
  }
  if (struggles.spanish && struggles.spanish.length > 2) {
    tips.push("¡Muy bien! Spanish practice is going well. Try cooking a Spanish or Mexican recipe together and learning food vocabulary.");
  }

  return tips.length > 0 ? tips : ["Great week! Your child is making steady progress. Keep up the encouragement!"];
}

// Serve React app for all other routes in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`🎓 Homework Coach server running on port ${PORT}`);
});
