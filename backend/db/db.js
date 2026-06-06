import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const parseDate = (dateVal) => {
  if (!dateVal) return null;

  let dateObj = null;
  if (dateVal instanceof Date) {
    dateObj = dateVal;
  } else if (typeof dateVal === 'number') {
    const ms = dateVal < 50000000000 ? dateVal * 1000 : dateVal;
    dateObj = new Date(ms);
  } else {
    const str = String(dateVal).trim();
    if (/^\d+$/.test(str)) {
      const num = Number(str);
      const ms = num < 50000000000 ? num * 1000 : num;
      dateObj = new Date(ms);
    } else {
      dateObj = new Date(str);
    }
  }

  return Number.isNaN(dateObj.getTime()) ? null : dateObj;
};

const validateDate = (dateVal, fallbackDate = new Date(), minDate = new Date('2020-01-01T00:00:00.000Z')) => {
  let dateObj = parseDate(dateVal);
  const fallbackObj = parseDate(fallbackDate) || new Date();

  if (!dateObj) {
    dateObj = fallbackObj;
  }

  const now = new Date();
  if (dateObj.getTime() > now.getTime()) {
    return now.toISOString();
  }

  if (dateObj.getTime() < minDate.getTime()) {
    return minDate.toISOString();
  }

  return dateObj.toISOString();
};

const getAccountStartDate = (dbData, userId) => {
  const profile = (dbData.profiles || []).find(p => p.id === userId);
  const firstConversation = (dbData.conversations || [])
    .filter(c => c.user_id === userId)
    .sort((a, b) => (parseDate(a.created_at)?.getTime() || 0) - (parseDate(b.created_at)?.getTime() || 0))[0];
  return parseDate(profile?.created_at) || parseDate(firstConversation?.created_at) || new Date();
};

const validateUserDate = (dbData, userId, dateVal, fallbackDate = new Date()) => {
  return validateDate(dateVal, fallbackDate, getAccountStartDate(dbData, userId));
};

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.keys(value);
  return [];
};

const normalizeText = (value) => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const tokenSimilarity = (a, b) => {
  const tokensA = new Set(normalizeText(a).split(' ').filter(Boolean));
  const tokensB = new Set(normalizeText(b).split(' ').filter(Boolean));
  if (!tokensA.size || !tokensB.size) return 0;

  let overlap = 0;
  tokensA.forEach(token => {
    if (tokensB.has(token)) overlap += 1;
  });

  return overlap / Math.max(tokensA.size, tokensB.size);
};

const canonicalizeConflictPart = (value, fallback) => {
  const normalized = normalizeText(value);
  if (!normalized) return fallback;
  if (/(action|progress|growth|autonomy|move|movement|execute|decision)/.test(normalized)) return 'Action';
  if (/(certainty|safety|safe|guarantee|control|protection|secure)/.test(normalized)) return 'Certainty';
  if (/(approval|validation|belong|accepted|pleas)/.test(normalized)) return 'Approval';
  if (/(authentic|honest|truth|voice|boundary)/.test(normalized)) return 'Authenticity';
  if (/(freedom|independence)/.test(normalized)) return 'Freedom';
  if (/(connection|relationship|belonging)/.test(normalized)) return 'Belonging';
  return String(value || fallback)
    .replace(/^wants?\s+/i, '')
    .replace(/\s*&\s*/g, ' ')
    .replace(/\s+\/\s+/g, ' ')
    .trim();
};

const buildConflictCategory = (partA, partB) => `${partA} vs ${partB}`;

const normalizeTimelineTitle = (title) => String(title || 'A meaningful shift appeared')
  .replace(/Pattern Identified:/gi, 'A recurring theme emerged:')
  .replace(/Self Criticism Identified/gi, 'Self criticism became visible')
  .replace(/Internal Conflict Logged/gi, 'A tension became visible')
  .replace(/Root Driver Identified/gi, 'A deeper reason became visible')
  .replace(/Shift Logged/gi, 'shifted')
  .replace(/Insight Generated:/gi, 'An insight formed:')
  .replace(/DNA Heightened/gi, 'became more active');

const normalizeTimelineDescription = (description) => String(description || 'Human OS noticed a meaningful change in the story.')
  .replace(/Pattern "([^"]+)" detected with score \d+% and confidence \d+%\.?/gi, '$1 became visible in memory.')
  .replace(/Detected ([^.]*) pattern at \d+% intensity\.?/gi, '$1 became visible in recent reflections.')
  .replace(/Your ([^.]*) score (rose|has receded) to \d+%[^.]*\.?/gi, '$1 shifted in recent reflections.')
  .replace(/\(\d+%\s*co-occurrence\)/gi, '')
  .replace(/\(\d+%\)/g, '')
  .replace(/\d+%/g, '')
  .replace(/\s{2,}/g, ' ')
  .trim();

const enrichPatternMemory = (pattern, dbData) => {
  const evidenceHistory = asArray(pattern.evidenceHistory).map(h => ({
    ...h,
    date: validateUserDate(dbData, pattern.user_id, h.date, pattern.lastSeen || pattern.updated_at)
  }));
  const strengthHistory = asArray(pattern.strengthHistory).map(h => ({
    ...h,
    date: validateUserDate(dbData, pattern.user_id, h.date, pattern.lastSeen || pattern.updated_at)
  }));
  const confidenceHistory = asArray(pattern.confidenceHistory).map(h => ({
    ...h,
    date: validateUserDate(dbData, pattern.user_id, h.date, pattern.lastSeen || pattern.updated_at)
  }));
  const growthHistory = asArray(pattern.growthHistory || pattern.growthSignals).map(item => (
    typeof item === 'string'
      ? { date: validateUserDate(dbData, pattern.user_id, pattern.lastSeen || pattern.updated_at), signal: item }
      : { ...item, date: validateUserDate(dbData, pattern.user_id, item.date, pattern.lastSeen || pattern.updated_at) }
  ));
  const narrativeHistory = asArray(pattern.narrativeHistory || pattern.insightHistory).map(item => (
    typeof item === 'string'
      ? { date: validateUserDate(dbData, pattern.user_id, pattern.lastSeen || pattern.updated_at), narrative: item }
      : { ...item, date: validateUserDate(dbData, pattern.user_id, item.date, pattern.lastSeen || pattern.updated_at) }
  ));
  const conflictHistory = asArray(pattern.conflictHistory).map(item => (
    typeof item === 'string'
      ? { date: validateUserDate(dbData, pattern.user_id, pattern.lastSeen || pattern.updated_at), tension: item }
      : { ...item, date: validateUserDate(dbData, pattern.user_id, item.date, pattern.lastSeen || pattern.updated_at) }
  ));
  const evidence = asArray(pattern.evidence || evidenceHistory.map(h => h.quote).filter(Boolean));

  return {
    ...pattern,
    firstSeen: validateUserDate(dbData, pattern.user_id, pattern.firstSeen, pattern.created_at || pattern.updated_at),
    lastSeen: validateUserDate(dbData, pattern.user_id, pattern.lastSeen || pattern.updated_at, pattern.firstSeen),
    updated_at: validateUserDate(dbData, pattern.user_id, pattern.updated_at || pattern.lastSeen),
    contexts: asArray(pattern.contexts),
    triggers: asArray(pattern.triggers),
    evidence,
    relatedPatterns: asArray(pattern.relatedPatterns),
    strengthHistory,
    confidenceHistory,
    growthHistory,
    conflictHistory,
    narrativeHistory,
    trendDirection: pattern.trendDirection || pattern.trend || 'Stable',
    evidenceHistory
  };
};

