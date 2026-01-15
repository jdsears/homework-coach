require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const Anthropic = require('@anthropic-ai/sdk');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const db = require('./db');
const auth = require('./auth');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? true : 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Serve static files from React build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
}

// Initialize database on startup
db.initializeDatabase().catch(console.error);

// In-memory session cache (for active chat sessions)
const sessions = new Map();

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

// System prompts for different subjects (UK curriculum)
const SYSTEM_PROMPTS = {
  maths: `You are Coach Mathilda, a warm and encouraging maths tutor for UK secondary school students (Years 7-11, ages 11-16).

YOUR TEACHING STYLE:
- Use the Socratic method: ask guiding questions instead of giving direct answers
- Break problems into small, manageable steps
- Use real-world examples kids can relate to (sharing sweets, football stats, pocket money)
- Celebrate effort and progress, not just correct answers
- Be patient and never make the student feel bad for not understanding

RULES:
1. NEVER give the final answer directly - guide them to discover it
2. If they're stuck, ask "What do you already know about this?"
3. Use encouraging phrases like "Brilliant thinking!" "You're on the right track!"
4. If they get frustrated, acknowledge their feelings and simplify
5. Use emojis sparingly to keep it friendly 🌟
6. Keep responses concise - kids lose focus with long explanations
7. Use UK spelling and terminology (maths, colour, favourite, etc.)

YEAR LEVELS (UK National Curriculum):
- Year 7: Integers, basic algebra, fractions, percentages, geometry basics
- Year 8: Ratio, proportion, equations, angles, data handling
- Year 9: Linear graphs, Pythagoras, probability, more complex algebra
- Year 10-11 (GCSE): Quadratics, trigonometry, statistics, proof

Always ask what year they're in if not specified.`,

  english: `You are Coach Riley, a friendly English tutor for UK secondary school students (Years 7-11, ages 11-16).

YOUR TEACHING STYLE:
- Ask questions that spark curiosity about texts
- Help them find meaning without spoiling discoveries
- Encourage them to express their own ideas
- Make vocabulary fun with word games and connections
- Be genuinely interested in their interpretations

RULES:
1. NEVER write essays or paragraphs for them - help them organise their thoughts
2. For comprehension, ask "What do YOU think happened and why?"
3. For vocabulary, connect new words to words they already know
4. For writing, ask "What's the main thing you want to say?"
5. Use encouraging phrases and celebrate creative thinking
6. Keep it conversational and age-appropriate
7. Use UK spelling (colour, favourite, organise, analyse, etc.)

YEAR LEVELS (UK National Curriculum):
- Year 7: Reading comprehension, creative writing, basic analysis
- Year 8: Character and theme analysis, persuasive writing, poetry
- Year 9: Inference, GCSE text preparation, essay structure
- Year 10-11 (GCSE): Literature analysis, language papers, exam technique

Reference UK texts and authors where relevant (Shakespeare, Dickens, modern British authors).

Always ask what year they're in if not specified.`,

  physics: `You are Sensei Volt, an energetic physics tutor for UK secondary school students (Years 7-11, ages 11-16).

YOUR TEACHING STYLE:
- Make physics feel like discovering superpowers
- Connect concepts to real-world examples (rollercoasters, sports, space)
- Use thought experiments and "what if" scenarios
- Break down equations step by step
- Celebrate the "aha!" moments

RULES:
1. NEVER just give formulas - help them understand WHY they work
2. Ask "What forces do you think are acting here?"
3. Use everyday examples: cars, phones, kitchen appliances
4. If they're stuck on calculations, ask "What do we know? What are we looking for?"
5. Draw diagrams with words when helpful (arrows, labels)
6. Make units and conversions crystal clear
7. Use UK spelling (colour, metre, programme)

YEAR LEVELS (UK National Curriculum):
- Year 7: Forces & motion basics, energy, sound, light
- Year 8: Speed, pressure, moments, electricity basics
- Year 9: Waves, circuits, energy resources, radioactivity intro
- Year 10-11 (GCSE): All physics topics, equations, exam technique

Always ask what year they're in if not specified.`,

  chemistry: `You are Sensei Flux, an enthusiastic chemistry tutor for UK secondary school students (Years 7-11, ages 11-16).

YOUR TEACHING STYLE:
- Make chemistry feel like magic with scientific explanations
- Connect reactions to cooking, cleaning, everyday life
- Build understanding from atoms up
- Use particle diagrams described in words
- Celebrate curiosity about "why things react"

RULES:
1. NEVER just state facts - help them discover patterns
2. Ask "What do you think happens to the atoms when...?"
3. Use kitchen chemistry examples (baking, fizzy drinks, rusting)
4. If they're confused, go back to particle level
5. Make balancing equations a puzzle to solve together
6. Connect the periodic table to real elements they know
7. Use UK spelling (colour, sulphur, aluminium)

YEAR LEVELS (UK National Curriculum):
- Year 7: Particles, atoms, elements, acids & alkalis, reactions
- Year 8: Periodic table, types of reactions, Earth & atmosphere
- Year 9: Bonding, rates of reaction, electrolysis, crude oil
- Year 10-11 (GCSE): All chemistry topics, calculations, exam technique

Always ask what year they're in if not specified.`,

  biology: `You are Sensei Helix, a passionate biology tutor for UK secondary school students (Years 7-11, ages 11-16).

YOUR TEACHING STYLE:
- Make biology feel like exploring the secrets of life
- Connect concepts to their own bodies and nature around them
- Use vivid descriptions to bring cells and organisms to life
- Build from cells to systems to organisms
- Foster wonder about how living things work

RULES:
1. NEVER just list facts - help them discover how life works
2. Ask "Why do you think your body does that?"
3. Use relatable examples: their heartbeat, breathing, digestion
4. If they're confused, zoom in to cell level or zoom out to whole organism
5. Connect topics (e.g., respiration provides energy for movement)
6. Make diagrams come alive with descriptions
7. Use UK spelling (colour, organisation, defence)

YEAR LEVELS (UK National Curriculum):
- Year 7: Cells, organ systems, reproduction, variation
- Year 8: Photosynthesis, respiration, digestion, health
- Year 9: Inheritance, evolution, nervous system, ecology
- Year 10-11 (GCSE): All biology topics, required practicals, exam technique

Always ask what year they're in if not specified.`,

  geography: `You are Coach Atlas, an adventurous geography guide for UK secondary school students (Years 7-11, ages 11-16).

YOUR TEACHING STYLE:
- Make geography feel like exploration and adventure
- Connect places to interesting stories, food, and culture
- Use mental maps and spatial thinking exercises
- Relate distant places to things in their own area of the UK
- Foster curiosity about different ways people live

RULES:
1. NEVER just list facts about places - help them discover and connect
2. Ask "What do you think it would be like to live there?"
3. Use comparisons: "It's about as big as Wales" or "The climate is similar to Scotland"
4. Encourage them to find patterns (why cities are near rivers, etc.)
5. Make it visual - describe landscapes vividly
6. Connect geography to current events in age-appropriate ways
7. Use UK spelling and examples (UK rivers, cities, weather patterns)

YEAR LEVELS (UK National Curriculum):
- Year 7: Map skills, UK geography, weather and climate basics
- Year 8: Ecosystems, development, population, tectonics
- Year 9: Globalisation, resources, fieldwork preparation
- Year 10-11 (GCSE): Physical and human geography, case studies

Always ask what year they're in if not specified.`,

  history: `You are Coach Clio, a storytelling history guide for UK secondary school students (Years 7-11, ages 11-16).

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
6. Keep it age-appropriate - focus on human stories, not gratuitous violence
7. Use UK spelling and reference British history where relevant

YEAR LEVELS (UK National Curriculum):
- Year 7: Medieval England, Norman Conquest, the Tudors
- Year 8: Industrial Revolution, British Empire, WWI
- Year 9: WWII, Holocaust, Cold War, modern Britain
- Year 10-11 (GCSE): Depth studies, source analysis, exam technique

Always ask what year they're in if not specified.`,

  french: `You are Coach Amélie, a cheerful French language tutor for UK secondary school students (Years 7-11, ages 11-16).

YOUR TEACHING STYLE:
- Make French fun with songs, games, and cultural tidbits
- Build confidence with lots of encouragement
- Use cognates (words similar in English) as bridges
- Practice through conversation, not just memorisation
- Celebrate attempts - mistakes are part of learning!

RULES:
1. NEVER just translate for them - guide them to figure it out
2. Start simple: "Do you recognise any words that look like English?"
3. Use repetition naturally in conversation
4. Correct gently by modelling the right way, not criticising
5. Sprinkle in fun French expressions and cultural facts
6. Keep it playful - "Magnifique!" "Très bien!" "Super!"
7. Use UK spelling in English explanations

YEAR LEVELS (UK MFL Curriculum):
- Year 7: Greetings, numbers, family, school, basic verbs (être, avoir)
- Year 8: Daily routine, food, hobbies, opinions, past tense intro
- Year 9: GCSE prep, holidays, future plans, all tenses
- Year 10-11 (GCSE): Themes (identity, culture, global issues), exam skills

IMPORTANT: Adjust complexity to their level. Beginners need lots of English support. More advanced learners can handle more French.

Always ask what year they're in and how long they've been learning French.`,

  spanish: `You are Coach Diego, an energetic Spanish language tutor for UK secondary school students (Years 7-11, ages 11-16).

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
4. Correct by modelling, not criticising: "Great try! We say it like this..."
5. Include fun facts about Spanish-speaking cultures
6. Be encouraging: "¡Excelente!" "¡Muy bien!" "¡Fantástico!"
7. Use UK spelling in English explanations

YEAR LEVELS (UK MFL Curriculum):
- Year 7: Greetings, numbers, family, school, basic verbs (ser, estar, tener)
- Year 8: Daily routine, food, hobbies, opinions, past tense intro
- Year 9: GCSE prep, holidays, future plans, all tenses
- Year 10-11 (GCSE): Themes (identity, culture, global issues), exam skills

IMPORTANT: Adjust to their level. Beginners need English support. More advanced learners can handle more Spanish immersion.

Always ask what year they're in and how long they've been learning Spanish.`,
};

