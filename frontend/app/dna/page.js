'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Dna, Sparkles, ChevronDown, ChevronUp, Link2, Compass } from 'lucide-react';
import { api } from '@/utils/api';
import { formatDate } from '@/utils/format';
import { trackDNAViewed, trackPatternSelected } from '@/utils/analytics';

const fallbackPatterns = [
  {
    name: 'Perfectionism',
    contexts: ['Career'],
    triggers: ['Evaluation', 'Visible outcomes'],
    relatedPatterns: ['Fear of Failure', 'Avoidance'],
    trendDirection: 'Stable',
    trend: 'Stable',
    occurrences: 5,
    evolutionStory: 'This pattern appears most strongly when outcomes become visible to others.'
  }
];

// Plain-English one-liners per pattern
const plainSummary = {
  Perfectionism: 'You hold yourself to very high standards — often so high that starting feels scary.',
  Avoidance: 'When something feels risky or uncomfortable, you find reasons to delay.',
  'Fear of Failure': 'You avoid putting yourself out there because failure feels like proof you\'re not good enough.',
  'Self Criticism': 'When something goes wrong, you turn on yourself instead of learning and moving on.',
  'Overthinking Loops': 'You get stuck thinking through every possible outcome instead of just deciding.',
  'People Pleasing': 'You say yes to others even when it costs you — because disappointing them feels worse.',
  'Conflict Avoidance': 'You stay quiet to keep the peace, even when speaking up would help.',
  default: 'A pattern that repeats in the way you think, decide, or protect yourself.'
};

// 4-row chain: Fear → Protection → Cost → Grow
const CHAINS = {
  Perfectionism:        { fear: 'Fear of failure',              protection: 'Raise the bar so high that failure becomes unlikely',  cost: 'You never finish — or you finish late and exhausted',      grow: 'Ship it before it\'s perfect. See what happens.' },
  Avoidance:            { fear: 'Fear of negative judgment',    protection: 'Stay busy with preparation instead of action',          cost: 'Opportunities pass while you\'re still getting ready',     grow: 'Do one small piece of the thing you\'ve been avoiding.' },
  'Fear of Failure':    { fear: 'Fear that failure = worthlessness', protection: 'Only attempt things you\'re likely to succeed at', cost: 'You stay small to stay safe',                              grow: 'Try something where failure is survivable. Learn from it.' },
  'Self Criticism':     { fear: 'Fear of losing your edge',     protection: 'Criticise yourself before others can',                  cost: 'Low energy, low confidence, high exhaustion',              grow: 'Notice the inner critic. Name it. Don\'t obey it.' },
  'Overthinking Loops': { fear: 'Fear of choosing wrong',       protection: 'Keep analysing until certainty arrives',                cost: 'Decisions drag, momentum dies',                            grow: 'Set a deadline. Decide by then, even without certainty.' },
  'People Pleasing':    { fear: 'Fear of rejection or abandonment', protection: 'Say yes to everyone to keep the peace',             cost: 'Resentment builds, your needs go unmet',                   grow: 'Say no to one small thing this week.' },
  'Conflict Avoidance': { fear: 'Fear of damaging relationships', protection: 'Go quiet, agree, or change the subject',              cost: 'Problems fester, relationships become shallow',            grow: 'Name one thing you\'ve been avoiding saying.' },
  default:              { fear: 'Fear of emotional discomfort', protection: 'Avoid the situation or numb the feeling',               cost: 'The pattern keeps repeating',                              grow: 'Notice the moment it starts. That awareness is the first step.' }
};

const getTrendLabel = (pattern) => {
  const t = String(pattern?.trendDirection || pattern?.trend || '').toLowerCase();
  if (['strengthening', 'rising', 'increasing'].includes(t)) return { label: 'Growing stronger', color: 'text-[#6EE7FF]' };
  if (['weakening', 'falling', 'decreasing'].includes(t)) return { label: 'Fading', color: 'text-amber-400' };
  if (['emerging', 'new'].includes(t)) return { label: 'Just appeared', color: 'text-violet-400' };
  if (t === 'resolved') return { label: 'Resolved', color: 'text-emerald-400' };
  return { label: 'Steady', color: 'text-[#71717A]' };
};

