# Ultimate Stock Research Notes System

## Requirements

Transform the existing Apple Notes clone into **the most advanced stock research notes system on the planet** - a world-class research tool that no competitor has, deeply integrated with BSE announcements, live price feeds, and AI-powered insights.

**Core Vision**: A three-pane Apple Notes-style interface specifically designed for equity research, where every note is automatically enriched with stock context, live P&L tracking, and seamless announcement linking.

---

## Key Features That Make This Unmatchable

### 1. Live Price Integration & P&L Tracking
- Every note auto-captures the stock price at creation
- Real-time P&L display: "You wrote this at ₹450. Stock is now ₹520 (+15.5%)"
- Price target vs current price progress indicator
- Stop-loss breach alerts within notes

### 2. Stock-Aware Editor
- Type `$RELIANCE` and see an inline live price badge auto-inserted
- Autocomplete for stock tickers with company names
- Smart detection of price mentions and formatting

### 3. Announcement-to-Note Pipeline
- One-click "Add Research Note" from any BSE announcement
- Auto-populates with announcement headline, PDF summary, and current price
- Links notes to specific announcements for context

### 4. Thesis Tracker & Scorecard
- Track prediction accuracy: "65% of your bullish calls were correct"
- Win/loss ratio dashboard
- P&L attribution per thesis
- Historical accuracy trends

### 5. Smart Stock Folders
- Auto-organize notes by watchlist/portfolio
- "Trading Ideas" folder for active theses
- "Closed Positions" for historical research
- Custom folders per sector

### 6. Cross-Stock Research Graph
- Link related research across companies
- "Company A supplies to Company B" relationship mapping
- Visual knowledge graph of your research

### 7. Voice Notes via PersonaPlex
- Speak your thesis, auto-transcribed with stock context
- Voice Oracle integration directly in editor

### 8. AI-Powered Enrichment
- Auto-summarize BSE announcements into notes
- Smart tagging based on content
- Sentiment analysis of your own notes

### 9. Chart Annotations
- Link notes to specific price points on charts
- Visual markers showing where you wrote each note
- Mini chart preview in note list

### 10. Export & Collaboration
- Export as professional PDF research reports
- Share individual theses as links
- Team collaboration ready

---

## Implementation Phases

### Phase 1: Merge Data Layers (Stock-Aware Notes)
1. Extend `Note` interface in `notes-types.ts` with stock research fields:
   - `scripCode: string | null`
   - `symbol: string | null`
   - `companyName: string | null`
   - `priceAtCreation: number | null`
   - `currentPrice: number | null` (calculated)
   - `sentiment: 'bullish' | 'bearish' | 'neutral' | null`
   - `priceTarget: number | null`
   - `stopLoss: number | null`
   - `timeframe: 'short' | 'medium' | 'long' | null`
   - `confidence: 1 | 2 | 3 | 4 | 5 | null`
   - `announcementId: string | null`
   - `announcementHeadline: string | null`
   - `thesisStatus: 'active' | 'won' | 'lost' | 'expired' | null`
   - `closedAt: number | null`
   - `closedPrice: number | null`
   - `linkedNotes: string[]`
2. Create migration function to convert existing Apple Notes data
3. Add stock research fields to `createNote` function
4. Build `useStockResearchNotes` hook extending `useNotes`

### Phase 2: Stock-Aware Folder System
5. Replace generic folders with stock-aware folders:
   - "All Notes" (system)
   - "Trading Ideas" (active bullish/bearish theses)
   - "Watchlist Research" (notes on watchlist stocks)
   - "Closed Positions" (historical research)
   - "Favorites" (pinned)
   - "Recently Deleted" (trash)
6. Add auto-folders that group by stock symbol
7. Add sector-based auto-folders (IT, Pharma, Banking, etc.)
8. Create custom folder creation with stock linking

### Phase 3: Live Price Integration
9. Create `useLivePrice` hook that fetches quotes for notes
10. Add `PriceAtCreationBadge` component showing price when note was created
11. Add `LivePriceBadge` component showing current price
12. Add `PLBadge` component calculating and displaying P&L
13. Integrate quote provider from `src/lib/quotes/provider.ts`
14. Add price refresh interval (30 seconds) for active notes
15. Show price change direction with color coding

### Phase 4: Stock-Aware Editor Enhancements
16. Build `StockMention` inline component for `$TICKER` syntax
17. Add stock ticker autocomplete dropdown in editor
18. Parse editor content for `$SYMBOL` patterns
19. Render inline price badges for mentioned stocks
20. Add "Insert Stock Reference" button in toolbar
21. Create `StockContextPanel` sidebar showing note's stock info
22. Add live mini-chart in editor sidebar

