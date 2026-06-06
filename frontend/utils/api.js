// Human OS Frontend API & Sandbox Handler

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const BACKEND_URL = `${API_BASE_URL}/api`;

const fetchWithTimeout = async (url, options = {}, timeoutMs = 8000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

// Core Schema Normalizer to prevent component crashes and support V2
const normalizeAnalysisResponse = (raw) => {
  if (!raw) return getDefaultAnalysisResponse();

  // 1. Normalize Patterns List (Ensure category, strength, confidence, and evidence exist)
  const rawPatterns = Array.isArray(raw.patterns) ? raw.patterns : [];
  const normalizedPatterns = rawPatterns.map(p => {
    const strengthVal = Number(p.strength || p.score || 50);
    return {
      name: p.name || 'Undefined Loop',
      category: p.category || 'Cognitive',
      strength: strengthVal,
      score: strengthVal, // Duplicate for layout compatibility
      confidence: Number(p.confidence || 50),
      evidence: p.evidence || 'Dialogue context segment.'
    };
  });

  // 2. Normalize Connections (Ensure source, target, and weight exist)
  const rawConnections = Array.isArray(raw.connections) ? raw.connections : [];
  const normalizedConnections = rawConnections.map(c => ({
    source: c.source || '',
    target: c.target || '',
    weight: Number(c.weight || 50)
  }));

  // 3. Normalize Blind Spots (as list of contradiction/revealed_truth objects)
  const rawBlindSpots = Array.isArray(raw.blind_spots || raw.blindSpots) ? (raw.blind_spots || raw.blindSpots) : [];
  const normalizedBlindSpots = rawBlindSpots.map(bs => {
    if (typeof bs === 'string') {
      return {
        contradiction: 'Conscious label/behavior',
        revealed_truth: bs,
        revealedTruth: bs
      };
    }
    const truth = bs.revealed_truth || bs.revealedTruth || 'Underlying avoidance dynamic.';
    return {
      contradiction: bs.contradiction || 'Unresolved labeling',
      revealed_truth: truth,
      revealedTruth: truth
    };
  });

  // 4. Normalize Hidden/Root Drivers
  const rawDrivers = Array.isArray(raw.hidden_drivers || raw.hiddenDrivers || raw.root_drivers || raw.rootDrivers) 
    ? (raw.hidden_drivers || raw.hiddenDrivers || raw.root_drivers || raw.rootDrivers) 
    : [];
  const normalizedDrivers = rawDrivers.map(hd => {
    if (typeof hd === 'string') {
      return {
        root_driver: hd,
        rootDriver: hd,
        creates: [],
        createsPatterns: []
      };
    }
    const rootDriver = hd.root_driver || hd.rootDriver || 'Hidden anxiety regulator';
    const creates = Array.isArray(hd.creates || hd.createsPatterns) ? (hd.creates || hd.createsPatterns) : [];
    return {
      root_driver: rootDriver,
      rootDriver: rootDriver,
      creates: creates,
      createsPatterns: creates
    };
  });

  // 5. Normalize Internal Conflicts
  const rawConflicts = Array.isArray(raw.internal_conflicts || raw.internalConflicts)
    ? (raw.internal_conflicts || raw.internalConflicts)
    : [];
  const normalizedConflicts = rawConflicts.map(ic => {
    const partA = ic.part_a || ic.partA || 'Desire for progression';
    const partB = ic.part_b || ic.partB || 'Desire for safety';
    const tension = ic.tension || 'Growth requires exposure, creating vulnerability.';
    return {
      part_a: partA,
      partA: partA,
      part_b: partB,
      partB: partB,
      tension: tension
    };
  });

  // 6. Normalize Domains
  const rawDomains = raw.domains || {};
  const defaultDomains = {
    Career: 0,
    Study: 0,
    Relationships: 0,
    Family: 0,
    Health: 0,
    Finance: 0,
    Identity: 0,
    Purpose: 0,
    'Social Life': 0,
    'Decision Making': 0
  };
  const normalizedDomains = { ...defaultDomains };
  Object.keys(rawDomains).forEach(d => {
    // Standardize key names in case of case mismatches
    let keyName = d;
    if (d.toLowerCase() === 'social life') keyName = 'Social Life';
    if (d.toLowerCase() === 'decision making') keyName = 'Decision Making';
    normalizedDomains[keyName] = Number(rawDomains[d] || 0);
  });

  const normalized = {
    summary: raw.summary || raw.observation || 'Dialogue analyzed.',
    observation: raw.observation || raw.summary || 'Dialogue analyzed.',
    evidence: Array.isArray(raw.evidence) ? raw.evidence : [raw.evidence].filter(Boolean),
    patterns: normalizedPatterns,
    connections: normalizedConnections,
    blindSpots: normalizedBlindSpots,
    blind_spots: normalizedBlindSpots,
    hiddenDrivers: normalizedDrivers,
    hidden_drivers: normalizedDrivers,
    internalConflicts: normalizedConflicts,
    internal_conflicts: normalizedConflicts,
    domains: normalizedDomains,
    reflectionQuestion: raw.reflectionQuestion || raw.reflection_question || 'What does this reveal to you?',
    reflection_question: raw.reflectionQuestion || raw.reflection_question || 'What does this reveal to you?',
    evolution: raw.evolution || 'Your pattern profiles calibrate in response.',
    experiment: raw.experiment || 'Commit to one small step without overthinking.',
    what_changed: raw.what_changed || raw.whatChanged || 'A shift is occurring as awareness develops.',
    what_stayed_the_same: raw.what_stayed_the_same || raw.whatStayedTheSame || 'The core concern remains consistent.'
  };

  return normalized;
};

const getDefaultAnalysisResponse = () => ({
  summary: 'Reflection compiled.',
  observation: 'Reflection compiled.',
  evidence: [],
  patterns: [],
  connections: [],
  blindSpots: [],
  blind_spots: [],
  hiddenDrivers: [],
  hidden_drivers: [],
  internalConflicts: [],
  internal_conflicts: [],
  domains: {
    Career: 0, Study: 0, Relationships: 0, Family: 0, Health: 0,
    Finance: 0, Identity: 0, Purpose: 0, 'Social Life': 0, 'Decision Making': 0
  },
  reflectionQuestion: 'What does this reveal to you?',
  reflection_question: 'What does this reveal to you?',
  evolution: 'Your pattern profiles calibrate in response.',
  experiment: 'Commit to one small step without overthinking.',
  what_changed: 'A shift is occurring as awareness develops.',
  what_stayed_the_same: 'The core concern remains consistent.'
});

// Initial Seeds to write to local storage when sandbox starts
const getInitialLocalStorageSeeds = () => {
  const now = new Date();
  const dateOffset = (days) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return d.toISOString();
  };

  return {
    conversations: [
      {
        id: 'conv-1',
        message: 'I keep postponing important work because I feel it won\'t be perfect.',
        response: normalizeAnalysisResponse({
          summary: 'Perfectionistic avoidance patterns triggered by evaluation anxiety.',
          patterns: [
            { name: 'Fear of Failure', category: 'Cognitive', strength: 82, confidence: 91, evidence: 'I keep postponing important work because I feel it won\'t be perfect.' },
            { name: 'Perfectionism', category: 'Behavioral', strength: 85, confidence: 89, evidence: 'I feel it won\'t be perfect.' },
            { name: 'Avoidance', category: 'Decision-making', strength: 78, confidence: 85, evidence: 'I keep postponing important work.' }
          ],
          connections: [
            { source: 'Fear of Failure', target: 'Perfectionism', weight: 85 },
            { source: 'Perfectionism', target: 'Avoidance', weight: 78 }
          ],
          blind_spots: [{ contradiction: 'Confusing preparing with performing', revealed_truth: 'Preparing feels safe, but delaying keeps you stuck.' }],
          hidden_drivers: [{ root_driver: 'Fear of Evaluation', creates: ['Perfectionism', 'Avoidance'] }],
          internal_conflicts: [{ part_a: 'Wants growth/progress', part_b: 'Wants safety/certainty', tension: 'Growth requires risk, which directly threatens safety.' }],
          domains: { Career: 85, Study: 60 },
          reflection_question: 'What is the cost of delaying this task compared to the discomfort of creating an imperfect first draft?'
        }),
        created_at: dateOffset(5)
      }
    ],
    patterns: [
      {
        id: 'pat-1',
        name: 'Fear of Failure',
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
        contexts: { Career: 4, Study: 2 },
        relatedPatterns: ['Perfectionism', 'Avoidance'],
        evidenceHistory: [{ date: dateOffset(5), quote: 'I keep postponing important work because I feel it won\'t be perfect.', domain: 'Career' }],
        confidenceHistory: [{ date: dateOffset(5), confidence: 91 }],
        strengthHistory: [{ date: dateOffset(10), score: 75 }, { date: dateOffset(5), score: 82 }],
        milestones: ['First observed in Career context']
      },
      {
        id: 'pat-2',
        name: 'Avoidance',
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
        contexts: { Career: 3 },
        relatedPatterns: ['Perfectionism', 'Fear of Failure'],
        evidenceHistory: [{ date: dateOffset(5), quote: 'I keep postponing important work.', domain: 'Career' }],
        confidenceHistory: [{ date: dateOffset(5), confidence: 85 }],
        strengthHistory: [{ date: dateOffset(10), score: 72 }, { date: dateOffset(5), score: 78 }],
        milestones: ['Linked with Perfectionism']
      },
      {
        id: 'pat-3',
        name: 'Perfectionism',
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
        contexts: { Career: 5, Study: 2 },
        relatedPatterns: ['Fear of Failure', 'Avoidance'],
        evidenceHistory: [{ date: dateOffset(5), quote: 'I feel it won\'t be perfect.', domain: 'Career' }],
        confidenceHistory: [{ date: dateOffset(5), confidence: 89 }],
        strengthHistory: [{ date: dateOffset(10), score: 78 }, { date: dateOffset(5), score: 85 }],
        milestones: ['High intensity detected in career tasks']
      },
      {
        id: 'pat-4',
        name: 'Overthinking Loops',
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
        contexts: { 'Decision Making': 2 },
        relatedPatterns: ['Self Criticism'],
        evidenceHistory: [{ date: dateOffset(3), quote: 'I keep analyzing this scenario.', domain: 'Decision Making' }],
        confidenceHistory: [{ date: dateOffset(3), confidence: 90 }],
        strengthHistory: [{ date: dateOffset(3), score: 84 }],
        milestones: ['Identified during reflection loops']
      }
    ],
    connections: [
      { source: 'Fear of Failure', target: 'Perfectionism', weight: 85 },
      { source: 'Perfectionism', target: 'Avoidance', weight: 78 }
    ],
    dna: [
      { dimension: 'Self Trust', score: 45, trend: 'stable', confidence: 80, history: [{ date: dateOffset(15), score: 48 }, { date: dateOffset(10), score: 46 }, { date: dateOffset(0), score: 45 }] },
      { dimension: 'Confidence', score: 38, trend: 'stable', confidence: 85, history: [{ date: dateOffset(15), score: 35 }, { date: dateOffset(10), score: 36 }, { date: dateOffset(0), score: 38 }] },
      { dimension: 'Avoidance', score: 78, trend: 'rising', confidence: 90, history: [{ date: dateOffset(15), score: 70 }, { date: dateOffset(10), score: 74 }, { date: dateOffset(0), score: 78 }] },
      { dimension: 'Perfectionism', score: 85, trend: 'rising', confidence: 92, history: [{ date: dateOffset(15), score: 80 }, { date: dateOffset(10), score: 82 }, { date: dateOffset(0), score: 85 }] },
      { dimension: 'People Pleasing', score: 50, trend: 'stable', confidence: 50, history: [{ date: dateOffset(15), score: 50 }, { date: dateOffset(0), score: 50 }] },
      { dimension: 'Emotional Independence', score: 50, trend: 'stable', confidence: 50, history: [{ date: dateOffset(15), score: 50 }, { date: dateOffset(0), score: 50 }] },
      { dimension: 'Boundary Strength', score: 40, trend: 'falling', confidence: 75, history: [{ date: dateOffset(15), score: 45 }, { date: dateOffset(10), score: 42 }, { date: dateOffset(0), score: 40 }] },
      { dimension: 'Decision Confidence', score: 42, trend: 'falling', confidence: 80, history: [{ date: dateOffset(15), score: 48 }, { date: dateOffset(10), score: 45 }, { date: dateOffset(0), score: 42 }] },
      { dimension: 'Self Criticism', score: 88, trend: 'rising', confidence: 91, history: [{ date: dateOffset(15), score: 82 }, { date: dateOffset(10), score: 85 }, { date: dateOffset(0), score: 88 }] },
      { dimension: 'Overthinking', score: 84, trend: 'rising', confidence: 90, history: [{ date: dateOffset(15), score: 76 }, { date: dateOffset(10), score: 80 }, { date: dateOffset(0), score: 84 }] }
    ],
    timeline: [
      { id: 'tl-1', type: 'pattern_discovered', title: 'Self Criticism Identified', description: 'Pattern "Self Criticism" detected with score 89% and confidence 92%.', created_at: dateOffset(10) },
      { id: 'tl-2', type: 'dna_evolved', title: 'Avoidance DNA Heightened', description: 'Your Avoidance score rose to 78% due to active patterns of over-preparation.', created_at: dateOffset(7) },
      { id: 'tl-3', type: 'connection_formed', title: 'Perfectionism-Avoidance Bridge', description: 'A strong behavioral connection (78%) formed between Perfectionism and Avoidance.', created_at: dateOffset(5) },
      { id: 'tl-4', type: 'insight_generated', title: 'Insight Generated: Fear of Evaluation', description: 'A deep psychological insight was uncovered based on career avoidance behaviors.', created_at: dateOffset(3) },
      { id: 'tl-5', type: 'milestone', title: 'Self-Awareness Mirror Initialized', description: 'Successfully configured Human OS core profiling. Evolving Psychological DNA.', created_at: dateOffset(0) }
    ],
    blind_spots: [
      {
        id: 'bs-1',
        contradiction: 'Believing that incomplete work is safe from judgment',
        revealed_truth: 'Postponing completion is a shield to defer evaluation, not laziness.',
        revealedTruth: 'Postponing completion is a shield to defer evaluation, not laziness.',
        confidence: 88,
        created_at: dateOffset(5)
      }
    ],
    internal_conflicts: [
      {
        id: 'ic-1',
        part_a: 'Wants Growth & Autonomy',
        partA: 'Wants Growth & Autonomy',
        part_b: 'Wants Safety & Certainty',
        partB: 'Wants Safety & Certainty',
        tension: 'Growth requires exposing work to judgment, which threatens safety.',
        created_at: dateOffset(5)
      }
    ],
    root_drivers: [
      {
        id: 'rd-1',
        root_driver: 'Fear of Evaluation',
        rootDriver: 'Fear of Evaluation',
        creates: ['Perfectionism', 'Avoidance', 'Overthinking Loops', 'Self Criticism'],
        createsPatterns: ['Perfectionism', 'Avoidance', 'Overthinking Loops', 'Self Criticism'],
        created_at: dateOffset(5)
      }
    ],
    narratives: [
      {
        id: 'nar-1',
        title: 'Phase 1: Initial Discovery',
        content: 'Your self-awareness mirror initialized. Early reflections show perfectionistic avoidance and people-pleasing loops. You are beginning to map the boundaries of your inner world.',
        phase: 'Month 1',
        created_at: dateOffset(20)
      },
      {
        id: 'nar-2',
        title: 'Phase 2: Emerging Awareness',
        content: 'You began identifying the Perfectionism-Avoidance bridge, noting how high standards are erected as shields against evaluation. Insights regarding career standard shields are surfacing.',
        phase: 'Month 2',
        created_at: dateOffset(10)
      }
    ],
    long_term_memory: {
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
  };
};

const initLocalStorage = () => {
  if (typeof window === 'undefined') return;
  const keys = ['conversations', 'patterns', 'connections', 'dna', 'timeline', 'blind_spots', 'internal_conflicts', 'root_drivers', 'narratives', 'long_term_memory'];
  const seeds = getInitialLocalStorageSeeds();

  keys.forEach(key => {
    if (!localStorage.getItem(`human_os_${key}`)) {
      localStorage.setItem(`human_os_${key}`, JSON.stringify(seeds[key]));
    }
  });
};

const getLocalData = (key) => {
  if (typeof window === 'undefined') return key === 'long_term_memory' ? {} : [];
  initLocalStorage();
  try {
    const val = localStorage.getItem(`human_os_${key}`);
    if (!val) return key === 'long_term_memory' ? {} : [];
    let parsed = JSON.parse(val);
    if (key === 'timeline' && Array.isArray(parsed)) {
      parsed = Array.from(new Map(parsed.map(item => [item.id, item])).values());
    }
    return parsed;
  } catch {
    return key === 'long_term_memory' ? {} : [];
  }
};

const saveLocalData = (key, data) => {
  if (typeof window === 'undefined') return;
  let finalData = data;
  if (key === 'timeline' && Array.isArray(data)) {
    finalData = Array.from(new Map(data.map(item => [item.id, item])).values());
  }
  localStorage.setItem(`human_os_${key}`, JSON.stringify(finalData));
};

// Simulated Local Pattern Engine inside client browser (fully aligned to Llama V2 output)
function calculateCosineSimilarity(str1, str2) {
  const normalize = (text) => String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words1 = normalize(str1).split(' ').filter(Boolean);
  const words2 = normalize(str2).split(' ').filter(Boolean);
  if (words1.length === 0 || words2.length === 0) return 0;

  const freq1 = {};
  const freq2 = {};
  const allWords = new Set();

  for (const w of words1) {
    freq1[w] = (freq1[w] || 0) + 1;
    allWords.add(w);
  }
  for (const w of words2) {
    freq2[w] = (freq2[w] || 0) + 1;
    allWords.add(w);
  }

  let dotProduct = 0;
  let sumSq1 = 0;
  let sumSq2 = 0;

  for (const w of allWords) {
    const v1 = freq1[w] || 0;
    const v2 = freq2[w] || 0;
    dotProduct += v1 * v2;
    sumSq1 += v1 * v1;
    sumSq2 += v2 * v2;
  }

  return dotProduct / (Math.sqrt(sumSq1) * Math.sqrt(sumSq2));
}

const SANDBOX_TEMPLATES = {
  career: [
    {
      notices: `What stands out in this career context is not a lack of motivation. You seem ready to move forward, but the hesitation appears when action becomes visible. That echoes the earlier perfectionism-avoidance memory Human OS has been carrying: preparation feels safe because finishing makes the work available for judgment.\n\nThe meaning is that certainty has become a condition for action. Compared with earlier reflections, you are naming the shield more clearly instead of only living inside it. If this continues, the future direction is not endless hesitation; it is learning to act while confidence is still incomplete.`,
      evolution: 'The recurring theme is shifting from simple postponement toward awareness that preparation is being used as protection.',
      conflict: {
        category: 'Growth vs Safety',
        want: 'To complete the task and grow professionally.',
        fear: 'Exposing completed work to critique and judgment.',
        tension: 'Growth requires putting work out there, but certainty demands keeping it hidden.'
      },
      blindSpot: {
        type: 'Hidden Assumption',
        contradiction: 'Believing that exhaustive preparation is active work',
        revealed_truth: 'Using research as an emotional shield to defer active vulnerability and potential judgment.',
        core_assumption: 'You are treating preparation as proof of readiness. The assumption underneath is that more preparation will remove uncertainty.'
      },
      what_changed: 'You are beginning to name your perfectionism rather than accepting it as an absolute necessity.',
      what_stayed_the_same: 'The habit of researching for hours to avoid the vulnerability of starting remains a core shield.',
      question: 'What would it mean for your identity if you completed this task and the outcome was merely average?',
      experiment: 'Commit to writing a raw, imperfect first draft for 20 minutes without looking at any research slides.'
    },
    {
      notices: `The standard you erect is not a measure of quality; it functions as a buffer against exposure. I notice a pattern where completing a task feels like stepping into a space of potential judgment. To manage this discomfort, you prolong the preparation phase, convincing yourself that more research is necessary.\n\nThe meaning is that high standards are being deployed defensively. By demanding absolute accuracy before committing to a draft, you ensure that you are never fully exposed to critique. The underlying tension remains: you want growth, but safety demands perfect guarantees.`,
      evolution: 'Perfectionism remains a shield, but you are becoming aware of how standard-setting serves as a postponement strategy.',
      conflict: {
        category: 'Action vs Certainty',
        want: 'To share your work and express yourself.',
        fear: 'Receiving negative feedback or failing to meet standards.',
        tension: 'Sharing work requires accepting the risk of evaluation, which certainty cannot tolerate.'
      },
      blindSpot: {
        type: 'Protective Strategy',
        contradiction: 'Equating performance outcome with personal worth',
        revealed_truth: 'Constructing rigid standards so that no output is ever fully ready for critique.',
        core_assumption: 'Underneath lies the assumption that if the work is perfect, it will be immune to judgment.'
      },
      what_changed: 'You are registering that over-preparation is a shield rather than a requirement.',
      what_stayed_the_same: 'You still delay sharing work early to protect yourself from external evaluation.',
      question: 'How does demand for perfection serve to keep you safe from criticism?',
      experiment: 'Share a half-finished slide or outline with a colleague to gather feedback early.'
    },
    {
      notices: `The current reflection highlights a familiar cycle where standard-setting serves as a postponement strategy. You are eager to make progress, yet you find yourself caught in an exhaustive cycle of refining details before committing to a decision.\n\nThis standard is not driving excellence; it is negotiating with the fear of being evaluated. You are protecting yourself by remaining in a state of perpetual preparation. The future direction is not finding the perfect answer, but training yourself to start without it.`,
      evolution: 'The standard shield remains active, but the timing between thought and recognition is narrowing.',
      conflict: {
        category: 'Growth vs Safety',
        want: 'To take action on career goals.',
        fear: 'Exposing incomplete capabilities to peers.',
        tension: 'Action forces you to step into the unknown, which safety resists.'
      },
      blindSpot: {
        type: 'Mental Loop',
        contradiction: 'Assuming that more information will reduce the risk of failure',
        revealed_truth: 'Accumulating details to create a false sense of security while delaying execution.',
        core_assumption: 'The core assumption is that a flawless defense can prevent any possible negative evaluation.'
      },
      what_changed: 'You are noticing that preparation has diminishing returns for anxiety control.',
      what_stayed_the_same: 'The instinct to delay starting until everything is aligned remains dominant.',
      question: 'If you knew the draft would be criticized anyway, what would change about your speed of work?',
      experiment: 'Submit an email draft or proposal within 5 minutes of writing it, with no final edits.'
    }
  ],
  relationships: [
    {
      notices: `In this relationship context, your attention moved toward preserving the other person's comfort before checking your own capacity. Human OS remembers this as part of a recurring approval-versus-authenticity tension: the immediate peace feels useful, but the cost returns later as resentment or self-criticism.\n\nThe meaning is that compliance is trying to protect connection. Compared with earlier reflections, you are now noticing the cost more directly. If that noticing continues, the next growth direction is a slower yes, not a harsher no.`,
      evolution: 'The conflict is becoming more conscious: approval still matters, but the cost of silence is easier to see.',
      conflict: {
        category: 'Authenticity vs Approval',
        want: 'To declare your real capacity and establish firm boundaries.',
        fear: 'Experiencing relational friction or causing disapproval.',
        tension: 'Setting boundaries feels like risking connection, while staying silent sacrifices your self-trust.'
      },
      blindSpot: {
        type: 'Internal Contradiction',
        contradiction: 'Assuming others will limit their demands if you never communicate boundaries',
        revealed_truth: 'By saying yes to protect their comfort, you teach them that your capacity has no limits.',
        core_assumption: 'Underneath is the assumption that others will automatically guess your limits if you smile and keep working.'
      },
      what_changed: 'You are registering the internal cost (resentment) of constant compliance instead of hiding it.',
      what_stayed_the_same: 'Your immediate reaction to relational tension is still to pacify and say yes.',
      question: 'Who are you protecting when you say yes to a demand you cannot sustainably fulfill?',
      experiment: 'Next time someone asks for a favor, delay your response by 10 minutes to check your real capacity.'
    },
    {
      notices: `I notice a default setting where preserving harmony takes precedence over expressing your true limits. You choose compliance to regulate the immediate anxiety of relational friction. However, this immediate relief creates a secondary deficit: your own voice is excluded from the conversation.\n\nThe meaning is that boundary preservation is being traded for short-term tranquility. The nervous system acts as if a difference of opinion is a threat to belonging. If you continue down this path, the connection itself becomes fragile because it is built on compliance rather than truth.`,
      evolution: 'Compliance is stable, but your tolerance for the resulting emotional exhaustion is decreasing.',
      conflict: {
        category: 'Authenticity vs Approval',
        want: 'To speak honestly without accommodating.',
        fear: 'Causing relational discord or feeling rejected.',
        tension: 'Stating your limits requires confronting the possibility of disapproval.'
      },
      blindSpot: {
        type: 'Emotional Avoidance',
        contradiction: 'Believing that asserting boundaries will automatically cause abandonment',
        revealed_truth: 'Compliance is keeping the relationship calm at the expense of your own authentic voice.',
        core_assumption: 'Underneath lies the assumption that you are only valued for what you can perform or accommodate.'
      },
      what_changed: 'You are expressing a desire to state your limits rather than managing others\' expectations.',
      what_stayed_the_same: 'Compliance remains your default response style to prevent immediate friction.',
      question: 'What is the specific risk you are avoiding when you choose compliance over authenticity?',
      experiment: 'Say "I need to check my schedule first" to the next low-stakes favor request.'
    },
    {
      notices: `Your reflection reveals a habit of accommodating external demands before validating your own capacity. The nervous system treats boundaries as a threat to belonging, so you say yes to maintain safety. This keeps the relationship calm in the short term, but it builds a quiet reservoir of resentment.\n\nYou are pacifying others while neglecting your own authentic space. Connection requires two whole people; if one is constantly compliance-fitting, the relationship loses depth.`,
      evolution: 'The people-pleasing loop is showing signs of instability as your resentment becomes harder to ignore.',
      conflict: {
        category: 'Independence vs Validation',
        want: 'To stand firm in your own decisions.',
        fear: 'Feeling disconnected or being perceived as unhelpful.',
        tension: 'Honoring your capacity means letting others sit with temporary disappointment.'
      },
      blindSpot: {
        type: 'Protective Strategy',
        contradiction: 'Believing that self-sacrifice is proof of care',
        revealed_truth: 'Accommodating to avoid the discomfort of stating boundaries.',
        core_assumption: 'The core assumption is that expressing a boundary will damage the relationship permanently.'
      },
      what_changed: 'You are noticing the connection between boundary silence and subsequent self-criticism.',
      what_stayed_the_same: 'The reflex to apologize when stating a preference remains intact.',
      question: 'If you were allowed to disappoint others occasionally, what boundaries would you set today?',
      experiment: 'Politely decline one minor request by saying: "I don\'t have the capacity for that this week."'
    }
  ],
  default: [
    {
      notices: `In this decision context, the recurring theme is not hesitation itself. Human OS remembers this loop as waiting for confidence to arrive before commitment. Thinking keeps the choice open, which temporarily protects you from being wrong.\n\nThe meaning is that uncertainty is being treated as something that must disappear before action begins. Compared with earlier reflections, you are closer to recognizing the loop while it is happening. If this continues, the future direction is not perfect certainty; it is a small action that proves uncertainty can be survived.`,
      evolution: 'The loop is still active, but awareness is moving closer to the moment where action usually stalls.',
      conflict: {
        category: 'Action vs Certainty',
        want: 'To make a choice and move forward.',
        fear: 'Stepping into the unknown or making the wrong choice.',
        tension: 'Action forces you to step into the unknown, which certainty cannot tolerate.'
      },
      blindSpot: {
        type: 'Mental Loop',
        contradiction: 'Believing that if you think about a problem long enough, you can guarantee a risk-free choice',
        revealed_truth: 'Overthinking is not solving the issue; it is a mechanism to delay the vulnerability of making a choice.',
        core_assumption: 'Underneath lies the assumption that the mind can predict and resolve all potential risks before they happen.'
      },
      what_changed: 'You are recognizing that over-analysis is a delay mechanism rather than an active solution.',
      what_stayed_the_same: 'You are still treating thinking as a safe substitute for choosing.',
      question: 'What direct action are you avoiding by continuing to analyze this scenario?',
      experiment: 'Set a timer for 5 minutes, make a low-stakes decision, and act on it immediately without review.'
    },
    {
      notices: `I notice an analytical loop where your mind attempts to resolve all potential risks before choosing a path. This over-analysis acts as a cognitive shield: as long as you are processing options, you don't have to face the vulnerability of a final decision.\n\nThe meaning is that thinking is serving as a delay mechanism. The mind is trying to guarantee safety, but thinking cannot replace the feedback of direct action. The future direction is choosing a path and discovering the outcome through experience rather than simulation.`,
      evolution: 'The cognitive loop is steady, but your level of comfort with open-ended decisions is slightly improving.',
      conflict: {
        category: 'Action vs Certainty',
        want: 'To move out of contemplation.',
        fear: 'Making an incorrect decision and suffering regret.',
        tension: 'Movement requires choosing one option and sacrificing the safety of the unchosen ones.'
      },
      blindSpot: {
        type: 'Hidden Assumption',
        contradiction: 'Believing that more thinking equals better decision capability',
        revealed_truth: 'Using intellectual analysis to postpone the finality of a real commitment.',
        core_assumption: 'The core assumption is that perfect analysis can eliminate the possibility of negative outcomes.'
      },
      what_changed: 'You are observing your overthinking cycles with a degree of objective distance.',
      what_stayed_the_same: 'You still require substantial reassurance before final choices.',
      question: 'What would happen if you trusted your first choice for 24 hours without questioning it?',
      experiment: 'Choose a lunch location or meeting time within 10 seconds and do not change it.'
    },
    {
      notices: `The current pattern shows a high reliance on cognitive reassurance. You are waiting for uncertainty to disappear before you move forward. By keeping the decision in a state of constant review, you protect yourself from the discomfort of making a mistake.\n\nThis loop keeps you intellectually active but behaviorally stationary. Understanding is valuable, but at this point, additional analysis is only reinforcing the gridlock. The only way to resolve the tension is to move before you feel fully ready.`,
      evolution: 'The overthinking pattern is stable, but there is an emerging fatigue with the loop itself.',
      conflict: {
        category: 'Action vs Certainty',
        want: 'To break the gridlock and take a stance.',
        fear: 'Committing to a direction without absolute safety.',
        tension: 'Making a choice requires letting go of alternative scenarios.'
      },
      blindSpot: {
        type: 'Protective Strategy',
        contradiction: 'Assuming that postponing a choice has no cost',
        revealed_truth: 'By refusing to choose, you are choosing to remain in a state of chronic cognitive tension.',
        core_assumption: 'The core assumption is that stagnation is safer than an imperfect action.'
      },
      what_changed: 'You are noticing the mental fatigue that results from keeping multiple options open.',
      what_stayed_the_same: 'The search for one extra piece of validation before choosing remains active.',
      question: 'What would you choose right now if you were not allowed to explain your reasoning to anyone?',
      experiment: 'Flip a coin for a minor choice today, and commit to the coin\'s decision.'
    }
  ]
};

// Simulated Local Pattern Engine inside client browser (fully aligned to Llama V2 output)
const simulateOfflineAnalysis = (message, priorObservations = []) => {
  const lowercaseInput = message.toLowerCase();
  let categoryKey = 'default';

  if (lowercaseInput.includes('fail') || lowercaseInput.includes('presentation') || lowercaseInput.includes('test') || lowercaseInput.includes('mistake') || lowercaseInput.includes('perfect') || lowercaseInput.includes('postpone')) {
    categoryKey = 'career';
  } else if (lowercaseInput.includes('boss') || lowercaseInput.includes('say yes') || lowercaseInput.includes(' boundary') || lowercaseInput.includes('pleas') || lowercaseInput.includes('conflict') || lowercaseInput.includes('angry') || lowercaseInput.includes('smile')) {
    categoryKey = 'relationships';
  }

  const templates = SANDBOX_TEMPLATES[categoryKey];
  let bestTemplate = templates[0];
  let lowestMaxSimilarity = 1.0;

  if (priorObservations.length === 0) {
    bestTemplate = templates[Math.floor(Math.random() * templates.length)];
  } else {
    for (const t of templates) {
      const templateText = `${t.notices} ${t.evolution} ${t.conflict.tension}`;
      let maxSim = 0;
      for (const prior of priorObservations) {
        const sim = calculateCosineSimilarity(templateText, prior);
        if (sim > maxSim) maxSim = sim;
      }
      if (maxSim < lowestMaxSimilarity) {
        lowestMaxSimilarity = maxSim;
        bestTemplate = t;
      }
    }
  }

  const patternsList = [];
  const connectionsList = [];
  const blindSpots = [];
  const hiddenDrivers = [];
  const internalConflicts = [];
  const domains = {
    Career: 0, Study: 0, Relationships: 0, Family: 0, Health: 0,
    Finance: 0, Identity: 0, Purpose: 0, 'Social Life': 0, 'Decision Making': 0
  };

  const getSentenceWith = (keywords) => {
    const sentence = message.split(/[.!?]/).find(s => 
      keywords.some(k => s.toLowerCase().includes(k))
    );
    return sentence ? sentence.trim() : message.slice(0, 100).trim();
  };

  if (categoryKey === 'career') {
    const failEvidence = getSentenceWith(['fail', 'afraid', 'postpone', 'wrong']);
    const perfectEvidence = getSentenceWith(['perfect', 'slide', 'presentation', 'research']);

    patternsList.push({
      name: 'Fear of Failure',
      category: 'Cognitive',
      strength: 82,
      confidence: 91,
      evidence: failEvidence || 'I am afraid I will do it wrong.'
    });

    patternsList.push({
      name: 'Perfectionism',
      category: 'Behavioral',
      strength: 85,
      confidence: 89,
      evidence: perfectEvidence || 'I feel it won\'t be perfect.'
    });

    hiddenDrivers.push({
      root_driver: 'Fear of Evaluation',
      creates: ['Perfectionism', 'Avoidance', 'Fear of Failure']
    });

    domains.Career = 85;
    domains.Study = 70;

    if (lowercaseInput.includes('delay') || lowercaseInput.includes('research') || lowercaseInput.includes('avoid') || lowercaseInput.includes('postpone') || lowercaseInput.includes('procrastinate')) {
      const avoidEvidence = getSentenceWith(['delay', 'postpone', 'avoid', 'procrastinate']);
      patternsList.push({
        name: 'Avoidance',
        category: 'Decision-making',
        strength: 78,
        confidence: 85,
        evidence: avoidEvidence || 'I keep postponing important work.'
      });

      connectionsList.push({ source: 'Fear of Failure', target: 'Perfectionism', weight: 88 });
      connectionsList.push({ source: 'Perfectionism', target: 'Avoidance', weight: 82 });
    } else {
      connectionsList.push({ source: 'Fear of Failure', target: 'Perfectionism', weight: 80 });
    }
  } else if (categoryKey === 'relationships') {
    const pleasEvidence = getSentenceWith(['yes', 'pleas', 'smile', 'boss']);
    const conflictEvidence = getSentenceWith(['conflict', 'angry', 'resent', 'argument']);

    patternsList.push({
      name: 'People Pleasing',
      category: 'Behavioral',
      strength: 78,
      confidence: 90,
      evidence: pleasEvidence || 'I smiled and said yes immediately.'
    });

    patternsList.push({
      name: 'Conflict Avoidance',
      category: 'Decision-making',
      strength: 82,
      confidence: 86,
      evidence: conflictEvidence || 'I avoid telling them how I really feel.'
    });

    hiddenDrivers.push({
      root_driver: 'Fear of Rejection',
      creates: ['People Pleasing', 'Conflict Avoidance']
    });

    domains.Relationships = 80;
    domains.Career = 65;

    connectionsList.push({ source: 'People Pleasing', target: 'Conflict Avoidance', weight: 85 });

    if (lowercaseInput.includes('exhausted') || lowercaseInput.includes('resent') || lowercaseInput.includes('tired')) {
      patternsList.push({
        name: 'Self Criticism',
        category: 'Emotional',
        strength: 84,
        confidence: 80,
        evidence: getSentenceWith(['exhausted', 'resent', 'tired']) || 'Now I feel exhausted and resentful.'
      });
    }
  } else {
    const thinkEvidence = getSentenceWith(['think', 'loop', 'stuck', 'worry']);
    patternsList.push({
      name: 'Overthinking Loops',
      category: 'Cognitive',
      strength: 86,
      confidence: 90,
      evidence: thinkEvidence || 'I keep analyzing this scenario over and over.'
    });

    hiddenDrivers.push({
      root_driver: 'Need for Certainty',
      creates: ['Overthinking Loops']
    });

    domains['Decision Making'] = 90;
    domains.Identity = 60;

    if (lowercaseInput.includes('fail') || lowercaseInput.includes('worst')) {
      patternsList.push({
        name: 'Catastrophic Thinking',
        category: 'Cognitive',
        strength: 80,
        confidence: 85,
        evidence: getSentenceWith(['fail', 'worst', 'happen']) || 'I keep imagining the worst outcome.'
      });
      connectionsList.push({ source: 'Overthinking Loops', target: 'Catastrophic Thinking', weight: 75 });
    }
  }

  blindSpots.push({
    contradiction: bestTemplate.blindSpot.contradiction,
    revealed_truth: bestTemplate.blindSpot.revealed_truth || bestTemplate.blindSpot.revealedTruth,
    revealedTruth: bestTemplate.blindSpot.revealed_truth || bestTemplate.blindSpot.revealedTruth
  });

  internalConflicts.push({
    part_a: bestTemplate.conflict.want,
    partA: bestTemplate.conflict.want,
    part_b: bestTemplate.conflict.fear,
    partB: bestTemplate.conflict.fear,
    tension: bestTemplate.conflict.tension
  });

  return normalizeAnalysisResponse({
    summary: bestTemplate.conflict.category || 'Introspective profile compiled.',
    observation: bestTemplate.notices,
    patterns: patternsList,
    connections: connectionsList,
    blind_spots: blindSpots,
    hidden_drivers: hiddenDrivers,
    internal_conflicts: internalConflicts,
    domains: domains,
    reflection_question: bestTemplate.question,
    evolution: bestTemplate.evolution,
    experiment: bestTemplate.experiment,
    what_changed: bestTemplate.what_changed,
    what_stayed_the_same: bestTemplate.what_stayed_the_same
  });
};

// Process dynamic local storage state updates offline (simulating memory system V2)
const processOfflineMemory = (analysis) => {
  if (typeof window === 'undefined') return;
  const isoStr = new Date().toISOString();
  const nowStr = isoStr;

  // Find max domain
  let maxDomain = 'General';
  let maxWeight = 0;
  if (analysis.domains) {
    Object.keys(analysis.domains).forEach(d => {
      if (analysis.domains[d] > maxWeight) {
        maxWeight = analysis.domains[d];
        maxDomain = d;
      }
    });
  }

  // 1. Update Patterns (EMA and history updates)
  const localPatterns = getLocalData('patterns');
  analysis.patterns.forEach(p => {
    const idx = localPatterns.findIndex(lp => lp.name === p.name);
    const occurrences = (idx !== -1 ? (localPatterns[idx].occurrences || 1) : 0) + 1;
    const firstSeen = idx !== -1 ? (localPatterns[idx].firstSeen || nowStr) : nowStr;

    const oldScore = idx !== -1 ? (localPatterns[idx].score || localPatterns[idx].strength || p.strength) : p.strength;
    const oldConf = idx !== -1 ? (localPatterns[idx].confidence || p.confidence) : p.confidence;

    const finalStrength = Math.round((oldScore * 0.4) + (p.strength * 0.6));
    const finalConfidence = Math.round((oldConf * 0.5) + (p.confidence * 0.5));

    const averageStrength = Math.round(((idx !== -1 ? (localPatterns[idx].averageStrength || p.strength) : p.strength) * (occurrences - 1) + p.strength) / occurrences);
    const highestStrength = Math.max(idx !== -1 ? (localPatterns[idx].highestStrength || p.strength) : p.strength, p.strength);
    const lowestStrength = Math.min(idx !== -1 ? (localPatterns[idx].lowestStrength || p.strength) : p.strength, p.strength);

    const strengthHistory = idx !== -1 ? (localPatterns[idx].strengthHistory || []) : [];
    strengthHistory.push({ date: nowStr, score: p.strength });

    const confidenceHistory = idx !== -1 ? (localPatterns[idx].confidenceHistory || []) : [];
    confidenceHistory.push({ date: nowStr, confidence: p.confidence });

    const evidenceHistory = idx !== -1 ? (localPatterns[idx].evidenceHistory || []) : [];
    evidenceHistory.push({ date: nowStr, quote: p.evidence, domain: maxDomain });

    const contexts = idx !== -1 ? (localPatterns[idx].contextsMap || {}) : {};
    contexts[maxDomain] = (contexts[maxDomain] || 0) + 1;

    const relatedSet = new Set(idx !== -1 ? (localPatterns[idx].relatedPatterns || []) : []);
    (analysis.connections || []).forEach(c => {
      if (c.source === p.name) relatedSet.add(c.target);
      if (c.target === p.name) relatedSet.add(c.source);
    });

    const milestones = idx !== -1 ? (localPatterns[idx].milestones || []) : [];
    if (occurrences === 1) {
      milestones.push(`First identified in ${maxDomain} contexts.`);
    }
    if (occurrences === 3) {
      milestones.push('Pattern observed repeatedly in reflections.');
    }

    // Calculate Trend & Velocity: New, Increasing, Stable, Weakening, Resolved, Re-emerging
    let trend = 'Stable';
    let trendVelocity = 0;
    if (occurrences === 1) {
      trend = 'New';
    } else if (strengthHistory.length >= 2) {
      const lastH = strengthHistory[strengthHistory.length - 1].score;
      const prevH = strengthHistory[strengthHistory.length - 2].score;
      trendVelocity = lastH - prevH;

      const wasResolved = idx !== -1 && localPatterns[idx].trend === 'Resolved';

      if (lastH < 25) {
        trend = 'Resolved';
      } else if (wasResolved && lastH >= 40) {
        trend = 'Re-emerging';
      } else if (lastH > prevH + 3) {
        trend = 'Increasing';
      } else if (lastH < prevH - 3) {
        trend = 'Weakening';
      } else {
        trend = 'Stable';
      }
    }

    // V4 dynamic evolution story text
    let evolutionStory = '';
    if (occurrences === 1) {
      evolutionStory = `This pattern was newly identified in your reflections, centered in ${maxDomain}.`;
    } else {
      const vel = trendVelocity;
      if (trend === 'Increasing') {
        evolutionStory = `This pattern has strengthened recently (intensity shifted by ${vel > 0 ? '+' : ''}${vel}%). It is becoming a more dominant coping style.`;
      } else if (trend === 'Weakening') {
        evolutionStory = `This pattern has weakened since it was first seen. You are showing reduced attachment to this loop (shift of ${vel}%).`;
      } else if (trend === 'Resolved') {
        evolutionStory = `This pattern has resolved and represents a healthy boundary shift. It is currently in a dormant state.`;
      } else if (trend === 'Re-emerging') {
        evolutionStory = `This pattern has resurfaced after a period of dormancy, indicating returning triggers.`;
      } else {
        evolutionStory = `This pattern has remained stable at a strength of ${finalStrength}% across your last few reflections.`;
      }
    }

    const updatedPattern = {
      id: idx !== -1 ? localPatterns[idx].id : `pat-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      name: p.name,
      // V4 attributes
      firstSeen,
      lastSeen: nowStr,
      occurrences,
      confidence: finalConfidence,
      strength: finalStrength,
      trend,
      trendVelocity,
      contexts: Object.keys(contexts), // Array of strings
      contextsMap: contexts,
      relatedPatterns: Array.from(relatedSet),
      confidenceHistory,
      strengthHistory,
      reflectionReferences: idx !== -1 ? (localPatterns[idx].reflectionReferences || []) : [],
      evidenceHistory,
      milestones,
      evolutionStory,

      // Backward compatibility
      score: finalStrength,
      category: p.category,
      averageStrength,
      highestStrength,
      lowestStrength
    };

    if (idx !== -1) {
      localPatterns[idx] = updatedPattern;
    } else {
      localPatterns.push(updatedPattern);
      
      const localTimeline = getLocalData('timeline');
      localTimeline.unshift({
        id: `tl-pat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        type: 'pattern_discovered',
        title: `Pattern Identified: ${p.name}`,
        description: `A recurring fear of ${p.name.toLowerCase()} became more visible in your reflections.`,
        created_at: nowStr
      });
      saveLocalData('timeline', localTimeline);
    }
  });
  saveLocalData('patterns', localPatterns);

  // 2. Update Connections
  const localConnections = getLocalData('connections');
  analysis.connections.forEach(c => {
    const exists = localConnections.some(conn => conn.source === c.source && conn.target === c.target);
    if (!exists) {
      localConnections.push(c);
      
      const localTimeline = getLocalData('timeline');
      localTimeline.unshift({
        id: `tl-conn-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        type: 'connection_formed',
        title: `Behavioral Bridge Formed`,
        description: `Identified logical linkage between "${c.source}" and "${c.target}" (${c.weight}% co-occurrence).`,
        created_at: nowStr
      });
      saveLocalData('timeline', localTimeline);
    }
  });
  saveLocalData('connections', localConnections);

  // 3. Update DNA profile dimensions
  const localDNA = getLocalData('dna');
  const patternStrengthMap = {};
  analysis.patterns.forEach(p => {
    patternStrengthMap[p.name] = p.strength;
  });

  const getTargetScore = (dim) => {
    switch (dim) {
      case 'Avoidance': return patternStrengthMap['Avoidance'] || patternStrengthMap['Procrastination'] || 15;
      case 'Perfectionism': return patternStrengthMap['Perfectionism'] || 15;
      case 'People Pleasing': return patternStrengthMap['People Pleasing'] || 15;
      case 'Self Criticism': return patternStrengthMap['Self Criticism'] || 15;
      case 'Overthinking': return patternStrengthMap['Overthinking Loops'] || 15;
      case 'Confidence': return Math.max(15, 100 - Math.max(patternStrengthMap['Fear of Failure'] || 0, patternStrengthMap['Self Criticism'] || 0));
      case 'Self Trust': return Math.max(15, 100 - Math.max(patternStrengthMap['Self Criticism'] || 0, patternStrengthMap['Overthinking Loops'] || 0));
      case 'Boundary Strength': return Math.max(15, 100 - Math.max(patternStrengthMap['People Pleasing'] || 0, patternStrengthMap['Conflict Avoidance'] || 0));
      case 'Decision Confidence': return Math.max(15, 100 - Math.max(patternStrengthMap['Overthinking Loops'] || 0, patternStrengthMap['Avoidance'] || 0));
      case 'Emotional Independence': return Math.max(15, 100 - (patternStrengthMap['Validation Seeking'] || patternStrengthMap['Approval Addiction'] || 0));
      default: return 50;
    }
  };

  localDNA.forEach((item, idx) => {
    const oldScore = item.score || 50;
    const targetScore = getTargetScore(item.dimension);
    
    const isNegativeDim = ['Avoidance', 'Perfectionism', 'People Pleasing', 'Self Criticism', 'Overthinking'].includes(item.dimension);
    const hasRelatedPatterns = isNegativeDim ? targetScore > 15 : targetScore < 90;
    const weight = hasRelatedPatterns ? 0.6 : 0.15;
    
    const newScore = Math.max(15, Math.min(95, Math.round((oldScore * (1 - weight)) + (targetScore * weight))));
    
    localDNA[idx].score = newScore;
    localDNA[idx].trend = newScore > oldScore ? 'rising' : newScore < oldScore ? 'falling' : 'stable';
    localDNA[idx].confidence = Math.min(95, item.confidence + 4);
    
    if (!Array.isArray(localDNA[idx].history)) {
      localDNA[idx].history = [];
    }
    localDNA[idx].history.push({ date: nowStr, score: newScore });

    if (Math.abs(newScore - oldScore) >= 4) {
      const changeStr = newScore > oldScore ? 'Increased' : 'Decreased';
      const localTimeline = getLocalData('timeline');
      localTimeline.unshift({
        id: `tl-dna-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        type: 'dna_evolved',
        title: `${item.dimension} Shift Logged`,
        description: `Your ${item.dimension} profile index shifted from ${oldScore}% to ${newScore}% (${changeStr}).`,
        created_at: nowStr
      });
      saveLocalData('timeline', localTimeline);
    }
  });
  saveLocalData('dna', localDNA);

  // 4. Update Blind Spots, Conflicts, Root Drivers in local storage
  if (analysis.blind_spots && analysis.blind_spots.length > 0) {
    const localBS = getLocalData('blind_spots');
    analysis.blind_spots.forEach(bs => {
      localBS.unshift({
        id: `bs-${Date.now()}-${Math.floor(Math.random()*1000)}`,
        contradiction: bs.contradiction,
        revealed_truth: bs.revealed_truth || bs.revealedTruth,
        revealedTruth: bs.revealed_truth || bs.revealedTruth,
        created_at: isoStr
      });
      
      const localTimeline = getLocalData('timeline');
      localTimeline.unshift({
        id: `tl-bs-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        type: 'blind_spot_discovered',
        title: 'Major Blind Spot Discovered',
        description: `contradiction identified: "${bs.contradiction}" vs truth: "${bs.revealed_truth || bs.revealedTruth}"`,
        created_at: nowStr
      });
      saveLocalData('timeline', localTimeline);
    });
    saveLocalData('blind_spots', localBS);
  }

  if (analysis.internal_conflicts && analysis.internal_conflicts.length > 0) {
    const localConflicts = getLocalData('internal_conflicts');
    analysis.internal_conflicts.forEach(ic => {
      localConflicts.unshift({
        id: `ic-${Date.now()}-${Math.floor(Math.random()*1000)}`,
        part_a: ic.part_a || ic.partA,
        partA: ic.part_a || ic.partA,
        part_b: ic.part_b || ic.partB,
        partB: ic.part_b || ic.partB,
        tension: ic.tension,
        created_at: isoStr
      });
      
      const localTimeline = getLocalData('timeline');
      localTimeline.unshift({
        id: `tl-ic-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        type: 'conflict_discovered',
        title: 'Internal Conflict Logged',
        description: `Part A ("${ic.part_a || ic.partA}") vs Part B ("${ic.part_b || ic.partB}"): ${ic.tension}`,
        created_at: nowStr
      });
      saveLocalData('timeline', localTimeline);
    });
    saveLocalData('internal_conflicts', localConflicts);
  }

  if (analysis.hidden_drivers && analysis.hidden_drivers.length > 0) {
    const localDrivers = getLocalData('root_drivers');
    analysis.hidden_drivers.forEach(hd => {
      localDrivers.unshift({
        id: `rd-${Date.now()}-${Math.floor(Math.random()*1000)}`,
        root_driver: hd.root_driver || hd.rootDriver,
        rootDriver: hd.root_driver || hd.rootDriver,
        creates: hd.creates || hd.createsPatterns,
        createsPatterns: hd.creates || hd.createsPatterns,
        created_at: isoStr
      });
      
      const localTimeline = getLocalData('timeline');
      localTimeline.unshift({
        id: `tl-rd-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        type: 'root_driver_discovered',
        title: 'Root Driver Identified',
        description: `Underlying driver: ${hd.root_driver || hd.rootDriver}. It generates: ${(hd.creates || hd.createsPatterns).join(', ')}`,
        created_at: nowStr
      });
      saveLocalData('timeline', localTimeline);
    });
    saveLocalData('root_drivers', localDrivers);
  }

  // Monthly Narratives
  const localConvs = getLocalData('conversations');
  const localNarratives = getLocalData('narratives');
  if (localConvs.length === 3) {
    localNarratives.unshift({
      id: `nar-${Date.now()}`,
      title: 'Phase 3: Integration Begins',
      content: 'Patterns are surfacing in decision-making domains. You are beginning to observe conflict tensions and align your boundaries.',
      phase: 'Month 3',
      created_at: isoStr
    });
    saveLocalData('narratives', localNarratives);
    
    const localTimeline = getLocalData('timeline');
    localTimeline.unshift({
      id: `tl-nar-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      type: 'milestone',
      title: 'Story Phase 3 Initialized',
      description: 'Evolved narrative to Phase 3: Integration.',
      created_at: nowStr
    });
    saveLocalData('timeline', localTimeline);
  } else if (localConvs.length === 5) {
    localNarratives.unshift({
      id: `nar-${Date.now()}`,
      title: 'Phase 4: Evolution & Re-Calibration',
      content: 'The system reports stabilizing trends. Avoidance patterns are decaying as boundary strength registers incremental growth.',
      phase: 'Month 4',
      created_at: isoStr
    });
    saveLocalData('narratives', localNarratives);
    
    const localTimeline = getLocalData('timeline');
    localTimeline.unshift({
      id: `tl-nar-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      type: 'milestone',
      title: 'Story Phase 4 Initialized',
      description: 'Evolved narrative to Phase 4: Recalibration.',
      created_at: nowStr
    });
    saveLocalData('timeline', localTimeline);
  }

  // 4. Update Long Term Memory offline (V4 properties compilation)
  if (localConvs.length > 0) {
    const firstReflection = localConvs[0].message;
    
    let mostRecurringPattern = 'None';
    let maxOccurrences = 0;
    let patternBecomingWeaker = 'None';
    let emergingTheme = 'None';
    
    const contextCounts = {};
    
    localPatterns.forEach(p => {
      const occ = p.occurrences || 1;
      if (occ > maxOccurrences) {
        maxOccurrences = occ;
        mostRecurringPattern = p.name;
      }
      if (p.trend === 'Weakening' || p.trend === 'Decreasing' || p.trend === 'falling') {
        patternBecomingWeaker = p.name;
      }
      if (p.trend === 'New' || p.trend === 'Emerging' || p.trend === 'rising' || p.trend === 'Increasing') {
        emergingTheme = p.name;
      }
      if (p.contexts) {
        const ctxList = Array.isArray(p.contexts) ? p.contexts : Object.keys(p.contexts);
        ctxList.forEach(ctx => {
          contextCounts[ctx] = (contextCounts[ctx] || 0) + 1;
        });
      }
    });

    let mostCommonContext = 'General';
    let maxContextCount = 0;
    Object.keys(contextCounts).forEach(ctx => {
      if (contextCounts[ctx] > maxContextCount) {
        maxContextCount = contextCounts[ctx];
        mostCommonContext = ctx;
      }
    });

    const localConflicts = getLocalData('internal_conflicts');
    const conflictCounts = {};
    localConflicts.forEach(c => {
      const cat = c.category || `${c.partA || c.part_a} vs ${c.partB || c.part_b}` || 'Growth vs Safety';
      conflictCounts[cat] = (conflictCounts[cat] || 0) + 1;
    });
    let mostFrequentConflict = 'Growth vs Certainty';
    let maxConflictCount = 0;
    Object.keys(conflictCounts).forEach(cat => {
      if (conflictCounts[cat] > maxConflictCount) {
        maxConflictCount = conflictCounts[cat];
        mostFrequentConflict = cat;
      }
    });

    const localDrivers = getLocalData('root_drivers');
    let mostCommonTrigger = 'Evaluation';
    if (localDrivers.length > 0) {
      mostCommonTrigger = localDrivers[0].rootDriver || localDrivers[0].root_driver || 'Evaluation';
    }

    let firstMemoryRecorded = 'June 2026';
    const firstDate = new Date(localConvs[0].created_at || new Date());
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    firstMemoryRecorded = `${months[firstDate.getMonth()]} ${firstDate.getFullYear()}`;

    let recentShift = 'Your core cognitive and emotional patterns have maintained a consistent equilibrium without major shifts.';
    if (localPatterns.length > 0) {
      const weakeningP = localPatterns.find(p => p.trend === 'Weakening' || p.trend === 'falling');
      const risingP = localPatterns.find(p => p.trend === 'Increasing' || p.trend === 'rising');
      if (weakeningP) {
        recentShift = `${weakeningP.name} appears less dominant than last month.`;
      } else if (risingP) {
        recentShift = `${risingP.name} has registered higher activity recently.`;
      }
    }

    let currentModelSummary = "Your self-awareness mirror is active. Reflect to synthesize a model.";
    if (localPatterns.length > 0) {
      const topPattern = mostRecurringPattern;
      const ctx = mostCommonContext;
      const trigger = mostCommonTrigger;
      const conflict = mostFrequentConflict;
      
      currentModelSummary = `Dialogue history suggests a primary coping cycle around ${topPattern.toLowerCase()} triggered by concerns of ${trigger.toLowerCase()} in ${ctx.toLowerCase()} domains. You are currently navigating an internal conflict of ${conflict.toLowerCase()}, which manifests as ${recentShift.toLowerCase()}`;
    }

    let currentExperiment = {
      action: "Observe your thoughts for 5 minutes without reacting.",
      purpose: "Build uncertainty tolerance and reduce automatic emotional avoidance.",
      expectedResistance: "Restlessness and an urge to check your phone or ask someone for their opinion.",
      successCondition: "Sat with the urge for 5 minutes without seeking reassurance or distraction."
    };

    const pNames = localPatterns.map(p => p.name);
    if (pNames.includes('Perfectionism')) {
      currentExperiment = {
        action: "Submit an imperfect draft or share a half-finished layout with a colleague.",
        purpose: "Deconstruct the standard shield by exposing incomplete work to feedback early.",
        expectedResistance: "A strong urge to make one final polish or review the material again.",
        successCondition: "Draft sent or shared with a teammate within the next 12 hours."
      };
    } else if (pNames.includes('Avoidance') || pNames.includes('Procrastination')) {
      currentExperiment = {
        action: "Perform the most avoided task for exactly 15 minutes and then stop.",
        purpose: "Bypass task confrontation anxiety by lowering the activation threshold.",
        expectedResistance: "Strong mental arguments that you need to check emails, clean your desk, or research more first.",
        successCondition: "Spent 15 minutes of focused work on the primary task before the end of the day."
      };
    } else if (pNames.includes('People Pleasing') || pNames.includes('Conflict Avoidance')) {
      currentExperiment = {
        action: "Delay your response to a low-stakes request by saying: 'Let me check my capacity first.'",
        purpose: "Create space to evaluate your authentic limits before compliance default activates.",
        expectedResistance: "Immediate fear of disappointing the person or feeling selfish.",
        successCondition: "Response delayed by at least 15 minutes to allow conscious evaluation."
      };
    } else if (pNames.includes('Self Criticism')) {
      currentExperiment = {
        action: "Audit your self-talk when a mistake happens and write it down as: 'The critic believes X, but the truth is Y.'",
        purpose: "Externalize the harsh internal audit system and separate self-worth from performance.",
        expectedResistance: "The belief that self-criticism is necessary to keep you motivated.",
        successCondition: "One critical self-talk pattern written down and reframed objectively today."
      };
    } else if (pNames.includes('Overthinking Loops')) {
      currentExperiment = {
        action: "Set a timer for 3 minutes, choose one option, and act on it immediately.",
        purpose: "Practice moving into action before requiring absolute cognitive reassurance.",
        expectedResistance: "The urge to continue weighing alternatives and researching outcomes.",
        successCondition: "One minor decision made and executed within the 3-minute limit."
      };
    }

    saveLocalData('long_term_memory', {
      firstReflection,
      mostRecurringPattern,
      mostCommonContext,
      emergingTheme,
      patternBecomingWeaker,
      mostFrequentConflict,
      mostCommonTrigger,
      firstMemoryRecorded,
      recentShift,
      currentModelSummary,
      currentExperiment
    });
  }
};

// Check if Backend server and Groq is active
export const checkServerStatus = async () => {
  if (typeof window === 'undefined') return { online: false, groq: false };
  try {
    const response = await fetchWithTimeout(`${BACKEND_URL}/health`, {}, 1200);
    if (!response.ok) return { online: false, groq: false };
    const data = await response.json();
    return { online: true, groq: !!data.groq };
  } catch {
    return { online: false, groq: false };
  }
};

// Exported API Actions
export const api = {
  analyze: async (message) => {
    const status = await checkServerStatus();
    if (status.online && status.groq) {
      // Live Mode
      const response = await fetchWithTimeout(`${BACKEND_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      }, 15000);
      if (!response.ok) throw new Error('API Analysis failed.');
      const data = await response.json();
      return normalizeAnalysisResponse(data.analysis);
    } else {
      // Sandbox Mode Fallback
      console.log('Human OS Engine: Running in offline local storage sandbox mode.');
      const localConvs = getLocalData('conversations');
      const priorObservations = localConvs.slice(-50).map(c => {
        return [
          c.response?.notices || '',
          c.response?.observation || '',
          c.response?.summary || '',
          c.response?.evolution || ''
        ].filter(Boolean).join(' ');
      });

      const analysis = simulateOfflineAnalysis(message, priorObservations);
      
      localConvs.push({
        id: `conv-${Date.now()}`,
        message,
        response: analysis,
        created_at: new Date().toISOString()
      });
      saveLocalData('conversations', localConvs);

      processOfflineMemory(analysis);
      return analysis;
    }
  },

  getDNA: async () => {
    const status = await checkServerStatus();
    if (status.online) {
      const response = await fetchWithTimeout(`${BACKEND_URL}/dna`);
      if (response.ok) {
        const data = await response.json();
        return Array.isArray(data) ? data : getLocalData('dna');
      }
    }
    return getLocalData('dna');
  },

  getGraph: async () => {
    const status = await checkServerStatus();
    if (status.online) {
      const response = await fetchWithTimeout(`${BACKEND_URL}/graph`);
      if (response.ok) {
        const data = await response.json();
        if (data && Array.isArray(data.nodes)) return data;
      }
    }
    
    // Fallback compilation
    const patterns = getLocalData('patterns');
    const connections = getLocalData('connections');

    const nodes = patterns.map(p => ({
      id: p.name,
      score: p.score || p.strength || 50,
      confidence: p.confidence || 50,
      category: p.category || 'Cognitive'
    }));

    const links = connections.map(c => ({
      source: c.source,
      target: c.target,
      weight: c.weight || 50
    }));

    return { nodes, links };
  },

  getPatterns: async () => {
    const status = await checkServerStatus();
    if (status.online) {
      const response = await fetchWithTimeout(`${BACKEND_URL}/patterns`);
      if (response.ok) {
        const data = await response.json();
        return Array.isArray(data) ? data : getLocalData('patterns');
      }
    }
    return getLocalData('patterns');
  },

  getTimeline: async () => {
    const status = await checkServerStatus();
    if (status.online) {
      const response = await fetchWithTimeout(`${BACKEND_URL}/timeline`);
      if (response.ok) {
        const data = await response.json();
        return Array.isArray(data) ? data : getLocalData('timeline');
      }
    }
    return getLocalData('timeline');
  },

  getBlindSpots: async () => {
    const status = await checkServerStatus();
    if (status.online) {
      const response = await fetchWithTimeout(`${BACKEND_URL}/blind-spots`);
      if (response.ok) {
        const data = await response.json();
        return Array.isArray(data) ? data : getLocalData('blind_spots');
      }
    }
    return getLocalData('blind_spots');
  },

  getInternalConflicts: async () => {
    const status = await checkServerStatus();
    if (status.online) {
      const response = await fetchWithTimeout(`${BACKEND_URL}/internal-conflicts`);
      if (response.ok) {
        const data = await response.json();
        return Array.isArray(data) ? data : getLocalData('internal_conflicts');
      }
    }
    return getLocalData('internal_conflicts');
  },

  getRootDrivers: async () => {
    const status = await checkServerStatus();
    if (status.online) {
      const response = await fetchWithTimeout(`${BACKEND_URL}/root-drivers`);
      if (response.ok) {
        const data = await response.json();
        return Array.isArray(data) ? data : getLocalData('root_drivers');
      }
    }
    return getLocalData('root_drivers');
  },

  getNarratives: async () => {
    const status = await checkServerStatus();
    if (status.online) {
      const response = await fetchWithTimeout(`${BACKEND_URL}/narratives`);
      if (response.ok) {
        const data = await response.json();
        return Array.isArray(data) ? data : getLocalData('narratives');
      }
    }
    return getLocalData('narratives');
  },

  getLongTermMemory: async () => {
    const status = await checkServerStatus();
    if (status.online) {
      const response = await fetchWithTimeout(`${BACKEND_URL}/long-term-memory`);
      if (response.ok) {
        const data = await response.json();
        return data || getLocalData('long_term_memory');
      }
    }
    return getLocalData('long_term_memory');
  }
};