const DB_FILE = process.env.LOCAL_DB_FILE
  ? path.resolve(process.env.LOCAL_DB_FILE)
  : path.join(__dirname, 'local_db.json');
const DB_TMP_FILE = `${DB_FILE}.tmp`;
const COLLECTIONS = ['profiles', 'conversations', 'patterns', 'pattern_connections', 'psychological_dna', 'insights', 'timeline_events', 'blind_spots', 'internal_conflicts', 'root_drivers', 'narratives', 'long_term_memory'];

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const isSupabaseEnabled = supabaseUrl && supabaseKey;

let supabase = null;
if (isSupabaseEnabled) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('Human OS Database: Supabase Client Initialized.');
} else {
  console.log('Human OS Database: Supabase variables missing. Running in SANDBOXED local file database mode.');
}

// Seed data populated with custom DNA traits from AI Connection Phase
const getInitialSeed = () => {
  const now = new Date();
  const dateOffset = (days) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return d.toISOString();
  };

  const seed = {
    profiles: [
      { id: 'sandbox-user-123', email: 'sandbox@humanos.ai', created_at: dateOffset(30) }
    ],
    conversations: [
      {
        id: 'conv-1',
        user_id: 'sandbox-user-123',
        message: 'I keep postponing important work because I feel it won\'t be perfect.',
        response: {
          summary: 'Strong evidence of perfectionistic avoidance patterns triggered by fear of failure.',
          observation: 'You seem to be delaying action until certainty arrives. The problem is that certainty never fully arrives.',
          patterns: [
            { name: 'Fear of Failure', category: 'Cognitive', strength: 82, confidence: 91, evidence: 'I keep postponing important work because I feel it won\'t be perfect.' },
            { name: 'Perfectionism', category: 'Behavioral', strength: 85, confidence: 89, evidence: 'I feel it won\'t be perfect.' },
            { name: 'Avoidance', category: 'Decision-making', strength: 78, confidence: 85, evidence: 'I keep postponing important work.' }
          ],
          connections: [
            { source: 'Fear of Failure', target: 'Perfectionism', weight: 85 },
            { source: 'Perfectionism', target: 'Avoidance', weight: 78 }
          ],
          blind_spots: [
            { contradiction: 'Confusing preparing with performing', revealedTruth: 'Preparing feels safe, but delaying keeps you stuck.' }
          ],
          hidden_drivers: [
            { root_driver: 'Fear of Evaluation', creates: ['Perfectionism', 'Avoidance'] }
          ],
          internal_conflicts: [
            { partA: 'Wants growth/progress', partB: 'Wants safety/certainty', tension: 'Growth requires putting work out there, but certainty demands keeping it hidden.' }
          ],
          domains: { Career: 85, Study: 60 },
          reflection_question: 'What is the cost of delaying this task compared to the discomfort of creating an imperfect first draft?'
        },
        created_at: dateOffset(5)
      }
    ],
    patterns: [
      {
        id: 'pat-1',
        user_id: 'sandbox-user-123',
        name: 'Fear of Failure',
        strength: 82,
        score: 82,
        confidence: 91,
        category: 'Cognitive',
        firstSeen: dateOffset(10),
        lastSeen: dateOffset(5),
        occurrences: 4,
        averageStrength: 80,
        highestStrength: 85,
        lowestStrength: 75,
        trend: 'rising',
        trendVelocity: 7,
        contexts: ['Career', 'Study'],
        contextsMap: { Career: 80, Study: 60 },
        relatedPatterns: ['Perfectionism', 'Avoidance'],
        evidenceHistory: [{ date: dateOffset(5), quote: 'I keep postponing important work because I feel it won\'t be perfect.', domain: 'Career' }],
        confidenceHistory: [{ date: dateOffset(5), confidence: 91 }],
        strengthHistory: [{ date: dateOffset(10), score: 75 }, { date: dateOffset(5), score: 82 }],
        reflectionReferences: ['conv-1'],
        milestones: ['First observed in Career context'],
        evolutionStory: 'Fear of failure has been rising in career contexts, but remains stable in other domains.',
        updated_at: dateOffset(5)
      },
      {
        id: 'pat-2',
        user_id: 'sandbox-user-123',
        name: 'Avoidance',
        strength: 78,
        score: 78,
        confidence: 85,
        category: 'Decision-making',
        firstSeen: dateOffset(10),
        lastSeen: dateOffset(5),
        occurrences: 3,
        averageStrength: 76,
        highestStrength: 78,
        lowestStrength: 72,
        trend: 'rising',
        trendVelocity: 6,
        contexts: ['Career', 'Study'],
        contextsMap: { Career: 75, Study: 50 },
        relatedPatterns: ['Perfectionism', 'Procrastination'],
        evidenceHistory: [{ date: dateOffset(5), quote: 'I keep postponing important work.', domain: 'Career' }],
        confidenceHistory: [{ date: dateOffset(5), confidence: 85 }],
        strengthHistory: [{ date: dateOffset(10), score: 72 }, { date: dateOffset(5), score: 78 }],
        reflectionReferences: ['conv-1'],
        milestones: ['Linked with Perfectionism'],
        evolutionStory: 'Avoidance acts as your primary emotional shield to defer evaluation.',
        updated_at: dateOffset(5)
      },
      {
        id: 'pat-3',
        user_id: 'sandbox-user-123',
        name: 'Perfectionism',
        strength: 85,
        score: 85,
        confidence: 89,
        category: 'Behavioral',
        firstSeen: dateOffset(10),
        lastSeen: dateOffset(5),
        occurrences: 5,
        averageStrength: 82,
        highestStrength: 85,
        lowestStrength: 78,
        trend: 'rising',
        trendVelocity: 7,
        contexts: ['Career', 'Study'],
        contextsMap: { Career: 85, Study: 70 },
        relatedPatterns: ['Fear of Failure', 'Avoidance'],
        evidenceHistory: [{ date: dateOffset(5), quote: 'I feel it won\'t be perfect.', domain: 'Career' }],
        confidenceHistory: [{ date: dateOffset(5), confidence: 89 }],
        strengthHistory: [{ date: dateOffset(10), score: 78 }, { date: dateOffset(5), score: 85 }],
        reflectionReferences: ['conv-1'],
        milestones: ['High intensity detected in career tasks'],
        evolutionStory: 'Perfectionism standards remain highly rigid, creating a loop with avoidance.',
        updated_at: dateOffset(5)
      },
      {
        id: 'pat-4',
        user_id: 'sandbox-user-123',
        name: 'Overthinking Loops',
        strength: 84,
        score: 84,
        confidence: 90,
        category: 'Cognitive',
        firstSeen: dateOffset(10),
        lastSeen: dateOffset(3),
        occurrences: 2,
        averageStrength: 84,
        highestStrength: 84,
        lowestStrength: 84,
        trend: 'stable',
        trendVelocity: 0,
        contexts: ['Career', 'Identity'],
        contextsMap: { Career: 80, Identity: 70 },
        relatedPatterns: ['Self Criticism'],
        evidenceHistory: [{ date: dateOffset(3), quote: 'I keep analyzing this scenario.', domain: 'Career' }],
        confidenceHistory: [{ date: dateOffset(3), confidence: 90 }],
        strengthHistory: [{ date: dateOffset(3), score: 84 }],
        reflectionReferences: [],
        milestones: ['Identified during reflection loops'],
        evolutionStory: 'Overthinking is stable around identity decisions, acting to postpone active choice.',
        updated_at: dateOffset(3)
      }
    ],
    pattern_connections: [
      { id: 'conn-1', user_id: 'sandbox-user-123', source: 'Fear of Failure', target: 'Perfectionism', weight: 85, evidence_count: 1 },
      { id: 'conn-2', user_id: 'sandbox-user-123', source: 'Perfectionism', target: 'Avoidance', weight: 78, evidence_count: 1 }
    ],
    psychological_dna: [
      { id: 'dna-1', user_id: 'sandbox-user-123', dimension: 'Self Trust', score: 45, trend: 'stable', confidence: 80, history: [{ date: dateOffset(15), score: 48 }, { date: dateOffset(10), score: 46 }, { date: dateOffset(0), score: 45 }], updated_at: dateOffset(0) },
      { id: 'dna-2', user_id: 'sandbox-user-123', dimension: 'Confidence', score: 38, trend: 'stable', confidence: 85, history: [{ date: dateOffset(15), score: 35 }, { date: dateOffset(10), score: 36 }, { date: dateOffset(0), score: 38 }], updated_at: dateOffset(0) },
      { id: 'dna-3', user_id: 'sandbox-user-123', dimension: 'Avoidance', score: 78, trend: 'rising', confidence: 90, history: [{ date: dateOffset(15), score: 70 }, { date: dateOffset(10), score: 74 }, { date: dateOffset(0), score: 78 }], updated_at: dateOffset(0) },
      { id: 'dna-4', user_id: 'sandbox-user-123', dimension: 'Perfectionism', score: 85, trend: 'rising', confidence: 92, history: [{ date: dateOffset(15), score: 80 }, { date: dateOffset(10), score: 82 }, { date: dateOffset(0), score: 85 }], updated_at: dateOffset(0) },
      { id: 'dna-5', user_id: 'sandbox-user-123', dimension: 'People Pleasing', score: 50, trend: 'stable', confidence: 50, history: [{ date: dateOffset(15), score: 50 }, { date: dateOffset(0), score: 50 }], updated_at: dateOffset(0) },
      { id: 'dna-6', user_id: 'sandbox-user-123', dimension: 'Emotional Independence', score: 50, trend: 'stable', confidence: 50, history: [{ date: dateOffset(15), score: 50 }, { date: dateOffset(0), score: 50 }], updated_at: dateOffset(0) },
      { id: 'dna-7', user_id: 'sandbox-user-123', dimension: 'Boundary Strength', score: 40, trend: 'falling', confidence: 75, history: [{ date: dateOffset(15), score: 45 }, { date: dateOffset(10), score: 42 }, { date: dateOffset(0), score: 40 }], updated_at: dateOffset(0) },
      { id: 'dna-8', user_id: 'sandbox-user-123', dimension: 'Decision Confidence', score: 42, trend: 'falling', confidence: 80, history: [{ date: dateOffset(15), score: 48 }, { date: dateOffset(10), score: 45 }, { date: dateOffset(0), score: 42 }], updated_at: dateOffset(0) },
      { id: 'dna-9', user_id: 'sandbox-user-123', dimension: 'Self Criticism', score: 88, trend: 'rising', confidence: 91, history: [{ date: dateOffset(15), score: 82 }, { date: dateOffset(10), score: 85 }, { date: dateOffset(0), score: 88 }], updated_at: dateOffset(0) },
      { id: 'dna-10', user_id: 'sandbox-user-123', dimension: 'Overthinking', score: 84, trend: 'rising', confidence: 90, history: [{ date: dateOffset(15), score: 76 }, { date: dateOffset(10), score: 80 }, { date: dateOffset(0), score: 84 }], updated_at: dateOffset(0) }
    ],
    insights: [
      {
        id: 'ins-1',
        user_id: 'sandbox-user-123',
        title: 'Fear of Evaluation',
        description: 'You frequently avoid tasks or delay projects when you anticipate they will be evaluated by peers or mentors. This is rooted in a pattern of equating your self-worth with external outcomes.',
        confidence: 88,
        areas: ['Career', 'Learning'],
        created_at: dateOffset(5)
      }
    ],
    timeline_events: [
      { id: 'tl-1', user_id: 'sandbox-user-123', type: 'pattern_discovered', title: 'Self Criticism Identified', description: 'Pattern "Self Criticism" detected with score 89% and confidence 92%.', metadata: { score: 89 }, created_at: dateOffset(10) },
      { id: 'tl-2', user_id: 'sandbox-user-123', type: 'dna_evolved', title: 'Avoidance DNA Heightened', description: 'Your Avoidance score rose to 78% due to active patterns of over-preparation.', metadata: { score: 78 }, created_at: dateOffset(7) },
      { id: 'tl-3', user_id: 'sandbox-user-123', type: 'connection_formed', title: 'Perfectionism-Avoidance Bridge', description: 'A strong behavioral connection (78%) formed between Perfectionism and Avoidance.', metadata: { connection: 'Perfectionism -> Avoidance' }, created_at: dateOffset(5) },
      { id: 'tl-4', user_id: 'sandbox-user-123', type: 'insight_generated', title: 'Insight Generated: Fear of Evaluation', description: 'A deep psychological insight was uncovered based on career avoidance behaviors.', metadata: { insightId: 'ins-1' }, created_at: dateOffset(3) },
      { id: 'tl-5', user_id: 'sandbox-user-123', type: 'milestone', title: 'Self-Awareness Mirror Initialized', description: 'Successfully configured Human OS core profiling. Evolving Psychological DNA.', metadata: {}, created_at: dateOffset(0) }
    ],
    blind_spots: [
      {
        id: 'bs-1',
        user_id: 'sandbox-user-123',
        contradiction: 'Believing that incomplete work is safe from judgment',
        revealedTruth: 'Postponing completion is a shield to defer evaluation, not laziness.',
        confidence: 88,
        created_at: dateOffset(5)
      }
    ],
    internal_conflicts: [
      {
        id: 'ic-1',
        user_id: 'sandbox-user-123',
        partA: 'Wants Growth & Autonomy',
        partB: 'Wants Safety & Certainty',
        tension: 'Growth requires exposing work to judgment, which threatens safety.',
        created_at: dateOffset(5)
      }
    ],
    root_drivers: [
      {
        id: 'rd-1',
        user_id: 'sandbox-user-123',
        rootDriver: 'Fear of Evaluation',
        createsPatterns: ['Perfectionism', 'Avoidance', 'Overthinking Loops', 'Self Criticism'],
        created_at: dateOffset(5)
      }
    ],
    narratives: [
      {
        id: 'nar-1',
        user_id: 'sandbox-user-123',
        title: 'Phase 1: Initial Discovery',
        content: 'Your self-awareness mirror initialized. Early reflections show perfectionistic avoidance and people-pleasing loops. You are beginning to map the boundaries of your inner world.',
        phase: 'Month 1',
        created_at: dateOffset(20)
      },
      {
        id: 'nar-2',
        user_id: 'sandbox-user-123',
        title: 'Phase 2: Emerging Awareness',
        content: 'You began identifying the Perfectionism-Avoidance bridge, noting how high standards are erected as shields against evaluation. Insights regarding career standard shields are surfacing.',
        phase: 'Month 2',
        created_at: dateOffset(10)
      }
    ],
    long_term_memory: {
      "sandbox-user-123": {
        firstReflection: "I keep postponing important work because I feel it won\'t be perfect.",
        mostRecurringPattern: "Perfectionism",
        mostCommonContext: "Career Decisions",
        emergingTheme: "Decision Uncertainty",
        patternBecomingWeaker: "Self Criticism",
        mostFrequentConflict: "Growth vs Certainty",
        mostCommonTrigger: "Evaluation",
        firstMemoryRecorded: "June 2026",
        recentShift: "Avoidance appears less dominant than last month"
      }
    }
  };
  return seed;
};

