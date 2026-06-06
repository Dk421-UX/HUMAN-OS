'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, AlertCircle, TrendingUp, ArrowRight, Sparkles, Zap } from 'lucide-react';
import { api } from '@/utils/api';
import Link from 'next/link';

export default function TodayPage() {
  const [memory, setMemory] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getLongTermMemory();
        setMemory(data);
      } catch {
        // use nulls — cards show helpful empty states
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const hasData = !!(memory?.mostRecurringPattern && memory.mostRecurringPattern !== 'None');

  // Derive one plain-language action sentence
  const getAction = () => {
    if (memory?.currentExperiment?.action) return memory.currentExperiment.action;
    if (memory?.mostFrequentConflict && memory.mostFrequentConflict !== 'None') {
      return `Notice the next time you feel pulled between ${memory.mostFrequentConflict.split(' vs ')[0]?.toLowerCase() || 'action'} and ${memory.mostFrequentConflict.split(' vs ')[1]?.toLowerCase() || 'certainty'}. Don't solve it — just notice it.`;
    }
    return 'Write one reflection today. Even 3 sentences is enough to start seeing your patterns.';
  };

  // What's getting better — merge recentShift + emergingTheme
  const getBetter = () => {
    const shift = memory?.recentShift;
    const theme = memory?.emergingTheme;
    if (shift && shift !== 'None' && shift !== 'Unknown') return shift;
    if (theme && theme !== 'None') return `${theme} is becoming more visible in your reflections.`;
    return 'Keep writing — after a few reflections, we\'ll show you what\'s improving.';
  };

  return (
    <div className="w-full flex flex-col gap-6 py-4 pb-28 md:py-6">

      {/* Header */}
      <header className="flex flex-col gap-1 px-1 md:px-0">
        <h1 className="font-serif text-3xl md:text-4xl font-light text-white">
          How you&apos;re doing
        </h1>
        <p className="text-sm text-[#A1A1AA] font-light leading-relaxed">
          {hasData ? 'Based on your reflections.' : 'Write your first reflection to get started.'}
        </p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20 min-h-[50vh]">
          <div className="w-8 h-8 rounded-full border border-white/5 border-t-[#6EE7FF] animate-spin" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">

          {/* CARD 1 — What keeps showing up */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0 }}
            className="w-full premium-glass p-6 md:p-7 rounded-2xl border-[#6EE7FF]/15 shadow-[0_16px_40px_rgba(0,0,0,0.7)] relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-28 h-28 bg-[#6EE7FF]/[0.025] blur-2xl rounded-full pointer-events-none" />
            <div className="flex items-center gap-2 mb-3">
              <Eye size={13} className="text-[#6EE7FF] stroke-[1.5]" />
              <span className="text-[10px] uppercase tracking-widest text-[#6EE7FF] font-semibold">What keeps showing up</span>
            </div>
            <p className="text-base md:text-lg font-light leading-relaxed text-white/90 font-serif">
              {memory?.mostRecurringPattern && memory.mostRecurringPattern !== 'None' ? (
                <>
                  <span className="text-white font-medium">{memory.mostRecurringPattern}</span>
                  {' '}keeps coming up in your life, especially in{' '}
                  <span className="text-[#6EE7FF]">{memory.mostCommonContext?.toLowerCase() || 'daily'}</span> situations.
                  {memory.currentModelSummary && memory.currentModelSummary !== 'None' && (
                    <span className="block mt-2 text-sm text-[#A1A1AA]">{memory.currentModelSummary}</span>
                  )}
                </>
              ) : (
                "You haven't written enough yet for patterns to appear. Write a few reflections and this will fill in."
              )}
            </p>
          </motion.section>

          {/* CARDS 2 & 3 — side by side on desktop */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* CARD 2 — What's holding you back */}
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.07 }}
              className="premium-glass p-6 rounded-xl border-white/5 flex flex-col gap-2"
            >
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle size={13} className="text-[#A1A1AA] stroke-[1.5]" />
                <span className="text-[10px] uppercase tracking-widest text-[#71717A] font-semibold">What&apos;s holding you back</span>
              </div>
              <p className="text-sm text-white/85 font-light leading-relaxed">
                {memory?.mostFrequentConflict && memory.mostFrequentConflict !== 'None' ? (
                  <>
                    Part of you wants{' '}
                    <span className="text-white font-medium">{memory.mostFrequentConflict.split(' vs ')[0]}</span>.
                    {' '}Another part wants{' '}
                    <span className="text-white font-medium">{memory.mostFrequentConflict.split(' vs ')[1] || 'certainty'}</span>.
                    {' '}This is the tension you feel most often.
                  </>
                ) : (
                  "Reflect a few more times and we'll show you the tension that holds you back most."
                )}
              </p>
            </motion.section>

            {/* CARD 3 — What's getting better */}
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="premium-glass p-6 rounded-xl border-white/5 flex flex-col gap-2"
            >
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={13} className="text-[#A1A1AA] stroke-[1.5]" />
                <span className="text-[10px] uppercase tracking-widest text-[#71717A] font-semibold">What&apos;s getting better</span>
              </div>
              <p className="text-sm text-white/85 font-light leading-relaxed">
                {getBetter()}
              </p>
            </motion.section>
          </div>

          {/* CARD 4 — What to do next */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="w-full premium-glass p-6 md:p-7 rounded-2xl border-emerald-500/15 flex flex-col gap-2"
          >
            <div className="flex items-center gap-2 mb-1">
              <Zap size={13} className="text-emerald-400 stroke-[1.5]" />
              <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-semibold">What to do next</span>
            </div>
            <p className="text-base font-medium text-white/95 leading-relaxed">
              {getAction()}
            </p>
          </motion.section>

          {/* Write CTA */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24 }}
            className="mt-2"
          >
            <Link href="/reflect" className="no-underline block w-full">
              <motion.div
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                className="w-full premium-glass p-5 rounded-2xl border-white/5 hover:border-[#6EE7FF]/20 cursor-pointer flex justify-between items-center transition-all duration-300 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-white/[0.03] flex items-center justify-center border border-white/10 group-hover:border-[#6EE7FF]/25 transition-all duration-300">
                    <Sparkles size={13} className="text-[#6EE7FF]" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-white/95 block">Write a reflection</span>
                    <span className="text-[10px] text-[#71717A]">Takes 2 minutes</span>
                  </div>
                </div>
                <ArrowRight size={14} className="text-[#71717A] group-hover:text-[#6EE7FF] transition-colors duration-300" />
              </motion.div>
            </Link>
          </motion.div>

        </div>
      )}

      {/* Minimal footer */}
      {memory?.firstMemoryRecorded && (
        <footer className="text-center text-[9px] text-[#3F3F46] mt-2">
          Tracking since {memory.firstMemoryRecorded}
        </footer>
      )}

    </div>
  );
}
