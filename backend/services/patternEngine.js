import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import { db } from '../db/db.js';
import crypto from 'crypto';
dotenv.config();

const apiKey = process.env.GROQ_API_KEY || '';
let groqClient = null;

if (apiKey) {
  groqClient = new Groq({ apiKey });
  console.log('Human OS Pattern Engine: Live Groq API Client active (Llama 3.3 70B).');
} else {
  console.log('Human OS Pattern Engine: Running in Mock Sandboxed Mode (Local inference).');
}

const SYSTEM_PROMPT = `You are the core Pattern Engine of Human OS, a Memory-First Psychological Operating System.
Your task is to analyze user dialogue and act as an objective, expert psychological mirror that develops an increasingly accurate model of the user's mind over time.

CRITICAL PRINCIPLES:
1. Do NOT act as a therapist or coach. Do NOT diagnose.
2. Focus exclusively on observation, pattern recognition, and revealing what is repeating.
3. Every response MUST be deeply personalized. Never repeat generic observations.
4. References to the user's history (if provided in context) are mandatory. Make connections between current behaviors and past reflections (e.g. "Today you mention a career decision, but this mirrors the hesitation you expressed three weeks ago around study decisions...").

HUMAN NARRATIVE ENGINE VOICE:
- Speak in a calm, precise, non-clinical, and observant human voice.
- NEVER write: "Overthinking detected.", "Avoidance identified.", "Conflict logged.", "Driver identified.", "Signal registered.", "Pattern detected.", "You exhibit...", "You demonstrate...", "You score...", "Your category...". Avoid clinical, robotic, diagnostic, academic, or assessment language.
- Instead write: "I've noticed...", "This theme keeps returning...", "The context changes, but the tension underneath looks familiar...", "Compared with earlier reflections...", "This appears to be evolving...".
- Example style: "What stands out is not a lack of motivation. You seem ready to move forward. The hesitation appears when action becomes visible. Preparation feels safe; execution introduces the possibility of judgment. That tension has appeared several times before."
- Every insight must follow this inner shape: Observation -> Meaning -> Evolution -> Implication.
- Every insight must reference memory, current context, what changed, and the likely future direction if the pattern continues.
- Prefer meaning over metrics. The user should feel remembered, not scored.

OUTPUT FORMAT:
You must output a single, valid JSON object. Do NOT include any markdown blocks (like \`\`\`json) or conversational preamble. Output raw JSON ONLY.

The JSON schema MUST match this structure:
{
  "summary": "Brief 1-sentence description of the core theme of this reflection.",
  "notices": "2-3 paragraphs of deeply personal, reflective human observations. You must cite specific details from the user's current reflection text. If past entry memory context is provided, actively cross-reference dates and themes, highlighting what is repeating or shifting across contexts.",
  "evolution": "1-2 sentences comparing current patterns with history, explaining how they are strengthening, weakening, stabilizing, or resolving.",
  "conflict": {
    "category": "One of: Want vs Fear, Goal vs Protection, Action vs Certainty, Authenticity vs Approval, Growth vs Safety, Freedom vs Belonging, Independence vs Validation",
    "want": "What the conscious side of the user wants to achieve.",
    "fear": "What the protective side of the user is fearing or trying to avoid.",
    "tension": "A summary of the tension (e.g., 'Part of you wants progress. Part of you wants certainty. Progress requires moving before certainty arrives.')"
  },
  "blind_spot": {
    "type": "One of: Hidden Assumption, Mental Loop, Internal Contradiction, Emotional Avoidance, Protective Strategy",
    "contradiction": "The user's conscious label or belief (e.g., 'I am lazy').",
    "revealed_truth": "The actual underlying behavior shown by evidence (e.g., 'Avoidance of imperfect execution, researching 6 hours daily').",
    "core_assumption": "The underlying belief acting as a shield (e.g., 'You are treating preparation as proof of readiness. The assumption underneath is that more preparation will remove uncertainty.')."
  },
  "what_changed": "A precise description of what has shifted or evolved since the previous reflections.",
  "what_stayed_the_same": "A precise description of what has remained constant or repeating since the previous reflections.",
  "question": "A single powerful, sharp self-reflective question.",
  "experiment": "A single behavioral next small experiment.",
  "patterns": [
    {
      "name": "One of: Fear of Failure, People Pleasing, Self Criticism, Perfectionism, Avoidance, Validation Seeking, Catastrophic Thinking, Identity Confusion, Emotional Dependence, Conflict Avoidance, Approval Addiction, Learned Helplessness, Comparison Patterns, Overthinking Loops",
      "category": "Cognitive, Emotional, Behavioral, Motivational, or Decision-making",
      "strength": 82,
      "confidence": 91,
      "evidence": "Direct quote from user input"
    }
  ],
  "connections": [
    {
      "source": "Pattern Name A",
      "target": "Pattern Name B",
      "weight": 80,
      "confidence": 85
    }
  ],
  "domains": {
    "Study": 0,
    "Career": 0,
    "Relationships": 0,
    "Family": 0,
    "Health": 0,
    "Finance": 0,
    "Identity": 0,
    "Purpose": 0,
    "Productivity": 0,
    "Social": 0
  }
}
`;