### Phase 5: Announcement Integration
23. Add "Create Note from Announcement" button on `/announcements` page
24. Build `createNoteFromAnnouncement` function
25. Auto-populate note with:
    - Announcement headline as title
    - AI summary as initial content (if available)
    - Stock info pre-filled
    - Announcement ID linked
26. Add "Linked Announcement" badge in note card
27. Create "View Announcement" link that opens original BSE filing
28. Show announcement context in editor sidebar

### Phase 6: Enhanced Notes List
29. Add stock symbol badge to each note card
30. Show P&L indicator (green/red) on each card
31. Add sentiment indicator (bull/bear/neutral icons)
32. Add confidence stars display
33. Add price target progress bar
34. Show mini sparkline chart per note (optional)
35. Group notes by stock with collapsible sections
36. Add "filter by stock" quick filter

### Phase 7: Thesis Tracker Dashboard
37. Create `ThesisTracker` component for notes page header
38. Calculate thesis accuracy: (won / (won + lost)) * 100
39. Show total P&L from all closed theses
40. Display win/loss ratio with visual bar
41. Add "Best Calls" and "Worst Calls" highlights
42. Create timeline view of thesis performance
43. Add export of thesis history

### Phase 8: Research Templates (Stock-Specific)
44. Create stock research templates:
    - "Earnings Analysis" (Q results breakdown)
    - "Technical Setup" (chart patterns, levels)
    - "Fundamental Deep Dive" (business model, moats)
    - "News Impact Analysis" (event-driven)
    - "Management Update" (AGM notes, guidance)
    - "Sector Overview" (industry thesis)
45. Auto-fill templates with stock data
46. Add template picker in note creation flow

### Phase 9: Search & Filtering Enhancements
47. Add stock symbol search/filter
48. Add sentiment filter (bullish/bearish/neutral)
49. Add date range filter
50. Add P&L range filter ("show only +10% winners")
51. Add thesis status filter (active/won/lost)
52. Add confidence level filter
53. Implement semantic search across research content

### Phase 10: Cross-Note Linking
54. Add "Link to Related Research" button in editor
55. Build note linking modal with search
56. Show "Related Notes" section in editor sidebar
57. Create visual relationship indicator
58. Add "Research Trail" breadcrumb navigation

### Phase 11: Chart Integration
59. Add "Annotate on Chart" feature
60. Show note markers on `LightweightChart`
61. Click marker to open associated note
62. Add "Chart Snapshot" capture in notes
63. Store chart image at note creation time

### Phase 12: Voice Notes Integration
64. Add microphone button in editor toolbar
65. Connect to PersonaPlex for transcription
66. Auto-tag voice notes with #voice-note
67. Show transcription with edit capability
68. Add playback of original audio (if stored)

### Phase 13: AI Enrichment
69. Add "AI Summarize" button for long notes
70. Auto-generate tags based on content
71. Sentiment analysis of note content
72. Suggest related announcements
73. Auto-detect and link mentioned stocks

### Phase 14: Export & Reporting
74. Create "Export as Research Report" (PDF)
75. Include charts, price data, and formatting
76. Add "Share Thesis" with unique link
77. Create "Portfolio Research Summary" export
78. Add print-optimized styling

### Phase 15: Mobile Optimization
79. Optimize stock badges for mobile
80. Add swipe to mark thesis won/lost
81. Quick-add note from announcement on mobile
82. Voice note button prominent on mobile
83. Responsive chart annotations

### Phase 16: Performance & Polish
84. Implement virtualized list for large note collections
85. Add skeleton loading for price data
86. Optimize re-renders with proper memoization
87. Add offline support with sync queue
88. Final visual polish matching Apple aesthetic

---

## Technical Architecture

### Extended Data Schema
```typescript
// Enhanced Note interface for stock research
interface StockResearchNote extends Note {
  // Stock context
  scripCode: string | null
  symbol: string | null
  companyName: string | null
  
  // Price tracking
  priceAtCreation: number | null
  priceTarget: number | null
  stopLoss: number | null
  
  // Research metadata
  sentiment: 'bullish' | 'bearish' | 'neutral' | null
  timeframe: 'short' | 'medium' | 'long' | null
  confidence: 1 | 2 | 3 | 4 | 5 | null
  template: 'earnings' | 'technical' | 'fundamental' | 'news' | 'management' | 'sector' | 'custom'
  
  // Announcement linking
  announcementId: string | null
  announcementHeadline: string | null
  announcementDate: string | null
  
  // Thesis tracking
  thesisStatus: 'active' | 'won' | 'lost' | 'expired' | null
  closedAt: number | null
  closedPrice: number | null
  closedReason: string | null
  
  // Cross-linking
  linkedNotes: string[]
  linkedStocks: string[] // Other stocks mentioned
  
  // Voice notes
  audioUrl: string | null
  transcription: string | null
}

// Stock-aware folder
interface StockFolder extends Folder {
  linkedScripCode: string | null  // Auto-folder for a specific stock
  linkedSector: string | null      // Auto-folder for a sector
  folderType: 'custom' | 'stock' | 'sector' | 'system'
}

// Thesis performance tracking
interface ThesisPerformance {
  totalTheses: number
  activeTheses: number
  closedTheses: number
  wonTheses: number
  lostTheses: number
  expiredTheses: number
  winRate: number
  totalPnL: number
  averagePnL: number
  bestCall: { noteId: string; pnl: number } | null
  worstCall: { noteId: string; pnl: number } | null
}
```

