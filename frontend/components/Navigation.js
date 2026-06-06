'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Sparkles, Dna, FolderLock, History, Eye } from 'lucide-react';

const navItems = [
  { path: '/', label: 'Today', icon: Eye },
  { path: '/reflect', label: 'Write', icon: Sparkles },
  { path: '/dna', label: 'Understand', icon: Dna },
  { path: '/vault', label: 'History', icon: FolderLock },
  { path: '/timeline', label: 'Journey', icon: History }
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-0 right-0 z-50 flex justify-center px-3 sm:px-4 pointer-events-none">
      <motion.nav 
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 25 }}
        aria-label="Primary navigation"
        className="pointer-events-auto flex max-w-[calc(100vw-1rem)] items-center gap-1 sm:gap-2 overflow-x-auto rounded-full border-white/5 bg-[#0F1115]/80 px-2 py-2 shadow-[0_16px_40px_rgba(0,0,0,0.9)] premium-glass sm:px-3"
      >
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          const Icon = item.icon;

          return (
            <Link key={item.path} href={item.path} className="relative no-underline" aria-current={isActive ? 'page' : undefined}>
              <motion.div
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className={`relative flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full px-3 py-2 text-xs font-medium transition-colors duration-300 cursor-pointer sm:px-4 ${
                  isActive ? 'text-white' : 'text-[#71717A] hover:text-[#A1A1AA]'
                }`}
              >
                {/* Active selection pill with subtle glow */}
                {isActive && (
                  <motion.div
                    layoutId="active-pill"
                    className="absolute inset-0 bg-white/[0.03] border border-white/10 shadow-[0_0_12px_rgba(110,231,255,0.05)] rounded-full -z-10"
                    transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                  />
                )}
                
                <Icon 
                  size={15} 
                  className={`stroke-[1.5] transition-all duration-300 ${
                    isActive ? 'stroke-[#6EE7FF] drop-shadow-[0_0_4px_rgba(110,231,255,0.4)]' : 'stroke-[#71717A]'
                  }`} 
                />
                <span className="hidden sm:inline tracking-widest uppercase text-[10px] font-medium">
                  {item.label}
                </span>
              </motion.div>
            </Link>
          );
        })}
      </motion.nav>
    </div>
  );
}
