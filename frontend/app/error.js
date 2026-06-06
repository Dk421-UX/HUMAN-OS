'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';

export default function Error({ reset }) {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center px-4">
      <div className="premium-glass flex w-full max-w-md flex-col items-center gap-5 rounded-2xl p-8 text-center">
        <AlertCircle size={34} className="text-red-400" />
        <div>
          <h2 className="text-lg font-medium text-white">System Interrupted</h2>
          <p className="mt-2 text-sm font-light leading-relaxed text-[#A1A1AA]">
            Human OS could not render this view cleanly. The current memory state is still preserved.
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="flex min-h-11 items-center gap-2 rounded-full bg-white px-5 py-2 text-xs font-semibold text-black transition hover:bg-neutral-200"
        >
          <RefreshCw size={14} />
          Retry
        </button>
      </div>
    </div>
  );
}
