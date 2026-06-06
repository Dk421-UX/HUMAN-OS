import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { db } from './db/db.js';
import { patternEngine } from './services/patternEngine.js';
import { psychologicalMemory } from './services/psychologicalMemory.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const requestBuckets = new Map();
const ANALYZE_RATE_LIMIT = Number(process.env.RATE_LIMIT_PER_MINUTE || 30);

app.disable('x-powered-by');

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// Enable CORS for frontend requests
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin not allowed by Human OS CORS policy.'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'X-User-Id']
}));

app.use(express.json({ limit: '32kb' }));

// Initialize Database (Seeds mock JSON DB if offline)
await db.init();

// Helper middleware to extract user context
const getUserContext = (req) => {
  return req.headers['x-user-id'] || 'sandbox-user-123';
};

const rateLimitAnalyze = (req, res, next) => {
  const userId = getUserContext(req);
  const now = Date.now();
  const windowMs = 60 * 1000;
  const bucket = requestBuckets.get(userId) || { count: 0, resetAt: now + windowMs };

  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }

  bucket.count += 1;
  requestBuckets.set(userId, bucket);

  if (bucket.count > ANALYZE_RATE_LIMIT) {
    return res.status(429).json({ error: 'Reflection rate limit reached. Wait a moment before analyzing again.' });
  }

  return next();
};

// 1. Analyze reflection dialogue
app.post('/api/analyze', rateLimitAnalyze, async (req, res) => {
  try {
    const userId = getUserContext(req);
    const { message } = req.body;
    const normalizedMessage = typeof message === 'string' ? message.trim() : '';

    if (!normalizedMessage) {
      return res.status(400).json({ error: 'Dialogue content is required.' });
    }

    if (normalizedMessage.length > 4000) {
      return res.status(413).json({ error: 'Reflection is too long for one analysis pass. Keep it under 4,000 characters.' });
    }

    // Retrieve patterns, narratives, and conversations to feed rich context history to LLM
    const [history, patterns, narratives] = await Promise.all([
      db.getConversations(userId),
      db.getPatterns(userId),
      db.getNarratives(userId)
    ]);

    const patternContext = patterns.map(p => 
      `- ${p.name}: currentStrength=${p.score}%, occurrences=${p.occurrences || 1}, trend=${p.trend || 'stable'}, contexts=${JSON.stringify(p.contexts || {})}`
    ).join('\n');

    const storyContext = narratives.map(n => 
      `- ${n.phase} (${n.title}): ${n.content}`
    ).join('\n');

    const recentReflections = history
      .slice(-5)
      .map(c => {
        const observation = c?.response?.notices || c?.response?.observation || c?.response?.summary || 'Prior reflection processed.';
        return `[Date: ${c.created_at}]\nUser: "${c.message}"\nHuman OS Notices: "${observation}"`;
      })
      .join('\n\n');

    const contextString = `
HISTORICAL PATTERNS REGISTERED IN MEMORY:
${patternContext || 'No historical patterns recorded yet.'}

NARRATIVE STORY PHASES:
${storyContext || 'No story chapters initialized yet.'}

RECENT REFLECTIONS HISTORY:
${recentReflections || 'This is the user\'s first reflection.'}
    `.trim();

    // Extract prior observations for similarity verification (last 50 reflections)
    const priorObservations = history.slice(-50).map(c => {
      return [
        c.response?.notices || '',
        c.response?.observation || '',
        c.response?.summary || '',
        c.response?.evolution || ''
      ].filter(Boolean).join(' ');
    });

    // Run Pattern Engine
    const analysis = await patternEngine.analyzeText(normalizedMessage, contextString, priorObservations);

    // Save dialogue and response in DB
    const savedConv = await db.saveConversation(userId, normalizedMessage, analysis);

    // Process in Psychological Memory (Updates DNA, records connections/patterns, alerts timeline)
    await psychologicalMemory.processAnalysisResults(userId, savedConv.id, analysis);

    return res.status(200).json({
      conversationId: savedConv.id,
      analysis
    });
  } catch (error) {
    console.error('API /analyze error:', error);
    return res.status(500).json({ error: 'Internal psychological analysis engine failure.' });
  }
});

// 2. Retrieve Psychological DNA profile
app.get('/api/dna', async (req, res) => {
  try {
    const userId = getUserContext(req);
    const dna = await db.getPsychologicalDNA(userId);
    return res.status(200).json(dna);
  } catch (error) {
    console.error('API /dna error:', error);
    return res.status(500).json({ error: 'Failed to retrieve Psychological DNA.' });
  }
});

