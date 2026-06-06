import { db } from '../db/db.js';
import crypto from 'crypto';

const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

// All 20 hidden profile dimensions as requested by Level 2
const DNA_DIMENSIONS = [
  'Need For Approval',
  'Fear Of Failure',
  'Fear Of Rejection',
  'Need For Control',
  'Uncertainty Tolerance',
  'Emotional Resilience',
  'Self Trust',
  'Self Criticism',
  'Perfectionism',
  'Avoidance',
  'Boundary Strength',
  'Identity Stability',
  'Authenticity',
  'Confidence',
  'Purpose Clarity',
  'Decision Confidence',
  'People Pleasing',
  'Dependency',
  'Overthinking',
  'Emotional Independence'
];

const TREND_STATES = {
  EMERGING: 'Emerging',
  STRENGTHENING: 'Strengthening',
  STABLE: 'Stable',
  WEAKENING: 'Weakening',
  DORMANT: 'Dormant',
  RESOLVED: 'Resolved'
};

const normalizeTrend = (trend) => {
  const normalized = String(trend || '').toLowerCase();
  if (['new', 'emerging', 're-emerging'].includes(normalized)) return TREND_STATES.EMERGING;
  if (['rising', 'increasing', 'strengthening'].includes(normalized)) return TREND_STATES.STRENGTHENING;
  if (['falling', 'weakening', 'decreasing'].includes(normalized)) return TREND_STATES.WEAKENING;
  if (normalized === 'dormant') return TREND_STATES.DORMANT;
  if (normalized === 'resolved') return TREND_STATES.RESOLVED;
  return TREND_STATES.STABLE;
};