// Priority 1 Term-Frequency Cosine Similarity Helper
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

// Sandbox Diverse Templates for Priority 1 & 9
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

const generateMockResponse = (message, priorObservations = []) => {
  const lowercaseInput = message.toLowerCase();
  let categoryKey = 'default';
  
  if (lowercaseInput.includes('fail') || lowercaseInput.includes('presentation') || lowercaseInput.includes('test') || lowercaseInput.includes('mistake') || lowercaseInput.includes('perfect') || lowercaseInput.includes('postpone') || lowercaseInput.includes('job') || lowercaseInput.includes('work')) {
    categoryKey = 'career';
  } else if (lowercaseInput.includes('boss') || lowercaseInput.includes('say yes') || lowercaseInput.includes(' boundary') || lowercaseInput.includes('pleas') || lowercaseInput.includes('conflict') || lowercaseInput.includes('angry') || lowercaseInput.includes('smile') || lowercaseInput.includes('friend') || lowercaseInput.includes('someone')) {
    categoryKey = 'relationships';
  }

  const templates = SANDBOX_TEMPLATES[categoryKey];
  
  // Choose the template that has the lowest similarity to all prior observations
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

  // Populate patterns and connections
  const patternsList = [];
  const connectionsList = [];
  const domains = {
    Study: 0, Career: 0, Relationships: 0, Family: 0, Health: 0,
    Finance: 0, Identity: 0, Purpose: 0, Productivity: 0, Social: 0
  };

  const getSentenceWith = (keywords) => {
    const sentence = message.split(/[.!?]/).find(s => 
      keywords.some(k => s.toLowerCase().includes(k))
    );
    return sentence ? sentence.trim() : message.slice(0, 100).trim();
  };

  if (categoryKey === 'career') {
    const failEvidence = getSentenceWith(['fail', 'afraid', 'postpone', 'wrong']);
    const perfectEvidence = getSentenceWith(['perfect', 'slide', 'presentation', 'research', 'work']);
    
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

    domains.Career = 85;
    domains.Productivity = 80;

    if (lowercaseInput.includes('delay') || lowercaseInput.includes('research') || lowercaseInput.includes('avoid') || lowercaseInput.includes('postpone') || lowercaseInput.includes('procrastinate')) {
      patternsList.push({ 
        name: 'Avoidance', 
        category: 'Decision-making',
        strength: 78, 
        confidence: 85, 
        evidence: getSentenceWith(['delay', 'postpone', 'avoid', 'procrastinate']) || 'I keep postponing important work.' 
      });
      connectionsList.push({ source: 'Fear of Failure', target: 'Perfectionism', weight: 88, confidence: 90 });
      connectionsList.push({ source: 'Perfectionism', target: 'Avoidance', weight: 82, confidence: 85 });
    } else {
      connectionsList.push({ source: 'Fear of Failure', target: 'Perfectionism', weight: 80, confidence: 85 });
    }
  } else if (categoryKey === 'relationships') {
    const pleasEvidence = getSentenceWith(['yes', 'pleas', 'smile', 'boss', 'friend']);
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

    domains.Relationships = 85;
    domains.Social = 75;

    connectionsList.push({ source: 'People Pleasing', target: 'Conflict Avoidance', weight: 85, confidence: 88 });
    
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
    const thinkEvidence = getSentenceWith(['think', 'loop', 'stuck', 'worry', 'decide']);
    patternsList.push({ 
      name: 'Overthinking Loops', 
      category: 'Cognitive',
      strength: 86, 
      confidence: 90, 
      evidence: thinkEvidence || 'I keep analyzing this scenario over and over.' 
    });

    domains.Identity = 80;
    domains.Productivity = 75;

    if (lowercaseInput.includes('fail') || lowercaseInput.includes('worst')) {
      patternsList.push({ 
        name: 'Catastrophic Thinking', 
        category: 'Cognitive',
        strength: 80, 
        confidence: 85, 
        evidence: getSentenceWith(['fail', 'worst', 'happen']) || 'I keep imagining the worst outcome.' 
      });
      connectionsList.push({ source: 'Overthinking Loops', target: 'Catastrophic Thinking', weight: 75, confidence: 80 });
    }
  }

  return {
    summary: bestTemplate.conflict.category || 'Introspective profile compiled.',
    notices: bestTemplate.notices,
    observation: bestTemplate.notices,
    evolution: bestTemplate.evolution,
    conflict: bestTemplate.conflict,
    blind_spot: bestTemplate.blindSpot,
    what_changed: bestTemplate.what_changed,
    what_stayed_the_same: bestTemplate.what_stayed_the_same,
    question: bestTemplate.question,
    reflection_question: bestTemplate.question,
    experiment: bestTemplate.experiment,
    patterns: patternsList,
    connections: connectionsList,
    domains
  };
};