const asList = (v) => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.keys(v) : []);

function PatternButton({ pattern, active, onClick }) {
  const { label, color } = getTrendLabel(pattern);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-16 rounded-xl border p-4 text-left transition-all duration-300 ${
        active
          ? 'border-[#6EE7FF]/30 bg-[#6EE7FF]/[0.04] shadow-[0_0_16px_rgba(110,231,255,0.04)]'
          : 'border-white/[0.05] bg-white/[0.005] hover:border-white/10'
      }`}
    >
      <div className="text-sm font-semibold text-white/90">{pattern.name}</div>
      <div className={`mt-1 text-[10px] font-semibold ${color}`}>{label}</div>
    </button>
  );
}

export default function UnderstandPage() {
  const [patterns, setPatterns] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showMore, setShowMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getPatterns();
        const safe = Array.isArray(data) && data.length ? data : fallbackPatterns;
        setPatterns(safe);
        setSelected(safe[0]);
      } catch {
        setError('Showing example data.');
        setPatterns(fallbackPatterns);
        setSelected(fallbackPatterns[0]);
      } finally {
        setLoading(false);
      }
    }
    load();
    trackDNAViewed();
  }, []);

  const chain = useMemo(() => CHAINS[selected?.name] || CHAINS.default, [selected]);
  const summary = useMemo(() => plainSummary[selected?.name] || plainSummary.default, [selected]);
  const triggers = useMemo(() => {
    const explicit = asList(selected?.triggers);
    if (explicit.length) return explicit;
    return asList(selected?.contexts).map(c => `${c} situations`);
  }, [selected]);
  const related = useMemo(() => asList(selected?.relatedPatterns), [selected]);

  const handleSelect = (p) => {
    setSelected(p);
    setShowMore(false);
    trackPatternSelected(p?.name);
  };

  return (
    <div className="w-full flex flex-col gap-6 py-4 pb-28 md:py-6">

      {/* Header */}
      <header className="flex flex-col gap-1 px-1 md:px-0">
        <h1 className="font-serif text-3xl md:text-4xl font-light text-white">Your thought patterns</h1>
        <p className="text-sm text-[#A1A1AA] font-light leading-relaxed">
          Select a pattern to understand why it exists and how to shift it.
        </p>
        {error && <span className="text-[10px] text-[#6EE7FF] mt-1">{error}</span>}
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border border-white/5 border-t-[#6EE7FF] animate-spin" />
        </div>
      ) : (
        <div className="flex flex-col gap-5">

          {/* Pattern selector */}
          <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-3">
            {patterns.map(p => (
              <PatternButton key={p.name} pattern={p} active={selected?.name === p.name} onClick={() => handleSelect(p)} />
            ))}
          </div>

          {/* Detail panel */}
          {selected && (
            <motion.div
              key={selected.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-4"
            >

              {/* Plain-English summary */}
              <div className="premium-glass p-6 rounded-2xl border-[#6EE7FF]/12 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-[0.025] pointer-events-none">
                  <Sparkles size={60} className="text-white" />
                </div>
                <span className="text-[10px] uppercase tracking-widest text-[#6EE7FF] font-semibold block mb-2">
                  What this is
                </span>
                <h2 className="font-serif text-2xl text-white font-light mb-2">{selected.name}</h2>
                <p className="text-sm text-[#A1A1AA] font-light leading-relaxed">{summary}</p>
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/[0.04]">
                  <span className="text-[9px] uppercase tracking-widest text-[#71717A]">
                    Seen {selected.occurrences || 1} time{(selected.occurrences || 1) !== 1 ? 's' : ''}
                    {selected.occurrences >= 5 ? ' — comes up often' : selected.occurrences >= 3 ? ' — comes up sometimes' : ' — comes up occasionally'}
                  </span>
                </div>
              </div>

              {/* 4-row chain */}
              <div className="premium-glass p-6 rounded-2xl border-white/5 flex flex-col gap-0">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#71717A] font-semibold mb-4">
                  <Dna size={12} className="stroke-[1.5]" />
                  How this pattern works
                </div>
                <div className="flex flex-col gap-0">
                  {[
                    { label: "What you're afraid of", value: chain.fear, accent: true },
                    { label: 'How you protect yourself', value: chain.protection },
                    { label: 'What it costs you', value: chain.cost, red: true },
                    { label: 'How to grow past it', value: chain.grow, green: true }
                  ].map((row, i, arr) => (
                    <div key={i}>
                      <div className={`p-4 rounded-xl ${
                        row.green ? 'bg-emerald-500/[0.04] border border-emerald-500/12' :
                        row.red ? 'bg-red-500/[0.03] border border-red-500/10' :
                        row.accent ? 'bg-[#6EE7FF]/[0.03] border border-[#6EE7FF]/10' :
                        'bg-white/[0.015] border border-white/[0.04]'
                      }`}>
                        <span className={`text-[9px] uppercase tracking-wider block mb-1 font-semibold ${
                          row.green ? 'text-emerald-400' :
                          row.red ? 'text-red-400/70' :
                          row.accent ? 'text-[#6EE7FF]' :
                          'text-[#71717A]'
                        }`}>{row.label}</span>
                        <span className="text-sm text-white/90 font-light leading-snug">{row.value}</span>
                      </div>
                      {i < arr.length - 1 && (
                        <div className="flex justify-center py-1">
                          <div className="w-px h-4 bg-white/10" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Show more toggle — triggers, history, related */}
              {(triggers.length > 0 || related.length > 0 || selected.firstSeen) && (
                <div>
                  <button
                    onClick={() => setShowMore(v => !v)}
                    className="flex items-center justify-center gap-2 py-2 w-full text-[10px] uppercase tracking-widest text-[#71717A] hover:text-[#A1A1AA] transition-colors duration-300"
                  >
                    {showMore ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    {showMore ? 'Show less' : 'More about this pattern'}
                  </button>

                  <AnimatePresence>
                    {showMore && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="premium-glass p-5 rounded-2xl border-white/5 flex flex-col gap-4 mt-2">

                          {triggers.length > 0 && (
                            <div>
                              <span className="text-[9px] uppercase tracking-widest text-[#71717A] font-semibold block mb-2">What sets it off</span>
                              <div className="flex flex-wrap gap-1.5">
                                {triggers.map(t => (
                                  <span key={t} className="text-[11px] px-3 py-1 rounded-full border border-white/10 text-[#A1A1AA] bg-white/[0.01]">{t}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {selected.firstSeen && (
                            <div className="border-t border-white/[0.04] pt-4">
                              <span className="text-[9px] uppercase tracking-widest text-[#71717A] font-semibold block mb-1">How long you've had this</span>
                              <p className="text-xs text-[#A1A1AA] font-light">
                                First spotted {formatDate(selected.firstSeen)}.{' '}
                                {selected.lastSeen ? `Still active as of ${formatDate(selected.lastSeen)}.` : ''}
                              </p>
                            </div>
                          )}

                          {related.length > 0 && (
                            <div className="border-t border-white/[0.04] pt-4">
                              <span className="text-[9px] uppercase tracking-widest text-[#71717A] font-semibold block mb-2 flex items-center gap-1.5">
                                <Link2 size={10} className="inline" /> Patterns connected to this one
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {related.map(r => (
                                  <span key={r} className="text-[11px] px-3 py-1 rounded-full border border-[#6EE7FF]/15 text-[#6EE7FF] bg-[#6EE7FF]/[0.03]">{r}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Link to Graph */}
              <a
                href="/graph"
                className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#71717A] hover:text-[#6EE7FF] transition-colors duration-300 justify-center py-2"
              >
                <Compass size={11} className="stroke-[1.5]" />
                See how your patterns connect →
              </a>

            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