export const psychologicalMemory = {
  processAnalysisResults: async (userId, conversationId, analysis) => {
    const { patterns, connections, blind_spots, hidden_drivers, internal_conflicts, domains } = analysis;
    const nowStr = new Date().toISOString();

    // Fetch existing patterns to support incremental memory updates
    const existingPatterns = await db.getPatterns(userId);
    const existingPatternsMap = {};
    for (const ep of existingPatterns) {
      existingPatternsMap[ep.name] = ep;
    }

    // Determine primary domain
    let maxDomain = 'General';
    let maxWeight = 0;
    if (domains) {
      Object.keys(domains).forEach(d => {
        if (domains[d] > maxWeight) {
          maxWeight = domains[d];
          maxDomain = d;
        }
      });
    }

    // 1. Process Patterns (Evolves patterns using memory-first schemas)
    for (const p of patterns || []) {
      const existing = existingPatternsMap[p.name];
      const occurrences = (existing?.occurrences || 0) + 1;
      const firstSeen = existing?.firstSeen || nowStr;
      const lastSeen = nowStr;
      
      const oldScore = existing?.score || existing?.strength || p.strength;
      const oldConf = existing?.confidence || p.confidence;
      
      const finalStrength = Math.round((oldScore * 0.4) + (p.strength * 0.6));
      const finalConfidence = Math.round((oldConf * 0.5) + (p.confidence * 0.5));

      const averageStrength = Math.round(((existing?.averageStrength || p.strength) * (occurrences - 1) + p.strength) / occurrences);
      const highestStrength = Math.max(existing?.highestStrength || p.strength, p.strength);
      const lowestStrength = Math.min(existing?.lowestStrength || p.strength, p.strength);

      // Record History arrays
      const strengthHistory = [...(existing?.strengthHistory || [])];
      strengthHistory.push({ date: nowStr, score: p.strength });

      const confidenceHistory = [...(existing?.confidenceHistory || [])];
      confidenceHistory.push({ date: nowStr, confidence: p.confidence });

      const reflectionReferences = [...(existing?.reflectionReferences || [])];
      reflectionReferences.push(conversationId);

      const insightHistory = [...(existing?.insightHistory || [])];
      if (analysis.summary) {
        insightHistory.push({ date: nowStr, insight: analysis.summary });
      }

      // Contexts count mapping
      const contextsMap = { ...(existing?.contextsMap || {}) };
      contextsMap[maxDomain] = (contextsMap[maxDomain] || 0) + 1;
      const contexts = Object.keys(contextsMap); // Array of contexts

      // Related Patterns list
      const relatedSet = new Set(existing?.relatedPatterns || []);
      (connections || []).forEach(c => {
        if (c.source === p.name) relatedSet.add(c.target);
        if (c.target === p.name) relatedSet.add(c.source);
      });
      const relatedPatterns = Array.from(relatedSet);

      // Calculate longitudinal trend using canonical memory states.
      let trend = TREND_STATES.STABLE;
      let trendVelocity = 0;
      if (occurrences === 1) {
        trend = TREND_STATES.EMERGING;
      } else if (strengthHistory.length >= 2) {
        const lastH = strengthHistory[strengthHistory.length - 1].score;
        const prevH = strengthHistory[strengthHistory.length - 2].score;
        trendVelocity = lastH - prevH;

        const priorTrend = normalizeTrend(existing?.trendDirection || existing?.trend);

        if (lastH < 20) {
          trend = TREND_STATES.RESOLVED;
        } else if (lastH < 35) {
          trend = TREND_STATES.DORMANT;
        } else if ([TREND_STATES.DORMANT, TREND_STATES.RESOLVED].includes(priorTrend) && lastH >= 40) {
          trend = TREND_STATES.EMERGING;
        } else if (lastH > prevH + 3) {
          trend = TREND_STATES.STRENGTHENING;
        } else if (lastH < prevH - 3) {
          trend = TREND_STATES.WEAKENING;
        } else {
          trend = TREND_STATES.STABLE;
        }
      }

      // V4 dynamic evolution story text
      let evolutionStory = '';
      if (occurrences === 1) {
        evolutionStory = `This theme has just entered memory through ${maxDomain.toLowerCase()} reflections. Human OS will watch whether it repeats, spreads, or fades.`;
      } else {
        if (trend === TREND_STATES.STRENGTHENING) {
          evolutionStory = `${p.name} is taking up more space in recent reflections, especially around ${maxDomain.toLowerCase()}. The system is watching whether it becomes the dominant explanation for hesitation.`;
        } else if (trend === TREND_STATES.WEAKENING) {
          evolutionStory = `${p.name} appears less central than it was before. That suggests the old loop is still present, but it is losing some of its automatic pull.`;
        } else if (trend === TREND_STATES.RESOLVED) {
          evolutionStory = `${p.name} has largely settled. Human OS will keep it in memory as a resolved chapter unless similar triggers bring it back.`;
        } else if (trend === TREND_STATES.DORMANT) {
          evolutionStory = `${p.name} is quiet right now. It remains part of memory, but it is not driving the current reflection as strongly.`;
        } else if (trend === TREND_STATES.EMERGING) {
          evolutionStory = `${p.name} has returned after a quieter period, suggesting a familiar trigger may be active again.`;
        } else {
          evolutionStory = `${p.name} has stayed steady across recent reflections. The context may change, but the underlying tension is familiar.`;
        }
      }

      // Gather triggers for this pattern
      const patternTriggersSet = new Set(existing?.triggers || []);
      (hidden_drivers || []).forEach(hd => {
        if ((hd.creates || hd.createsPatterns || []).includes(p.name)) {
          patternTriggersSet.add(hd.root_driver || hd.rootDriver);
        }
      });
      const triggers = Array.from(patternTriggersSet);

      // Gather related conflicts for this pattern
      const conflictHistory = [...(existing?.conflictHistory || [])]
        .map(item => typeof item === 'string' ? { date: firstSeen, tension: item } : item);
      (internal_conflicts || []).forEach(ic => {
        const tension = ic.tension || '';
        const exists = conflictHistory.some(item => item.tension === tension);
        if (tension && !exists) {
          conflictHistory.push({
            date: nowStr,
            category: ic.category || '',
            tension
          });
        }
      });

      // Evolve growth signals
      const growthSignals = [...(existing?.growthSignals || [])];
      const growthHistory = [...(existing?.growthHistory || [])]
        .map(item => typeof item === 'string' ? { date: firstSeen, signal: item } : item);
      if (trend === TREND_STATES.WEAKENING) {
        const signal = `${p.name} appears less central than before.`;
        growthSignals.push(signal);
        growthHistory.push({ date: nowStr, signal });
      } else if (trend === TREND_STATES.RESOLVED) {
        const signal = `${p.name} settled into a resolved chapter.`;
        growthSignals.push(`${p.name} settled into dormancy.`);
        growthHistory.push({ date: nowStr, signal });
      }

      // Evolve evidence references
      const evidenceReferences = [...(existing?.evidenceReferences || existing?.reflectionReferences || [])];
      if (!evidenceReferences.includes(conversationId)) {
        evidenceReferences.push(conversationId);
      }

      const evidenceHistory = [...(existing?.evidenceHistory || [])];
      if (p.evidence) {
        evidenceHistory.push({ date: nowStr, quote: p.evidence, domain: maxDomain });
      }
      const evidence = Array.from(new Set(evidenceHistory.map(item => item.quote).filter(Boolean)));

      const milestones = [...(existing?.milestones || [])];
      if (occurrences === 1) {
        milestones.push(`First appeared in ${maxDomain}.`);
      } else if (trend === 'Weakening') {
        milestones.push(`${p.name} became less central.`);
      } else if (trend === 'Resolved') {
        milestones.push(`${p.name} moved toward resolution.`);
      }

      const narrativeHistory = [...(existing?.narrativeHistory || [])]
        .map(item => typeof item === 'string' ? { date: firstSeen, narrative: item } : item);
      narrativeHistory.push({
        date: nowStr,
        narrative: evolutionStory
      });

      const trendDirection = normalizeTrend(trend);
      const patternId = existing?.id || `pat-${crypto.randomUUID()}`;

      const v2Data = {
        id: patternId,
        patternId,
        name: p.name,
        firstSeen,
        lastSeen,
        occurrences,
        confidence: finalConfidence,
        strength: finalStrength,
        trend,
        trendVelocity,
        contexts,
        contextsMap,
        triggers,
        evidence,
        relatedPatterns,
        strengthHistory,
        confidenceHistory,
        growthHistory,
        conflictHistory,
        trendDirection,
        narrativeHistory,
        reflectionReferences,
        evidenceHistory,
        milestones,
        evolutionStory,
        
        // V4 attributes
        growthSignals,
        evidenceReferences,

        // Backward compatibility
        score: finalStrength,
        averageStrength,
        highestStrength,
        lowestStrength,
        category: p.category,
        insightHistory
      };

      // Upsert pattern row in database
      await db.upsertPattern(userId, p.name, finalStrength, finalConfidence, p.category, v2Data);

      // Log human-friendly timeline events based on V4 definitions
      const pNameLower = p.name.toLowerCase();
      if (occurrences === 1) {
        await db.addTimelineEvent(
          userId,
          'pattern_discovered',
          `A recurring theme emerged: ${p.name}`,
          `${p.name} became visible in ${maxDomain.toLowerCase()} reflections.`,
          { pattern: p.name, trend: trendDirection }
        );
      } else if (trend === TREND_STATES.STRENGTHENING) {
        await db.addTimelineEvent(
          userId,
          'pattern_strengthened',
          `${p.name} became more active`,
          `${p.name} expanded into ${maxDomain.toLowerCase()}-related decisions.`,
          { pattern: p.name, trend: trendDirection }
        );
      } else if (trend === TREND_STATES.WEAKENING) {
        await db.addTimelineEvent(
          userId,
          'pattern_weakened',
          `An older pattern weakened`,
          `${p.name} became less dominant in recent reflections.`,
          { pattern: p.name, trend: trendDirection }
        );
      } else if (trend === TREND_STATES.RESOLVED) {
        await db.addTimelineEvent(
          userId,
          'pattern_broken',
          `${p.name} moved toward resolution`,
          `The loop of ${pNameLower} has resolved or faded into dormancy.`,
          { pattern: p.name, trend: trendDirection }
        );
      }
    }

    // 2. Process Connections (Edges)
    for (const c of connections || []) {
      await db.upsertPatternConnection(userId, c.source, c.target, c.weight);
    }

    // 3. Process Psychological DNA Calibration using mathematical EMA (all 20 dimensions)
    const currentDNA = await db.getPsychologicalDNA(userId);
    const dnaMap = {};
    for (const d of currentDNA) {
      dnaMap[d.dimension] = d;
    }

    // Initialize dimensions if missing
    for (const dim of DNA_DIMENSIONS) {
      if (!dnaMap[dim]) {
        dnaMap[dim] = {
          dimension: dim,
          score: 50,
          trend: 'stable',
          confidence: 50,
          history: []
        };
      }
    }

    // Map patterns for DNA calculations
    const patternStrengthMap = {};
    (patterns || []).forEach(p => {
      patternStrengthMap[p.name] = p.strength;
    });

    // Compute target values for all 20 dimensions
    const getTargetScore = (dim) => {
      switch (dim) {
        case 'Fear Of Failure': return patternStrengthMap['Fear of Failure'] || 15;
        case 'Perfectionism': return patternStrengthMap['Perfectionism'] || 15;
        case 'Avoidance': return patternStrengthMap['Avoidance'] || patternStrengthMap['Procrastination'] || 15;
        case 'People Pleasing': return patternStrengthMap['People Pleasing'] || 15;
        case 'Self Criticism': return patternStrengthMap['Self Criticism'] || 15;
        case 'Overthinking': return patternStrengthMap['Overthinking Loops'] || 15;
        case 'Conflict Avoidance': return patternStrengthMap['Conflict Avoidance'] || 15;
        case 'Need For Approval': return patternStrengthMap['Validation Seeking'] || patternStrengthMap['Approval Addiction'] || patternStrengthMap['People Pleasing'] || 15;
        case 'Fear Of Rejection': return patternStrengthMap['Conflict Avoidance'] || patternStrengthMap['People Pleasing'] || 15;
        case 'Need For Control': return patternStrengthMap['Perfectionism'] || patternStrengthMap['Overthinking Loops'] || 15;
        case 'Uncertainty Tolerance': return clamp(100 - (patternStrengthMap['Overthinking Loops'] || patternStrengthMap['Fear of Failure'] || 0), 15, 90);
        case 'Emotional Resilience': return clamp(100 - (patternStrengthMap['Self Criticism'] || patternStrengthMap['Catastrophic Thinking'] || 0), 15, 90);
        case 'Self Trust': return clamp(100 - (patternStrengthMap['Self Criticism'] || patternStrengthMap['Overthinking Loops'] || 0), 15, 90);
        case 'Boundary Strength': return clamp(100 - (patternStrengthMap['People Pleasing'] || patternStrengthMap['Conflict Avoidance'] || 0), 15, 90);
        case 'Identity Stability': return clamp(100 - (patternStrengthMap['Identity Confusion'] || patternStrengthMap['Validation Seeking'] || 0), 15, 90);
        case 'Authenticity': return clamp(100 - (patternStrengthMap['People Pleasing'] || patternStrengthMap['Conflict Avoidance'] || 0), 15, 90);
        case 'Confidence': return clamp(100 - Math.max(patternStrengthMap['Fear of Failure'] || 0, patternStrengthMap['Self Criticism'] || 0), 15, 90);
        case 'Purpose Clarity': return clamp(100 - (patternStrengthMap['Identity Confusion'] || 0), 15, 90);
        case 'Decision Confidence': return clamp(100 - Math.max(patternStrengthMap['Overthinking Loops'] || 0, patternStrengthMap['Avoidance'] || 0), 15, 90);
        case 'Dependency': return patternStrengthMap['Emotional Dependence'] || patternStrengthMap['Approval Addiction'] || 15;
        case 'Emotional Independence': return clamp(100 - (patternStrengthMap['Emotional Dependence'] || patternStrengthMap['Validation Seeking'] || 0), 15, 90);
        default: return 50;
      }
    };

    // Apply EMA calculations to all 20 DNA traits
    for (const dim of DNA_DIMENSIONS) {
      const item = dnaMap[dim];
      const oldScore = item.score || 50;
      const targetScore = getTargetScore(dim);
      
      const isNegativeDim = ['Avoidance', 'Perfectionism', 'People Pleasing', 'Self Criticism', 'Overthinking', 'Need For Approval', 'Fear Of Failure', 'Fear Of Rejection', 'Need For Control', 'Dependency'].includes(dim);
      const hasRelatedPatterns = isNegativeDim ? targetScore > 15 : targetScore < 90;

      const weight = hasRelatedPatterns ? 0.6 : 0.15;
      const newScore = clamp(Math.round((oldScore * (1 - weight)) + (targetScore * weight)), 15, 95);

      if (newScore !== oldScore) {
        let trend = 'stable';
        if (newScore > oldScore) trend = 'rising';
        if (newScore < oldScore) trend = 'falling';

        const newConfidence = clamp((item.confidence || 50) + 3, 50, 95);

        // Update in database
        await db.updatePsychologicalDNA(
          userId,
          dim,
          newScore,
          trend,
          newConfidence,
          { date: nowStr, score: newScore }
        );

        // Growth Detection: check DNA shifts for positive progress
        let growthTitle = '';
        let growthDesc = '';
        if (dim === 'Boundary Strength' && newScore > oldScore) {
          growthTitle = 'Improved Boundary Strength';
          growthDesc = 'You are showing more willingness to protect your limits instead of automatically absorbing pressure.';
        } else if (dim === 'Self Trust' && newScore > oldScore) {
          growthTitle = 'Improved Self Trust';
          growthDesc = 'Recent reflections show more trust in your own read of the situation before outside certainty arrives.';
        } else if (dim === 'Avoidance' && newScore < oldScore) {
          growthTitle = 'Reduced Avoidance';
          growthDesc = 'Avoidance appears less automatic, suggesting higher readiness to act before certainty is complete.';
        } else if (dim === 'Self Criticism' && newScore < oldScore) {
          growthTitle = 'Reduced Self Criticism';
          growthDesc = 'The self-critical loop appears less dominant, leaving more room for a calmer internal voice.';
        } else if (dim === 'Decision Confidence' && newScore > oldScore) {
          growthTitle = 'Healthier Decisions';
          growthDesc = 'Decision-making appears less dependent on exhaustive review and more able to tolerate uncertainty.';
        }

        if (growthTitle && growthDesc && Math.abs(newScore - oldScore) >= 2) {
          await db.addTimelineEvent(
            userId,
            'behavior_change',
            growthTitle,
            growthDesc,
            { dimension: dim, direction: newScore > oldScore ? 'up' : 'down' }
          );
        }
      }
    }

    // 4. Process Blind Spots
    for (const bs of blind_spots || []) {
      await db.saveBlindSpot(userId, bs.contradiction, bs.revealed_truth || bs.revealedTruth || '', 85);
    }

    // 5. Process Internal Conflicts (using deduplicating save helper)
    for (const ic of internal_conflicts || []) {
      const partA = ic.part_a || ic.partA || 'Growth';
      const partB = ic.part_b || ic.partB || 'Safety';
      const inputStrength = ic.strength || Math.round(((patterns || []).reduce((acc, p) => acc + p.strength, 0) / (patterns?.length || 1)) || 75);
      
      await db.saveInternalConflict(userId, partA, partB, ic.tension || '', {
        strength: inputStrength,
        contexts: [maxDomain]
      });
    }

    // 6. Process Hidden Drivers
    for (const hd of hidden_drivers || []) {
      await db.saveRootDriver(userId, hd.root_driver || hd.rootDriver || '', hd.creates || []);
    }

    // 7. Process Story Narratives
    const convs = await db.getConversations(userId);
    if (convs.length === 3) {
      await db.saveNarrative(userId, 'Phase 3: Integration Begins', 'Patterns are surfacing in decision-making domains. You are beginning to observe conflict tensions and align your boundaries.', 'Month 3');
      await db.addTimelineEvent(userId, 'milestone', 'Story Phase 3 Initialized', 'Evolved narrative to Phase 3: Integration.', {});
    } else if (convs.length === 5) {
      await db.saveNarrative(userId, 'Phase 4: Evolution & Re-Calibration', 'The system reports stabilizing trends. Avoidance patterns are decaying as boundary strength registers incremental growth.', 'Month 4');
      await db.addTimelineEvent(userId, 'milestone', 'Story Phase 4 Initialized', 'Evolved narrative to Phase 4: Recalibration.', {});
    }

    // 8. Generate Insight Cards
    for (const p of patterns || []) {
      if (p.strength >= 80) {
        const existingInsights = await db.getInsights(userId);
        const exists = existingInsights.some(ins => ins.title.toLowerCase().includes(p.name.toLowerCase()));
        
        if (!exists) {
          let title = '';
          let description = '';
          let areas = [];

          if (p.name === 'Fear of Failure') {
            title = 'Fear of Evaluation';
            description = 'You frequently postpone tasks or avoid exposure to escape judgment, equating incomplete work with protection from criticism.';
            areas = ['Career', 'Identity'];
          } else if (p.name === 'Perfectionism') {
            title = 'The Standard Shield';
            description = 'You establish rigid standards to make action feel too dangerous, maintaining control by avoiding actual completion.';
            areas = ['Productivity', 'Career'];
          } else if (p.name === 'Avoidance') {
            title = 'Defensive Postponement';
            description = 'You avoid task confrontations to regulate anxiety, using preparation as a defense style against active vulnerability.';
            areas = ['Decision-making', 'Career'];
          }

          if (title && description) {
            const insight = await db.saveInsight(userId, title, description, p.confidence, areas);
            await db.addTimelineEvent(
              userId,
              'insight_generated',
              `Insight Formed: ${title}`,
              `Uncovered a recurring cognitive blind spot in your behavior: ${title}.`,
              { insightId: insight.id }
            );
          }
        }
      }
    }

    // 9. Update Long Term Memory metrics (V4 Memory-First properties)
    const patternsData = await db.getPatterns(userId);
    
    if (convs.length > 0) {
      const firstReflection = convs[0].message;
      
      let mostRecurringPattern = 'Observation cycle initialized. Reflect to reveal patterns.';
      let maxOccurrences = 0;
      let patternBecomingWeaker = 'No specific defensive loop has shown significant reduction recently; the core model remains stable.';
      let emergingTheme = 'Recent reflections reinforce existing themes rather than introducing a distinct new psychological direction.';
      
      const contextCounts = {};
      
      patternsData.forEach(p => {
        const occ = p.occurrences || 1;
        if (occ > maxOccurrences) {
          maxOccurrences = occ;
          mostRecurringPattern = p.name;
        }
        
        if (p.trend === 'Weakening' || p.trend === 'Decreasing' || p.trend === 'falling') {
          patternBecomingWeaker = `Intensity of ${p.name.toLowerCase()} shows reduction.`;
        }
        
        if (p.trend === 'New' || p.trend === 'Emerging' || p.trend === 'rising' || p.trend === 'Increasing') {
          emergingTheme = `The theme of ${p.name.toLowerCase()} is registering emerging activity.`;
        }
        
        if (p.contexts) {
          const ctxList = Array.isArray(p.contexts) ? p.contexts : Object.keys(p.contexts || {});
          ctxList.forEach(ctx => {
            contextCounts[ctx] = (contextCounts[ctx] || 0) + 1;
          });
        }
      });
      
      let mostCommonContext = 'The system is collecting evidence across reflections to identify a primary context.';
      let maxContextCount = 0;
      Object.keys(contextCounts).forEach(ctx => {
        if (contextCounts[ctx] > maxContextCount) {
          maxContextCount = contextCounts[ctx];
          mostCommonContext = ctx;
        }
      });
      
      // Conflicts
      const conflicts = await db.getInternalConflicts(userId);
      const conflictCounts = {};
      conflicts.forEach(c => {
        const cat = c.category || `${c.partA || c.part_a} vs ${c.partB || c.part_b}` || 'Growth vs Safety';
        conflictCounts[cat] = (conflictCounts[cat] || 0) + 1;
      });
      let mostFrequentConflict = 'No unresolved psychological conflicts registered. Reflections are stable.';
      let maxConflictCount = 0;
      Object.keys(conflictCounts).forEach(cat => {
        if (conflictCounts[cat] > maxConflictCount) {
          maxConflictCount = conflictCounts[cat];
          mostFrequentConflict = cat;
        }
      });

      // Triggers
      const drivers = await db.getRootDrivers(userId);
      let mostCommonTrigger = 'The system is collecting evidence to identify your primary trigger.';
      if (drivers.length > 0) {
        mostCommonTrigger = drivers[0].rootDriver || drivers[0].root_driver || 'Evaluation';
      }

      // First memory recorded date
      let firstMemoryRecorded = 'June 2026';
      const firstDate = new Date(convs[0].created_at || new Date());
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      firstMemoryRecorded = `${months[firstDate.getMonth()]} ${firstDate.getFullYear()}`;

      // Recent Shift text
      let recentShift = 'Your core cognitive and emotional patterns have maintained a consistent equilibrium without major shifts.';
      if (patternsData.length > 0) {
        const weakeningP = patternsData.find(p => p.trend === 'Weakening' || p.trend === 'falling');
        const risingP = patternsData.find(p => p.trend === 'Increasing' || p.trend === 'rising');
        if (weakeningP) {
          recentShift = `${weakeningP.name} appears less dominant than last month.`;
        } else if (risingP) {
          recentShift = `${risingP.name} has registered higher activity recently.`;
        }
      }
      
      // Compile V2 Current Human Model summary narrative (Priority 2)
      let currentModelSummary = "Your self-awareness mirror is active. Reflect to synthesize a model.";
      if (patternsData.length > 0) {
        const topPattern = mostRecurringPattern;
        const ctx = mostCommonContext;
        const trigger = mostCommonTrigger;
        const conflict = mostFrequentConflict;
        
        currentModelSummary = `Dialogue history suggests a primary coping cycle around ${topPattern.toLowerCase()} triggered by concerns of ${trigger.toLowerCase()} in ${ctx.toLowerCase()} domains. You are currently navigating an internal conflict of ${conflict.toLowerCase()}, which manifests as ${recentShift.toLowerCase()}`;
      }

      // Compile V2 Behavioral Experiment (Priority 3)
      let currentExperiment = {
        action: "Observe your thoughts for 5 minutes without reacting.",
        purpose: "Build uncertainty tolerance and reduce automatic emotional avoidance.",
        expectedResistance: "Restlessness and an urge to check your phone or ask someone for their opinion.",
        successCondition: "Sat with the urge for 5 minutes without seeking reassurance or distraction."
      };
      
      const pNames = patternsData.map(p => p.name);
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

      await db.updateLongTermMemory(userId, {
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
  }
};
