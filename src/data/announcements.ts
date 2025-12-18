export type Impact = "high" | "medium" | "low"

export type Announcement = {
  id: string
  ticker: string
  company: string
  title: string
  summary: string
  impact: Impact
  sector: string
  time: string // ISO string
  sentiment: number // -1 to 1
  source: string
  tags: string[]
}

export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: "1",
    ticker: "AAPL",
    company: "Apple Inc.",
    title: "Q4 beats with strong Services growth",
    summary:
      "Revenue surpasses expectations led by double-digit Services growth; iPhone stable; guidance indicates margin expansion.",
    impact: "high",
    sector: "Technology",
    time: "2025-11-26T13:20:00Z",
    sentiment: 0.72,
    source: "Earnings",
    tags: ["earnings", "guidance", "services"],
  },
  {
    id: "2",
    ticker: "MSFT",
    company: "Microsoft Corporation",
    title: "Azure AI demand accelerates",
    summary:
      "Azure reported accelerating growth driven by AI workloads; Copilot adoption broadens across enterprise suites.",
    impact: "high",
    sector: "Technology",
    time: "2025-11-26T11:05:00Z",
    sentiment: 0.68,
    source: "Press Release",
    tags: ["ai", "cloud", "copilot"],
  },
  {
    id: "3",
    ticker: "NVDA",
    company: "NVIDIA Corporation",
    title: "Next-gen GPUs announced",
    summary:
      "Unveils new data-center GPUs with improved throughput and energy efficiency; major hyperscalers announced early commitments.",
    impact: "high",
    sector: "Semiconductors",
    time: "2025-11-25T19:00:00Z",
    sentiment: 0.64,
    source: "Event",
    tags: ["gpu", "datacenter", "hyperscaler"],
  },
  {
    id: "4",
    ticker: "TSLA",
    company: "Tesla, Inc.",
    title: "Production update and margin focus",
    summary:
      "Company reiterates production targets; emphasizes cost optimization and software margin expansion opportunities.",
    impact: "medium",
    sector: "Automotive",
    time: "2025-11-26T08:40:00Z",
    sentiment: 0.31,
    source: "Update",
    tags: ["production", "margins", "software"],
  },
  {
    id: "5",
    ticker: "AMZN",
    company: "Amazon.com, Inc.",
    title: "Retail sales beat; AWS steady",
    summary:
      "Stronger retail comps drive upside; AWS steady with improving new logo pipeline; cost discipline remains a priority.",
    impact: "medium",
    sector: "Consumer Discretionary",
    time: "2025-11-24T16:15:00Z",
    sentiment: 0.44,
    source: "Earnings",
    tags: ["retail", "aws", "costs"],
  },
  {
    id: "6",
    ticker: "JPM",
    company: "JPMorgan Chase & Co.",
    title: "NIM outlook and credit quality stable",
    summary:
      "Net interest margin outlook stable; credit metrics within expectations; capital returns continue.",
    impact: "low",
    sector: "Financials",
    time: "2025-11-26T10:10:00Z",
    sentiment: 0.18,
    source: "Update",
    tags: ["nim", "credit", "capital-returns"],
  },
  {
    id: "7",
    ticker: "AAPL",
    company: "Apple Inc.",
    title: "AI features rollout timeline",
    summary:
      "Announces phased rollout of on-device AI features improving privacy and latency across flagship products.",
    impact: "medium",
    sector: "Technology",
    time: "2025-11-26T14:05:00Z",
    sentiment: 0.53,
    source: "Press Release",
    tags: ["ai", "privacy", "devices"],
  },
  {
    id: "8",
    ticker: "XOM",
    company: "Exxon Mobil Corporation",
    title: "Capex plan updated; focus on LNG",
    summary:
      "Revised capex prioritizing LNG projects; operational efficiency initiatives to improve free cash flow.",
    impact: "medium",
    sector: "Energy",
    time: "2025-11-23T12:50:00Z",
    sentiment: 0.22,
    source: "Investor Day",
    tags: ["lng", "capex", "fcf"],
  },
  {
    id: "9",
    ticker: "PFE",
    company: "Pfizer Inc.",
    title: "Pipeline update: late-stage trial",
    summary:
      "Reports positive top-line results for a late-stage trial; regulatory submission expected next quarter.",
    impact: "high",
    sector: "Healthcare",
    time: "2025-11-26T09:25:00Z",
    sentiment: 0.6,
    source: "Clinical",
    tags: ["trial", "regulatory", "pipeline"],
  },
  {
    id: "10",
    ticker: "GOOGL",
    company: "Alphabet Inc.",
    title: "Search updates and ad efficiency",
    summary:
      "Introduces new search features; ad platform improvements drive higher ROI for advertisers.",
    impact: "medium",
    sector: "Technology",
    time: "2025-11-25T21:30:00Z",
    sentiment: 0.4,
    source: "Blog",
    tags: ["search", "ads", "roi"],
  },
  {
    id: "11",
    ticker: "TSLA",
    company: "Tesla, Inc.",
    title: "Energy storage deployments hit record",
    summary:
      "Megapack deployments reach new high; recurring software revenues from fleet continue to scale.",
    impact: "high",
    sector: "Automotive",
    time: "2025-11-25T07:10:00Z",
    sentiment: 0.55,
    source: "Update",
    tags: ["storage", "software", "deployments"],
  },
  {
    id: "12",
    ticker: "NFLX",
    company: "Netflix, Inc.",
    title: "Ad tier penetration increases",
    summary:
      "Ad-supported tier grows faster than expected, improving ARPU and engagement in key markets.",
    impact: "medium",
    sector: "Communication Services",
    time: "2025-11-22T18:45:00Z",
    sentiment: 0.35,
    source: "Earnings",
    tags: ["ads", "arpu", "engagement"],
  },
  {
    id: "13",
    ticker: "MSFT",
    company: "Microsoft Corporation",
    title: "Copilot for SMB launches globally",
    summary:
      "Extends Copilot to SMB segment with simplified onboarding; ecosystem partners integrated at launch.",
    impact: "medium",
    sector: "Technology",
    time: "2025-11-26T15:25:00Z",
    sentiment: 0.48,
    source: "Press Release",
    tags: ["copilot", "smb", "partners"],
  },
  {
    id: "14",
    ticker: "AAPL",
    company: "Apple Inc.",
    title: "Supply chain resilience update",
    summary:
      "Highlights resilient supply chain and diversification; expects improved lead times heading into holiday.",
    impact: "low",
    sector: "Technology",
    time: "2025-11-24T14:30:00Z",
    sentiment: 0.2,
    source: "Update",
    tags: ["supply-chain", "lead-times", "holiday"],
  },
  {
    id: "15",
    ticker: "META",
    company: "Meta Platforms, Inc.",
    title: "AI infra efficiency gains",
    summary:
      "Improved inference efficiency reduces cost per query; Reels monetization trends remain constructive.",
    impact: "medium",
    sector: "Communication Services",
    time: "2025-11-26T06:05:00Z",
    sentiment: 0.33,
    source: "Update",
    tags: ["ai", "infrastructure", "reels"],
  },
]