### New Components
```
src/components/notes/
├── StockNotesPage.tsx          # Main page with thesis tracker
├── StockNoteEditor.tsx         # Enhanced editor with stock features
├── StockNoteCard.tsx           # Card with P&L, sentiment badges
├── StockMention.tsx            # Inline $TICKER component
├── PriceTracker.tsx            # Price at creation vs current
├── ThesisTracker.tsx           # Win/loss dashboard
├── AnnouncementLink.tsx        # Linked announcement badge
├── StockContextPanel.tsx       # Sidebar with stock info
├── StockFolderTree.tsx         # Enhanced folder navigation
├── ResearchTemplates.tsx       # Template picker
├── ThesisStatusBadge.tsx       # Active/Won/Lost badge
└── ChartAnnotation.tsx         # Note markers on chart
```

### Integration Points
- `/api/bse/quote/route.ts` - Live price fetching
- `src/lib/quotes/provider.ts` - Quote caching
- `src/app/announcements/page.tsx` - "Create Note" button
- `src/components/lightweight-chart.tsx` - Note annotations
- `python-services/personaplex_server.py` - Voice transcription

---

## Critical Files to Modify

| File | Changes |
|------|---------|
| `src/lib/notes-types.ts` | Extend Note interface with stock fields |
| `src/lib/notes-storage.ts` | Add stock-aware CRUD operations |
| `src/hooks/useNotes.ts` | Add thesis tracking, price fetching |
| `src/app/apple-notes/page.tsx` | Transform into stock research hub |
| `src/components/notes/NoteEditor.tsx` | Add stock toolbar, mentions |
| `src/components/notes/NotesList.tsx` | Add P&L badges, stock filters |
| `src/components/notes/NotesSidebar.tsx` | Add stock/sector folders |
| `src/app/announcements/page.tsx` | Add "Create Note" button |
| `src/app/globals.css` | Add stock research CSS variables |

---

## What Makes This "Best on Planet"

1. **No Competitor Has This**: Traditional note apps don't understand stock context. Trading platforms don't have rich note-taking. This bridges both worlds.

2. **Live P&L In Notes**: See how your thesis is performing in real-time, right inside the note.

3. **Announcement-to-Note Pipeline**: One-click capture of BSE filings with AI summaries.

4. **Thesis Scorecard**: Track your prediction accuracy like a professional fund manager.

5. **Voice Research**: Speak your analysis on the go, auto-linked to stocks.

6. **Cross-Stock Linking**: Build a knowledge graph of your research.

7. **Chart Annotations**: Visual markers showing exactly when you made each call.

8. **Beautiful Apple-Style UI**: Premium experience, not a boring data table.

---

## Success Metrics

- [ ] Every note can be linked to a stock with live price tracking
- [ ] P&L calculation accurate and real-time
- [ ] One-click note creation from announcements
- [ ] Thesis accuracy dashboard shows meaningful insights
- [ ] Voice notes work seamlessly with PersonaPlex
- [ ] $TICKER mentions render live price badges
- [ ] Export generates professional PDF reports
- [ ] Mobile experience is touch-optimized
- [ ] Performance remains smooth with 1000+ notes

---

## Risks & Mitigations

1. **Quote API Rate Limits**
   - Mitigation: Use existing 45s cache, batch requests

2. **Performance with Many Live Prices**
   - Mitigation: Only fetch prices for visible notes, use virtualization

3. **Complex Data Migration**
   - Mitigation: Keep backward compatibility, migrate on first load

4. **Voice Integration Complexity**
   - Mitigation: Make it optional, graceful fallback

---

## Priority Order

**Must Have (Phase 1-6)**: Core stock integration, live prices, P&L tracking, announcement linking
**Should Have (Phase 7-10)**: Thesis tracker, templates, cross-linking
**Nice to Have (Phase 11-16)**: Chart annotations, voice notes, AI enrichment
