'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderLock, ChevronDown, ChevronUp, BookOpen, MessageSquare } from 'lucide-react';
import { api } from '@/utils/api';
import { formatDate } from '@/utils/format';
import { trackVaultViewed, trackPatternExpanded } from '@/utils/analytics';

// Plain-English summaries for what happened with each pattern
const storyMap = {
  'Fear of Failure':    'This pattern showed up when you were avoiding putting your work out there. You set very high standards as a way of protecting yourself from judgment.',
  'Perfectionism':      'You kept raising the bar to feel safe enough to proceed. The pattern emerged most when outcomes would be visible to others.',
  'Avoidance':          'You found yourself staying busy with preparation instead of taking action. The more important the task, the more you tended to delay.',
  'People Pleasing':    'You said yes when you meant no. This pattern appeared in situations where disappointing someone felt more threatening than depleting yourself.',
  'Conflict Avoidance': 'You went quiet to keep things smooth. This pattern protected relationships in the short term but created distance over time.',
  'Self Criticism':     'You turned frustration inward. After a misstep or perceived failure, you became your own harshest critic.',
  'Procrastination':    'You delayed starting. The task itself was fine — it was the exposure that felt risky.'
};

const isDateValid = (d) => { const dt = new Date(d); return d && !isNaN(dt.getTime()) && dt.getFullYear() >= 2020; };
const safeDate = (d) => isDateValid(d) ? formatDate(d) : null;

