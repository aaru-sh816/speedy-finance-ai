"use client"

import Link from "next/link"
import { MainNav } from "@/components/main-nav"

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 backdrop-blur border-b">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <MainNav />
          <div className="hidden md:flex items-center gap-3">
            <Link href="/announcements" className="rounded-full px-4 py-2 border hover:bg-foreground/5 transition">
              Announcements
            </Link>
            <Link href="/screener" className="rounded-full px-4 py-2 border hover:bg-foreground/5 transition">
              Screener
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-12">
        <section className="grid gap-6 md:grid-cols-2 items-center">
          <div className="space-y-6">
            <h1 className="text-4xl md:text-6xl font-semibold tracking-tight">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 via-blue-600 to-zinc-900 dark:from-zinc-100 dark:via-cyan-400 dark:to-zinc-100">
                Speedy Finance AI
              </span>
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400 max-w-xl">
              Minimal. Futuristic. Real-time insight. Explore AI-summarized market announcements, advanced filters, and a consolidated view that outperforms traditional screeners.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/announcements" className="rounded-full px-5 py-2.5 bg-foreground text-background hover:opacity-90 transition">
                Open Announcements
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border p-6 bg-gradient-to-b from-transparent to-foreground/[0.03]">
              <p className="text-sm text-zinc-500">AI Signals (24h)</p>
              <p className="mt-2 text-3xl font-semibold">+128</p>
              <p className="text-xs text-emerald-500">+12% vs prev</p>
            </div>
            <div className="rounded-2xl border p-6 bg-gradient-to-b from-transparent to-foreground/[0.03]">
              <p className="text-sm text-zinc-500">High-Impact News</p>
              <p className="mt-2 text-3xl font-semibold">37</p>
              <p className="text-xs text-rose-500">Most: Tech</p>
            </div>
            <div className="rounded-2xl border p-6 bg-gradient-to-b from-transparent to-foreground/[0.03]">
              <p className="text-sm text-zinc-500">Coverage</p>
              <p className="mt-2 text-3xl font-semibold">4,200+</p>
              <p className="text-xs text-zinc-500">tickers</p>
            </div>
            <div className="rounded-2xl border p-6 bg-gradient-to-b from-transparent to-foreground/[0.03]">
              <p className="text-sm text-zinc-500">Last Sync</p>
              <p className="mt-2 text-3xl font-semibold">4m ago</p>
              <p className="text-xs text-zinc-500">live</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
