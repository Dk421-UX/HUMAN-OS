'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowDown } from 'lucide-react';
import { api } from '@/utils/api';
import { formatDate } from '@/utils/format';

export default function JourneyPage() {
  const [timeline, setTimeline] = useState([]);
  const [patterns, setPatterns] = useState([]);
  const [memory, setMemory] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [t, p, m] = await Promise.all([
          api.getTimeline(),
          api.getPatterns(),
          api.getLongTermMemory()
        ]);
        setTimeline(Array.isArray(t) ? t : []);
        setPatterns(Array.isArray(p) ? p : []);
        setMemory(m);
      } catch {
        // show chapters with defaults
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const chapters = useMemo(() => {
    const firstEvent = timeline[timeline.length - 1];
    const latestEvent = timeline[0];
    const firstDate = firstEvent?.created_at ? formatDate(firstEvent.created_at) : null;
    const latestDate = latestEvent?.created_at ? formatDate(latestEvent.created_at) : null;

    const totalReflections = timeline.filter(t =>
      ['pattern_discovered', 'first_reflection', 'pattern_strengthened'].includes(t.type)
    ).length || 1;

    const hasCh2 = patterns.some(p => p.name === 'Perfectionism' || p.name === 'Avoidance') || totalReflections >= 2;
    const hasCh3 = patterns.some(p => ['Weakening', 'Resolved'].includes(p.trend)) || totalReflections >= 4;

    // One plain-English sentence per chapter — what happened, not what the system computed
    return [
      {
        id: 'ch-1',
        number: 'Chapter 1',
        title: 'The pattern appears',
        sentence: memory?.firstReflection
          ? `You noticed: "${memory.firstReflection.slice(0, 120)}${memory.firstReflection.length > 120 ? '…' : ''}"`
          : 'A repeating worry about judgment or failure started showing up in your thoughts.',
        dateRange: firstDate ? `From ${firstDate}` : 'Your first reflection',
        active: true
      },
      {
        id: 'ch-2',
        number: 'Chapter 2',
        title: 'The pattern becomes a habit',
        sentence: 'High standards and preparation became your go-to protection. The more important the task, the harder it was to start.',
        dateRange: firstDate && latestDate ? `${firstDate} – ${latestDate}` : 'As your reflections grew',
        active: hasCh2
      },
      {
        id: 'ch-3',
        number: 'Chapter 3',
        title: 'You start to see it happening',
        sentence: memory?.recentShift && memory.recentShift !== 'None'
          ? memory.recentShift
          : 'You began noticing the pattern while it was happening — not just after. That awareness is the beginning of change.',
        dateRange: latestDate ? `Around ${latestDate}` : 'Recently',
        active: hasCh3
      }
    ];
  }, [timeline, patterns, memory]);

  return (
    <div className="w-full flex flex-col gap-6 py-4 pb-28 md:py-6">

      {/* Header */}
      <header className="flex flex-col gap-1 px-1 md:px-0">
        <h1 className="font-serif text-3xl md:text-4xl font-light text-white">How you&apos;ve changed</h1>
        <p className="text-sm text-[#A1A1AA] font-light leading-relaxed">
          The story of your patterns — where they started, how they grew, and where things stand now.
        </p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border border-white/5 border-t-[#6EE7FF] animate-spin" />
        </div>
      ) : (
        <div className="flex flex-col gap-2 relative max-w-xl">

          {/* Vertical connector line */}
          <div className="absolute left-5 top-10 bottom-10 w-px bg-white/[0.05] pointer-events-none hidden sm:block" />

          {chapters.map((ch, idx) => (
            <div key={ch.id} className="flex flex-col">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`premium-glass p-6 rounded-2xl border-white/5 flex gap-5 relative ${
                  ch.active ? 'opacity-100' : 'opacity-35 select-none pointer-events-none'
                }`}
              >
                {/* Left: chapter number + dot */}
                <div className="flex flex-col items-center gap-2 shrink-0 pt-0.5">
                  <div className={`w-2.5 h-2.5 rounded-full border-2 ${
                    ch.active
                      ? 'bg-[#6EE7FF] border-[#6EE7FF] shadow-[0_0_8px_rgba(110,231,255,0.6)]'
                      : 'bg-transparent border-white/20'
                  }`} />
                </div>

                {/* Right: content */}
                <div className="flex flex-col gap-2 flex-1">
                  <div className="flex items-baseline justify-between gap-3 flex-wrap">
                    <span className="text-[9px] uppercase tracking-widest text-[#71717A] font-semibold">
                      {ch.number}
                    </span>
                    <span className="text-[9px] text-[#71717A]">
                      {ch.active ? ch.dateRange : 'Not yet'}
                    </span>
                  </div>

                  <h2 className="text-base font-semibold text-white/90">
                    {ch.title}
                  </h2>

                  <p className="text-sm text-[#A1A1AA] font-light leading-relaxed">
                    {ch.active
                      ? ch.sentence
                      : 'This chapter will form as you write more reflections.'}
                  </p>
                </div>
              </motion.div>

              {idx < chapters.length - 1 && (
                <div className="flex justify-start sm:justify-center py-1.5 pl-4 sm:pl-0">
                  <ArrowDown size={12} className="text-white/10" />
                </div>
              )}
            </div>
          ))}

          {/* Empty state — no timeline data at all */}
          {timeline.length === 0 && !loading && (
            <p className="text-xs text-[#71717A] font-light text-center mt-4 italic">
              Write a few reflections and your journey will start taking shape here.
            </p>
          )}

        </div>
      )}
    </div>
  );
}