const readLocalDB = () => {
  if (!fs.existsSync(DB_FILE)) {
    const seed = getInitialSeed();
    writeLocalDB(seed);
    return seed;
  }
  try {
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    const db = JSON.parse(data);
    const originalPayload = JSON.stringify(db);

    let migrated = false;
    const seed = getInitialSeed();
    COLLECTIONS.forEach(col => {
      if (!db[col]) {
        db[col] = seed[col] || (col === 'long_term_memory' ? {} : []);
        migrated = true;
      }
    });

    db.profiles = db.profiles.map(item => ({
      ...item,
      created_at: validateDate(item.created_at)
    }));

    db.conversations = db.conversations.map(item => ({
      ...item,
      created_at: validateUserDate(db, item.user_id, item.created_at)
    }));

    db.patterns = db.patterns.map(item => enrichPatternMemory(item, db));

    db.psychological_dna = db.psychological_dna.map(item => ({
      ...item,
      history: asArray(item.history).map(h => ({ ...h, date: validateUserDate(db, item.user_id, h.date, item.updated_at) })),
      updated_at: validateUserDate(db, item.user_id, item.updated_at)
    }));

    db.insights = db.insights.map(item => ({
      ...item,
      title: normalizeTimelineTitle(item.title),
      description: normalizeTimelineDescription(item.description),
      created_at: validateUserDate(db, item.user_id, item.created_at)
    }));

    db.timeline_events = db.timeline_events.map(item => ({
      ...item,
      title: normalizeTimelineTitle(item.title),
      description: normalizeTimelineDescription(item.description),
      created_at: validateUserDate(db, item.user_id, item.created_at)
    }));

    db.blind_spots = db.blind_spots.map(item => ({
      ...item,
      revealed_truth: item.revealed_truth || item.revealedTruth || '',
      revealedTruth: item.revealedTruth || item.revealed_truth || '',
      created_at: validateUserDate(db, item.user_id, item.created_at)
    }));

    db.internal_conflicts = db.internal_conflicts.map(item => {
      const partA = canonicalizeConflictPart(item.part_a || item.partA, 'Action');
      const partB = canonicalizeConflictPart(item.part_b || item.partB, 'Certainty');
      return {
        ...item,
        part_a: partA,
        partA,
        part_b: partB,
        partB,
        category: item.category || buildConflictCategory(partA, partB),
        contexts: asArray(item.contexts),
        occurrences: item.occurrences || 1,
        strength: item.strength || 75,
        firstSeen: validateUserDate(db, item.user_id, item.firstSeen || item.created_at),
        lastSeen: validateUserDate(db, item.user_id, item.lastSeen || item.created_at),
        created_at: validateUserDate(db, item.user_id, item.created_at)
      };
    });

    db.root_drivers = db.root_drivers.map(item => ({
      ...item,
      root_driver: item.root_driver || item.rootDriver || '',
      rootDriver: item.rootDriver || item.root_driver || '',
      creates: item.creates || item.createsPatterns || [],
      createsPatterns: item.createsPatterns || item.creates || [],
      created_at: validateUserDate(db, item.user_id, item.created_at)
    }));

    db.narratives = db.narratives.map(item => ({
      ...item,
      created_at: validateUserDate(db, item.user_id, item.created_at)
    }));

    const dedupeBySignature = (items, getSignature) => Array.from(
      new Map(items.map(item => [getSignature(item), item])).values()
    );

    db.timeline_events = dedupeBySignature(
      db.timeline_events,
      item => `${item.user_id}|${item.type}|${normalizeText(item.title)}|${normalizeText(item.description)}`
    );

    db.internal_conflicts = dedupeBySignature(
      db.internal_conflicts,
      item => `${item.user_id}|${normalizeText(item.partA || item.part_a)}|${normalizeText(item.partB || item.part_b)}`
    );

    if (migrated || originalPayload !== JSON.stringify(db)) {
      writeLocalDB(db);
    }
    return db;
  } catch (error) {
    console.error('Failed to parse local_db.json. Resetting database to seed.', error);
    const seed = getInitialSeed();
    writeLocalDB(seed);
    return seed;
  }
};