// 3. Retrieve Pattern Graph data
app.get('/api/graph', async (req, res) => {
  try {
    const userId = getUserContext(req);
    const patterns = await db.getPatterns(userId);
    const connections = await db.getPatternConnections(userId);

    // Build node list from active patterns
    const nodes = patterns.map(p => ({
      id: p.name,
      score: p.score,
      confidence: p.confidence,
      category: p.category
    }));

    // Build link list from connections
    const links = connections.map(c => ({
      source: c.source,
      target: c.target,
      weight: c.weight
    }));

    return res.status(200).json({ nodes, links });
  } catch (error) {
    console.error('API /graph error:', error);
    return res.status(500).json({ error: 'Failed to compile Pattern Graph.' });
  }
});

// 4. Retrieve Patterns vault list
app.get('/api/patterns', async (req, res) => {
  try {
    const userId = getUserContext(req);
    const patterns = await db.getPatterns(userId);
    return res.status(200).json(patterns);
  } catch (error) {
    console.error('API /patterns error:', error);
    return res.status(500).json({ error: 'Failed to retrieve Patterns.' });
  }
});

// 5. Retrieve Evolution Timeline
app.get('/api/timeline', async (req, res) => {
  try {
    const userId = getUserContext(req);
    const timeline = await db.getTimeline(userId);
    return res.status(200).json(timeline);
  } catch (error) {
    console.error('API /timeline error:', error);
    return res.status(500).json({ error: 'Failed to retrieve Evolution Timeline.' });
  }
});

// 6. Retrieve Insights cards
app.get('/api/insights', async (req, res) => {
  try {
    const userId = getUserContext(req);
    const insights = await db.getInsights(userId);
    return res.status(200).json(insights);
  } catch (error) {
    console.error('API /insights error:', error);
    return res.status(500).json({ error: 'Failed to retrieve Insights.' });
  }
});

// 7. Retrieve Blind Spots
app.get('/api/blind-spots', async (req, res) => {
  try {
    const userId = getUserContext(req);
    const bs = await db.getBlindSpots(userId);
    return res.status(200).json(bs);
  } catch (error) {
    console.error('API /blind-spots error:', error);
    return res.status(500).json({ error: 'Failed to retrieve Blind Spots.' });
  }
});

// 8. Retrieve Internal Conflicts
app.get('/api/internal-conflicts', async (req, res) => {
  try {
    const userId = getUserContext(req);
    const conflicts = await db.getInternalConflicts(userId);
    return res.status(200).json(conflicts);
  } catch (error) {
    console.error('API /internal-conflicts error:', error);
    return res.status(500).json({ error: 'Failed to retrieve Internal Conflicts.' });
  }
});

// 9. Retrieve Root Drivers
app.get('/api/root-drivers', async (req, res) => {
  try {
    const userId = getUserContext(req);
    const rd = await db.getRootDrivers(userId);
    return res.status(200).json(rd);
  } catch (error) {
    console.error('API /root-drivers error:', error);
    return res.status(500).json({ error: 'Failed to retrieve Root Drivers.' });
  }
});

// 10. Retrieve Narratives (Story Engine)
app.get('/api/narratives', async (req, res) => {
  try {
    const userId = getUserContext(req);
    const narratives = await db.getNarratives(userId);
    return res.status(200).json(narratives);
  } catch (error) {
    console.error('API /narratives error:', error);
    return res.status(500).json({ error: 'Failed to retrieve Narratives.' });
  }
});

// 11. Retrieve Long Term Memory
app.get('/api/long-term-memory', async (req, res) => {
  try {
    const userId = getUserContext(req);
    const ltm = await db.getLongTermMemory(userId);
    return res.status(200).json(ltm);
  } catch (error) {
    console.error('API /long-term-memory error:', error);
    return res.status(500).json({ error: 'Failed to retrieve Long Term Memory.' });
  }
});

// Startup Validation Logs
console.log("================================");
console.log("Human OS Boot Sequence");
console.log("Groq Loaded:", !!process.env.GROQ_API_KEY);
console.log("================================");

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    groq: !!process.env.GROQ_API_KEY,
    database: db.isSupabaseEnabled() ? 'supabase' : 'local-json',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// AI Connection test endpoint
app.get('/api/test-ai', async (req, res) => {
  try {
    const reply = await patternEngine.testConnection();
    return res.status(200).json({ success: true, response: reply });
  } catch (error) {
    console.error('Test AI connection failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request payload is too large.' });
  }

  if (error?.message?.includes('CORS')) {
    return res.status(403).json({ error: error.message });
  }

  console.error('Unhandled API error:', error);
  return res.status(500).json({ error: 'Human OS API encountered an unexpected failure.' });
});

app.listen(PORT, () => {
  console.log(`Human OS Backend: Server running on port ${PORT}`);
});