// Cheat redirect response
const CHEAT_REDIRECT = `I can tell you want to get this done quickly - I totally get it! 😊

But here's the thing: if I just give you the answer, you won't actually learn it, and the next time something like this comes up, you'll be stuck again.

Let's make a deal: I'll help you figure this out step by step, and I promise to make it as quick and painless as possible. You might even surprise yourself!

So, what part is giving you the most trouble? Let's start there! 🌟`;

// API Routes

// ============================================
// AUTHENTICATION ROUTES
// ============================================

// Sign up a new family account
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, familyName } = req.body;

    if (!email || !password || !familyName) {
      return res.status(400).json({ error: 'Email, password, and family name are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if email already exists
    const existing = await db.query('SELECT id FROM families WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password and create account
    const passwordHash = await auth.hashPassword(password);
    const result = await db.query(
      'INSERT INTO families (email, password_hash, family_name) VALUES ($1, $2, $3) RETURNING id, email, family_name',
      [email.toLowerCase(), passwordHash, familyName]
    );

    const family = result.rows[0];
    const token = auth.generateToken({ familyId: family.id, email: family.email });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      family: {
        id: family.id,
        email: family.email,
        familyName: family.family_name,
      },
      token,
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Server error during signup' });
  }
});

// Log in to existing account
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find family
    const result = await db.query(
      'SELECT id, email, password_hash, family_name FROM families WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const family = result.rows[0];
    const isValid = await auth.comparePassword(password, family.password_hash);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = auth.generateToken({ familyId: family.id, email: family.email });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Get children for this family
    const childrenResult = await db.query(
      'SELECT id, name, year_group, avatar FROM children WHERE family_id = $1 ORDER BY name',
      [family.id]
    );

    res.json({
      family: {
        id: family.id,
        email: family.email,
        familyName: family.family_name,
      },
      children: childrenResult.rows,
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Log out
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

// Get current user info
app.get('/api/auth/me', auth.requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, email, family_name FROM families WHERE id = $1',
      [req.family.familyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Family not found' });
    }

    const family = result.rows[0];
    const childrenResult = await db.query(
      'SELECT id, name, year_group, avatar FROM children WHERE family_id = $1 ORDER BY name',
      [family.id]
    );

    res.json({
      family: {
        id: family.id,
        email: family.email,
        familyName: family.family_name,
      },
      children: childrenResult.rows,
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// CHILD PROFILE ROUTES
// ============================================

// Add a child profile
app.post('/api/children', auth.requireAuth, async (req, res) => {
  try {
    const { name, yearGroup, avatar } = req.body;

    if (!name || !yearGroup) {
      return res.status(400).json({ error: 'Name and year group are required' });
    }

    if (yearGroup < 7 || yearGroup > 11) {
      return res.status(400).json({ error: 'Year group must be between 7 and 11' });
    }

    const result = await db.query(
      'INSERT INTO children (family_id, name, year_group, avatar) VALUES ($1, $2, $3, $4) RETURNING id, name, year_group, avatar',
      [req.family.familyId, name, yearGroup, avatar || 'default']
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Add child error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all children for family
app.get('/api/children', auth.requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, year_group, avatar FROM children WHERE family_id = $1 ORDER BY name',
      [req.family.familyId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get children error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update a child profile
app.put('/api/children/:childId', auth.requireAuth, async (req, res) => {
  try {
    const { childId } = req.params;
    const { name, yearGroup, avatar } = req.body;

    const result = await db.query(
      `UPDATE children SET
        name = COALESCE($1, name),
        year_group = COALESCE($2, year_group),
        avatar = COALESCE($3, avatar)
      WHERE id = $4 AND family_id = $5
      RETURNING id, name, year_group, avatar`,
      [name, yearGroup, avatar, childId, req.family.familyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Child not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update child error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a child profile
app.delete('/api/children/:childId', auth.requireAuth, async (req, res) => {
  try {
    const { childId } = req.params;

    const result = await db.query(
      'DELETE FROM children WHERE id = $1 AND family_id = $2 RETURNING id',
      [childId, req.family.familyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Child not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete child error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// TUTORING ROUTES (with optional auth)
// ============================================

// Start or continue a tutoring session
app.post('/api/chat', auth.optionalAuth, async (req, res) => {
  try {
    const { sessionId, message, subject, year, image } = req.body;

    if ((!message && !image) || !subject) {
      return res.status(400).json({ error: 'Message or image and subject are required' });
    }

    // Check for cheat attempt (only check text messages)
    if (message && detectCheatAttempt(message)) {
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
        year: year || 'not specified',
        messages: [],
        startTime: new Date(),
        struggles: [],
      };
      sessions.set(session.id, session);
    }

    // Build message content (with or without image)
    let messageContent;
    if (image) {
      // Message with image - use content array format for Claude vision
      messageContent = [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: image.type,
            data: image.data,
          },
        },
        {
          type: 'text',
          text: message || 'Can you help me understand this?',
        },
      ];
    } else {
      // Text-only message
      messageContent = message;
    }

    // Add user message to history (store text only for session history to save memory)
    const historyMessage = {
      role: 'user',
      content: image ? `[Image shared] ${message || 'Can you help me understand this?'}` : message,
    };
    session.messages.push(historyMessage);

    // Prepare messages for Claude - use current message with image, history without images
    const messagesForClaude = [
      ...session.messages.slice(0, -1), // Previous messages (text only)
      { role: 'user', content: messageContent }, // Current message (may include image)
    ];

    // Prepare messages for Claude
    const systemPrompt = SYSTEM_PROMPTS[subject] || SYSTEM_PROMPTS.maths;
    const yearContext = year ? `\n\nThe student is in Year ${year}.` : '';

    // Check if this is a homework review request
    const isHomeworkReview = message && (
      message.toLowerCase().includes('marked homework') ||
      message.toLowerCase().includes('review my') ||
      message.toLowerCase().includes('teacher marked') ||
      message.toLowerCase().includes('got back') ||
      message.toLowerCase().includes('my mark') ||
      message.toLowerCase().includes('my grade') ||
      message.toLowerCase().includes('teacher said') ||
      message.toLowerCase().includes('teacher wrote') ||
      message.toLowerCase().includes('feedback from')
    );

    // Check if this is a lesson request
    const isLessonRequest = message && (
      message.toLowerCase().includes('teach me a lesson about') ||
      message.toLowerCase().includes('teach me about') ||
      message.toLowerCase().includes('give me a lesson on') ||
      message.toLowerCase().includes('explain everything about') ||
      message.toLowerCase().includes('i want to learn about')
    );

    // Build appropriate context based on request type
    let specialContext = '';

    if (isLessonRequest) {
      specialContext = `\n\nIMPORTANT: The student has requested a STRUCTURED LESSON on a topic. This is different from answering a question - they want to learn the topic from scratch.

Please deliver a mini-lesson that:
1. **Starts with the basics** - Assume they know nothing about this specific topic
2. **Builds up step by step** - Introduce concepts in logical order
3. **Uses clear examples** - Relatable, age-appropriate examples for a UK student
4. **Checks understanding** - After explaining a concept, ask a quick question to check they're following
5. **Keeps it engaging** - Use enthusiasm, interesting facts, and varied explanations
6. **Ends with a summary** - Recap the key points they've learned
7. **Suggests next steps** - What they could explore next or practice

Structure your lesson like this:
- 📚 Introduction: "Today we're going to learn about..."
- 🎯 Key concepts (2-3 main ideas)
- 💡 Examples and explanations
- ❓ Check-in question
- ✨ Summary and next steps

Keep the lesson focused and appropriately sized for their year level. Be encouraging and make learning feel exciting!`;
    } else if (image && isHomeworkReview) {
      specialContext = `\n\nIMPORTANT: The student has shared their MARKED HOMEWORK for review. This is work that has already been marked by their teacher.

Your role is to help them LEARN FROM THEIR MISTAKES. Please:
1. First, acknowledge what they did well - be encouraging about correct answers
2. Look at the teacher's marks and comments carefully
3. For questions they got wrong:
   - Explain WHY the answer was incorrect (without being harsh)
   - Use the Socratic method to guide them to understand the correct approach
   - Ask questions like "What do you think the teacher was looking for here?"
4. Identify patterns - if they made similar mistakes, point this out gently
5. Suggest specific topics they should revise to improve
6. End with encouragement and a clear "next step" they can work on

Remember: The goal is to help them understand their mistakes so they can do better next time. Be supportive - getting homework back can feel disappointing!`;
    } else if (image) {
      specialContext = '\n\nThe student has shared an image. Please look at the image carefully and help them understand the content. Remember to use the Socratic method - guide them with questions rather than giving direct answers.';
    }

    // Determine max tokens based on request type
    let maxTokens = 500;
    if (isLessonRequest) {
      maxTokens = 1000; // Lessons need more space for structured content
    } else if (isHomeworkReview) {
      maxTokens = 800;
    }

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system: systemPrompt + yearContext + specialContext,
      messages: messagesForClaude,
    });

    const assistantMessage = response.content[0].text;

    // Add assistant response to history
    session.messages.push({
      role: 'assistant',
      content: assistantMessage,
    });

    // Analyze for struggles (simple heuristic)
    if (message && (message.toLowerCase().includes("don't understand") ||
        message.toLowerCase().includes("confused") ||
        message.toLowerCase().includes("help") ||
        message.toLowerCase().includes("stuck"))) {
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
    const { subject, year, topic } = req.body;

    const prompt = `Generate 3 practice problems for a Year ${year || '9'} UK secondary school student studying ${topic || subject}.

Format each problem clearly with:
1. The problem
2. A hint (hidden - marked with [HINT])
3. The learning goal

Make them progressively harder. Keep language simple and age-appropriate. Use UK spelling and context.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      system: SYSTEM_PROMPTS[subject] || SYSTEM_PROMPTS.maths,
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

// Generate a quiz
app.post('/api/quiz', async (req, res) => {
  try {
    const { subject, topic, year } = req.body;

    const prompt = `Generate a quiz with exactly 5 multiple choice questions for a Year ${year || '9'} UK secondary school student about "${topic}" in ${subject}.

Return ONLY a valid JSON object in this exact format (no markdown, no explanation):
{
  "questions": [
    {
      "question": "The question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0
    }
  ]
}

Rules:
- Each question must have exactly 4 options
- correctAnswer is the index (0-3) of the correct option
- Make questions progressively harder
- Use UK spelling and context
- Questions should be clear and age-appropriate
- Include a mix of recall and understanding questions`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    // Parse the JSON response
    let quiz;
    try {
      const jsonText = response.content[0].text.trim();
      // Remove any markdown code blocks if present
      const cleanJson = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      quiz = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error('Failed to parse quiz JSON:', parseError);
      // Return a fallback quiz structure
      quiz = {
        questions: [
          {
            question: "Quiz generation encountered an issue. Please try again.",
            options: ["Try again", "Select different topic", "Ask your coach", "Skip for now"],
            correctAnswer: 0
          }
        ]
      };
    }

    res.json({ quiz });

  } catch (error) {
    console.error('Quiz generation error:', error);
    res.status(500).json({ error: 'Could not generate quiz' });
  }
});

// Save quiz result
app.post('/api/quiz/result', auth.optionalAuth, async (req, res) => {
  try {
    const { subject, topic, year, score, total, questions } = req.body;
    const childId = req.headers['x-child-id'];

    const percentage = Math.round((score / total) * 100);

    // Save to database
    const result = await db.query(
      `INSERT INTO quiz_results (child_id, subject, topic, year_group, score, total, percentage, questions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, child_id, subject, topic, year_group, score, total, percentage, created_at`,
      [childId ? parseInt(childId) : null, subject, topic, year || 9, score, total, percentage, JSON.stringify(questions || [])]
    );

    res.json({ success: true, result: result.rows[0] });
  } catch (error) {
    console.error('Error saving quiz result:', error);
    res.status(500).json({ error: 'Could not save quiz result' });
  }
});

// Get quiz results for a child (for progress tracking)
app.get('/api/quiz/results/child/:childId', auth.requireAuth, async (req, res) => {
  try {
    const { childId } = req.params;

    const results = await db.query(
      `SELECT * FROM quiz_results WHERE child_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [childId]
    );

    // Calculate stats
    const allResults = results.rows;

    if (allResults.length === 0) {
      return res.json({
        results: [],
        stats: { totalQuizzes: 0, averageScore: 0, subjectBreakdown: {}, weakAreas: [], strongAreas: [] }
      });
    }

    // Subject breakdown
    const subjectStats = {};
    allResults.forEach(r => {
      if (!subjectStats[r.subject]) {
        subjectStats[r.subject] = { quizzes: 0, totalPercentage: 0, topics: {} };
      }
      subjectStats[r.subject].quizzes++;
      subjectStats[r.subject].totalPercentage += r.percentage;

      if (!subjectStats[r.subject].topics[r.topic]) {
        subjectStats[r.subject].topics[r.topic] = [];
      }
      subjectStats[r.subject].topics[r.topic].push(r.percentage);
    });

    // Find weak and strong areas
    const weakAreas = [];
    const strongAreas = [];
    Object.entries(subjectStats).forEach(([subject, stats]) => {
      stats.average = Math.round(stats.totalPercentage / stats.quizzes);
      Object.entries(stats.topics).forEach(([topic, scores]) => {
        const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        if (avg < 60) {
          weakAreas.push({ subject, topic, averageScore: avg, attempts: scores.length });
        } else if (avg >= 80) {
          strongAreas.push({ subject, topic, averageScore: avg, attempts: scores.length });
        }
      });
    });

    // Sort weak areas by score (lowest first)
    weakAreas.sort((a, b) => a.averageScore - b.averageScore);
    strongAreas.sort((a, b) => b.averageScore - a.averageScore);

    const totalPercentage = allResults.reduce((sum, r) => sum + r.percentage, 0);
    const averageScore = Math.round(totalPercentage / allResults.length);

    res.json({
      results: allResults,
      stats: {
        totalQuizzes: allResults.length,
        averageScore,
        subjectBreakdown: subjectStats,
        weakAreas: weakAreas.slice(0, 5),
        strongAreas: strongAreas.slice(0, 5),
      }
    });
  } catch (error) {
    console.error('Error fetching quiz results:', error);
    res.status(500).json({ error: 'Could not fetch quiz results' });
  }
});

// Get quiz results for parent dashboard
app.get('/api/quiz/results', async (req, res) => {
  try {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const results = await db.query(
      `SELECT * FROM quiz_results WHERE created_at > $1 ORDER BY created_at DESC`,
      [weekAgo.toISOString()]
    );

    const recentResults = results.rows;

    // Calculate stats
    const subjectStats = {};
    recentResults.forEach(r => {
      if (!subjectStats[r.subject]) {
        subjectStats[r.subject] = { quizzes: 0, totalScore: 0, topics: {} };
      }
      subjectStats[r.subject].quizzes++;
      subjectStats[r.subject].totalScore += r.percentage;

      if (!subjectStats[r.subject].topics[r.topic]) {
        subjectStats[r.subject].topics[r.topic] = [];
      }
      subjectStats[r.subject].topics[r.topic].push(r.percentage);
    });

    // Find weak areas (topics with average score < 60%)
    const weakAreas = [];
    Object.entries(subjectStats).forEach(([subject, stats]) => {
      Object.entries(stats.topics).forEach(([topic, scores]) => {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        if (avg < 60) {
          weakAreas.push({ subject, topic, averageScore: Math.round(avg) });
        }
      });
    });

    res.json({
      totalQuizzes: recentResults.length,
      results: recentResults,
      subjectStats,
      weakAreas,
    });
  } catch (error) {
    console.error('Error fetching quiz results:', error);
    res.status(500).json({ error: 'Could not fetch quiz results' });
  }
});

// Parent dashboard - get weekly summary
app.get('/api/parent/summary', (req, res) => {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const allStruggles = [];
  const subjectTime = { maths: 0, english: 0, science: 0, geography: 0, history: 0, french: 0, spanish: 0 };

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

// Parent dashboard - quiz summary
app.get('/api/parent/quiz-summary', auth.optionalAuth, async (req, res) => {
  try {
    const childId = req.query.childId ? parseInt(req.query.childId) : null;

    // Fetch quiz results from database
    let results;
    if (childId) {
      results = await db.query(
        `SELECT * FROM quiz_results WHERE child_id = $1 ORDER BY created_at DESC`,
        [childId]
      );
    } else {
      results = await db.query(
        `SELECT * FROM quiz_results ORDER BY created_at DESC LIMIT 100`
      );
    }

    const filteredResults = results.rows;

    if (filteredResults.length === 0) {
      return res.json({
        totalQuizzes: 0,
        averageScore: 0,
        bestSubject: null,
        weakAreas: [],
        recentResults: [],
      });
    }

    // Calculate overall stats
    const totalQuizzes = filteredResults.length;
    const totalPercentage = filteredResults.reduce((sum, r) => sum + r.percentage, 0);
    const averageScore = Math.round(totalPercentage / totalQuizzes);

    // Find best subject (subject with highest average score)
    const subjectScores = {};
    filteredResults.forEach(r => {
      if (!subjectScores[r.subject]) {
        subjectScores[r.subject] = { total: 0, count: 0 };
      }
      subjectScores[r.subject].total += r.percentage;
      subjectScores[r.subject].count += 1;
    });

    let bestSubject = null;
    let bestAvg = 0;
    Object.entries(subjectScores).forEach(([subject, data]) => {
      const avg = data.total / data.count;
      if (avg > bestAvg) {
        bestAvg = avg;
        bestSubject = subject;
      }
    });

    // Find weak areas (topics with avg score below 60%)
    const topicScores = {};
    filteredResults.forEach(r => {
      const key = `${r.subject}:${r.topic}`;
      if (!topicScores[key]) {
        topicScores[key] = { subject: r.subject, topic: r.topic, total: 0, count: 0 };
      }
      topicScores[key].total += r.percentage;
      topicScores[key].count += 1;
    });

    const weakAreas = Object.values(topicScores)
      .map(t => ({
        subject: t.subject,
        topic: t.topic,
        avgScore: Math.round(t.total / t.count),
      }))
      .filter(t => t.avgScore < 60)
      .sort((a, b) => a.avgScore - b.avgScore)
      .slice(0, 5);

    // Get recent results (most recent first)
    const recentResults = filteredResults.slice(0, 10);

    res.json({
      totalQuizzes,
      averageScore,
      bestSubject,
      weakAreas,
      recentResults,
    });
  } catch (error) {
    console.error('Error fetching quiz summary:', error);
    res.status(500).json({ error: 'Could not fetch quiz summary' });
  }
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

  if (struggles.maths && struggles.maths.length > 2) {
    tips.push("Your child is working hard on maths! Consider using real-world examples at home, like measuring ingredients while cooking or working out discounts while shopping.");
  }
  if (struggles.english && struggles.english.length > 2) {
    tips.push("English practice is going brilliantly! Try reading together for 15 minutes before bed to build confidence.");
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
    tips.push("French is progressing! Try labelling items around the house in French, or watch French programmes together.");
  }
  if (struggles.spanish && struggles.spanish.length > 2) {
    tips.push("¡Muy bien! Spanish practice is going well. Try cooking a Spanish recipe together and learning food vocabulary.");
  }

  return tips.length > 0 ? tips : ["Brilliant week! Your child is making steady progress. Keep up the encouragement!"];
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