const writeLocalDB = (data) => {
  fs.writeFileSync(DB_TMP_FILE, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(DB_TMP_FILE, DB_FILE);
};

export const db = {
  isSupabaseEnabled: () => isSupabaseEnabled,

  init: async () => {
    if (!isSupabaseEnabled) {
      readLocalDB();
    }
  },

  saveConversation: async (userId, message, response) => {
    if (isSupabaseEnabled) {
      const { data, error } = await supabase
        .from('conversations')
        .insert({ user_id: userId, message, response })
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const dbData = readLocalDB();
      const newConv = {
        id: `conv-${crypto.randomUUID()}`,
        user_id: userId,
        message,
        response,
        created_at: validateUserDate(dbData, userId, new Date().toISOString())
      };
      dbData.conversations.push(newConv);
      writeLocalDB(dbData);
      return newConv;
    }
  },

  getConversations: async (userId) => {
    if (isSupabaseEnabled) {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    } else {
      const dbData = readLocalDB();
      return dbData.conversations.filter(c => c.user_id === userId);
    }
  },

  getPatterns: async (userId) => {
    if (isSupabaseEnabled) {
      const { data, error } = await supabase
        .from('patterns')
        .select('*')
        .eq('user_id', userId);
      if (error) throw error;
      return data;
    } else {
      const dbData = readLocalDB();
      return dbData.patterns.filter(p => p.user_id === userId);
    }
  },

  upsertPattern: async (userId, name, score, confidence, category, v2Data = {}) => {
    let finalScore = score;
    let finalConfidence = confidence;
    let finalCategory = category;
    let finalV2Data = v2Data;

    if (typeof score === 'object' && score !== null) {
      finalV2Data = score;
      finalScore = finalV2Data.score || finalV2Data.strength || 50;
      finalConfidence = finalV2Data.confidence || 50;
      finalCategory = finalV2Data.category || 'Cognitive';
    }

    if (isSupabaseEnabled) {
      const { data, error } = await supabase
        .from('patterns')
        .upsert({
          user_id: userId,
          name,
          score: finalScore,
          confidence: finalConfidence,
          category: finalCategory,
          metadata: finalV2Data,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id, name' })
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const dbData = readLocalDB();
      const existingIdx = dbData.patterns.findIndex(p => p.user_id === userId && p.name === name);
      const nowStr = validateUserDate(dbData, userId, new Date().toISOString());
      const existing = existingIdx !== -1 ? dbData.patterns[existingIdx] : {};

      const getTrendDirection = (trendVal) => {
        const t = String(trendVal || 'Stable').toLowerCase();
        if (t === 'rising' || t === 'increasing' || t === 'strengthening') return 'Strengthening';
        if (t === 'falling' || t === 'weakening' || t === 'decreasing') return 'Weakening';
        if (t === 'new' || t === 'emerging' || t === 're-emerging') return 'Emerging';
        if (t === 'dormant') return 'Dormant';
        if (t === 'resolved') return 'Resolved';
        return 'Stable';
      };

      const updatedPattern = {
        id: finalV2Data.id || finalV2Data.patternId || existing.id || `pat-${crypto.randomUUID()}`,
        user_id: userId,
        name,
        // V4 attributes
        firstSeen: validateUserDate(dbData, userId, finalV2Data.firstSeen || existing.firstSeen || nowStr),
        lastSeen: validateUserDate(dbData, userId, finalV2Data.lastSeen || nowStr),
        occurrences: finalV2Data.occurrences !== undefined ? finalV2Data.occurrences : (existing.occurrences || 1),
        confidence: finalConfidence,
        strength: finalScore,
        trend: finalV2Data.trend || existing.trend || 'stable',
        trendVelocity: finalV2Data.trendVelocity !== undefined ? finalV2Data.trendVelocity : (existing.trendVelocity || 0),
        contexts: asArray(finalV2Data.contexts || existing.contexts),
        contextsMap: finalV2Data.contextsMap || existing.contextsMap || {},
        triggers: asArray(finalV2Data.triggers || existing.triggers),
        evidence: asArray(finalV2Data.evidence || existing.evidence || (finalV2Data.evidenceHistory || existing.evidenceHistory || []).map(h => h.quote).filter(Boolean)),
        relatedPatterns: asArray(finalV2Data.relatedPatterns || existing.relatedPatterns),
        confidenceHistory: (finalV2Data.confidenceHistory || existing.confidenceHistory || []).map(h => ({ ...h, date: validateUserDate(dbData, userId, h.date) })),
        strengthHistory: (finalV2Data.strengthHistory || existing.strengthHistory || []).map(h => ({ ...h, date: validateUserDate(dbData, userId, h.date) })),
        reflectionReferences: finalV2Data.reflectionReferences || existing.reflectionReferences || [],
        evidenceHistory: (finalV2Data.evidenceHistory || existing.evidenceHistory || []).map(h => ({ ...h, date: validateUserDate(dbData, userId, h.date) })),
        growthHistory: (finalV2Data.growthHistory || existing.growthHistory || []).map(h => (
          typeof h === 'string'
            ? { date: nowStr, signal: h }
            : { ...h, date: validateUserDate(dbData, userId, h.date) }
        )),
        conflictHistory: (finalV2Data.conflictHistory || existing.conflictHistory || []).map(h => (
          typeof h === 'string'
            ? { date: nowStr, tension: h }
            : { ...h, date: validateUserDate(dbData, userId, h.date) }
        )),
        narrativeHistory: (finalV2Data.narrativeHistory || existing.narrativeHistory || []).map(h => (
          typeof h === 'string'
            ? { date: nowStr, narrative: h }
            : { ...h, date: validateUserDate(dbData, userId, h.date) }
        )),
        milestones: finalV2Data.milestones || existing.milestones || [],
        evolutionStory: finalV2Data.evolutionStory || existing.evolutionStory || 'A stable behavioral pattern repeating across reflections.',
        
        // V4 True Memory System additions
        growthSignals: finalV2Data.growthSignals || existing.growthSignals || [],
        evidenceReferences: finalV2Data.evidenceReferences || finalV2Data.reflectionReferences || existing.evidenceReferences || existing.reflectionReferences || [],
        trendDirection: getTrendDirection(finalV2Data.trendDirection || finalV2Data.trend || existing.trendDirection || existing.trend || 'Stable'),

        // Backward compatibility
        score: finalScore,
        category: finalCategory,
        averageStrength: finalV2Data.averageStrength !== undefined ? finalV2Data.averageStrength : (existing.averageStrength || finalScore),
        highestStrength: finalV2Data.highestStrength !== undefined ? finalV2Data.highestStrength : (existing.highestStrength || finalScore),
        lowestStrength: finalV2Data.lowestStrength !== undefined ? finalV2Data.lowestStrength : (existing.lowestStrength || finalScore),
        updated_at: nowStr
      };

      if (existingIdx !== -1) {
        dbData.patterns[existingIdx] = updatedPattern;
      } else {
        dbData.patterns.push(updatedPattern);
      }
      writeLocalDB(dbData);
      return updatedPattern;
    }
  },

  getPatternConnections: async (userId) => {
    if (isSupabaseEnabled) {
      const { data, error } = await supabase
        .from('pattern_connections')
        .select('*')
        .eq('user_id', userId);
      if (error) throw error;
      return data;
    } else {
      const dbData = readLocalDB();
      return dbData.pattern_connections.filter(c => c.user_id === userId);
    }
  },

  upsertPatternConnection: async (userId, source, target, weight) => {
    if (isSupabaseEnabled) {
      const { data, error } = await supabase
        .from('pattern_connections')
        .upsert({ user_id: userId, source, target, weight, updated_at: new Date().toISOString() }, { onConflict: 'user_id, source, target' })
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const dbData = readLocalDB();
      const nowStr = validateUserDate(dbData, userId, new Date().toISOString());
      const existingIdx = dbData.pattern_connections.findIndex(c => c.user_id === userId && c.source === source && c.target === target);
      if (existingIdx !== -1) {
        dbData.pattern_connections[existingIdx].weight = Math.round((dbData.pattern_connections[existingIdx].weight + weight) / 2);
        dbData.pattern_connections[existingIdx].evidence_count += 1;
        dbData.pattern_connections[existingIdx].updated_at = nowStr;
      } else {
        dbData.pattern_connections.push({
          id: `conn-${crypto.randomUUID()}`,
          user_id: userId,
          source,
          target,
          weight,
          evidence_count: 1,
          updated_at: nowStr
        });
      }
      writeLocalDB(dbData);
      return dbData.pattern_connections.find(c => c.user_id === userId && c.source === source && c.target === target);
    }
  },

  getPsychologicalDNA: async (userId) => {
    if (isSupabaseEnabled) {
      const { data, error } = await supabase
        .from('psychological_dna')
        .select('*')
        .eq('user_id', userId);
      if (error) throw error;
      return data;
    } else {
      const dbData = readLocalDB();
      return dbData.psychological_dna.filter(d => d.user_id === userId);
    }
  },

  updatePsychologicalDNA: async (userId, dimension, score, trend, confidence, historyEntry) => {
    if (isSupabaseEnabled) {
      const { data: existing } = await supabase
        .from('psychological_dna')
        .select('history')
        .eq('user_id', userId)
        .eq('dimension', dimension)
        .single();

      let newHistory = historyEntry ? [historyEntry] : [];
      if (existing && existing.history) {
        newHistory = [...existing.history, ...(historyEntry ? [historyEntry] : [])];
      }

      const { data, error } = await supabase
        .from('psychological_dna')
        .upsert({
          user_id: userId,
          dimension,
          score,
          trend,
          confidence,
          history: newHistory,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id, dimension' })
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      const dbData = readLocalDB();
      const existingIdx = dbData.psychological_dna.findIndex(d => d.user_id === userId && d.dimension === dimension);
      const nowStr = validateUserDate(dbData, userId, new Date().toISOString());
      const safeHistoryEntry = historyEntry
        ? { ...historyEntry, date: validateUserDate(dbData, userId, historyEntry.date || nowStr) }
        : null;

      if (existingIdx !== -1) {
        const item = dbData.psychological_dna[existingIdx];
        const newHistory = [...(item.history || [])];
        if (safeHistoryEntry) {
          newHistory.push(safeHistoryEntry);
        }
        dbData.psychological_dna[existingIdx] = {
          ...item,
          score,
          trend,
          confidence,
          history: newHistory,
          updated_at: nowStr
        };
      } else {
        dbData.psychological_dna.push({
          id: `dna-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          user_id: userId,
          dimension,
          score,
          trend,
          confidence,
          history: safeHistoryEntry ? [safeHistoryEntry] : [],
          updated_at: nowStr
        });
      }
      writeLocalDB(dbData);
      return dbData.psychological_dna.find(d => d.user_id === userId && d.dimension === dimension);
    }
  },

  getInsights: async (userId) => {
    if (isSupabaseEnabled) {
      const { data, error } = await supabase
        .from('insights')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    } else {
      const dbData = readLocalDB();
      return dbData.insights.filter(i => i.user_id === userId);
    }
  },

  saveInsight: async (userId, title, description, confidence, areas) => {
    if (isSupabaseEnabled) {
      const { data, error } = await supabase
        .from('insights')
        .insert({ user_id: userId, title, description, confidence, areas })
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const dbData = readLocalDB();
      const existingInsight = (dbData.insights || []).find(item => (
        item.user_id === userId &&
        (
          normalizeText(item.title) === normalizeText(title) ||
          tokenSimilarity(item.description, description) > 0.72
        )
      ));

      if (existingInsight) {
        return existingInsight;
      }

      const newInsight = {
        id: `ins-${crypto.randomUUID()}`,
        user_id: userId,
        title: normalizeTimelineTitle(title),
        description: normalizeTimelineDescription(description),
        confidence,
        areas,
        created_at: validateUserDate(dbData, userId, new Date().toISOString())
      };
      dbData.insights.push(newInsight);
      writeLocalDB(dbData);
      return newInsight;
    }
  },

  getTimeline: async (userId) => {
    if (isSupabaseEnabled) {
      const { data, error } = await supabase
        .from('timeline_events')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    } else {
      const dbData = readLocalDB();
      if (!dbData.timeline_events) dbData.timeline_events = [];
      const rawEvents = [...dbData.timeline_events].filter(t => t.user_id === userId);
      const uniqueEvents = Array.from(
        new Map(rawEvents.map(item => [
          `${item.type}|${normalizeText(item.title)}|${normalizeText(item.description)}`,
          item
        ])).values()
      );
      const meaningfulTypes = new Set([
        'first_reflection',
        'pattern_discovered',
        'pattern_strengthened',
        'pattern_weakened',
        'pattern_broken',
        'behavior_change',
        'insight_generated',
        'milestone',
        'major_shift',
        'growth_signal'
      ]);

      return uniqueEvents
        .filter(event => meaningfulTypes.has(event.type))
        .sort((a, b) => (parseDate(b.created_at)?.getTime() || 0) - (parseDate(a.created_at)?.getTime() || 0))
        .slice(0, 10);
    }
  },

  addTimelineEvent: async (userId, type, title, description, metadata = {}) => {
    if (isSupabaseEnabled) {
      const { data, error } = await supabase
        .from('timeline_events')
        .insert({ user_id: userId, type, title, description, metadata })
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const dbData = readLocalDB();
      if (!dbData.timeline_events) dbData.timeline_events = [];
      const safeTitle = normalizeTimelineTitle(title);
      const safeDescription = normalizeTimelineDescription(description);
      const signature = `${userId}|${type}|${normalizeText(safeTitle)}|${normalizeText(safeDescription)}`;
      const existing = dbData.timeline_events.find(item => (
        `${item.user_id}|${item.type}|${normalizeText(item.title)}|${normalizeText(item.description)}` === signature
      ));

      if (existing) {
        return existing;
      }

      const newEvent = {
        id: `tl-${crypto.randomUUID()}`,
        user_id: userId,
        type,
        title: safeTitle,
        description: safeDescription,
        metadata,
        created_at: validateUserDate(dbData, userId, new Date().toISOString())
      };
      dbData.timeline_events.push(newEvent);
      dbData.timeline_events = Array.from(
        new Map(dbData.timeline_events.map(item => [item.id, item])).values()
      );
      writeLocalDB(dbData);
      return newEvent;
    }
  },

  saveBlindSpot: async (userId, contradiction, revealedTruth, confidence) => {
    if (isSupabaseEnabled) {
      const { data, error } = await supabase
        .from('blind_spots')
        .insert({ user_id: userId, contradiction, revealed_truth: revealedTruth, confidence })
        .select()
        .single();
      if (error) return null;
      return data;
    } else {
      const dbData = readLocalDB();
      if (!dbData.blind_spots) dbData.blind_spots = [];
      const existing = dbData.blind_spots.find(item => (
        item.user_id === userId &&
        (
          normalizeText(item.contradiction) === normalizeText(contradiction) ||
          tokenSimilarity(item.revealed_truth || item.revealedTruth, revealedTruth) > 0.72
        )
      ));

      if (existing) {
        return existing;
      }

      const newBS = {
        id: `bs-${crypto.randomUUID()}`,
        user_id: userId,
        contradiction,
        revealed_truth: revealedTruth,
        revealedTruth,
        confidence,
        created_at: validateUserDate(dbData, userId, new Date().toISOString())
      };
      dbData.blind_spots.push(newBS);
      writeLocalDB(dbData);
      return newBS;
    }
  },

  getBlindSpots: async (userId) => {
    if (isSupabaseEnabled) {
      const { data, error } = await supabase
        .from('blind_spots')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) return [];
      return data;
    } else {
      const dbData = readLocalDB();
      if (!dbData.blind_spots) dbData.blind_spots = [];
      return dbData.blind_spots.filter(bs => bs.user_id === userId);
    }
  },

  saveInternalConflict: async (userId, partA, partB, tension, options = {}) => {
    const cleanPartA = canonicalizeConflictPart(partA, 'Action');
    const cleanPartB = canonicalizeConflictPart(partB, 'Certainty');
    const category = buildConflictCategory(cleanPartA, cleanPartB);

    if (isSupabaseEnabled) {
      const { data, error } = await supabase
        .from('internal_conflicts')
        .insert({ user_id: userId, part_a: cleanPartA, part_b: cleanPartB, tension })
        .select()
        .single();
      if (error) return null;
      return data;
    } else {
      const dbData = readLocalDB();
      if (!dbData.internal_conflicts) dbData.internal_conflicts = [];
      
      const key = `${cleanPartA.toLowerCase()}|${cleanPartB.toLowerCase()}`;
      const revKey = `${cleanPartB.toLowerCase()}|${cleanPartA.toLowerCase()}`;
      
      const existingIdx = dbData.internal_conflicts.findIndex(ic => 
        ic.user_id === userId && 
        ((`${(ic.partA || ic.part_a || '').toLowerCase()}|${(ic.partB || ic.part_b || '').toLowerCase()}` === key) ||
         (`${(ic.partA || ic.part_a || '').toLowerCase()}|${(ic.partB || ic.part_b || '').toLowerCase()}` === revKey))
      );
      
      const nowStr = validateUserDate(dbData, userId, new Date().toISOString());
      const existing = existingIdx !== -1 ? dbData.internal_conflicts[existingIdx] : {};
      
      const occurrences = options.occurrences !== undefined ? options.occurrences : ((existing.occurrences || 0) + 1);
      const firstSeen = validateUserDate(dbData, userId, options.firstSeen || existing.firstSeen || nowStr);
      const lastSeen = validateUserDate(dbData, userId, options.lastSeen || nowStr);
      const strength = options.strength !== undefined ? options.strength : (existing.strength || 75);
      const contexts = Array.from(new Set([...(existing.contexts || []), ...(options.contexts || [])]));

      const newIC = {
        id: existing.id || `ic-${crypto.randomUUID()}`,
        user_id: userId,
        part_a: cleanPartA,
        partA: cleanPartA,
        part_b: cleanPartB,
        partB: cleanPartB,
        category,
        tension: tension || existing.tension || '',
        occurrences,
        contexts,
        firstSeen,
        lastSeen,
        strength,
        created_at: existing.created_at || firstSeen
      };

      if (existingIdx !== -1) {
        dbData.internal_conflicts[existingIdx] = newIC;
      } else {
        dbData.internal_conflicts.push(newIC);
      }
      writeLocalDB(dbData);
      return newIC;
    }
  },

  getInternalConflicts: async (userId) => {
    if (isSupabaseEnabled) {
      const { data, error } = await supabase
        .from('internal_conflicts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) return [];
      return (data || [])
        .map(item => {
          const partA = canonicalizeConflictPart(item.part_a || item.partA, 'Action');
          const partB = canonicalizeConflictPart(item.part_b || item.partB, 'Certainty');
          return {
            ...item,
            part_a: partA,
            partA,
            part_b: partB,
            partB,
            category: item.category || buildConflictCategory(partA, partB),
            occurrences: item.occurrences || 1,
            strength: item.strength || 75
          };
        })
        .sort((a, b) => ((b.occurrences || 1) * (b.strength || 75)) - ((a.occurrences || 1) * (a.strength || 75)))
        .slice(0, 3);
    } else {
      const dbData = readLocalDB();
      if (!dbData.internal_conflicts) dbData.internal_conflicts = [];
      return dbData.internal_conflicts
        .filter(ic => ic.user_id === userId)
        .sort((a, b) => ((b.occurrences || 1) * (b.strength || 75)) - ((a.occurrences || 1) * (a.strength || 75)))
        .slice(0, 3);
    }
  },

  saveRootDriver: async (userId, rootDriver, createsPatterns) => {
    if (isSupabaseEnabled) {
      const { data, error } = await supabase
        .from('root_drivers')
        .insert({ user_id: userId, root_driver: rootDriver, creates_patterns: createsPatterns })
        .select()
        .single();
      if (error) return null;
      return data;
    } else {
      const dbData = readLocalDB();
      if (!dbData.root_drivers) dbData.root_drivers = [];
      const existing = dbData.root_drivers.find(item => (
        item.user_id === userId &&
        normalizeText(item.root_driver || item.rootDriver) === normalizeText(rootDriver)
      ));

      if (existing) {
        const creates = Array.from(new Set([...(existing.creates || existing.createsPatterns || []), ...(createsPatterns || [])]));
        const updated = {
          ...existing,
          creates,
          createsPatterns: creates
        };
        const idx = dbData.root_drivers.findIndex(item => item.id === existing.id);
        dbData.root_drivers[idx] = updated;
        writeLocalDB(dbData);
        return updated;
      }

      const newRD = {
        id: `rd-${crypto.randomUUID()}`,
        user_id: userId,
        root_driver: rootDriver,
        rootDriver,
        creates: createsPatterns,
        createsPatterns,
        created_at: validateUserDate(dbData, userId, new Date().toISOString())
      };
      dbData.root_drivers.push(newRD);
      writeLocalDB(dbData);
      return newRD;
    }
  },

  getRootDrivers: async (userId) => {
    if (isSupabaseEnabled) {
      const { data, error } = await supabase
        .from('root_drivers')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) return [];
      return data;
    } else {
      const dbData = readLocalDB();
      if (!dbData.root_drivers) dbData.root_drivers = [];
      return dbData.root_drivers.filter(rd => rd.user_id === userId);
    }
  },

  saveNarrative: async (userId, title, content, phase) => {
    if (isSupabaseEnabled) {
      const { data, error } = await supabase
        .from('narratives')
        .insert({ user_id: userId, title, content, phase })
        .select()
        .single();
      if (error) return null;
      return data;
    } else {
      const dbData = readLocalDB();
      if (!dbData.narratives) dbData.narratives = [];
      const newN = {
        id: `nar-${crypto.randomUUID()}`,
        user_id: userId,
        title,
        content,
        phase,
        created_at: validateUserDate(dbData, userId, new Date().toISOString())
      };
      dbData.narratives.push(newN);
      writeLocalDB(dbData);
      return newN;
    }
  },

  getNarratives: async (userId) => {
    if (isSupabaseEnabled) {
      const { data, error } = await supabase
        .from('narratives')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) return [];
      return data;
    } else {
      const dbData = readLocalDB();
      if (!dbData.narratives) dbData.narratives = [];
      return dbData.narratives.filter(n => n.user_id === userId);
    }
  },

  getLongTermMemory: async (userId) => {
    const dbData = readLocalDB();
    if (!dbData.long_term_memory) dbData.long_term_memory = {};
    if (!dbData.long_term_memory[userId]) {
      dbData.long_term_memory[userId] = {
        firstReflection: null,
        mostRecurringPattern: null,
        mostCommonContext: null,
        emergingTheme: null,
        patternBecomingWeaker: null,
        mostFrequentConflict: null,
        mostCommonTrigger: null,
        firstMemoryRecorded: null,
        recentShift: null
      };
      writeLocalDB(dbData);
    }
    return dbData.long_term_memory[userId];
  },

  updateLongTermMemory: async (userId, data) => {
    const dbData = readLocalDB();
    if (!dbData.long_term_memory) dbData.long_term_memory = {};
    dbData.long_term_memory[userId] = {
      ...(dbData.long_term_memory[userId] || {}),
      ...data
    };
    writeLocalDB(dbData);
    return dbData.long_term_memory[userId];
  }
};