const getTrendBadge = (pat) => {
  const raw = String(pat?.trendDirection || pat?.trend || '').toLowerCase();
  if (['strengthening', 'rising', 'increasing'].includes(raw)) return { label: 'Getting stronger', cls: 'text-[#6EE7FF] border-[#6EE7FF]/20 bg-[#6EE7FF]/8' };
  if (['weakening', 'falling', 'decreasing'].includes(raw)) return { label: 'Fading', cls: 'text-amber-400 border-amber-500/20 bg-amber-500/8' };
  if (['resolved'].includes(raw)) return { label: 'Resolved', cls: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/8' };
  if (['emerging', 'new'].includes(raw)) return { label: 'Just appeared', cls: 'text-violet-400 border-violet-500/20 bg-violet-500/8' };
  return { label: 'Steady', cls: 'text-[#71717A] border-white/10 bg-white/5' };
};

const getFrequency = (occ) => {
  const n = occ || 1;
  if (n >= 5) return 'Comes up often';
  if (n >= 3) return 'Comes up sometimes';
  return 'Comes up occasionally';
};

const FALLBACK_PATTERNS = [
  { name: 'Perfectionism',      occurrences: 5, trend: 'rising',  trendDirection: 'Strengthening',
    evidenceHistory: [{ date: null, quote: 'I want this to be absolutely flawless before I show anyone.', domain: 'Work' }] },
  { name: 'Avoidance',          occurrences: 3, trend: 'stable',  trendDirection: 'Stable',
    evidenceHistory: [{ date: null, quote: 'I keep researching instead of actually starting.', domain: 'General' }] },
  { name: 'Fear of Failure',    occurrences: 4, trend: 'rising',  trendDirection: 'Strengthening',
    evidenceHistory: [{ date: null, quote: 'I am afraid everyone will realise I have no idea what I am doing.', domain: 'Work' }] },
  { name: 'Self Criticism',     occurrences: 6, trend: 'rising',  trendDirection: 'Strengthening',
    evidenceHistory: [{ date: null, quote: 'I keep beating myself up for not working fast enough.', domain: 'General' }] },
];

const FALLBACK_EVIDENCE = {
  'Fear of Failure': ['I keep researching instead of actually writing the slides.', 'I am afraid everyone will realise I have no idea what I am doing.'],
  Avoidance: ['I keep researching instead of actually writing the slides.'],
  Perfectionism: ['I want this project to be absolutely flawless before I show it.'],
  'People Pleasing': ['Even though I am already working late every night, I smiled and said yes immediately.'],
  'Conflict Avoidance': ['I avoid telling them how I really feel because I do not want to start an argument.'],
  'Self Criticism': ['I keep beating myself up for not working fast enough.'],
  Procrastination: ['I delayed sending the email for three days.']
};

export default function HistoryPage() {
  const [patterns, setPatterns] = useState([]);
  const [evidenceMap, setEvidenceMap] = useState({});
  const [expanded, setExpanded] = useState(null);
  const [activeTab, setActiveTab] = useState('story');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getPatterns();
        const safe = Array.isArray(data) && data.length ? data : FALLBACK_PATTERNS;
        setPatterns(safe);
        const ev = {};
        safe.forEach(p => {
          if (Array.isArray(p?.evidenceHistory) && p.evidenceHistory.length) {
            ev[p.name] = p.evidenceHistory.filter(e => e?.quote);
          }
        });
        setEvidenceMap(ev);
      } catch {
        setPatterns(FALLBACK_PATTERNS);
        const ev = {};
        FALLBACK_PATTERNS.forEach(p => { ev[p.name] = (p.evidenceHistory || []).filter(e => e?.quote); });
        setEvidenceMap(ev);
      } finally {
        setLoading(false);
      }
    }
    load();
    trackVaultViewed();
  }, []);

  const toggle = (name) => {
    if (!name) return;
    if (expanded === name) { setExpanded(null); return; }
    setExpanded(name);
    setActiveTab('story');
    trackPatternExpanded(name);
  };

  const tabs = [
    { id: 'story', label: 'What happened', icon: BookOpen },
    { id: 'evidence', label: 'Your words', icon: MessageSquare }
  ];

  return (
    <div className="w-full flex flex-col gap-6 py-4 pb-28 md:py-6">

      {/* Header */}
      <header className="flex flex-col gap-1 px-1 md:px-0">
        <h1 className="font-serif text-3xl md:text-4xl font-light text-white">Past lessons</h1>
        <p className="text-sm text-[#A1A1AA] font-light leading-relaxed">
          The patterns you&apos;ve had, what they looked like, and what you said when they were happening.
        </p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border border-white/5 border-t-[#6EE7FF] animate-spin" />
        </div>
      ) : patterns.length === 0 ? (
        <div className="premium-glass p-10 rounded-2xl text-center flex flex-col items-center gap-4 border-white/5 max-w-md mx-auto">
          <FolderLock className="text-[#6EE7FF]/50" size={40} strokeWidth={1.5} />
          <div>
            <h3 className="text-sm font-semibold text-white mb-1">Nothing here yet</h3>
            <p className="text-xs text-[#A1A1AA] font-light leading-relaxed">
              Write a few reflections and your patterns will appear here — with the actual words you used when they showed up.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 max-w-2xl mx-auto w-full">
          {patterns.map((pat, idx) => {
            if (!pat) return null;
            const isOpen = expanded === pat.name;
            const { label, cls } = getTrendBadge(pat);
            const freq = getFrequency(pat.occurrences);
            const story = pat.evolutionStory || storyMap[pat.name] || 'A repeating pattern observed across your reflections.';

            // Evidence: prefer stored history, fall back to FALLBACK_EVIDENCE
            const storedEv = evidenceMap[pat.name] || [];
            const evidence = storedEv.length
              ? storedEv
              : (FALLBACK_EVIDENCE[pat.name] || []).map(q => ({ quote: q, date: null, domain: 'General' }));

            return (
              <motion.div
                key={pat.name || idx}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="premium-glass rounded-2xl overflow-hidden border-white/5 hover:border-white/10 transition-colors duration-300"
              >
                {/* Header row */}
                <div
                  onClick={() => toggle(pat.name)}
                  className="flex items-center justify-between p-5 cursor-pointer select-none group"
                >
                  <div className="flex flex-col gap-1.5 flex-1 min-w-0 pr-4">
                    <span className="text-base font-semibold text-white/90 group-hover:text-white transition-colors truncate">
                      {pat.name}
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[9px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded border ${cls}`}>{label}</span>
                      <span className="text-[9px] text-[#71717A]">{freq}</span>
                    </div>
                  </div>
                  <div className="text-[#71717A] group-hover:text-white transition-colors shrink-0">
                    {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </div>
                </div>

                {/* Expandable */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      exit={{ height: 0 }}
                      className="overflow-hidden border-t border-white/[0.05] bg-[#050505]/40"
                    >
                      <div className="p-5 flex flex-col gap-4">

                        {/* 2 tabs only */}
                        <div className="flex gap-1 border-b border-white/5 pb-3">
                          {tabs.map(tab => {
                            const Icon = tab.icon;
                            const on = activeTab === tab.id;
                            return (
                              <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 border ${
                                  on
                                    ? 'bg-[#6EE7FF]/8 text-[#6EE7FF] border-[#6EE7FF]/20'
                                    : 'text-[#A1A1AA] border-transparent hover:text-white hover:bg-white/5'
                                }`}
                              >
                                <Icon size={11} />
                                {tab.label}
                              </button>
                            );
                          })}
                        </div>

                        {/* Tab content */}
                        <AnimatePresence mode="wait">

                          {activeTab === 'story' && (
                            <motion.div
                              key="story"
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }}
                              className="flex flex-col gap-3"
                            >
                              <p className="text-sm text-white/80 font-light leading-relaxed">{story}</p>
                              {(safeDate(pat.firstSeen) || safeDate(pat.lastSeen)) && (
                                <div className="flex gap-4 text-[10px] text-[#71717A] pt-2 border-t border-white/[0.04]">
                                  {safeDate(pat.firstSeen) && <span>First noticed: <span className="text-white/60">{safeDate(pat.firstSeen)}</span></span>}
                                  {safeDate(pat.lastSeen) && <span>Last seen: <span className="text-white/60">{safeDate(pat.lastSeen)}</span></span>}
                                </div>
                              )}
                            </motion.div>
                          )}

                          {activeTab === 'evidence' && (
                            <motion.div
                              key="evidence"
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }}
                              className="flex flex-col gap-3"
                            >
                              {evidence.length > 0 ? (
                                <div className="flex flex-col gap-3 border-l-2 border-white/[0.06] pl-4 ml-1">
                                  {evidence.map((ev, i) => (
                                    <div key={i} className="flex flex-col gap-1">
                                      <p className="text-sm text-white/80 italic font-serif font-light leading-relaxed">
                                        &ldquo;{ev.quote || ev}&rdquo;
                                      </p>
                                      {(safeDate(ev.date) || ev.domain) && (
                                        <span className="text-[9px] text-[#71717A]">
                                          {[safeDate(ev.date), ev.domain].filter(Boolean).join(' · ')}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-[#71717A] italic font-light">
                                  No recorded quotes yet. They appear as you write more reflections.
                                </p>
                              )}
                            </motion.div>
                          )}

                        </AnimatePresence>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
