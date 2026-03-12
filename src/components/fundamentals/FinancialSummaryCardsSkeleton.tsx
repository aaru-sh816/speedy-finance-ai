"use client"

export function FinancialSummaryCardsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-1">
        <div className="h-4 w-32 rounded bg-zinc-800/60 animate-pulse" />
        <div className="h-8 w-24 rounded-lg bg-zinc-800/60 animate-pulse" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/5 border border-white/5 rounded-3xl overflow-hidden">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="bg-zinc-950/80 p-6 flex flex-col justify-between min-h-[240px]"
          >
            <div className="space-y-4">
              <div className="flex justify-between">
                <div className="h-3 w-24 rounded bg-zinc-800/60 animate-pulse" />
                <div className="h-5 w-12 rounded-full bg-zinc-800/60 animate-pulse" />
              </div>
              <div className="h-9 w-32 rounded bg-zinc-800/60 animate-pulse" />
              <div className="flex gap-4">
                <div className="h-3 w-14 rounded bg-zinc-800/60 animate-pulse" />
                <div className="h-3 w-14 rounded bg-zinc-800/60 animate-pulse" />
              </div>
              <div className="h-3 w-16 rounded bg-zinc-800/40 animate-pulse" />
            </div>
            <div className="mt-6 h-[100px] w-full rounded bg-zinc-800/40 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