export const patternEngine = {
  testConnection: async () => {
    if (groqClient) {
      try {
        const chatCompletion = await groqClient.chat.completions.create({
          messages: [
            { role: 'user', content: 'Say exactly "Human OS Connected" and nothing else.' }
          ],
          model: 'llama-3.3-70b-versatile',
          temperature: 0.0
        });
        return chatCompletion.choices[0].message.content.trim();
      } catch (error) {
        throw new Error('Groq test call failed: ' + error.message);
      }
    } else {
      return 'Sandbox Mode (Local Simulation Connect)';
    }
  },

  analyzeText: async (message, context = '', priorObservations = []) => {
    if (!message || message.trim() === '') {
      throw new Error('Input text is required for analysis.');
    }

    if (groqClient) {
      const maxAttempts = 3;
      let attempt = 0;
      let lastError = null;
      let instructionModifier = '';

      while (attempt < maxAttempts) {
        attempt++;
        try {
          console.log(`================================`);
          console.log(`Groq API Analysis: Attempt ${attempt}/${maxAttempts}`);
          console.log(`================================`);

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000);

          const fullPrompt = `${context ? `USER PSYCHOLOGICAL HISTORY & CONTEXT:\n${context}\n\n` : ''}CURRENT REFLECTION TO ANALYZE:\n"${message}"${instructionModifier}`;

          const chatCompletion = await groqClient.chat.completions.create({
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: fullPrompt }
            ],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.2 + (attempt * 0.1), // Slightly increase temp to encourage diversity on retry
            response_format: { type: 'json_object' }
          }, { signal: controller.signal });

          clearTimeout(timeoutId);

          const responseText = chatCompletion.choices[0].message.content;
          const analysis = JSON.parse(responseText);

          // Priority 1 Insight Diversity verification
          const currentText = [
            analysis.notices || '',
            analysis.observation || '',
            analysis.summary || '',
            analysis.evolution || ''
          ].filter(Boolean).join(' ');

          let maxSim = 0;
          for (const prior of priorObservations) {
            const sim = calculateCosineSimilarity(currentText, prior);
            if (sim > maxSim) maxSim = sim;
          }

          if (maxSim <= 0.65 || priorObservations.length === 0 || attempt === maxAttempts) {
            console.log(`Insight Diversity: Accepted response. Cosine similarity is ${maxSim.toFixed(2)} (attempt ${attempt}).`);
            return {
              summary: analysis.summary || 'Dialogue analyzed.',
              notices: analysis.notices || analysis.observation || 'Dialogue analyzed.',
              observation: analysis.notices || analysis.observation || 'Dialogue analyzed.',
              evolution: analysis.evolution || 'Human OS is comparing this reflection with memory and watching what changes next.',
              conflict: {
                category: analysis.conflict?.category || 'Growth vs Safety',
                want: analysis.conflict?.want || 'Progress',
                fear: analysis.conflict?.fear || 'Risk',
                tension: analysis.conflict?.tension || 'Part of you wants progress. Part of you wants safety.'
              },
              blind_spot: {
                type: analysis.blind_spot?.type || 'Hidden Assumption',
                contradiction: analysis.blind_spot?.contradiction || 'Conscious label',
                revealed_truth: analysis.blind_spot?.revealed_truth || analysis.blind_spot?.revealedTruth || 'Revealed truth',
                core_assumption: analysis.blind_spot?.core_assumption || 'Core shield assumption'
              },
              what_changed: analysis.what_changed || analysis.whatChanged || 'A shift is occurring as awareness develops.',
              what_stayed_the_same: analysis.what_stayed_the_same || analysis.whatStayedTheSame || 'The core concern remains consistent.',
              question: analysis.question || analysis.reflection_question || analysis.reflectionQuestion || 'What does this reveal to you?',
              reflection_question: analysis.question || analysis.reflection_question || analysis.reflectionQuestion || 'What does this reveal to you?',
              experiment: analysis.experiment || 'Take one small step without over-preparation.',
              patterns: (analysis.patterns || []).map(p => ({
                name: p.name,
                category: p.category,
                strength: p.strength || p.score || 50,
                confidence: p.confidence || 50,
                evidence: p.evidence || 'Dialogue segment.'
              })),
              connections: (analysis.connections || []).map(c => ({
                source: c.source,
                target: c.target,
                weight: c.weight || 50,
                confidence: c.confidence || 50
              })),
              domains: analysis.domains || {}
            };
          } else {
            console.log(`Insight Diversity: Refused response due to similarity ${maxSim.toFixed(2)} (> 0.65). Retrying...`);
            instructionModifier = `\n\n[WARNING: Your previous response draft was too similar (similarity = ${(maxSim * 100).toFixed(1)}%) to prior entries in user history. You MUST rewrite your observations, notices, summary, and tension using completely different vocabulary, vocabulary choices, sentence structures, and metaphors. Focus on a different angle of the user's situation and avoid repeating identical conclusions or phrasing.]`;
          }
        } catch (error) {
          console.warn(`Groq Engine Attempt ${attempt} failed:`, error.message);
          lastError = error;
          if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
      }

      console.error('All 3 Groq attempts failed. Falling back to sandbox simulator.', lastError);
      return generateMockResponse(message, priorObservations);
    } else {
      await new Promise(resolve => setTimeout(resolve, 800));
      return generateMockResponse(message, priorObservations);
    }
  }
};
