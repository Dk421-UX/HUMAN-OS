'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Eye, TrendingUp, Zap } from 'lucide-react';
import { api } from '@/utils/api';
import { trackMirrorViewed } from '@/utils/analytics';

const fallbackMemory = {
  mostRecurringPattern: 'Perfectionism',
  mostCommonContext: 'career',
  mostFrequentConflict: 'Action vs Certainty',
  recentShift: 'Avoidance is coming up less often than before.',
  emergingTheme: 'A growing ability to act before everything feels perfect.',
  patternBecomingWeaker: 'Self Criticism',
  currentExperiment: { action: 'Notice when you hesitate before sharing your work. That moment is the pattern.' }
};

function Card({ icon: Icon, label, accent = false, children }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className={`premium-glass rounded-2xl p-6 md:p-7 flex flex-col gap-3 ${accent ? 'border-[#6EE7FF]/15' : 'border-white/5'}`}
    >
      <div className={`flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest ${accent ? 'text-[#6EE7FF]' : 'text-[#71717A]'}`}>
        <Icon size={12} className="stroke-[1.5]" />
        {label}
      </div>
      <div className="text-sm md:text-base font-light leading-relaxed text-white/90">
        {children}
      </div>
    </motion.section>
  );
}

export default function InsightsPage() {
  const [memory, setMemory] = useState(null);
  const [patterns, setPatterns] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [mem, pats, cons] = await Promise.all([
          api.getLongTermMemory(),
          api.getPatterns(),
          api.getInternalConflicts()
        ]);
        setMemory(Object.keys(mem || {}).length ? mem : fallbackMemory);
        setPatterns(Array.isArray(pats) ? pats : []);
        setConflicts(Array.isArray(cons) ? cons : []);
      } catch {
        setMemory(fallbackMemory);
      } finally {
        setLoading(false);
      }
    }
    load();
    trackMirrorViewed();
  }, []);

  const model = useMemo(() => {
    const m = memory || fallbackMemory;
    const topPattern = [...patterns].sort((a, b) => (b.occurrences || 0) - (a.occurrences || 0))[0];
    const conflict = conflicts[0];
    const weakening = patterns.find(p => ['Weakening', 'falling', 'Resolved'].includes(p.trend));

    // Card 1 — What keeps showing up
    const showing = m.mostRecurringPattern || topPattern?.name || 'a repeating pattern';
    const context = m.mostCommonContext?.toLowerCase() || 'daily life';
    const card1 = `${showing} keeps coming up, especially in ${context} situations. This is the pattern your mind returns to most.`;

    // Card 2 — What's holding you back
    const conflictText = conflict?.tension
      || (m.mostFrequentConflict && m.mostFrequentConflict !== 'None'
        ? `Part of you wants ${m.mostFrequentConflict.split(' vs ')[0]}. Another part wants ${m.mostFrequentConflict.split(' vs ')[1] || 'certainty'}. This back-and-forth is what creates friction.`
        : null);
    const card2 = conflictText || 'Write a few more reflections and we\'ll show you the tension that holds you back most.';

    // Card 3 — What's getting better (merge emerging + weakening)
    let card3 = 'Keep writing — we\'ll show you what\'s improving as patterns become clearer.';
    if (weakening) card3 = `${weakening.name} is coming up less. That\'s a real shift.`;
    else if (m.emergingTheme && m.emergingTheme !== 'None') card3 = m.emergingTheme;
    else if (m.recentShift && m.recentShift !== 'None') card3 = m.recentShift;
    else if (m.patternBecomingWeaker && m.patternBecomingWeaker !== 'None') card3 = `${m.patternBecomingWeaker} is becoming less central than before.`;

    // Card 4 — What to do next (one action sentence)
    const card4 = m.currentExperiment?.action
      || (m.mostFrequentConflict && m.mostFrequentConflict !== 'None'
        ? `Next time you feel the pull between ${m.mostFrequentConflict.split(' vs ')[0]?.toLowerCase() || 'action'} and ${m.mostFrequentConflict.split(' vs ')[1]?.toLowerCase() || 'certainty'}, pause for 60 seconds before deciding.`
        : 'Write one reflection today. Even a paragraph reveals something useful.');

    return { card1, card2, card3, card4 };
  }, [memory, patterns, conflicts]);

  return (
    <div className="w-full flex flex-col gap-5 py-4 pb-28 md:py-6">

      <header className="flex flex-col gap-1 px-1 md:px-0 mb-1">
        <h1 className="font-serif text-3xl md:text-4xl font-light text-white">
          Your snapshot
        </h1>
        <p className="text-sm text-[#A1A1AA] font-light">
          Four things Human OS understands about you right now.
        </p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border border-white/5 border-t-[#6EE7FF] animate-spin" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">

          {/* Card 1 — What keeps showing up */}
          <Card icon={Eye} label="What keeps showing up" accent>
            {model.card1}
          </Card>

          {/* Cards 2 & 3 — side by side on desktop */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card icon={AlertCircle} label="What's holding you back">
              {model.card2}
            </Card>
            <Card icon={TrendingUp} label="What's getting better">
              {model.card3}
            </Card>
          </div>

          {/* Card 4 — What to do next */}
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="premium-glass rounded-2xl p-6 md:p-7 border-emerald-500/15 flex flex-col gap-3"
          >
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-emerald-400">
              <Zap size={12} className="stroke-[1.5]" />
              What to do next
            </div>
            <p className="text-base font-medium text-white/95 leading-relaxed">
              {model.card4}
            </p>
          </motion.section>

        </div>
      )}
    </div>
  );
}
