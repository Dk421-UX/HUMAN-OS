import { Sparkles } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-6 text-center">
      <div className="relative flex h-20 w-20 items-center justify-center">
        <div className="absolute inset-0 rounded-full border border-white/5" />
        <div className="absolute inset-0 animate-spin rounded-full border-t border-[#6EE7FF]" />
        <Sparkles size={20} className="text-[#6EE7FF]" />
      </div>
      <p className="text-xs font-medium uppercase text-[#A1A1AA]">
        Retrieving psychological memory...
      </p>
    </div>
  );
}
