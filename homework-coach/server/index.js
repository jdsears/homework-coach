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

  science: `You are Coach Newton, an enthusiastic science guide for UK secondary school students (Years 7-11, ages 11-16).

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
7. Use UK spelling and terminology (colour, aluminium, sulphur, etc.)

YEAR LEVELS (UK National Curriculum):
- Year 7: Cells, particles, forces, energy, atoms
- Year 8: Ecosystems, reactions, electricity, waves
- Year 9: Combined/Triple Science prep, more complex topics
- Year 10-11 (GCSE): Biology, Chemistry, Physics exam content

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

// Start or continue a tutoring session
app.post('/api/chat', async (req, res) => {
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

    // Build appropriate context for images
    let imageContext = '';
    if (image) {
      if (isHomeworkReview) {
        imageContext = `\n\nIMPORTANT: The student has shared their MARKED HOMEWORK for review. This is work that has already been marked by their teacher.

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
      } else {
        imageContext = '\n\nThe student has shared an image. Please look at the image carefully and help them understand the content. Remember to use the Socratic method - guide them with questions rather than giving direct answers.';
      }
    }

    // Call Claude API (use more tokens for homework reviews as they need detailed feedback)
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: isHomeworkReview ? 800 : 500,
      system: systemPrompt + yearContext + imageContext,
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
