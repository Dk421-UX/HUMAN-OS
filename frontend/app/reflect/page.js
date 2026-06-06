'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, RefreshCw, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '@/utils/api';
import Image from 'next/image';
import {
  trackReflectionSubmitted,
  trackPatternDetected,
  trackConflictDetected,
  trackExperimentGenerated,
  trackReflectionReset
} from '@/utils/analytics';

const LOADING_STEPS = [
  'Reading what you wrote...',
  'Looking at your history...',
  'Spotting your patterns...',
  'Connecting the dots...',
  'Putting it all together...'
];

export default function WritePage() {
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('idle');
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [ltm, setLtm] = useState(null);
  const [showMore, setShowMore] = useState(false);
  const [expandedPatterns, setExpandedPatterns] = useState({});
  const textareaRef = useRef(null);

  useEffect(() => {
    async function fetchLtm() {
      try {
        const memory = await api.getLongTermMemory();
        if (memory?.reflectionCount >= 3 || memory?.firstReflection) {
          setLtm(memory);
        }
      } catch { /* silent */ }
    }
    if (status === 'idle' || status === 'result') fetchLtm();
  }, [status]);

  useEffect(() => {
    let interval;
    if (status === 'loading') {
      interval = setInterval(() => {
        setLoadingStep(prev => Math.min(prev + 1, LOADING_STEPS.length - 1));
      }, 700);
    }
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim()) return;
    setStatus('loading');
    setLoadingStep(0);
    setError('');
    setResult(null);
    setShowMore(false);
    trackReflectionSubmitted(input.trim().split(/\s+/).length);
    try {
      const data = await api.analyze(input);
      setResult(data);
      setStatus('result');
      if (data?.patterns?.length) trackPatternDetected(data.patterns.length);
      if (data?.conflict?.category) trackConflictDetected(data.conflict.category);
      if (data?.experiment) trackExperimentGenerated();
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setStatus('error');
    }
  };

  const handleReset = () => {
    setInput('');
    setResult(null);
    setStatus('idle');
    setShowMore(false);
    trackReflectionReset();
  };

  const togglePatternExpand = (name) => {
    setExpandedPatterns(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const getTrendLabel = (trend) => {
    const t = String(trend || '').toLowerCase();
    if (['rising', 'increasing', 'strengthening'].includes(t)) return { label: 'Growing', color: 'text-[#6EE7FF]' };
    if (['falling', 'weakening', 'decreasing'].includes(t)) return { label: 'Fading', color: 'text-neutral-500' };
    if (['new', 'emerging'].includes(t)) return { label: 'New', color: 'text-violet-400' };
    if (t === 'resolved') return { label: 'Resolved', color: 'text-emerald-400' };
    return { label: 'Steady', color: 'text-neutral-400' };
  };

  return (
    <div className="w-full flex-1 flex flex-col items-center justify-center min-h-[75vh] py-6 pb-24">

      {/* Header */}
      <div className="w-full max-w-xl text-center mb-8 px-4">
        <h1 className="text-3xl font-light text-white font-serif mt-1">
          What&apos;s on your mind?
        </h1>
        <p className="text-sm text-[#A1A1AA] font-light mt-2 max-w-md mx-auto leading-relaxed">
          Write freely. A decision, a feeling, something you&apos;re stuck on. We&apos;ll find the pattern.
        </p>
      </div>

      <AnimatePresence mode="wait">

        {/* ── IDLE: Input form ── */}
        {status === 'idle' && (
          <motion.div
            key="input-form"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="w-full max-w-xl flex flex-col items-center px-4"
          >
            {/* Progress card — only when 3+ reflections */}
            {ltm && ltm.firstReflection && (
              <div className="w-full mb-6 premium-glass p-5 rounded-2xl border-white/5">
                <h2 className="text-[10px] tracking-widest uppercase text-[#71717A] mb-3 font-semibold flex items-center gap-1.5">
                  <Sparkles size={10} className="text-[#6EE7FF]" /> Your progress so far
                </h2>
                <div className="grid grid-cols-2 gap-x-5 gap-y-3">
                  <div>
                    <span className="text-[9px] uppercase tracking-widest text-[#71717A] block">Keeps coming up</span>
                    <span className="text-xs font-medium text-white/90 truncate block mt-0.5">{ltm.mostRecurringPattern || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase tracking-widest text-[#71717A] block">Getting stronger</span>
                    <span className="text-xs font-medium text-[#6EE7FF]/90 truncate block mt-0.5">{ltm.emergingTheme || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase tracking-widest text-[#71717A] block">Fading away</span>
                    <span className="text-xs font-medium text-neutral-400 truncate block mt-0.5">{ltm.patternBecomingWeaker || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase tracking-widest text-[#71717A] block">Most common context</span>
                    <span className="text-xs font-medium text-white/90 truncate block mt-0.5">{ltm.mostCommonContext || 'General'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Textarea */}
            <form onSubmit={handleSubmit} className="w-full">
              <div className="relative w-full rounded-2xl premium-glass p-6 border-white/5 focus-within:border-[#6EE7FF]/30 transition-all duration-500">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="What's been on your mind lately?"
                  className="w-full bg-transparent text-white placeholder-[#71717A] focus:outline-none resize-none min-h-[140px] text-base font-light leading-relaxed"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                />
                <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/[0.04]">
                  <span className="text-[10px] uppercase tracking-widest text-[#71717A]">Press Enter to submit</span>
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    type="submit"
                    disabled={!input.trim()}
                    className={`flex min-h-11 min-w-11 items-center justify-center p-2.5 rounded-full border transition-all duration-400 ${
                      input.trim()
                        ? 'bg-white border-white text-black cursor-pointer shadow-[0_0_20px_rgba(255,255,255,0.2)]'
                        : 'bg-transparent border-white/5 text-[#71717A] cursor-not-allowed'
                    }`}
                  >
                    <Send size={13} className="stroke-[2.5]" />
                  </motion.button>
                </div>
              </div>
            </form>
          </motion.div>
        )}

        {/* ── LOADING ── */}
        {status === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center text-center p-12 min-h-[300px] w-full max-w-xl px-4"
          >
            <div className="relative w-16 h-16 mb-8 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border border-white/5" />
              <div className="absolute inset-0 rounded-full border-t border-[#6EE7FF] animate-spin" style={{ animationDuration: '1.2s' }} />
              <div className="relative w-9 h-9 rounded-full overflow-hidden border border-white/10">
                <Image src="/logo.jpg" alt="" fill className="object-cover" />
              </div>
            </div>
            <div className="min-h-5 relative w-full flex justify-center max-w-xs">
              <AnimatePresence mode="popLayout">
                <motion.p
                  key={loadingStep}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.5 }}
                  className="text-xs uppercase tracking-widest text-[#A1A1AA] font-medium"
                >
                  {LOADING_STEPS[loadingStep]}
                </motion.p>
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* ── ERROR ── */}
        {status === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-xl premium-glass p-8 border-red-500/20 text-center mx-4"
          >
            <AlertCircle className="mx-auto text-red-400 mb-4 stroke-[1.5]" size={32} />
            <h3 className="text-white font-medium text-base mb-2">Couldn&apos;t analyse that</h3>
            <p className="text-sm text-[#A1A1AA] mb-8 font-light leading-relaxed">{error}</p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setStatus('idle')}
                className="min-h-11 px-5 py-2.5 rounded-full border border-white/10 text-[10px] uppercase tracking-wider text-[#A1A1AA] hover:bg-white/5 hover:text-white transition duration-300"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                className="min-h-11 px-5 py-2.5 rounded-full bg-white text-black text-[10px] uppercase tracking-wider font-semibold hover:bg-neutral-200 transition duration-300"
              >
                Try again
              </button>
            </div>
          </motion.div>
        )}

        {/* ── RESULT ── */}
        {status === 'result' && result && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-2xl flex flex-col gap-4 px-4"
          >
            {/* Top bar */}
            <div className="flex justify-between items-center px-1">
              <span className="text-[10px] uppercase tracking-widest text-[#71717A] font-semibold">Your reflection</span>
              <button
                onClick={handleReset}
                className="flex min-h-10 items-center gap-2 px-4 py-1.5 rounded-full border border-white/5 text-[9px] uppercase tracking-widest text-[#A1A1AA] hover:text-white hover:bg-white/5 transition-all duration-300"
              >
                <RefreshCw size={10} />
                Write again
              </button>
            </div>

            {/* Card 1 — What we noticed (always visible) */}
            <div className="premium-glass p-6 md:p-7 rounded-2xl border-[#6EE7FF]/12 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-[0.025] pointer-events-none">
                <Sparkles size={70} className="text-white" />
              </div>
              <span className="text-[10px] uppercase tracking-widest text-[#6EE7FF] font-semibold block mb-3">What we noticed</span>
              <p className="text-base md:text-lg font-light leading-relaxed text-white/95 font-serif">
                {result.observation || result.notices || result.summary}
              </p>
            </div>

            {/* Card 2 — What's holding you back (always visible, if exists) */}
            {result.conflict && (
              <div className="premium-glass p-6 rounded-2xl">
                <span className="text-[10px] uppercase tracking-widest text-[#71717A] font-semibold block mb-3">What&apos;s holding you back</span>
                <div className="grid grid-cols-2 gap-3 text-center mb-4">
                  <div className="flex flex-col gap-1 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <span className="text-[9px] uppercase tracking-widest text-[#71717A]">You want</span>
                    <span className="text-sm text-white font-medium leading-snug">{result.conflict.want}</span>
                  </div>
                  <div className="flex flex-col gap-1 p-3 rounded-xl bg-[#6EE7FF]/[0.03] border border-[#6EE7FF]/[0.06]">
                    <span className="text-[9px] uppercase tracking-widest text-[#6EE7FF]">But fear</span>
                    <span className="text-sm text-[#6EE7FF] font-medium leading-snug">{result.conflict.fear}</span>
                  </div>
                </div>
                <p className="text-sm text-[#A1A1AA] font-light leading-relaxed">{result.conflict.tension}</p>
              </div>
            )}

            {/* Card 3 — Think about this (always visible) */}
            {(result.reflection_question || result.reflectionQuestion || result.question) && (
              <div className="premium-glass p-6 rounded-2xl bg-white/[0.01] border-white/5">
                <span className="text-[10px] uppercase tracking-widest text-[#71717A] font-semibold block mb-3">Think about this</span>
                <p className="text-base font-light text-white italic leading-relaxed font-serif">
                  &ldquo;{result.reflection_question || result.reflectionQuestion || result.question}&rdquo;
                </p>
              </div>
            )}

            {/* Card 4 — Try this today (always visible) */}
            {result.experiment && (
              <div className="premium-glass p-6 rounded-2xl border-emerald-500/15">
                <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-semibold block mb-3">Try this today</span>
                <p className="text-base font-medium text-white/95 leading-relaxed">
                  {result.experiment}
                </p>
              </div>
            )}

            {/* ── SHOW MORE TOGGLE ── */}
            {(result.evolution || result.blind_spots?.length || result.patterns?.length) && (
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setShowMore(v => !v)}
                  className="flex items-center justify-center gap-2 py-2.5 text-[10px] uppercase tracking-widest text-[#71717A] hover:text-[#A1A1AA] transition-colors duration-300 w-full"
                >
                  {showMore ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  {showMore ? 'Show less' : 'See more details'}
                </button>

                <AnimatePresence>
                  {showMore && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden flex flex-col gap-4"
                    >
                      {/* What's changing */}
                      {result.evolution && (
                        <div className="premium-glass p-5 rounded-xl">
                          <span className="text-[10px] uppercase tracking-widest text-[#71717A] font-semibold block mb-2">What&apos;s changing</span>
                          <p className="text-sm text-[#A1A1AA] font-light leading-relaxed">{result.evolution}</p>
                        </div>
                      )}

                      {/* Blind spots */}
                      {result.blind_spots?.length > 0 && (
                        <div className="premium-glass p-5 rounded-xl flex flex-col gap-3">
                          <span className="text-[10px] uppercase tracking-widest text-[#71717A] font-semibold">Something you might be missing</span>
                          {result.blind_spots.map((spot, idx) => (
                            <div key={idx} className="flex flex-col gap-1.5 border-t border-white/[0.04] pt-3 first:border-0 first:pt-0">
                              <p className="text-xs text-white/50 line-through font-light">{spot.contradiction}</p>
                              <p className="text-sm text-white font-light leading-relaxed">{spot.revealed_truth || spot.revealedTruth}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Patterns */}
                      {result.patterns?.length > 0 && (
                        <div className="premium-glass p-5 rounded-xl flex flex-col gap-3">
                          <span className="text-[10px] uppercase tracking-widest text-[#71717A] font-semibold">Thought patterns spotted</span>
                          <div className="flex flex-col gap-2">
                            {result.patterns.map((pat, idx) => {
                              const { label, color } = getTrendLabel(pat.trend);
                              const isExpanded = !!expandedPatterns[pat.name];
                              return (
                                <div key={idx} className="border border-white/5 rounded-xl overflow-hidden">
                                  <div
                                    onClick={() => togglePatternExpand(pat.name)}
                                    className="px-4 py-3 flex justify-between items-center cursor-pointer"
                                  >
                                    <span className="text-sm text-white/90 font-medium">{pat.name}</span>
                                    <span className={`text-[10px] font-semibold ${color}`}>{label}</span>
                                  </div>
                                  <AnimatePresence>
                                    {isExpanded && (
                                      <motion.div
                                        initial={{ height: 0 }}
                                        animate={{ height: 'auto' }}
                                        exit={{ height: 0 }}
                                        className="overflow-hidden border-t border-white/[0.04] bg-[#050505]/40 px-4 py-3 text-xs text-[#A1A1AA] font-light"
                                      >
                                        {pat.evidence && <p className="italic font-serif">&ldquo;{pat.evidence}&rdquo;</p>}
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
