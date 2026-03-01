"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { FeyNav } from "@/components/fey/FeyNav"
import { PortfolioOnboarding } from "@/components/portfolio/portfolio-onboarding"
import { PortfolioDashboard } from "@/components/portfolio/portfolio-dashboard"
import { getPortfolio, getHoldings } from "@/lib/portfolio"

export default function PortfolioPage() {
  const router = useRouter()
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null)

  useEffect(() => {
    const p = getPortfolio()
    const h = getHoldings()
    const needsOnboarding = !p
    setShowOnboarding(needsOnboarding)
  }, [])

  const handleOnboardingComplete = () => {
    setShowOnboarding(false)
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-black text-white selection:bg-cyan-500/30">
      <FeyNav />
      <main className="pt-28 pb-24 px-4 md:px-6 max-w-6xl mx-auto">
        {showOnboarding === null && (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-cyan-500/50 border-t-cyan-400 animate-spin" />
          </div>
        )}
        {showOnboarding === true && (
          <PortfolioOnboarding onComplete={handleOnboardingComplete} />
        )}
        {showOnboarding === false && (
          <PortfolioDashboard />
        )}
      </main>
    </div>
  )
}
